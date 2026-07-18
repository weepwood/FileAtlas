import { AlertCircle, FileWarning, FolderX, Layers3 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { formatBytes } from '../utils/file'

export function HealthPage() {
  const { entries, status } = useFileAtlasStore()
  if (status === 'idle') return <EmptyState />
  const emptyFiles = entries.filter((entry) => entry.kind === 'file' && entry.size === 0)
  const emptyDirectories = entries.filter((entry) => entry.kind === 'directory' && entry.isEmptyDirectory)
  const deepEntries = entries.filter((entry) => entry.depth >= 8)
  const longNames = entries.filter((entry) => entry.name.length >= 120)
  const risks = [
    { label: '空文件', value: emptyFiles.length, icon: FileWarning, description: '可能是未完成写入、占位文件或无效产物。' },
    { label: '空文件夹', value: emptyDirectories.length, icon: FolderX, description: '仅完整目录授权模式能够可靠识别。' },
    { label: '深层路径', value: deepEntries.length, icon: Layers3, description: '目录深度达到 8 层及以上，维护成本可能增加。' },
    { label: '超长文件名', value: longNames.length, icon: AlertCircle, description: '名称达到 120 个字符及以上，跨平台迁移时可能出现问题。' },
  ]
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">HEALTH</span><h1>目录健康</h1><p>这些规则只提供审计线索，不会把异常直接等同于错误。</p></div></div>
      <div className="health-grid">{risks.map(({ label, value, icon: Icon, description }) => <article className="panel health-card" key={label}><Icon size={21} /><strong>{value.toLocaleString()}</strong><h2>{label}</h2><p>{description}</p></article>)}</div>
      <article className="panel">
        <div className="panel-title"><div><h2>需要关注的对象</h2><p>按风险规则汇总前 100 条</p></div></div>
        <div className="health-list">
          {[...emptyFiles, ...emptyDirectories, ...longNames, ...deepEntries].slice(0, 100).map((entry) => <div key={`${entry.id}-${entry.relativePath}`}><span>{entry.name}</span><small>{entry.relativePath}</small><b>{entry.kind === 'file' ? formatBytes(entry.size) : '目录'}</b></div>)}
          {!emptyFiles.length && !emptyDirectories.length && !longNames.length && !deepEntries.length && <p className="muted-text">当前规则没有发现需要特别关注的对象。</p>}
        </div>
      </article>
    </div>
  )
}
