# FileAtlas

FileAtlas 是一个运行在浏览器中的本地文件分析与整理工作台。用户主动授权目录后，应用在当前设备中完成扫描、统计、哈希、快照和报告导出，不上传文件内容或目录结构。

> 当前版本为 `0.1.0` MVP，默认只读，不执行删除、移动或重命名。

## 已实现功能

- Chromium File System Access API 目录授权
- `webkitdirectory` 降级选择模式与任意目录拖拽扫描
- 内置一键体验「示例工作区」（含真实可验证 SHA-256 重复文件与审计样本）
- 流式目录遍历、顶部实时进度条反馈和取消扫描
- 文件夹树数据、按列排序、快捷键文件搜索（`/`）和虚拟列表
- 文件类型占比环形图、大小分布柱图、一级目录空间矩形树图与比例排行条
- 最大文件、空文件、空文件夹、深层路径和超长名称分类过滤审计
- 重复文件三级检测：大小分组、抽样 SHA-256、完整 SHA-256
- 相似文件名分组、快捷重命名预设和同名冲突预检
- IndexedDB 本地快照、两次快照差异比较与变更文件明细
- CSV、JSON、Markdown 本地导出与操作通知反馈
- 浏览器能力检测和隐私说明
- 深色星云 / 浅色晨雾双主题切换、指针聚光灯微交互与响应式桌面/移动端界面

## 技术栈

- React 19 + TypeScript
- Vite
- Zustand
- ECharts 按需模块
- Web Worker
- Web Crypto API
- IndexedDB + idb
- TanStack Virtual
- Lucide React

## 快速开始

环境要求：Node.js 20.19 或更高版本。

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run lint
npm test
npm run build
npm run preview
```

## 浏览器支持

| 能力 | Chrome / Edge | Firefox / Safari |
|---|---|---|
| 目录递归扫描 | 完整支持 | 降级选择 |
| 空文件夹识别 | 支持 | 通常不可用 |
| 本地快照 | 支持 | 支持 |
| Web Worker 哈希 | 支持 | 取决于浏览器能力 |
| 原目录写入 | 首版未启用 | 首版未启用 |

FileAtlas 使用能力检测决定是否启用功能，不仅依赖 User-Agent 判断。

## 重复文件检测策略

1. 只处理文件大小相同且数量大于 1 的分组。
2. 读取文件开头、中间和结尾各 64 KB，生成抽样 SHA-256。
3. 对 128 MB 以内的抽样候选计算完整 SHA-256。
4. 大于 128 MB 的候选标记为“抽样指纹一致”，不声称已经完全确认。
5. 单次最多处理 5,000 个候选，避免大目录造成浏览器失去响应。

当前版本只生成分析结果，不删除重复文件。

## 隐私模型

- 文件内容、文件名、目录结构和扫描结果不会发送到项目服务器。
- 部署后的网页仍需要从托管平台加载 HTML、CSS 和 JavaScript 静态资源。
- 快照保存在当前浏览器的 IndexedDB；清理站点数据会删除快照。
- 导出文件由浏览器本地生成。
- 首版不请求写入权限。

## 部署

### GitHub Pages（自动化部署）

仓库已内置 GitHub Actions 工作流（`.github/workflows/deploy.yml` 与 `.github/workflows/ci.yml`）：

1. 在仓库 **Settings → Pages → Build and deployment** 中，将 **Source** 设置为 **GitHub Actions**。
2. 推送代码到 `main` 分支（或在 **Actions** 页面手动触发 `Deploy to GitHub Pages` 工作流）。
3. 工作流会自动完成依赖安装、代码检查、单元测试、动态子路径构建（自动生成 `404.html` SPA 路由回退与 `.nojekyll`）并发布至 `https://<username>.github.io/FileAtlas/`（如绑定自定义域名也会自动适配根路径 `/`）。

### Netlify / 其他静态托管

仓库包含 `netlify.toml`，可以直接导入 Netlify：

- Build command：`npm run build`
- Publish directory：`dist`

也可以部署到任意支持 SPA 回退的静态托管服务。

## 项目结构

```text
src/
├── components/       通用界面、图表、扫描入口
├── pages/            各分析页面
├── services/         扫描、重复检测、快照、导出、IndexedDB
├── store/            Zustand 运行时状态
├── types/            类型定义
├── utils/            文件格式化与统计函数
├── workers/          分析 Worker 与哈希 Worker
└── tests/            单元测试
```

更详细的设计见：

- [技术架构](docs/architecture.md)
- [版本路线](docs/roadmap.md)
- [安全说明](SECURITY.md)

## 开发原则

FileAtlas 按照“看见 → 理解 → 行动”的顺序演进：

1. 先让用户看清目录结构和空间占用。
2. 再提供重复文件、命名和目录健康分析。
3. 写入操作必须先生成方案、检查冲突、明确确认并记录操作日志。

## License

MIT
