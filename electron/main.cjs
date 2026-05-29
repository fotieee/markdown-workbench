const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const isDev = process.argv.includes('--dev');
const titleBarThemes = {
  dark: {
    color: '#101318',
    symbolColor: '#d7dce3'
  },
  light: {
    color: '#f6f7f9',
    symbolColor: '#242932'
  }
};
const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd']);
const pendingOpenFilePaths = getMarkdownFilePathsFromArgs(process.argv);
let lastExternalOpen = {
  href: '',
  openedAt: 0
};
const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'vendor'
]);

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePaths = getMarkdownFilePathsFromArgs(argv);
    const win = BrowserWindow.getAllWindows()[0];

    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    filePaths.forEach((filePath) => sendOpenPathCommand(win, filePath));
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();

  if (!isMarkdownPath(filePath)) return;

  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    sendOpenPathCommand(win, filePath);
    return;
  }

  pendingOpenFilePaths.push(filePath);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 560,
    title: 'Markdown Workbench',
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      ...titleBarThemes.dark,
      height: 34
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.on('context-menu', (_event, params) => {
    createContextMenu(win, params).popup({ window: win });
  });

  if (isDev) {
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
    });
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isExternalUrl(url)) return;

    event.preventDefault();
    openExternalUrl(url);
  });

  win.webContents.once('did-finish-load', () => {
    pendingOpenFilePaths.splice(0).forEach((filePath) => sendOpenPathCommand(win, filePath));
  });

  Menu.setApplicationMenu(createApplicationMenu(win));
  return win;
}

function createApplicationMenu(win) {
  return Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        createRendererMenuItem(win, '打开文件', 'CmdOrCtrl+O', 'open-file'),
        createRendererMenuItem(win, '打开文件夹', 'CmdOrCtrl+Shift+O', 'open-folder'),
        createRendererMenuItem(win, '关闭当前文档', 'CmdOrCtrl+W', 'close-current-document'),
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        createRendererMenuItem(win, '查找当前文档', 'CmdOrCtrl+F', 'search-document'),
        { type: 'separator' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        createRendererMenuItem(win, '预览模式', 'CmdOrCtrl+1', 'view-preview'),
        createRendererMenuItem(win, '源码模式', 'CmdOrCtrl+2', 'view-source'),
        createRendererMenuItem(win, '切换主题', 'CmdOrCtrl+T', 'toggle-theme'),
        createRendererMenuItem(win, '收起/展开文件栏', 'CmdOrCtrl+B', 'toggle-explorer'),
        { type: 'separator' },
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭窗口' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => showAboutDialog(win)
        }
      ]
    }
  ]);
}

function createRendererMenuItem(win, label, accelerator, command) {
  return {
    label,
    accelerator,
    click: () => win.webContents.send('menu:command', command)
  };
}

function createRendererPayloadMenuItem(win, label, command, payload) {
  return {
    label,
    click: () => win.webContents.send('menu:command', command, payload)
  };
}

function createContextMenu(win, params) {
  const menuTemplate = params.isEditable ? createEditableContextMenu() : createReaderContextMenu(win, params);
  return Menu.buildFromTemplate(menuTemplate);
}

function createEditableContextMenu() {
  return [
    { role: 'undo', label: '撤销' },
    { role: 'redo', label: '重做' },
    { type: 'separator' },
    { role: 'cut', label: '剪切' },
    { role: 'copy', label: '复制' },
    { role: 'paste', label: '粘贴' },
    { type: 'separator' },
    { role: 'selectAll', label: '全选' }
  ];
}

function createReaderContextMenu(win, params) {
  return [
    { role: 'copy', label: '复制', enabled: Boolean(params.selectionText) },
    { role: 'selectAll', label: '全选' },
    { type: 'separator' },
    createRendererContextMenuItem(win, '预览模式', 'view-preview'),
    createRendererContextMenuItem(win, '源码模式', 'view-source'),
    createRendererContextMenuItem(win, '关闭当前文档', 'close-current-document'),
    createRendererContextMenuItem(win, '查找当前文档', 'search-document'),
    { type: 'separator' },
    createRendererContextMenuItem(win, '打开文件', 'open-file'),
    createRendererContextMenuItem(win, '打开文件夹', 'open-folder'),
    createRendererContextMenuItem(win, '切换主题', 'toggle-theme'),
    createRendererContextMenuItem(win, '收起/展开文件栏', 'toggle-explorer')
  ];
}

function createRendererContextMenuItem(win, label, command) {
  return {
    label,
    click: () => win.webContents.send('menu:command', command)
  };
}

function createWorkbenchContextMenu(win, context) {
  const payload = context.payload || {};
  const menuTemplate = context.type === 'tab'
    ? createTabContextMenu(win, payload)
    : createFileTreeContextMenu(win, context.type, payload);

  return Menu.buildFromTemplate(menuTemplate);
}

function createTabContextMenu(win, payload) {
  return [
    createRendererPayloadMenuItem(win, '关闭', 'close-document', payload),
    createRendererPayloadMenuItem(win, '关闭其他', 'close-other-documents', payload),
    createRendererPayloadMenuItem(win, '关闭右侧', 'close-documents-to-right', payload),
    { type: 'separator' },
    createPathCopyMenuItem(payload.path),
    createRevealMenuItem(payload.path)
  ];
}

function createFileTreeContextMenu(win, type, payload) {
  const menuTemplate = [
    createPathCopyMenuItem(payload.path),
    createRevealMenuItem(payload.path)
  ];

  if (type === 'file') {
    menuTemplate.unshift(createRendererPayloadMenuItem(win, '打开', 'open-path', payload), { type: 'separator' });
  }

  return menuTemplate;
}

function createPathCopyMenuItem(filePath) {
  return {
    label: '复制路径',
    enabled: Boolean(filePath),
    click: () => clipboard.writeText(filePath)
  };
}

function createRevealMenuItem(filePath) {
  return {
    label: '在资源管理器中显示',
    enabled: Boolean(filePath),
    click: () => shell.showItemInFolder(filePath)
  };
}

function showAboutDialog(win) {
  dialog.showMessageBox(win, {
    type: 'info',
    title: '关于',
    message: 'Markdown 文档工作台',
    detail: '一个支持文件树、多文档标签、主题切换的本地 Markdown 阅读器。'
  });
}

function sendOpenPathCommand(win, filePath) {
  win.webContents.send('menu:command', 'open-path', { path: filePath });
}

function getMarkdownFilePathsFromArgs(argv) {
  return argv.filter((arg) => isMarkdownPath(arg));
}

function isMarkdownPath(filePath) {
  return typeof filePath === 'string' && markdownExtensions.has(path.extname(filePath).toLowerCase());
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('markdown:openFile', async (event) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Select Markdown File',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return readMarkdownFile(result.filePaths[0]);
});

ipcMain.handle('markdown:openFolder', async (event) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Select Markdown Workspace Folder',
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return readMarkdownWorkspace(result.filePaths[0]);
});

ipcMain.handle('markdown:readPath', async (_event, filePath) => {
  return readMarkdownFile(filePath);
});

ipcMain.handle('markdown:readFolderPath', async (_event, folderPath) => {
  return readMarkdownWorkspace(folderPath);
});

ipcMain.handle('markdown:setNativeTheme', async (_event, themeName) => {
  nativeTheme.themeSource = themeName === 'light' ? 'light' : 'dark';
  updateWindowTitleBar(themeName);
});

ipcMain.handle('markdown:openExternal', async (_event, linkHref) => {
  return openExternalUrl(linkHref);
});

function isExternalUrl(linkHref) {
  try {
    const linkUrl = new URL(linkHref);
    return ['http:', 'https:', 'mailto:'].includes(linkUrl.protocol);
  } catch {
    return false;
  }
}

async function openExternalUrl(linkHref) {
  if (!isExternalUrl(linkHref)) return false;

  const linkUrl = new URL(linkHref);
  const now = Date.now();
  if (lastExternalOpen.href === linkUrl.href && now - lastExternalOpen.openedAt < 1000) {
    return true;
  }

  lastExternalOpen = {
    href: linkUrl.href,
    openedAt: now
  };

  await shell.openExternal(linkUrl.href);
  return true;
}

ipcMain.handle('markdown:showContextMenu', (event, context) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;

  createWorkbenchContextMenu(win, context || {}).popup({ window: win });
  return true;
});

function updateWindowTitleBar(themeName) {
  const titleBarTheme = themeName === 'light' ? titleBarThemes.light : titleBarThemes.dark;

  BrowserWindow.getAllWindows().forEach((win) => {
    win.setTitleBarOverlay({
      ...titleBarTheme,
      height: 34
    });
  });
}

async function readMarkdownFile(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('Invalid file path.');
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!markdownExtensions.has(extension)) {
    throw new Error('Please select a Markdown file.');
  }

  const content = await fs.readFile(filePath, 'utf8');
  const stats = await fs.stat(filePath);

  return {
    path: filePath,
    name: path.basename(filePath),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    content
  };
}

async function readMarkdownWorkspace(folderPath) {
  const stats = await fs.stat(folderPath);
  if (!stats.isDirectory()) {
    throw new Error('Please select a folder.');
  }

  const children = await readDirectoryTree(folderPath, 0);

  return {
    path: folderPath,
    name: path.basename(folderPath) || folderPath,
    children,
    fileCount: countMarkdownFiles(children)
  };
}

async function readDirectoryTree(directoryPath, depth) {
  if (depth > 7) {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes = [];

  for (const entry of entries.slice(0, 700)) {
    if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const children = await readDirectoryTree(entryPath, depth + 1);
      if (children.length > 0) {
        nodes.push({
          type: 'folder',
          name: entry.name,
          path: entryPath,
          children
        });
      }
      continue;
    }

    if (entry.isFile() && markdownExtensions.has(path.extname(entry.name).toLowerCase())) {
      nodes.push({
        type: 'file',
        name: entry.name,
        path: entryPath
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    return a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
  });
}

function countMarkdownFiles(nodes) {
  return nodes.reduce((count, node) => {
    if (node.type === 'file') {
      return count + 1;
    }

    return count + countMarkdownFiles(node.children || []);
  }, 0);
}
