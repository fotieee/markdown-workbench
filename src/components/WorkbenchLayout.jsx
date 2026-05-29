import { ChevronRight, FileText, FolderOpen, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from 'lucide-react';
import { DOCUMENT_WIDTH_OPTIONS, FONT_SIZE_SETTING, THEME_MODE, VIEW_MODE } from '../appConstants';
import { closeTabByEvent, closeTabByKeyboard, hasOpenedDescendant, runSearchByKeyboard } from '../utils/workbenchUtils';

export function Sidebar({ appState, appActions }) {
  if (appState.isExplorerCollapsed) {
    return (
      <aside className="explorer collapsed-explorer">
        <button className="collapse-toggle expand-toggle" type="button" onClick={appActions.toggleExplorer} title="展开文件栏" aria-label="展开文件栏">
          <PanelLeftOpen className="svg-icon" size={17} strokeWidth={2.1} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="explorer">
      <div className="explorer-title">
        <span>资源管理器</span>
        <div className="explorer-title-actions">
          <button className="icon-button" type="button" onClick={appActions.openFolder} disabled={appState.isLoading} title="打开文件夹" aria-label="打开文件夹">
            <FolderOpen className="svg-icon" size={17} strokeWidth={2.1} />
          </button>
          <button className="collapse-toggle" type="button" onClick={appActions.toggleExplorer} title="收起文件栏" aria-label="收起文件栏">
            <PanelLeftClose className="svg-icon" size={17} strokeWidth={2.1} />
          </button>
        </div>
      </div>

      <div className="explorer-actions">
        <button className="action-button" type="button" onClick={appActions.openFolder} disabled={appState.isLoading}>
          {appState.isLoading ? '处理中...' : '打开文件夹'}
        </button>
        <button className="action-button subtle" type="button" onClick={appActions.openFile} disabled={appState.isLoading}>打开文件</button>
      </div>

      <WorkspaceView appState={appState} appActions={appActions} />
      {appState.status && <p className="status-text">{appState.status}</p>}
      {appState.error && <p className="error-text">{appState.error}</p>}
      <button className="explorer-resize-handle" type="button" onMouseDown={appActions.startExplorerResize} onDoubleClick={appActions.resetExplorerWidth} title="拖动调整文件栏宽度，双击恢复默认" aria-label="拖动调整文件栏宽度" />
    </aside>
  );
}

/**
 * 渲染工作区文件树或空提示。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @returns {JSX.Element} 工作区视图。
 */
function WorkspaceView({ appState, appActions }) {
  if (!appState.workspace) {
    return (
      <section className="empty-explorer">
        <p>打开一个文件夹后，这里会以类似 VS Code 的方式展示 Markdown 文件树。</p>
      </section>
    );
  }

  return (
    <section className="workspace-tree">
      <div className="workspace-name" title={appState.workspace.path}>
        {appState.workspace.name}
        <span>{appState.workspace.fileCount} 个文档</span>
      </div>
      <FileTree
        nodes={appState.workspace.children}
        activePath={appState.activePath}
        openedPaths={appState.documents.map((documentItem) => documentItem.path)}
        expandedFolderPaths={appState.expandedFolderPaths}
        onOpen={appActions.openFromTree}
        onToggleFolder={appActions.toggleFolder}
        onShowContextMenu={appActions.showContextMenu}
      />
    </section>
  );
}

/**
 * 渲染右侧编辑区。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @returns {JSX.Element} 编辑区。
 */
export function EditorArea({ appState, appActions, editorContentRef, searchInputRef }) {
  return (
    <section className="editor-area">
      <DocumentTabs appState={appState} appActions={appActions} />
      <EditorToolbar appState={appState} appActions={appActions} />
      <SearchPanel appState={appState} appActions={appActions} searchInputRef={searchInputRef} />
      <DocumentViewer appState={appState} appActions={appActions} editorContentRef={editorContentRef} />
    </section>
  );
}

/**
 * 渲染顶部文档标签。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @returns {JSX.Element} 标签栏。
 */
function DocumentTabs({ appState, appActions }) {
  if (appState.documents.length === 0) {
    return <div className="tabs"><div className="tab-placeholder">尚未打开文档</div></div>;
  }

  return (
    <div className="tabs" role="tablist" aria-label="已打开文档">
      {appState.documents.map((documentItem) => (
        <button className={`tab ${documentItem.path === appState.activePath ? 'active' : ''}`} key={documentItem.path} type="button" onClick={() => appActions.setActivePath(documentItem.path)} onContextMenu={(event) => appActions.showContextMenu(event, 'tab', { path: documentItem.path })} title={documentItem.path} role="tab">
          <span className="file-dot" aria-hidden="true" />
          <span className="tab-name">{documentItem.name}</span>
          <span className="tab-close" role="button" tabIndex={0} aria-label={`关闭 ${documentItem.name}`} onClick={(event) => closeTabByEvent(event, documentItem.path, appActions.closeDocument)} onKeyDown={(event) => closeTabByKeyboard(event, documentItem.path, appActions.closeDocument)}>
            <X className="svg-icon" size={14} strokeWidth={2.4} />
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * 渲染编辑器工具栏。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @returns {JSX.Element} 工具栏。
 */
function EditorToolbar({ appState, appActions }) {
  const themeButtonText = appState.theme === THEME_MODE.dark ? '浅色主题' : '深色主题';
  const ThemeIcon = appState.theme === THEME_MODE.dark ? Sun : Moon;

  return (
    <div className="editor-toolbar">
      <div className="document-meta">
        <span className="eyebrow">Markdown 阅读器</span>
        <h1>{appState.activeDocument ? appState.activeDocument.name : '欢迎'}</h1>
      </div>

      <div className="toolbar-actions">
        <div className="quick-search-actions">
          <button className="utility-button with-icon" type="button" onClick={appActions.openSearchPanel} disabled={!appState.activeDocument}>
            <Search className="button-icon" size={15} strokeWidth={2.2} />
            <span>查找</span>
          </button>
        </div>

        <div className="segmented-control" aria-label="查看模式">
          <button className={appState.viewMode === VIEW_MODE.preview ? 'active' : ''} type="button" onClick={() => appActions.setViewMode(VIEW_MODE.preview)} disabled={!appState.activeDocument}>预览</button>
          <button className={appState.viewMode === VIEW_MODE.source ? 'active' : ''} type="button" onClick={() => appActions.setViewMode(VIEW_MODE.source)} disabled={!appState.activeDocument}>源码</button>
        </div>

        <div className="reading-controls" aria-label="阅读设置">
          <div className="font-size-control" aria-label="文字大小">
            <button type="button" onClick={() => appActions.changeFontSize(-1)} disabled={appState.fontSize <= FONT_SIZE_SETTING.min}>A-</button>
            <span className="font-size-value">{appState.fontSize}px</span>
            <button type="button" onClick={() => appActions.changeFontSize(1)} disabled={appState.fontSize >= FONT_SIZE_SETTING.max}>A+</button>
          </div>

          <div className="segmented-control width-control" aria-label="文档宽度">
            {DOCUMENT_WIDTH_OPTIONS.map((widthOption) => (
              <button className={appState.documentWidth === widthOption.value ? 'active' : ''} key={widthOption.value} type="button" onClick={() => appActions.setDocumentWidth(widthOption.value)}>
                {widthOption.label}
              </button>
            ))}
          </div>
        </div>

        <button className="theme-button with-icon" type="button" onClick={appActions.toggleTheme}>
          <ThemeIcon className="button-icon" size={15} strokeWidth={2.2} />
          <span>{themeButtonText}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 渲染当前文档和工作区搜索面板。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @param {object} props.searchInputRef 搜索输入框引用。
 * @returns {JSX.Element|null} 搜索面板。
 */
function SearchPanel({ appState, appActions, searchInputRef }) {
  if (!appState.searchState.isOpen) return null;

  return (
    <section className="search-panel">
      <div className="search-bar">
        <span className="search-scope-label">
          <Search className="button-icon" size={14} strokeWidth={2.2} />
          当前文档
        </span>
        <input ref={searchInputRef} className="search-input" value={appState.searchState.query} onChange={(event) => appActions.updateSearchQuery(event.target.value)} onKeyDown={(event) => runSearchByKeyboard(event, appState, appActions)} placeholder="搜索当前文档" />
        <button className="utility-button" type="button" onClick={appActions.runSearch} disabled={appState.searchState.isSearching}>搜索</button>
        <button className="utility-button" type="button" onClick={() => appActions.moveSearchResult(-1)} disabled={!appState.searchState.query}>上一个</button>
        <button className="utility-button" type="button" onClick={() => appActions.moveSearchResult(1)} disabled={!appState.searchState.query}>下一个</button>
        <button className="icon-button" type="button" onClick={appActions.closeSearchPanel} title="关闭搜索" aria-label="关闭搜索">
          <X className="svg-icon" size={15} strokeWidth={2.4} />
        </button>
      </div>

      <SearchResults appState={appState} appActions={appActions} />
    </section>
  );
}

/**
 * 渲染搜索结果列表。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @returns {JSX.Element|null} 搜索结果区域。
 */
function SearchResults({ appState, appActions }) {
  if (!appState.searchState.query || appState.searchState.isSearching) {
    return <p className="search-empty">{appState.searchState.isSearching ? '正在搜索...' : '输入关键词后按 Enter 搜索'}</p>;
  }

  if (!appState.searchState.hasRun) {
    return <p className="search-empty">按 Enter 或点击搜索开始查找</p>;
  }

  if (!appState.searchState.results.length) {
    return <p className="search-empty">没有找到匹配内容</p>;
  }

  return (
    <div className="search-results">
      <span className="search-count">找到 {appState.searchState.results.length} 处匹配</span>
      {appState.searchState.results.map((result, index) => (
        <button className={`search-result ${index === appState.searchState.activeIndex ? 'active' : ''}`} key={`${result.path}-${result.lineNumber}-${index}`} type="button" onClick={() => appActions.selectSearchResult(result, index)}>
          <span className="search-result-meta">{result.name} · 第 {result.lineNumber} 行</span>
          <span className="search-result-snippet">{result.snippet}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * 渲染欢迎页、Markdown 预览或源码。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @returns {JSX.Element} 文档内容区域。
 */
function DocumentViewer({ appState, appActions, editorContentRef }) {
  const documentWidthClass = `document-width-${appState.documentWidth}`;
  const readingStyle = { '--reading-font-size': `${appState.fontSize}px` };

  return (
    <div className="editor-content" ref={editorContentRef}>
      {!appState.activeDocument && (
        <div className="welcome-panel">
          <h2>选择文件或文件夹开始阅读</h2>
          <p>支持同时打开多个 Markdown 文档，可通过顶部标签快速切换或关闭。</p>
          <div className="welcome-actions">
            <button className="action-button" type="button" onClick={appActions.openFolder} disabled={appState.isLoading}>打开文件夹</button>
            <button className="action-button subtle" type="button" onClick={appActions.openFile} disabled={appState.isLoading}>打开文件</button>
          </div>
        </div>
      )}

      {appState.activeDocument && (
        <div className="document-layout">
          <div className="document-stage">
            {appState.viewMode === VIEW_MODE.preview && (
              <article className={`markdown-body ${documentWidthClass}`} style={readingStyle} dangerouslySetInnerHTML={{ __html: appState.renderedMarkdown }} />
            )}

            {appState.viewMode === VIEW_MODE.source && (
              <pre className={`source-view ${documentWidthClass}`} style={readingStyle}><code>{appState.activeDocument.content}</code></pre>
            )}
          </div>

          <DocumentOutline appState={appState} appActions={appActions} />
        </div>
      )}
    </div>
  );
}

/**
 * 渲染右侧文档目录。
 * @param {object} props 组件属性。
 * @param {object} props.appState 应用状态。
 * @param {object} props.appActions 应用操作。
 * @returns {JSX.Element|null} 文档目录。
 */
function DocumentOutline({ appState, appActions }) {
  if (appState.viewMode !== VIEW_MODE.preview || appState.documentOutline.length === 0) return null;

  return (
    <aside className="document-outline" aria-label="文档目录">
      <span className="outline-title">目录</span>
      {appState.documentOutline.map((headingItem) => (
        <button className={`outline-item level-${headingItem.level} ${headingItem.id === appState.activeHeadingId ? 'active' : ''}`} key={headingItem.id} type="button" onClick={() => appActions.scrollToHeading(headingItem.id)}>
          {headingItem.text}
        </button>
      ))}
    </aside>
  );
}

/**
 * 渲染 Markdown 文件树。
 * @param {object} props 组件属性。
 * @param {object[]} props.nodes 文件树节点。
 * @param {string} props.activePath 当前激活文件路径。
 * @param {string[]} props.openedPaths 已打开文件路径。
 * @param {Function} props.onOpen 打开文件回调。
 * @param {number} props.depth 文件树层级。
 * @returns {JSX.Element} 文件树。
 */
function FileTree({ nodes, activePath, openedPaths, expandedFolderPaths, onOpen, onToggleFolder, onShowContextMenu, depth = 0 }) {
  if (!nodes?.length) {
    return <p className="tree-empty">没有找到 Markdown 文件</p>;
  }

  return (
    <ul className="file-tree">
      {nodes.map((treeNode) => (
        <TreeNode
          key={treeNode.path}
          node={treeNode}
          activePath={activePath}
          openedPaths={openedPaths}
          expandedFolderPaths={expandedFolderPaths}
          onOpen={onOpen}
          onToggleFolder={onToggleFolder}
          onShowContextMenu={onShowContextMenu}
          depth={depth}
        />
      ))}
    </ul>
  );
}

/**
 * 渲染单个文件或文件夹节点。
 * @param {object} props 组件属性。
 * @param {object} props.node 文件树节点。
 * @param {string} props.activePath 当前激活文件路径。
 * @param {string[]} props.openedPaths 已打开文件路径。
 * @param {Function} props.onOpen 打开文件回调。
 * @param {number} props.depth 文件树层级。
 * @returns {JSX.Element} 文件树节点。
 */
function TreeNode({ node, activePath, openedPaths, expandedFolderPaths, onOpen, onToggleFolder, onShowContextMenu, depth }) {
  if (node.type === 'file') {
    const isActive = node.path === activePath;
    const isOpen = openedPaths.includes(node.path);

    return (
      <li>
        <button className={`tree-item file ${isActive ? 'active' : ''}`} type="button" onClick={() => onOpen(node.path)} onContextMenu={(event) => onShowContextMenu(event, 'file', { path: node.path })} style={{ '--depth': depth }} title={node.path}>
          <span className="tree-icon file-mark" aria-hidden="true">
            <FileText className="svg-icon" size={15} strokeWidth={2.05} />
          </span>
          <span className="tree-name">{node.name}</span>
          {isOpen && <span className="open-indicator" aria-label="已打开" />}
        </button>
      </li>
    );
  }

  const hasOpenDocument = hasOpenedDescendant(node, openedPaths);
  const isExpanded = expandedFolderPaths.has(node.path);

  return (
    <li>
      <button className="tree-item folder" type="button" onClick={() => onToggleFolder(node.path)} onContextMenu={(event) => onShowContextMenu(event, 'folder', { path: node.path })} style={{ '--depth': depth }} title={node.path} aria-expanded={isExpanded}>
        <span className={`tree-icon folder-chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
          <ChevronRight className="svg-icon" size={15} strokeWidth={2.1} />
        </span>
        <span className="tree-name">{node.name}</span>
        {hasOpenDocument && <span className="open-indicator folder-indicator" aria-label="包含已打开文档" />}
      </button>
      {isExpanded && (
        <FileTree
          nodes={node.children}
          activePath={activePath}
          openedPaths={openedPaths}
          expandedFolderPaths={expandedFolderPaths}
          onOpen={onOpen}
          onToggleFolder={onToggleFolder}
          onShowContextMenu={onShowContextMenu}
          depth={depth + 1}
        />
      )}
    </li>
  );
}

/**
 * 新增或更新一个已打开文档。
 * @param {object[]} documents 当前文档列表。
 * @param {object} nextDocument 要写入的文档。
 * @returns {object[]} 更新后的文档列表。
 */
