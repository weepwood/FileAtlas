# FileAtlas

FileAtlas 是一个运行在浏览器中的本地文件分析与整理工作台。用户主动授权目录后，应用在当前设备中完成扫描、统计、哈希、快照和报告导出，不上传文件内容或目录结构。

> 当前版本为 `0.1.0` MVP，默认只读，不执行删除、移动或重命名。

## 已实现功能

- Chromium File System Access API 目录授权
- `webkitdirectory` 降级选择模式
- 流式目录遍历、进度反馈和取消扫描
- 文件夹树数据、文件搜索和虚拟列表
- 文件类型占比、大小分布、一级目录空间矩形树图
- 最大文件、空文件、空文件夹、深层路径和超长名称审计
- 重复文件三级检测：大小分组、抽样 SHA-256、完整 SHA-256
- 相似文件名分组和批量重命名方案预览
- IndexedDB 本地快照和两次快照差异比较
- CSV、JSON、Markdown 本地导出
- 浏览器能力检测和隐私说明
- 响应式桌面与移动端界面

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
