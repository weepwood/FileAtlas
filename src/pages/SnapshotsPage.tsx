import { useEffect, useMemo, useState } from 'react'
import { Camera, GitCompareArrows, Trash2 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { deleteSnapshot, listSnapshots, saveSnapshot } from '../services/database'
import { compareSnapshots, createSnapshot } from '../services/snapshot'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import type { Snapshot } from '../types'
import { formatBytes } from '../utils/file'

export function SnapshotsPage() {
  const { rootName, entries, statistics, status } = useFileAtlasStore()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState('')
  const reload = async () => setSnapshots(await listSnapshots())
  useEffect(() => {
    let active = true
    void listSnapshots().then((items) => { if (active) setSnapshots(items) })
    return () => { active = false }
  }, [])
  const diff = useMemo(() => {
    const before = snapshots.find((snapshot) => snapshot.id === beforeId)
    const after = snapshots.find((snapshot) => snapshot.id === afterId)
    return before && after ? compareSnapshots(before, after) : null
  }, [afterId, beforeId, snapshots])

  const create = async () => {
    if (status !== 'complete') return
    const snapshot = createSnapshot(rootName, entries, statistics)
    await saveSnapshot(snapshot)
    await reload()
    setAfterId(snapshot.id)
  }

  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">SNAPSHOTS</span><h1>文件夹快照</h1><p>快照只保存目录元数据，不保存文件内容。</p></div><button className="button primary-button" disabled={status !== 'complete'} onClick={() => void create()}><Camera size={17} />保存当前快照</button></div>
      <article className="panel">
        <div className="panel-title"><div><h2>已保存快照</h2><p>数据存放于当前站点的 IndexedDB</p></div></div>
        <div className="snapshot-list">
          {snapshots.map((snapshot) => <div key={snapshot.id}><div><strong>{snapshot.name}</strong><small>{snapshot.statistics.fileCount.toLocaleString()} 个文件 · {formatBytes(snapshot.statistics.totalSize)}</small></div><button className="icon-button" aria-label="删除快照" onClick={async () => { await deleteSnapshot(snapshot.id); await reload() }}><Trash2 size={16} /></button></div>)}
          {!snapshots.length && <p className="muted-text">还没有快照。完成一次扫描后，可以保存当前目录状态。</p>}
        </div>
      </article>
      {snapshots.length >= 2 ? <article className="panel">
        <div className="panel-title"><div><h2>快照差异</h2><p>比较新增、删除、修改与空间变化</p></div><GitCompareArrows size={19} /></div>
        <div className="compare-selects"><label><span>旧快照</span><select value={beforeId} onChange={(event) => setBeforeId(event.target.value)}><option value="">请选择</option>{snapshots.map((snapshot) => <option value={snapshot.id} key={snapshot.id}>{snapshot.name}</option>)}</select></label><label><span>新快照</span><select value={afterId} onChange={(event) => setAfterId(event.target.value)}><option value="">请选择</option>{snapshots.map((snapshot) => <option value={snapshot.id} key={snapshot.id}>{snapshot.name}</option>)}</select></label></div>
        {diff && <div className="diff-grid"><div><span>新增</span><strong>+{diff.added.length}</strong></div><div><span>删除</span><strong>-{diff.removed.length}</strong></div><div><span>修改</span><strong>{diff.modified.length}</strong></div><div><span>空间变化</span><strong>{diff.totalSizeDelta >= 0 ? '+' : '-'}{formatBytes(Math.abs(diff.totalSizeDelta))}</strong></div></div>}
      </article> : <EmptyState title="至少需要两个快照" description="分别在两个时间点重新扫描并保存，就可以比较目录变化。" />}
    </div>
  )
}
