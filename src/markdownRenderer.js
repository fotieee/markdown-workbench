import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

export function configureMarkdownRenderer() {
  const renderer = new marked.Renderer();

  renderer.image = (href, title, text) => {
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
    return [
      '<figure class="markdown-image">',
      `<img src="${escapeHtml(href)}" alt="${escapeHtml(text || '')}"${titleAttribute} loading="lazy" decoding="async" referrerpolicy="no-referrer" />`,
      '</figure>'
    ].join('');
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: false,
    headerIds: true,
    mangle: false,
    highlight: highlightMarkdownCode
  });
}

export function renderMarkdown(markdownContent) {
  const sanitizedHtml = DOMPurify.sanitize(marked.parse(markdownContent), {
    ADD_ATTR: ['decoding', 'loading', 'referrerpolicy']
  });

  return normalizeMarkdownImages(sanitizedHtml);
}

/**
 * 高亮 Markdown 中的代码块。
 * @param {string} codeContent 代码块内容。
 * @param {string} languageName Markdown 声明的语言名。
 * @returns {string} 高亮后的 HTML 字符串。
 */
function highlightMarkdownCode(codeContent, languageName) {
  const normalizedLanguage = normalizeCodeLanguage(languageName);

  if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
    return hljs.highlight(codeContent, { language: normalizedLanguage }).value;
  }

  return hljs.highlightAuto(codeContent).value;
}

function normalizeCodeLanguage(languageName = '') {
  const languageAliases = {
    html: 'xml',
    htm: 'xml',
    vue: 'xml',
    js: 'javascript',
    node: 'javascript',
    shell: 'bash',
    sh: 'bash',
    zsh: 'bash',
    ps: 'powershell',
    ps1: 'powershell',
    ts: 'typescript',
    yml: 'yaml',
    md: 'markdown',
    docker: 'dockerfile',
    cplusplus: 'cpp',
    'c++': 'cpp',
    cs: 'csharp',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    kt: 'kotlin',
    kts: 'kotlin',
    golang: 'go'
  };

  const normalizedName = String(languageName).toLowerCase().trim();
  return languageAliases[normalizedName] || normalizedName;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeMarkdownImages(htmlContent) {
  const template = document.createElement('template');
  template.innerHTML = htmlContent;

  template.content.querySelectorAll('img').forEach((imageElement) => {
    imageElement.setAttribute('loading', 'lazy');
    imageElement.setAttribute('decoding', 'async');
    imageElement.setAttribute('referrerpolicy', 'no-referrer');

    if (imageElement.closest('.markdown-image')) return;

    const parentParagraph = imageElement.parentElement?.tagName === 'P' ? imageElement.parentElement : null;
    const paragraphOnlyContainsImage = parentParagraph && parentParagraph.textContent.trim() === '' && parentParagraph.querySelectorAll('img').length === 1;
    const imageWrapper = document.createElement('figure');
    imageWrapper.className = 'markdown-image';

    if (parentParagraph?.getAttribute('align')?.toLowerCase() === 'center') {
      imageWrapper.classList.add('align-center');
    }

    if (paragraphOnlyContainsImage) {
      parentParagraph.replaceWith(imageWrapper);
      imageWrapper.appendChild(imageElement);
      return;
    }

    imageElement.replaceWith(imageWrapper);
    imageWrapper.appendChild(imageElement);
  });

  return template.innerHTML;
}
