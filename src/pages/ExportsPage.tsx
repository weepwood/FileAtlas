import { Braces, FileDown, FileText, Sheet } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { exportCsv, exportJson, exportMarkdown } from '../services/export'
import { useFileAtlasStore } from '../store/useFileAtlasStore'

export function ExportsPage() {
  const { entries, statistics, rootName, status } = useFileAtlasStore()
  if (status === 'idle') return <EmptyState />
  const formats = [
    { title: 'CSV 清单', description: '适合 Excel、数据库和后续脚本处理。', icon: Sheet, action: () => exportCsv(entries, rootName) },
    { title: 'JSON 快照', description: '保留完整元数据和统计结果，便于二次开发。', icon: Braces, action: () => exportJson(entries, statistics, rootName) },
    { title: 'Markdown 报告', description: '适合归档到 Notion、Obsidian 或代码仓库。', icon: FileText, action: () => exportMarkdown(entries, statistics, rootName) },
  ]
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">EXPORT</span><h1>导出中心</h1><p>所有报告均由浏览器本地生成，不经过服务器。</p></div></div>
      <div className="export-grid">{formats.map(({ title, description, icon: Icon, action }) => <article className="panel export-card" key={title}><div className="export-icon"><Icon size={24} /></div><h2>{title}</h2><p>{description}</p><button className="button secondary-button" onClick={action}><FileDown size={17} />生成并下载</button></article>)}</div>
    </div>
  )
}
