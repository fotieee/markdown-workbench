const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const screenshotPath = path.join(projectRoot, 'docs', 'screenshot.png');
const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd']);
const sampleMarkdownContent = `# Markdown Workbench

> A calm local workspace for reading Markdown notes, docs, and technical references.

## Overview

Markdown Workbench focuses on a simple desktop reading flow:

1. Open a single Markdown file.
2. Open a folder as a workspace.
3. Switch between multiple documents with tabs.
4. Use the outline to jump across long documents.

## Code Highlighting

\`\`\`ts
type DocumentTab = {
  path: string;
  name: string;
  modifiedAt: string;
};

function openDocument(tab: DocumentTab) {
  console.log(\`Opening \${tab.name}\`);
}
\`\`\`

## Reading Features

| Feature | Status |
| --- | --- |
| Markdown preview | Ready |
| Source view | Ready |
| Document outline | Ready |
| Search | Ready |
| Dark and light themes | Ready |

## Remote Images

Markdown images and inline HTML images are both supported.

## Notes

This screenshot is generated from a temporary demo document, so the README stays clean and reproducible.
`;

ipcMain.handle('markdown:readPath', async (_event, filePath) => readMarkdownFile(filePath));
ipcMain.handle('markdown:openFile', async () => null);
ipcMain.handle('markdown:openFolder', async () => null);
ipcMain.handle('markdown:readFolderPath', async () => null);
ipcMain.handle('markdown:setNativeTheme', async () => true);
ipcMain.handle('markdown:showContextMenu', async () => true);
ipcMain.handle('markdown:openExternal', async (_event, linkHref) => {
  await shell.openExternal(linkHref);
  return true;
});

app.whenReady().then(async () => {
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

  const sampleMarkdownPath = path.join(app.getPath('temp'), 'Markdown Workbench Demo.md');
  await fs.writeFile(sampleMarkdownPath, sampleMarkdownContent, 'utf8');

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    show: false,
    backgroundColor: '#101318',
    webPreferences: {
      preload: path.join(projectRoot, 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: `markdown-workbench-screenshot-${Date.now()}`
    }
  });

  await win.loadFile(path.join(projectRoot, 'dist', 'index.html'));
  await waitForRenderer();

  win.webContents.send('menu:command', 'open-path', { path: sampleMarkdownPath });
  await waitForRenderer();

  const image = await win.capturePage();
  await fs.writeFile(screenshotPath, image.toPNG());
  await fs.rm(sampleMarkdownPath, { force: true });
  app.quit();
});

async function readMarkdownFile(filePath) {
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

function waitForRenderer() {
  return new Promise((resolve) => setTimeout(resolve, 1800));
}
