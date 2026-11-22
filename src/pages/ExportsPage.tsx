import { useState } from 'react'
import { Braces, Check, FileDown, FileText, Sheet } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { exportCsv, exportJson, exportMarkdown } from '../services/export'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'
import { handleSpotlightMove } from '../utils/spotlight'

export function ExportsPage() {
  const { entries, statistics, rootName, status } = useFileAtlasStore()
  const { pushToast } = useUiStore()
  const [recentKey, setRecentKey] = useState<string | null>(null)

  if (status === 'idle') return <EmptyState />

  const triggerExport = (key: string, title: string, fn: () => void) => {
    fn()
    setRecentKey(key)
    pushToast({
      tone: 'success',
      title: `${title}已生成`,
      message: `文件已通过浏览器本地 Blob 流开始下载。`,
    })
    window.setTimeout(() => {
      setRecentKey((prev) => (prev === key ? null : prev))
    }, 2200)
  }

  const formats = [
    {
      key: 'csv',
      ext: '.CSV',
      title: 'CSV 结构清单',
      description: '包含 UTF-8 BOM 头与完整路径、扩展名、字节数、层级和时间戳，适合 Excel、SQL 或 Python 分析。',
      meta: `${entries.length.toLocaleString()} 行明细记录`,
      icon: Sheet,
      action: () => exportCsv(entries, rootName),
    },
    {
      key: 'json',
      ext: '.JSON',
      title: 'JSON 完整快照',
      description: '完整保留聚合统计指标、最大文件榜单与结构化条目数组，便于二次开发或自动化归档流水线。',
      meta: `含 ${Object.keys(statistics.typeCounts).length} 类类型聚合`,
      icon: Braces,
      action: () => exportJson(entries, statistics, rootName),
    },
    {
      key: 'md',
      ext: '.MD',
      title: 'Markdown 诊断报告',
      description: '生成人类可读的概览摘要、最大文件表格与缩进目录树，适合沉淀到 Obsidian、Notion 或 Git 仓库。',
      meta: `总计 ${formatBytes(statistics.totalSize)} 摘要`,
      icon: FileText,
      action: () => exportMarkdown(entries, statistics, rootName),
    },
  ]

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOCAL EXPORT CENTER</span>
          <h1>导出中心</h1>
          <p>所有报告文件均由当前浏览器内存实时构建并触发下载，不经过任何远程服务端。</p>
        </div>
      </div>

      <div className="export-grid">
        {formats.map(({ key, ext, title, description, meta, icon: Icon, action }) => {
          const isDone = recentKey === key
          return (
            <article className="panel export-card spotlight-surface" key={key} onPointerMove={handleSpotlightMove}>
              <div className="export-card-top">
                <div className="export-icon">
                  <Icon size={23} />
                </div>
                <span className="ext-pill">{ext}</span>
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
              <small className="export-meta tabular-nums">{meta}</small>
              <button
                type="button"
                className={isDone ? 'button primary-button' : 'button secondary-button'}
                onClick={() => triggerExport(key, title, action)}
              >
                {isDone ? <Check size={16} /> : <FileDown size={16} />}
                <span>{isDone ? '已生成下载' : '本地生成并下载'}</span>
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
