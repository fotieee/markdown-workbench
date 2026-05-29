import { useEffect, useMemo, useState } from 'react';
import { VIEW_MODE } from '../appConstants';
import { renderMarkdown } from '../markdownRenderer';
import {
  extractHeadingsFromHtml,
  findActiveHeadingId,
  isExternalLink,
  isFindShortcut,
  scrollToPendingSearchTarget
} from '../utils/workbenchUtils';

export function useRenderedMarkdown(activeDocument) {
  return useMemo(() => {
    if (!activeDocument?.content) return '';
    return renderMarkdown(activeDocument.content);
  }, [activeDocument]);
}

/**
 * 将前端主题同步给 Electron 原生窗口区域。
 * @param {string} theme 当前主题名称。
 * @returns {void}
 */
export function useSyncNativeTheme(theme) {
  useEffect(() => {
    window.markdownApi?.setNativeTheme?.(theme);
  }, [theme]);
}

/**
 * 切换文档后把编辑区滚动位置重置到顶部。
 * @param {string} activePath 当前激活文档路径。
 * @returns {void}
 */
export function useRestoreEditorScroll(activePath, editorContentRef, documentScrollPositions) {
  useEffect(() => {
    const savedScrollTop = documentScrollPositions.current[activePath] || 0;
    editorContentRef.current?.scrollTo({ top: savedScrollTop, left: 0 });
  }, [activePath, editorContentRef, documentScrollPositions]);
}

/**
 * 从渲染后的 HTML 中提取文档目录。
 * @param {string} renderedMarkdown 渲染后的 HTML。
 * @returns {object[]} 标题目录。
 */
export function useDocumentOutline(renderedMarkdown) {
  return useMemo(() => extractHeadingsFromHtml(renderedMarkdown), [renderedMarkdown]);
}

/**
 * 根据滚动位置计算当前标题。
 * @param {object[]} documentOutline 文档目录。
 * @param {object} editorContentRef 编辑区引用。
 * @param {string} viewMode 当前查看模式。
 * @param {string} activePath 当前文档路径。
 * @returns {string} 当前标题 ID。
 */
export function useActiveHeading(documentOutline, editorContentRef, viewMode, activePath) {
  const [activeHeadingId, setActiveHeadingId] = useState('');

  useEffect(() => {
    const editorContent = editorContentRef.current;
    if (!editorContent || viewMode !== VIEW_MODE.preview || !documentOutline.length) return;

    const updateActiveHeading = () => {
      setActiveHeadingId(findActiveHeadingId(documentOutline, editorContent));
    };

    updateActiveHeading();
    editorContent.addEventListener('scroll', updateActiveHeading);
    return () => editorContent.removeEventListener('scroll', updateActiveHeading);
  }, [documentOutline, editorContentRef, viewMode, activePath]);

  return activeHeadingId;
}

/**
 * 拦截 Markdown 中的外部链接并交给系统浏览器打开。
 * @param {void} 无参数。
 * @returns {void}
 */
export function useOpenExternalLinks() {
  useEffect(() => {
    let lastOpenedLink = '';
    let lastOpenedAt = 0;

    const openExternalLink = (event) => {
      const linkElement = event.target.closest?.('.markdown-body a[href]');
      if (!linkElement || !isExternalLink(linkElement.href)) return;

      event.preventDefault();
      event.stopPropagation();

      const now = Date.now();
      if (linkElement.href === lastOpenedLink && now - lastOpenedAt < 800) return;

      lastOpenedLink = linkElement.href;
      lastOpenedAt = now;
      window.markdownApi?.openExternal?.(linkElement.href);
    };

    document.addEventListener('click', openExternalLink);
    return () => document.removeEventListener('click', openExternalLink);
  }, []);
}

export function useMarkdownImageStatus(editorContentRef, renderedMarkdown) {
  useEffect(() => {
    const editorContent = editorContentRef.current;
    if (!editorContent) return;

    const updateImageState = (event) => {
      const imageElement = event.target;
      if (!(imageElement instanceof HTMLImageElement)) return;

      const imageWrapper = imageElement.closest('.markdown-image');
      if (!imageWrapper) return;

      imageWrapper.classList.toggle('image-load-failed', event.type === 'error');
      imageWrapper.dataset.imageUrl = imageElement.currentSrc || imageElement.src || '';
    };

    editorContent.addEventListener('load', updateImageState, true);
    editorContent.addEventListener('error', updateImageState, true);

    editorContent.querySelectorAll('.markdown-image img').forEach((imageElement) => {
      if (imageElement.complete && imageElement.naturalWidth === 0) {
        imageElement.dispatchEvent(new Event('error'));
      }
    });

    return () => {
      editorContent.removeEventListener('load', updateImageState, true);
      editorContent.removeEventListener('error', updateImageState, true);
    };
  }, [editorContentRef, renderedMarkdown]);
}

/**
 * 搜索面板打开后自动聚焦输入框。
 * @param {boolean} isOpen 搜索面板是否打开。
 * @param {object} searchInputRef 搜索输入框引用。
 * @returns {void}
 */
export function useFocusSearchInput(isOpen, searchInputRef) {
  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isOpen, searchInputRef]);
}

/**
 * 文档切换或重渲染后完成搜索结果跳转。
 * @param {object} pendingSearchTargetRef 待跳转搜索目标。
 * @param {string} activePath 当前文档路径。
 * @param {object|null} activeDocument 当前文档。
 * @param {string} renderedMarkdown 渲染后的 HTML。
 * @param {string} viewMode 当前查看模式。
 * @param {object} editorContentRef 编辑区引用。
 * @returns {void}
 */
export function useSearchResultScroller(pendingSearchTargetRef, activePath, activeDocument, renderedMarkdown, viewMode, editorContentRef) {
  useEffect(() => {
    const pendingSearchTarget = pendingSearchTargetRef.current;
    if (!pendingSearchTarget || pendingSearchTarget.result.path !== activePath) return;

    window.requestAnimationFrame(() => {
      scrollToPendingSearchTarget(pendingSearchTargetRef, editorContentRef, viewMode);
    });
  }, [pendingSearchTargetRef, activePath, activeDocument, renderedMarkdown, viewMode, editorContentRef]);
}

/**
 * 定时检测已打开文件是否被外部修改。
 * @param {object[]} documents 已打开文档。
 * @param {Function} refreshCallback 刷新回调。
 * @returns {void}
 */
export function useAutoRefreshDocuments(documents, refreshCallback) {
  useEffect(() => {
    if (!documents.length) return;

    const timerId = window.setInterval(refreshCallback, 5000);
    return () => window.clearInterval(timerId);
  }, [documents, refreshCallback]);
}

/**
 * 绑定搜索快捷键。
 * @param {Function} openSearchPanel 打开搜索面板。
 * @param {Function} closeSearchPanel 关闭搜索面板。
 * @param {boolean} isSearchOpen 搜索面板是否打开。
 * @returns {void}
 */
export function useSearchShortcuts(openSearchPanel, closeSearchPanel, isSearchOpen) {
  useEffect(() => {
    const handleShortcut = (event) => {
      if (isFindShortcut(event)) {
        event.preventDefault();
        openSearchPanel();
      }

      if (event.key === 'Escape' && isSearchOpen) closeSearchPanel();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openSearchPanel, closeSearchPanel, isSearchOpen]);
}

/**
 * 读取本地保存的会话。
 * @param {void} 无参数。
 * @returns {object|null} 会话数据。
 */
