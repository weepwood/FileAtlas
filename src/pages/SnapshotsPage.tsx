import { useEffect, useMemo, useState } from 'react'
import { Camera, GitCompareArrows, Trash2 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { deleteSnapshot, listSnapshots, saveSnapshot } from '../services/database'
import { compareSnapshots, createSnapshot } from '../services/snapshot'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import type { Snapshot } from '../types'
import { formatBytes } from '../utils/file'
import { handleSpotlightMove } from '../utils/spotlight'

export function SnapshotsPage() {
  const { rootName, entries, statistics, status } = useFileAtlasStore()
  const { pushToast } = useUiStore()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState('')
  const [diffTab, setDiffTab] = useState<'added' | 'removed' | 'modified'>('added')

  const reload = async () => setSnapshots(await listSnapshots())

  useEffect(() => {
    let active = true
    void listSnapshots().then((items) => {
      if (active) setSnapshots(items)
    })
    return () => {
      active = false
    }
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
    const updated = await listSnapshots()
    setSnapshots(updated)
    if (updated.length >= 2 && !beforeId) {
      setBeforeId(updated[1].id)
    }
    setAfterId(snapshot.id)
    pushToast({
      tone: 'success',
      title: '本地快照已保存',
      message: `${snapshot.name} · ${statistics.fileCount.toLocaleString()} 个文件`,
    })
  }

  const remove = async (snapshot: Snapshot) => {
    await deleteSnapshot(snapshot.id)
    if (beforeId === snapshot.id) setBeforeId('')
    if (afterId === snapshot.id) setAfterId('')
    await reload()
    pushToast({ tone: 'info', title: '已删除快照', message: snapshot.name })
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SNAPSHOTS & DIFF</span>
          <h1>文件夹快照</h1>
          <p>快照仅保存轻量目录元数据至本地 IndexedDB，可在不同时间点追踪空间增减明细。</p>
        </div>
        <button
          type="button"
          className="button primary-button"
          disabled={status !== 'complete'}
          onClick={() => void create()}
        >
          <Camera size={17} />
          <span>保存当前快照</span>
        </button>
      </div>

      <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>已保存快照</h2>
            <p>数据持久化在当前浏览器的 IndexedDB 中</p>
          </div>
          <span className="panel-pill tabular-nums">{snapshots.length} 份记录</span>
        </div>

        <div className="snapshot-list">
          {snapshots.map((snapshot) => (
            <div className="snapshot-row" key={snapshot.id}>
              <div>
                <strong>{snapshot.name}</strong>
                <small className="tabular-nums">
                  {snapshot.statistics.fileCount.toLocaleString()} 个文件 ·{' '}
                  {snapshot.statistics.directoryCount.toLocaleString()} 个目录 ·{' '}
                  {formatBytes(snapshot.statistics.totalSize)}
                </small>
              </div>
              <div className="snapshot-row-actions">
                {snapshots.length >= 2 && (
                  <>
                    <button
                      type="button"
                      className={beforeId === snapshot.id ? 'chip-btn active' : 'chip-btn'}
                      onClick={() => setBeforeId(snapshot.id)}
                    >
                      设为旧基准
                    </button>
                    <button
                      type="button"
                      className={afterId === snapshot.id ? 'chip-btn active' : 'chip-btn'}
                      onClick={() => setAfterId(snapshot.id)}
                    >
                      设为新目标
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="icon-button danger-hover"
                  aria-label="删除快照"
                  title="删除此快照"
                  onClick={() => void remove(snapshot)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {!snapshots.length && (
            <p className="muted-text">还没有本地快照。完成一次目录扫描或载入示例工作区后，点击右上角即可保存快照。</p>
          )}
        </div>
      </article>

      {snapshots.length >= 2 ? (
        <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="panel-title">
            <div>
              <h2>快照差异对比</h2>
              <p>对比任意两次快照间的新增、删除、体积变更与净空间差值</p>
            </div>
            <GitCompareArrows size={19} className="accent-sky" />
          </div>

          <div className="compare-selects">
            <label>
              <span>基准快照（旧）</span>
              <select value={beforeId} onChange={(event) => setBeforeId(event.target.value)}>
                <option value="">请选择基准快照</option>
                {snapshots.map((snapshot) => (
                  <option value={snapshot.id} key={snapshot.id}>
                    {snapshot.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>目标快照（新）</span>
              <select value={afterId} onChange={(event) => setAfterId(event.target.value)}>
                <option value="">请选择目标快照</option>
                {snapshots.map((snapshot) => (
                  <option value={snapshot.id} key={snapshot.id}>
                    {snapshot.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {diff && (
            <>
              <div className="diff-grid">
                <div>
                  <span>新增条目</span>
                  <strong className="tabular-nums accent-emerald">+{diff.added.length}</strong>
                </div>
                <div>
                  <span>移除条目</span>
                  <strong className="tabular-nums accent-rose">-{diff.removed.length}</strong>
                </div>
                <div>
                  <span>变更文件</span>
                  <strong className="tabular-nums accent-amber">{diff.modified.length}</strong>
                </div>
                <div>
                  <span>净空间变化</span>
                  <strong className="tabular-nums">
                    {diff.totalSizeDelta >= 0 ? '+' : '-'}
                    {formatBytes(Math.abs(diff.totalSizeDelta))}
                  </strong>
                </div>
              </div>

              <div className="diff-detail-box">
                <div className="segmented-tabs">
                  <button
                    type="button"
                    className={diffTab === 'added' ? 'seg-tab active' : 'seg-tab'}
                    onClick={() => setDiffTab('added')}
                  >
                    新增 <em className="tabular-nums">{diff.added.length}</em>
                  </button>
                  <button
                    type="button"
                    className={diffTab === 'removed' ? 'seg-tab active' : 'seg-tab'}
                    onClick={() => setDiffTab('removed')}
                  >
                    移除 <em className="tabular-nums">{diff.removed.length}</em>
                  </button>
                  <button
                    type="button"
                    className={diffTab === 'modified' ? 'seg-tab active' : 'seg-tab'}
                    onClick={() => setDiffTab('modified')}
                  >
                    修改 <em className="tabular-nums">{diff.modified.length}</em>
                  </button>
                </div>

                <div className="diff-items-list">
                  {diffTab === 'added' &&
                    (diff.added.length ? (
                      diff.added.slice(0, 40).map((item) => (
                        <div className="diff-item-row" key={item.id}>
                          <span>{item.relativePath}</span>
                          <b className="accent-emerald tabular-nums">
                            +{item.kind === 'file' ? formatBytes(item.size) : '目录'}
                          </b>
                        </div>
                      ))
                    ) : (
                      <p className="muted-text">两次快照之间没有新增条目。</p>
                    ))}

                  {diffTab === 'removed' &&
                    (diff.removed.length ? (
                      diff.removed.slice(0, 40).map((item) => (
                        <div className="diff-item-row" key={item.id}>
                          <span>{item.relativePath}</span>
                          <b className="accent-rose tabular-nums">
                            -{item.kind === 'file' ? formatBytes(item.size) : '目录'}
                          </b>
                        </div>
                      ))
                    ) : (
                      <p className="muted-text">两次快照之间没有移除条目。</p>
                    ))}

                  {diffTab === 'modified' &&
                    (diff.modified.length ? (
                      diff.modified.slice(0, 40).map(({ before, after }) => {
                        const delta = after.size - before.size
                        return (
                          <div className="diff-item-row" key={after.id}>
                            <span>{after.relativePath}</span>
                            <b className="accent-amber tabular-nums">
                              {formatBytes(before.size)} → {formatBytes(after.size)} ({delta >= 0 ? '+' : '-'}
                              {formatBytes(Math.abs(delta))})
                            </b>
                          </div>
                        )
                      })
                    ) : (
                      <p className="muted-text">两次快照之间没有文件变更。</p>
                    ))}
                </div>
              </div>
            </>
          )}
        </article>
      ) : (
        <EmptyState
          variant="inline"
          title="至少需要两份本地快照才能执行差异对比"
          description="您可以先保存当前目录快照，待整理或再次扫描后保存第二份快照，即可在此精准比对变化。"
        />
      )}
    </div>
  )
}
