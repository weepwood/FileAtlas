# FileAtlas 技术架构

## 1. 分层结构

```text
UI Layer
├── Dashboard / Explorer / Space
├── Duplicates / Naming / Health
└── Snapshots / Exports / Settings

Application Layer
├── Scanner
├── Duplicate detector
├── Naming analyzer
├── Snapshot comparator
└── Export generator

Infrastructure Layer
├── File System Access API
├── Web Worker
├── Web Crypto API
└── IndexedDB
```

界面只消费扫描后的轻量元数据。`File` 对象只保存在当前会话的运行时 Map 中，不写入 React 可持久化状态或 IndexedDB。

## 2. 扫描流程

```text
选择目录
  ↓
广度优先遍历目录句柄
  ↓
每 200 个条目合并一次进度通知
  ↓
主线程短暂让出执行权
  ↓
分析 Worker 聚合统计
  ↓
界面展示与按需深度分析
```

默认忽略：

```text
node_modules, .git, .idea, .vscode, dist, build,
target, .next, .cache
```

后续版本会把忽略规则开放为用户设置。

## 3. Worker 边界

### `analysis.worker.ts`

负责：

- 文件数量和目录数量
- 总大小和平均大小
- 扩展名聚合
- 大小区间聚合
- 最大文件排行
- 空文件和空目录计数

### `hash.worker.ts`

负责：

- 文件局部读取
- SHA-256 抽样指纹
- 小文件完整 SHA-256
- 重复分组

Worker 计算失败时，应用会给出明确错误，不会自动把候选文件标记为重复。

## 4. 数据模型

主要记录为 `FileEntryRecord`：

```ts
interface FileEntryRecord {
  id: string
  name: string
  normalizedName: string
  relativePath: string
  parentPath: string
  kind: 'file' | 'directory'
  extension: string
  mimeType: string
  size: number
  lastModified: number
  depth: number
  isEmptyDirectory?: boolean
}
```

快照只保存这些元数据及聚合结果，不保存文件内容或文件句柄。

## 5. 性能策略

- 使用广度优先遍历，避免深递归调用栈。
- 文件表格通过 TanStack Virtual 按可视区域渲染。
- 路由页面使用 React lazy 分包。
- ECharts 只注册饼图、柱图和矩形树图所需模块。
- 重复检测先按大小分组，避免无效哈希。
- 只对候选文件读取内容。
- 对大文件使用抽样指纹，不一次性读取完整内容。
- 单次重复候选上限为 5,000 个。

## 6. 兼容策略

完整模式使用 `showDirectoryPicker()`。不支持时使用带 `webkitdirectory` 的文件输入框降级。

降级模式的限制：

- 无法可靠发现空目录。
- 无法保存持续目录访问权限。
- 无法直接在原目录执行写入。
- 目录信息来自文件的相对路径。

## 7. 写入能力边界

首版不实现原目录修改。未来写入模式需要独立完成：

1. 再次申请 `readwrite` 权限。
2. 生成完整重命名或移动方案。
3. 检查非法名称、同名冲突和循环交换。
4. 使用临时名称解决 `A → B`、`B → A` 的交换问题。
5. 用户逐批确认。
6. 保存操作日志。
7. 提供尽力回滚，但不承诺文件系统级原子事务。
