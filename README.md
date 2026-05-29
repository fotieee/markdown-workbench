# Markdown Workbench

Markdown Workbench 是一个使用 Electron + React 构建的本地 Markdown 阅读工作台，适合浏览电脑上的笔记、文档和技术资料。

## 特性

- 打开单个 Markdown 文件，或打开文件夹作为工作区
- 左侧文件树自动展示工作区内的 Markdown 文档
- 支持多文档标签页切换、关闭和右键菜单
- 支持 Markdown 预览、源码视图、目录导航和文档内搜索
- 支持深色/浅色主题、阅读字号和阅读宽度调整
- 支持 JavaScript、TypeScript、HTML、CSS、JSON、Python、Java、Go、Rust、SQL、Shell 等多数常见语言的代码高亮
- 支持 Windows 安装包构建

## 技术栈

- Electron
- React
- Vite
- Marked
- DOMPurify
- Highlight.js
- Lucide React
- Electron Builder

## 快速开始

```bash
npm install
npm run dev
```

## 常用命令

```bash
# 开发模式
npm run dev

# 构建前端资源
npm run build

# 使用已构建资源启动
npm start

# 打包 Windows 安装包
npm run dist

# 生成免安装目录包
npm run pack
```

## 代码高亮

代码块会根据 Markdown 围栏语言自动高亮：

````markdown
```js
const message = 'Hello Markdown Workbench';
console.log(message);
```
````

常见别名也会被识别，例如 `js`、`jsx`、`ts`、`tsx`、`html`、`vue`、`shell`、`ps1`、`yml`、`md`、`docker`、`c++`、`cs`、`py` 等。

为了覆盖更多文档场景，项目默认使用 Highlight.js 全量语言包，因此构建产物会比只支持少数语言的版本更大。

## 开源相关

- [LICENSE](LICENSE)：项目许可证
- [CONTRIBUTING.md](CONTRIBUTING.md)：贡献指南
- [CHANGELOG.md](CHANGELOG.md)：版本变更记录
- [SECURITY.md](SECURITY.md)：安全策略

发布到 GitHub 后，可以在 `package.json` 中补充真实的 `repository`、`homepage` 和 `bugs` 地址。

## 路线图

- 拖拽打开 Markdown 文件或文件夹
- 最近打开列表
- 导出 HTML/PDF
- 自定义主题色
- 更细粒度的组件拆分和测试
