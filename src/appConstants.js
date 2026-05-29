export const VIEW_MODE = {
  preview: 'preview',
  source: 'source'
};

export const THEME_MODE = {
  dark: 'dark',
  light: 'light'
};

export const SESSION_STORAGE_KEY = 'markdown-workbench-session';

export const EXPLORER_WIDTH_SETTING = {
  min: 220,
  max: 480,
  defaultValue: 306,
  collapsedValue: 44
};

export const FONT_SIZE_SETTING = {
  min: 14,
  max: 22,
  defaultValue: 16
};

export const DOCUMENT_WIDTH = {
  narrow: 'narrow',
  normal: 'normal',
  wide: 'wide'
};

export const DOCUMENT_WIDTH_OPTIONS = [
  { value: DOCUMENT_WIDTH.narrow, label: '窄' },
  { value: DOCUMENT_WIDTH.normal, label: '标准' },
  { value: DOCUMENT_WIDTH.wide, label: '宽' }
];

export const SEARCH_SCOPE = {
  document: 'document'
};

export const EMPTY_SEARCH_STATE = {
  isOpen: false,
  scope: SEARCH_SCOPE.document,
  query: '',
  results: [],
  activeIndex: -1,
  hasRun: false,
  isSearching: false
};
