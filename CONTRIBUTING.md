# 贡献指南

感谢你愿意为 Markdown Workbench 做贡献。

## 本地开发

```bash
npm install
npm run dev
```

## 提交前检查

```bash
npm run build
```

## 建议

- 保持功能改动聚焦，避免一次提交混入大量无关重构。
- 涉及界面的改动请附上截图或录屏。
- 新增 Electron 主进程能力时，请优先通过 preload 暴露最小 API。
