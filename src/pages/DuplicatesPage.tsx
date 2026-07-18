import { AlertTriangle, CheckCircle2, Copy, LoaderCircle } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { findDuplicates } from '../services/duplicates'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { formatBytes } from '../utils/file'

export function DuplicatesPage() {
  const { entries, files, status, duplicates, duplicateStatus, setDuplicates, setDuplicateStatus } = useFileAtlasStore()
  if (status === 'idle') return <EmptyState />
  const totalReclaimable = duplicates.reduce((sum, group) => sum + group.reclaimableSize, 0)

  const run = async () => {
    setDuplicateStatus('running')
    try {
      setDuplicates(await findDuplicates(entries, files))
    } catch {
      setDuplicateStatus('error')
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><span className="eyebrow">DUPLICATES</span><h1>重复文件检测</h1><p>先按大小筛选，再计算抽样指纹；128 MB 以内候选会进行完整 SHA-256 校验。</p></div>
        <button className="button primary-button" disabled={duplicateStatus === 'running'} onClick={() => void run()}>{duplicateStatus === 'running' ? <LoaderCircle className="spin" size={17} /> : <Copy size={17} />}{duplicateStatus === 'running' ? '正在计算' : '开始检测'}</button>
      </div>
      <div className="metric-strip"><div><span>重复组</span><strong>{duplicates.length}</strong></div><div><span>可释放空间估算</span><strong>{formatBytes(totalReclaimable)}</strong></div><div><span>检测范围</span><strong>最多 5,000 个候选</strong></div></div>
      {duplicateStatus === 'error' && <div className="notice warning"><AlertTriangle size={18} />检测失败，可能是浏览器不支持 Worker 中的 Web Crypto。</div>}
      {duplicateStatus === 'idle' && <EmptyState title="尚未执行深度检测" description="重复检测会读取候选文件的局部内容；数据仍然只在本机计算。" />}
      {duplicateStatus === 'complete' && duplicates.length === 0 && <EmptyState title="没有发现重复候选" description="当前扫描范围内没有通过大小和哈希校验的重复文件。" />}
      <div className="duplicate-list">
        {duplicates.map((group, index) => (
          <article className="panel duplicate-card" key={group.id}>
            <div className="duplicate-header"><div><span>重复组 {index + 1}</span><strong>{formatBytes(group.size)} × {group.files.length}</strong></div><div className={group.certainty === 'confirmed' ? 'certainty confirmed' : 'certainty probable'}>{group.certainty === 'confirmed' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}{group.certainty === 'confirmed' ? '完整哈希确认' : '抽样指纹一致'}</div></div>
            {group.files.map((file) => <div className="duplicate-file" key={file.id}><span>{file.name}</span><small>{file.relativePath}</small></div>)}
            <footer>保留其中 1 个，预计可释放 {formatBytes(group.reclaimableSize)}。首版仅提供分析，不执行删除。</footer>
          </article>
        ))}
      </div>
    </div>
  )
}
