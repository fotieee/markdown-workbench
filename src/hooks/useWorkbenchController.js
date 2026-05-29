import { useEffect, useRef, useState } from 'react';
import {
  DOCUMENT_WIDTH,
  EMPTY_SEARCH_STATE,
  EXPLORER_WIDTH_SETTING,
  FONT_SIZE_SETTING,
  SEARCH_SCOPE,
  THEME_MODE,
  VIEW_MODE
} from '../appConstants';
import {
  useActiveHeading,
  useAutoRefreshDocuments,
  useDocumentOutline,
  useFocusSearchInput,
  useMarkdownImageStatus,
  useOpenExternalLinks,
  useRenderedMarkdown,
  useRestoreEditorScroll,
  useSearchResultScroller,
  useSearchShortcuts,
  useSyncNativeTheme
} from './useWorkbenchHooks';
import {
  clampExplorerWidth,
  clampFontSize,
  findFirstFilePath,
  getNextSearchIndex,
  hasDocumentChanged,
  mergeRefreshedDocuments,
  normalizeDocumentWidth,
  readExistingDocuments,
  readSavedSession,
  resolveNextActivePath,
  resolveRestoredActivePath,
  saveSession,
  scrollHeadingIntoEditor,
  scrollToPendingSearchTarget,
  searchDocument,
  upsertDocument
} from '../utils/workbenchUtils';

export function useWorkbenchController() {
  const [workspace, setWorkspace] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activePath, setActivePath] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_WIDTH_SETTING.defaultValue);
  const [expandedFolderPaths, setExpandedFolderPaths] = useState(new Set());
  const [viewMode, setViewMode] = useState(VIEW_MODE.preview);
  const [theme, setTheme] = useState(THEME_MODE.dark);
  const [fontSize, setFontSize] = useState(FONT_SIZE_SETTING.defaultValue);
  const [documentWidth, setDocumentWidth] = useState(DOCUMENT_WIDTH.normal);
  const [searchState, setSearchState] = useState(EMPTY_SEARCH_STATE);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const editorContentRef = useRef(null);
  const searchInputRef = useRef(null);
  const pendingSearchTargetRef = useRef(null);
  const documentScrollPositions = useRef({});

  const activeDocument = documents.find((documentItem) => documentItem.path === activePath) || null;
  const renderedMarkdown = useRenderedMarkdown(activeDocument);
  const documentOutline = useDocumentOutline(renderedMarkdown);
  const activeHeadingId = useActiveHeading(documentOutline, editorContentRef, viewMode, activePath);

  useRestoreEditorScroll(activePath, editorContentRef, documentScrollPositions);
  useSyncNativeTheme(theme);
  useOpenExternalLinks();
  useMarkdownImageStatus(editorContentRef, renderedMarkdown);
  useFocusSearchInput(searchState.isOpen, searchInputRef);
  useSearchResultScroller(pendingSearchTargetRef, activePath, activeDocument, renderedMarkdown, viewMode, editorContentRef);
  useAutoRefreshDocuments(documents, updateDocumentsFromDisk);
  useSearchShortcuts(openSearchPanel, closeSearchPanel, searchState.isOpen);
  useEffect(() => {
    if (!window.markdownApi?.onMenuCommand) return undefined;
    return window.markdownApi.onMenuCommand(handleMenuCommand);
  }, [activePath, documents]);
  useEffect(() => {
    restoreLastSession();
  }, []);

  useEffect(() => {
    if (!hasRestoredSession) return;

    saveSession({
      workspacePath: workspace?.path || '',
      documentPaths: documents.map((documentItem) => documentItem.path),
      activePath,
      theme,
      viewMode,
      fontSize,
      documentWidth,
      isExplorerCollapsed,
      explorerWidth,
      expandedFolderPaths: Array.from(expandedFolderPaths)
    });
  }, [workspace, documents, activePath, theme, viewMode, fontSize, documentWidth, isExplorerCollapsed, explorerWidth, expandedFolderPaths, hasRestoredSession]);

  /**
   * 执行异步操作并统一处理加载、状态和错误。
   * @param {string} loadingMessage 加载中的状态文案。
   * @param {Function} taskCallback 需要执行的异步任务。
   * @returns {Promise<void>}
   */
  async function runTask(loadingMessage, taskCallback) {
    setIsLoading(true);
    setStatus(loadingMessage);
    setError('');

    try {
      await taskCallback();
    } catch (taskError) {
      setError(taskError.message || '操作失败，请重试');
      setStatus('');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * 从本地存储恢复上次打开的工作区和文档标签。
   * @param {void} 无参数。
   * @returns {Promise<void>}
   */
  async function restoreLastSession() {
    const savedSession = readSavedSession();

    if (!savedSession) {
      setHasRestoredSession(true);
      return;
    }

    await runTask('正在恢复上次会话...', async () => {
      await restoreWorkspace(savedSession);
      await restoreDocuments(savedSession);
      restoreViewState(savedSession);
    });

    setHasRestoredSession(true);
  }

  /**
   * 恢复上次打开的工作区。
   * @param {object} savedSession 本地保存的会话数据。
   * @returns {Promise<void>}
   */
  async function restoreWorkspace(savedSession) {
    if (!savedSession.workspacePath) return;

    const restoredWorkspace = await window.markdownApi.readFolderPath(savedSession.workspacePath);
    setWorkspace(restoredWorkspace);
  }

  /**
   * 恢复上次打开的文档标签。
   * @param {object} savedSession 本地保存的会话数据。
   * @returns {Promise<void>}
   */
  async function restoreDocuments(savedSession) {
    const restoredDocuments = await readExistingDocuments(savedSession.documentPaths || []);

    setDocuments(restoredDocuments);
    setActivePath(resolveRestoredActivePath(savedSession.activePath, restoredDocuments));
  }

  /**
   * 恢复主题、查看模式、文件栏状态和展开目录。
   * @param {object} savedSession 本地保存的会话数据。
   * @returns {void}
   */
  function restoreViewState(savedSession) {
    setTheme(savedSession.theme === THEME_MODE.light ? THEME_MODE.light : THEME_MODE.dark);
    setViewMode(savedSession.viewMode === VIEW_MODE.source ? VIEW_MODE.source : VIEW_MODE.preview);
    setFontSize(clampFontSize(savedSession.fontSize));
    setDocumentWidth(normalizeDocumentWidth(savedSession.documentWidth));
    setIsExplorerCollapsed(Boolean(savedSession.isExplorerCollapsed));
    setExplorerWidth(clampExplorerWidth(savedSession.explorerWidth));
    setExpandedFolderPaths(new Set(savedSession.expandedFolderPaths || []));
  }

  /**
   * 打开单个 Markdown 文件。
   * @param {void} 无参数。
   * @returns {Promise<void>}
   */
  async function openFile() {
    await runTask('正在打开文件...', async () => {
      const selectedDocument = await window.markdownApi.openFile();
      if (selectedDocument) openDocument(selectedDocument);
    });
  }

  /**
   * 打开文件夹并自动打开第一个 Markdown 文件。
   * @param {void} 无参数。
   * @returns {Promise<void>}
   */
  async function openFolder() {
    await runTask('正在扫描文件夹...', async () => {
      const selectedWorkspace = await window.markdownApi.openFolder();
      if (!selectedWorkspace) {
        setStatus('已取消选择文件夹');
        return;
      }

      setWorkspace(selectedWorkspace);
      setExpandedFolderPaths(new Set());
      await openFirstWorkspaceDocument(selectedWorkspace);
    });
  }

  /**
   * 打开文件树中的 Markdown 文件。
   * @param {string} filePath 文件路径。
   * @returns {Promise<void>}
   */
  async function openFromTree(filePath) {
    await runTask('正在打开文档...', async () => {
      const cachedDocument = documents.find((documentItem) => documentItem.path === filePath);

      if (cachedDocument) {
        switchActiveDocument(cachedDocument.path);
        setStatus(`已切换到：${cachedDocument.name}`);
        return;
      }

      const selectedDocument = await window.markdownApi.readPath(filePath);
      openDocument(selectedDocument);
    });
  }

  /**
   * 打开文档标签，若已存在则更新内容。
   * @param {object} nextDocument 要打开的文档。
   * @returns {void}
   */
  function openDocument(nextDocument) {
    setDocuments((currentDocuments) => upsertDocument(currentDocuments, nextDocument));
    switchActiveDocument(nextDocument.path);
    setViewMode(VIEW_MODE.preview);
    setStatus(`已打开：${nextDocument.name}`);
  }

  /**
   * 关闭文档标签并自动选中相邻标签。
   * @param {string} filePath 要关闭的文档路径。
   * @returns {void}
   */
  function closeDocument(filePath) {
    const nextDocuments = documents.filter((documentItem) => documentItem.path !== filePath);
    const nextActivePath = resolveNextActivePath(filePath, activePath, documents, nextDocuments);

    saveCurrentScrollPosition();
    delete documentScrollPositions.current[filePath];
    setDocuments(nextDocuments);
    setActivePath(nextActivePath);
  }

  /**
   * 关闭指定文档之外的其他标签。
   * @param {string} filePath 保留的文档路径。
   * @returns {void}
   */
  function closeOtherDocuments(filePath) {
    const targetDocument = documents.find((documentItem) => documentItem.path === filePath);
    if (!targetDocument) return;

    saveCurrentScrollPosition();
    setDocuments([targetDocument]);
    setActivePath(targetDocument.path);
  }

  /**
   * 关闭指定标签右侧的所有标签。
   * @param {string} filePath 基准文档路径。
   * @returns {void}
   */
  function closeDocumentsToRight(filePath) {
    const targetIndex = documents.findIndex((documentItem) => documentItem.path === filePath);
    if (targetIndex < 0) return;

    const nextDocuments = documents.slice(0, targetIndex + 1);
    const nextActivePath = nextDocuments.some((documentItem) => documentItem.path === activePath) ? activePath : filePath;
    saveCurrentScrollPosition();
    setDocuments(nextDocuments);
    setActivePath(nextActivePath);
  }

  /**
   * 保存当前阅读位置后切换文档。
   * @param {string} nextActivePath 要切换到的文档路径。
   * @returns {void}
   */
  function switchActiveDocument(nextActivePath) {
    saveCurrentScrollPosition();
    setActivePath(nextActivePath);
  }

  /**
   * 保存当前文档滚动位置。
   * @param {void} 无参数。
   * @returns {void}
   */
  function saveCurrentScrollPosition() {
    if (!activePath || !editorContentRef.current) return;
    documentScrollPositions.current[activePath] = editorContentRef.current.scrollTop;
  }

  /**
   * 处理原生菜单发送给前端的命令。
   * @param {string} command 菜单命令名称。
   * @returns {void}
   */
  function handleMenuCommand(command, payload = {}) {
    const commandHandlers = {
      'open-file': openFile,
      'open-folder': openFolder,
      'open-path': () => payload.path && openDocumentByPath(payload.path),
      'close-current-document': () => activePath && closeDocument(activePath),
      'close-document': () => payload.path && closeDocument(payload.path),
      'close-other-documents': () => payload.path && closeOtherDocuments(payload.path),
      'close-documents-to-right': () => payload.path && closeDocumentsToRight(payload.path),
      'view-preview': () => setViewMode(VIEW_MODE.preview),
      'view-source': () => setViewMode(VIEW_MODE.source),
      'search-document': () => openSearchPanel(SEARCH_SCOPE.document),
      'toggle-theme': () => setTheme((currentTheme) => (currentTheme === THEME_MODE.dark ? THEME_MODE.light : THEME_MODE.dark)),
      'toggle-explorer': () => setIsExplorerCollapsed((currentValue) => !currentValue)
    };

    commandHandlers[command]?.();
  }

  /**
   * 切换指定文件夹的展开状态。
   * @param {string} folderPath 文件夹路径。
   * @returns {void}
   */
  function toggleFolder(folderPath) {
    setExpandedFolderPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      nextPaths.has(folderPath) ? nextPaths.delete(folderPath) : nextPaths.add(folderPath);
      return nextPaths;
    });
  }

  /**
   * 调整阅读区字号。
   * @param {number} sizeOffset 字号变化值。
   * @returns {void}
   */
  function changeFontSize(sizeOffset) {
    setFontSize((currentSize) => clampFontSize(currentSize + sizeOffset));
  }

  /**
   * 拖动左侧边界时调整文件栏宽度。
   * @param {MouseEvent} event 鼠标按下事件。
   * @returns {void}
   */
  function startExplorerResize(event) {
    const startX = event.clientX;
    const startWidth = explorerWidth;
    const updateWidth = (moveEvent) => setExplorerWidth(clampExplorerWidth(startWidth + moveEvent.clientX - startX));
    const stopResize = () => {
      window.removeEventListener('mousemove', updateWidth);
      document.body.classList.remove('is-resizing-explorer');
    };

    event.preventDefault();
    document.body.classList.add('is-resizing-explorer');
    window.addEventListener('mousemove', updateWidth);
    window.addEventListener('mouseup', stopResize, { once: true });
  }

  /**
   * 双击拖拽线时恢复默认文件栏宽度。
   * @param {void} 无参数。
   * @returns {void}
   */
  function resetExplorerWidth() {
    setExplorerWidth(EXPLORER_WIDTH_SETTING.defaultValue);
  }

  /**
   * 显示文件树或标签页的右键菜单。
   * @param {MouseEvent} event 右键事件。
   * @param {string} type 菜单类型。
   * @param {object} payload 菜单上下文。
   * @returns {void}
   */
  function showContextMenu(event, type, payload) {
    event.preventDefault();
    event.stopPropagation();
    window.markdownApi.showContextMenu({ type, payload });
  }

  /**
   * 打开当前文档搜索面板。
   * @param {void} 无参数。
   * @returns {void}
   */
  function openSearchPanel() {
    setSearchState((currentState) => ({
      ...currentState,
      isOpen: true,
      scope: SEARCH_SCOPE.document,
      activeIndex: -1,
      hasRun: currentState.hasRun
    }));
  }

  /**
   * 关闭搜索面板。
   * @param {void} 无参数。
   * @returns {void}
   */
  function closeSearchPanel() {
    setSearchState((currentState) => ({ ...currentState, isOpen: false }));
  }

  /**
   * 更新搜索关键词。
   * @param {string} query 搜索关键词。
   * @returns {void}
   */
  function updateSearchQuery(query) {
    setSearchState((currentState) => ({ ...currentState, query, results: [], activeIndex: -1, hasRun: false }));
  }

  /**
   * 在当前文档中执行搜索。
   * @param {void} 无参数。
   * @returns {Promise<void>}
   */
  async function runSearch() {
    const query = searchState.query.trim();
    if (!query) return;

    setSearchState((currentState) => ({ ...currentState, isSearching: true }));
    const results = searchDocument(activeDocument, query);

    setSearchState((currentState) => ({ ...currentState, results, activeIndex: results.length ? 0 : -1, hasRun: true, isSearching: false }));
    if (results.length) selectSearchResult(results[0], 0, query);
  }

  /**
   * 选中搜索结果并跳转到对应文档。
   * @param {object} result 搜索结果。
   * @param {number} index 搜索结果序号。
   * @param {string} queryOverride 可选搜索词。
   * @returns {Promise<void>}
   */
  async function selectSearchResult(result, index, queryOverride = searchState.query) {
    pendingSearchTargetRef.current = { result, query: queryOverride };
    setSearchState((currentState) => ({ ...currentState, activeIndex: index }));
    if (result.path !== activePath) await openDocumentByPath(result.path);
    if (result.path === activePath) scrollToPendingSearchTarget(pendingSearchTargetRef, editorContentRef, viewMode);
  }

  /**
   * 打开指定路径文档，已打开时只切换标签。
   * @param {string} filePath 文档路径。
   * @returns {Promise<void>}
   */
  async function openDocumentByPath(filePath) {
    const cachedDocument = documents.find((documentItem) => documentItem.path === filePath);
    if (cachedDocument) {
      switchActiveDocument(cachedDocument.path);
      return;
    }

    const selectedDocument = await window.markdownApi.readPath(filePath);
    openDocument(selectedDocument);
  }

  /**
   * 搜索结果向前或向后切换。
   * @param {number} direction 切换方向。
   * @returns {void}
   */
  function moveSearchResult(direction) {
    if (!searchState.query.trim()) return;
    const nextIndex = getNextSearchIndex(searchState.results, searchState.activeIndex, direction);

    if (nextIndex >= 0) {
      selectSearchResult(searchState.results[nextIndex], nextIndex);
      return;
    }

    runSearch();
  }

  /**
   * 点击目录标题时滚动到对应位置。
   * @param {string} headingId 标题 ID。
   * @returns {void}
   */
  function scrollToHeading(headingId) {
    scrollHeadingIntoEditor(headingId, editorContentRef);
  }

  /**
   * 从磁盘刷新已打开文档的内容。
   * @param {void} 无参数。
   * @returns {Promise<void>}
   */
  async function updateDocumentsFromDisk() {
    const refreshedDocuments = await readExistingDocuments(documents.map((documentItem) => documentItem.path));
    const refreshedMap = new Map(refreshedDocuments.map((documentItem) => [documentItem.path, documentItem]));
    const changedDocuments = documents.filter((documentItem) => hasDocumentChanged(documentItem, refreshedMap.get(documentItem.path)));

    if (!changedDocuments.length) return;

    setDocuments((currentDocuments) => mergeRefreshedDocuments(currentDocuments, refreshedMap));
    setStatus(`已自动刷新：${changedDocuments[0].name}`);
  }

  /**
   * 打开工作区里的第一个 Markdown 文件。
   * @param {object} selectedWorkspace 用户选择的工作区。
   * @returns {Promise<void>}
   */
  async function openFirstWorkspaceDocument(selectedWorkspace) {
    const firstMarkdownPath = findFirstFilePath(selectedWorkspace.children);

    if (!firstMarkdownPath) {
      setStatus('工作区已加载，但没有找到 Markdown 文件');
      return;
    }

    const firstDocument = await window.markdownApi.readPath(firstMarkdownPath);
    openDocument(firstDocument);
    setStatus(`工作区已加载，共 ${selectedWorkspace.fileCount} 个 Markdown 文件`);
  }

  const appState = {
    workspace,
    documents,
    activePath,
    activeDocument,
    renderedMarkdown,
    documentOutline,
    activeHeadingId,
    searchState,
    status,
    error,
    isLoading,
    isExplorerCollapsed,
    explorerWidth,
    expandedFolderPaths,
    viewMode,
    theme,
    fontSize,
    documentWidth
  };

  const appActions = {
    openFile,
    openFolder,
    openFromTree,
    closeDocument,
    closeOtherDocuments,
    closeDocumentsToRight,
    setActivePath: switchActiveDocument,
    setViewMode,
    setDocumentWidth,
    openSearchPanel,
    closeSearchPanel,
    updateSearchQuery,
    runSearch,
    selectSearchResult,
    moveSearchResult,
    scrollToHeading,
    changeFontSize,
    startExplorerResize,
    resetExplorerWidth,
    showContextMenu,
    toggleFolder,
    toggleExplorer: () => setIsExplorerCollapsed((currentValue) => !currentValue),
    toggleTheme: () => setTheme((currentTheme) => (currentTheme === THEME_MODE.dark ? THEME_MODE.light : THEME_MODE.dark))
  };
  const explorerGridStyle = {
    '--explorer-width': `${isExplorerCollapsed ? EXPLORER_WIDTH_SETTING.collapsedValue : explorerWidth}px`
  };

  const refs = {
    editorContentRef,
    searchInputRef
  };

  return {
    appState,
    appActions,
    refs,
    explorerGridStyle,
    theme,
    isExplorerCollapsed
  };
}
