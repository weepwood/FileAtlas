import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Fingerprint, LoaderCircle } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { findDuplicates } from '../services/duplicates'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'
import { copyTextToClipboard, handleSpotlightMove } from '../utils/spotlight'

export function DuplicatesPage() {
  const { entries, files, status, duplicates, duplicateStatus, setDuplicates, setDuplicateStatus } = useFileAtlasStore()
  const { pushToast } = useUiStore()
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'probable'>('all')

  const totalReclaimable = useMemo(
    () => duplicates.reduce((sum, group) => sum + group.reclaimableSize, 0),
    [duplicates],
  )

  const filteredDuplicates = useMemo(
    () => duplicates.filter((group) => filter === 'all' || group.certainty === filter),
    [duplicates, filter],
  )

  if (status === 'idle') return <EmptyState />

  const run = async () => {
    setDuplicateStatus('running')
    try {
      const found = await findDuplicates(entries, files)
      setDuplicates(found)
      const reclaimable = found.reduce((sum, item) => sum + item.reclaimableSize, 0)
      pushToast({
        tone: found.length > 0 ? 'success' : 'info',
        title: found.length > 0 ? `发现 ${found.length} 组重复文件` : '未发现重复文件',
        message: found.length > 0 ? `预计可释放 ${formatBytes(reclaimable)} 空间` : '所有同体积候选均未命中相同指纹',
      })
    } catch {
      setDuplicateStatus('error')
      pushToast({ tone: 'error', title: '重复检测失败', message: '请检查当前浏览器 Web Worker 与 Web Crypto 支持状态。' })
    }
  }

  const handleCopyPath = async (path: string) => {
    if (await copyTextToClipboard(path)) {
      pushToast({ tone: 'success', title: '路径已复制', message: path })
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DUPLICATES</span>
          <h1>重复文件检测</h1>
          <p>三级递进校验：同体积筛选 → 首中尾 64 KB 抽样哈希 → 128 MB 内完整 SHA-256 精确确认。</p>
        </div>
        <button
          type="button"
          className="button primary-button"
          disabled={duplicateStatus === 'running'}
          onClick={() => void run()}
        >
          {duplicateStatus === 'running' ? <LoaderCircle className="spin" size={17} /> : <Fingerprint size={17} />}
          <span>{duplicateStatus === 'running' ? '正在计算哈希…' : duplicates.length ? '重新检测' : '开始深度检测'}</span>
        </button>
      </div>

      <div className="metric-strip">
        <div>
          <span>检出重复组</span>
          <strong className="tabular-nums">{duplicates.length}</strong>
        </div>
        <div>
          <span>预计可释放空间</span>
          <strong className="tabular-nums accent-emerald">{formatBytes(totalReclaimable)}</strong>
        </div>
        <div>
          <span>单次保护上限</span>
          <strong className="tabular-nums">最多 5,000 个候选</strong>
        </div>
      </div>

      {duplicateStatus === 'error' && (
        <div className="notice warning">
          <AlertTriangle size={18} />
          <span>检测失败，可能是当前浏览器环境限制了 Worker 中的 Web Crypto API。</span>
        </div>
      )}

      {duplicateStatus === 'idle' && (
        <EmptyState
          variant="inline"
          title="尚未执行深度指纹校验"
          description="点击右上角「开始深度检测」后，Web Worker 将在本地读取同体积候选并计算 SHA-256 指纹。"
          action={
            <button type="button" className="button primary-button" onClick={() => void run()}>
              <Fingerprint size={17} />
              <span>立即执行本地检测</span>
            </button>
          }
        />
      )}

      {duplicateStatus === 'running' && (
        <div className="panel scanning-placeholder">
          <LoaderCircle className="spin" size={26} />
          <strong>正在后台 Worker 中计算 SHA-256 指纹…</strong>
          <p>文件内容仅在本地内存中分片读取，不会发送到任何外部服务器。</p>
        </div>
      )}

      {duplicateStatus === 'complete' && duplicates.length === 0 && (
        <EmptyState
          variant="inline"
          title="没有发现重复文件"
          description="当前目录中没有通过体积分组与 SHA-256 指纹校验的重复对象。"
        />
      )}

      {duplicates.length > 0 && (
        <>
          <div className="filter-bar">
            <div className="segmented-tabs">
              <button
                type="button"
                className={filter === 'all' ? 'seg-tab active' : 'seg-tab'}
                onClick={() => setFilter('all')}
              >
                全部 <em className="tabular-nums">{duplicates.length}</em>
              </button>
              <button
                type="button"
                className={filter === 'confirmed' ? 'seg-tab active' : 'seg-tab'}
                onClick={() => setFilter('confirmed')}
              >
                完整哈希确认{' '}
                <em className="tabular-nums">{duplicates.filter((g) => g.certainty === 'confirmed').length}</em>
              </button>
              <button
                type="button"
                className={filter === 'probable' ? 'seg-tab active' : 'seg-tab'}
                onClick={() => setFilter('probable')}
              >
                抽样指纹一致{' '}
                <em className="tabular-nums">{duplicates.filter((g) => g.certainty === 'probable').length}</em>
              </button>
            </div>
          </div>

          <div className="duplicate-list">
            {filteredDuplicates.map((group, index) => {
              const sampleHash = group.files[0]?.hash ?? ''
              const shortHash = sampleHash ? `${sampleHash.slice(0, 10)}…${sampleHash.slice(-6)}` : ''
              return (
                <article
                  className="panel duplicate-card spotlight-surface"
                  key={group.id}
                  onPointerMove={handleSpotlightMove}
                >
                  <div className="duplicate-header">
                    <div>
                      <span>
                        重复组 #{index + 1}
                        {shortHash && <code className="hash-badge">SHA-256 · {shortHash}</code>}
                      </span>
                      <strong className="tabular-nums">
                        {formatBytes(group.size)} × {group.files.length} 个副本
                      </strong>
                    </div>
                    <div className={group.certainty === 'confirmed' ? 'certainty confirmed' : 'certainty probable'}>
                      {group.certainty === 'confirmed' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      <span>{group.certainty === 'confirmed' ? '完整哈希确认' : '抽样指纹一致'}</span>
                    </div>
                  </div>

                  <div className="duplicate-files-wrap">
                    {group.files.map((file) => (
                      <div className="duplicate-file" key={file.id}>
                        <div className="duplicate-file-main">
                          <FileTypeIcon kind="file" extension={file.extension} size={15} />
                          <span>{file.name}</span>
                        </div>
                        <div className="duplicate-file-path">
                          <small>{file.relativePath}</small>
                          <button
                            type="button"
                            className="mini-action-btn"
                            title="复制文件相对路径"
                            aria-label={`复制 ${file.name} 路径`}
                            onClick={() => void handleCopyPath(file.relativePath)}
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <footer>
                    <span>保留其中 1 份副本，预计可释放 </span>
                    <strong className="tabular-nums">{formatBytes(group.reclaimableSize)}</strong>
                    <span> · 当前只读模式不执行自动删除。</span>
                  </footer>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
