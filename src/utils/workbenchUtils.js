import { DOCUMENT_WIDTH, EXPLORER_WIDTH_SETTING, FONT_SIZE_SETTING, SESSION_STORAGE_KEY, VIEW_MODE } from '../appConstants';

export function readSavedSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * 保存当前会话到本地。
 * @param {object} sessionData 当前会话数据。
 * @returns {void}
 */
export function saveSession(sessionData) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

/**
 * 把文件栏宽度限制在可用范围内。
 * @param {number} explorerWidth 用户拖拽或恢复出来的宽度。
 * @returns {number} 可用的文件栏宽度。
 */
export function clampExplorerWidth(explorerWidth) {
  const parsedExplorerWidth = Number(explorerWidth) || EXPLORER_WIDTH_SETTING.defaultValue;
  return Math.min(EXPLORER_WIDTH_SETTING.max, Math.max(EXPLORER_WIDTH_SETTING.min, parsedExplorerWidth));
}

/**
 * 把字号限制在舒适阅读范围内。
 * @param {number} fontSize 用户设置或恢复出来的字号。
 * @returns {number} 可用的字号。
 */
export function clampFontSize(fontSize) {
  const parsedFontSize = Number(fontSize) || FONT_SIZE_SETTING.defaultValue;
  return Math.min(FONT_SIZE_SETTING.max, Math.max(FONT_SIZE_SETTING.min, parsedFontSize));
}

/**
 * 规范化文档宽度设置。
 * @param {string} documentWidth 用户设置或恢复出来的宽度值。
 * @returns {string} 可用的宽度值。
 */
export function normalizeDocumentWidth(documentWidth) {
  return Object.values(DOCUMENT_WIDTH).includes(documentWidth) ? documentWidth : DOCUMENT_WIDTH.normal;
}

/**
 * 从 HTML 中提取 h1-h3 作为目录。
 * @param {string} htmlContent 渲染后的 HTML。
 * @returns {object[]} 目录项。
 */
export function extractHeadingsFromHtml(htmlContent) {
  if (!htmlContent) return [];

  const htmlDocument = new DOMParser().parseFromString(htmlContent, 'text/html');
  return Array.from(htmlDocument.querySelectorAll('h1, h2, h3'))
    .filter((headingElement) => headingElement.id)
    .map((headingElement) => ({
      id: headingElement.id,
      text: headingElement.textContent.trim(),
      level: Number(headingElement.tagName.slice(1))
    }));
}

/**
 * 根据标题在滚动容器中的位置查找当前标题。
 * @param {object[]} documentOutline 目录项。
 * @param {Element} editorContent 编辑区滚动容器。
 * @returns {string} 当前标题 ID。
 */
export function findActiveHeadingId(documentOutline, editorContent) {
  let activeHeadingId = documentOutline[0]?.id || '';
  if (!editorContent) return activeHeadingId;

  const activationOffset = 120;
  const editorRect = editorContent.getBoundingClientRect();

  for (const headingItem of documentOutline) {
    const headingElement = document.getElementById(headingItem.id);
    if (!headingElement) continue;

    const headingTop = headingElement.getBoundingClientRect().top - editorRect.top;
    if (headingTop <= activationOffset) {
      activeHeadingId = headingItem.id;
    }
  }

  return activeHeadingId;
}

/**
 * 把标题滚动到编辑区顶部附近。
 * @param {string} headingId 标题 ID。
 * @param {object} editorContentRef 编辑区引用。
 * @returns {void}
 */
export function scrollHeadingIntoEditor(headingId, editorContentRef) {
  const editorContent = editorContentRef.current;
  const headingElement = document.getElementById(headingId);
  if (!editorContent || !headingElement) return;

  const editorRect = editorContent.getBoundingClientRect();
  const headingRect = headingElement.getBoundingClientRect();
  const targetTop = editorContent.scrollTop + headingRect.top - editorRect.top - 28;
  editorContent.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
}

/**
 * 判断链接是否应该交给系统浏览器打开。
 * @param {string} linkHref 链接地址。
 * @returns {boolean} 是否外部链接。
 */
export function isExternalLink(linkHref) {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(linkHref).protocol);
  } catch {
    return false;
  }
}

/**
 * 判断键盘事件是否为查找快捷键。
 * @param {KeyboardEvent} event 键盘事件。
 * @returns {boolean} 是否查找快捷键。
 */
export function isFindShortcut(event) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
}

/**
 * 搜索单个文档内容。
 * @param {object|null} documentItem 文档对象。
 * @param {string} query 搜索关键词。
 * @returns {object[]} 搜索结果。
 */
export function searchDocument(documentItem, query) {
  if (!documentItem?.content || !query) return [];

  let matchIndex = 0;
  const normalizedQuery = query.toLowerCase();
  const searchResults = [];

  documentItem.content.split(/\r?\n/).forEach((lineContent, lineIndex) => {
    let columnIndex = lineContent.toLowerCase().indexOf(normalizedQuery);

    while (columnIndex >= 0) {
      searchResults.push({
        path: documentItem.path,
        name: documentItem.name,
        lineNumber: lineIndex + 1,
        matchIndex,
        snippet: buildSearchSnippet(lineContent, query)
      });
      matchIndex += 1;
      columnIndex = lineContent.toLowerCase().indexOf(normalizedQuery, columnIndex + query.length);
    }
  });

  return searchResults;
}

/**
 * 构建搜索结果摘要。
 * @param {string} lineContent 匹配行内容。
 * @param {string} query 搜索关键词。
 * @returns {string} 摘要文本。
 */
export function buildSearchSnippet(lineContent, query) {
  const compactLine = lineContent.trim() || '(空行)';
  if (compactLine.length <= 140) return compactLine;

  const matchIndex = compactLine.toLowerCase().indexOf(query.toLowerCase());
  const startIndex = Math.max(0, matchIndex - 46);
  return `${startIndex > 0 ? '...' : ''}${compactLine.slice(startIndex, startIndex + 140)}...`;
}

/**
 * 计算下一个搜索结果序号。
 * @param {object[]} results 搜索结果。
 * @param {number} activeIndex 当前序号。
 * @param {number} direction 切换方向。
 * @returns {number} 下一个序号。
 */
export function getNextSearchIndex(results, activeIndex, direction) {
  if (!results.length) return -1;
  return (activeIndex + direction + results.length) % results.length;
}

/**
 * 滚动到待处理的搜索目标。
 * @param {object} pendingSearchTargetRef 待处理搜索目标引用。
 * @param {object} editorContentRef 编辑区引用。
 * @param {string} viewMode 当前查看模式。
 * @returns {void}
 */
export function scrollToPendingSearchTarget(pendingSearchTargetRef, editorContentRef, viewMode) {
  const pendingSearchTarget = pendingSearchTargetRef.current;
  if (!pendingSearchTarget) return;

  const hasScrolled = viewMode === VIEW_MODE.source
    ? scrollToSourceSearchResult(pendingSearchTarget.result, editorContentRef)
    : scrollToPreviewSearchResult(pendingSearchTarget, editorContentRef);

  if (hasScrolled) pendingSearchTargetRef.current = null;
}

/**
 * 在预览模式中滚动到搜索词。
 * @param {object} searchTarget 搜索目标。
 * @param {object} editorContentRef 编辑区引用。
 * @returns {boolean} 是否成功滚动。
 */
export function scrollToPreviewSearchResult(searchTarget, editorContentRef) {
  const markdownBody = editorContentRef.current?.querySelector('.markdown-body');
  const matchedRange = findTextRange(markdownBody, searchTarget.query, searchTarget.result.matchIndex);
  if (!matchedRange) return false;

  selectMatchedRange(matchedRange);
  scrollRangeIntoEditor(matchedRange, editorContentRef.current);
  return true;
}

/**
 * 在源码模式中滚动到搜索结果所在行。
 * @param {object} result 搜索结果。
 * @param {object} editorContentRef 编辑区引用。
 * @returns {boolean} 是否成功滚动。
 */
export function scrollToSourceSearchResult(result, editorContentRef) {
  const editorContent = editorContentRef.current;
  const sourceView = editorContent?.querySelector('.source-view');
  if (!editorContent || !sourceView) return false;

  const lineHeight = parseFloat(getComputedStyle(sourceView).lineHeight) || 24;
  const targetTop = sourceView.offsetTop + Math.max(0, result.lineNumber - 1) * lineHeight - 110;
  editorContent.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  return true;
}

/**
 * 查找正文里第 N 个匹配文本范围。
 * @param {Element|null} rootElement 搜索根元素。
 * @param {string} query 搜索词。
 * @param {number} targetIndex 目标匹配序号。
 * @returns {Range|null} 匹配范围。
 */
export function findTextRange(rootElement, query, targetIndex) {
  if (!rootElement || !query) return null;

  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  const normalizedQuery = query.toLowerCase();
  let matchedCount = 0;
  let currentNode = walker.nextNode();

  while (currentNode) {
    const normalizedText = currentNode.nodeValue.toLowerCase();
    let matchOffset = normalizedText.indexOf(normalizedQuery);

    while (matchOffset >= 0) {
      if (matchedCount === targetIndex) return createTextRange(currentNode, matchOffset, query.length);
      matchedCount += 1;
      matchOffset = normalizedText.indexOf(normalizedQuery, matchOffset + query.length);
    }

    currentNode = walker.nextNode();
  }

  return null;
}

/**
 * 创建文本选区范围。
 * @param {Text} textNode 文本节点。
 * @param {number} startOffset 开始位置。
 * @param {number} length 匹配长度。
 * @returns {Range} 文本范围。
 */
export function createTextRange(textNode, startOffset, length) {
  const matchedRange = document.createRange();
  matchedRange.setStart(textNode, startOffset);
  matchedRange.setEnd(textNode, startOffset + length);
  return matchedRange;
}

/**
 * 选中匹配文本，给用户一个明确反馈。
 * @param {Range} matchedRange 匹配文本范围。
 * @returns {void}
 */
export function selectMatchedRange(matchedRange) {
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(matchedRange);
}

/**
 * 把匹配文本滚动到阅读区合适位置。
 * @param {Range} matchedRange 匹配文本范围。
 * @param {Element} editorContent 编辑区元素。
 * @returns {void}
 */
export function scrollRangeIntoEditor(matchedRange, editorContent) {
  const rangeRect = matchedRange.getBoundingClientRect();
  const editorRect = editorContent.getBoundingClientRect();
  const targetTop = editorContent.scrollTop + rangeRect.top - editorRect.top - 110;
  editorContent.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
}

/**
 * 判断文档是否发生变化。
 * @param {object} currentDocument 当前文档。
 * @param {object|undefined} refreshedDocument 最新文档。
 * @returns {boolean} 是否变化。
 */
export function hasDocumentChanged(currentDocument, refreshedDocument) {
  if (!refreshedDocument) return false;
  return currentDocument.modifiedAt !== refreshedDocument.modifiedAt || currentDocument.content !== refreshedDocument.content;
}

/**
 * 合并从磁盘刷新的文档内容。
 * @param {object[]} currentDocuments 当前文档列表。
 * @param {Map<string, object>} refreshedMap 最新文档映射。
 * @returns {object[]} 合并后的文档列表。
 */
export function mergeRefreshedDocuments(currentDocuments, refreshedMap) {
  return currentDocuments.map((documentItem) => refreshedMap.get(documentItem.path) || documentItem);
}

/**
 * 处理搜索框回车快捷操作。
 * @param {KeyboardEvent} event 键盘事件。
 * @param {object} appState 应用状态。
 * @param {object} appActions 应用操作。
 * @returns {void}
 */
export function runSearchByKeyboard(event, appState, appActions) {
  if (event.key !== 'Enter') return;

  event.preventDefault();
  if (!appState.searchState.results.length) {
    appActions.runSearch();
    return;
  }

  appActions.moveSearchResult(event.shiftKey ? -1 : 1);
}

/**
 * 读取仍然存在的文档文件。
 * @param {string[]} documentPaths 文档路径列表。
 * @returns {Promise<object[]>} 成功读取的文档列表。
 */
export async function readExistingDocuments(documentPaths) {
  const documentResults = await Promise.allSettled(
    documentPaths.map((filePath) => window.markdownApi.readPath(filePath))
  );

  return documentResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}

/**
 * 计算恢复会话时应激活的文档路径。
 * @param {string} savedActivePath 上次激活的路径。
 * @param {object[]} restoredDocuments 已恢复的文档列表。
 * @returns {string} 激活路径。
 */
export function resolveRestoredActivePath(savedActivePath, restoredDocuments) {
  const hasSavedActiveDocument = restoredDocuments.some((documentItem) => documentItem.path === savedActivePath);
  return hasSavedActiveDocument ? savedActivePath : restoredDocuments[0]?.path || '';
}

export function upsertDocument(documents, nextDocument) {
  const hasDocument = documents.some((documentItem) => documentItem.path === nextDocument.path);

  if (!hasDocument) {
    return [...documents, nextDocument];
  }

  return documents.map((documentItem) => (
    documentItem.path === nextDocument.path ? nextDocument : documentItem
  ));
}

/**
 * 关闭标签后计算下一个激活文档。
 * @param {string} closedPath 被关闭的路径。
 * @param {string} activePath 当前激活路径。
 * @param {object[]} currentDocuments 当前文档列表。
 * @param {object[]} nextDocuments 关闭后的文档列表。
 * @returns {string} 下一个激活路径。
 */
export function resolveNextActivePath(closedPath, activePath, currentDocuments, nextDocuments) {
  if (closedPath !== activePath) {
    return activePath;
  }

  const closedIndex = currentDocuments.findIndex((documentItem) => documentItem.path === closedPath);
  return (nextDocuments[Math.max(0, closedIndex - 1)] || nextDocuments[0])?.path || '';
}

/**
 * 查找文件树里的第一个 Markdown 文件。
 * @param {object[]} nodes 文件树节点。
 * @returns {string} 第一个文件路径，未找到时返回空字符串。
 */
export function findFirstFilePath(nodes) {
  for (const treeNode of nodes || []) {
    if (treeNode.type === 'file') return treeNode.path;

    const nestedPath = findFirstFilePath(treeNode.children);
    if (nestedPath) return nestedPath;
  }

  return '';
}

/**
 * 判断文件夹下是否包含已打开文档。
 * @param {object} folderNode 文件夹节点。
 * @param {string[]} openedPaths 已打开文档路径列表。
 * @returns {boolean} 包含已打开文档时返回 true。
 */
export function hasOpenedDescendant(folderNode, openedPaths) {
  return (folderNode.children || []).some((childNode) => {
    if (childNode.type === 'file') {
      return openedPaths.includes(childNode.path);
    }

    return hasOpenedDescendant(childNode, openedPaths);
  });
}

/**
 * 处理标签关闭点击事件。
 * @param {Event} event 鼠标事件。
 * @param {string} filePath 要关闭的文件路径。
 * @param {Function} closeDocument 关闭文档函数。
 * @returns {void}
 */
export function closeTabByEvent(event, filePath, closeDocument) {
  event.stopPropagation();
  closeDocument(filePath);
}

/**
 * 处理标签关闭键盘事件。
 * @param {KeyboardEvent} event 键盘事件。
 * @param {string} filePath 要关闭的文件路径。
 * @param {Function} closeDocument 关闭文档函数。
 * @returns {void}
 */
export function closeTabByKeyboard(event, filePath, closeDocument) {
  if (!['Enter', ' '].includes(event.key)) return;

  event.preventDefault();
  closeTabByEvent(event, filePath, closeDocument);
}
