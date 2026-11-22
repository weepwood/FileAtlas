import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Copy,
  Eye,
  FileCode2,
  Fingerprint,
  LoaderCircle,
  Terminal,
  XCircle,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { findDuplicatesWithSummary } from '../services/duplicates'
import { exportDuplicateQuarantineScript } from '../services/export'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'
import { copyTextToClipboard, handleSpotlightMove } from '../utils/spotlight'

export function DuplicatesPage() {
  const {
    rootName,
    entries,
    files,
    status,
    duplicates,
    duplicateStatus,
    duplicateProgress,
    duplicateSkippedCount,
    setDuplicates,
    setDuplicateStatus,
    setDuplicateProgress,
  } = useFileAtlasStore()
  const { pushToast, openPreview } = useUiStore()
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'probable'>('all')
  const abortRef = useRef<AbortController | null>(null)

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
    const controller = new AbortController()
    abortRef.current = controller
    setDuplicateStatus('running')
    setDuplicateProgress(null)
    try {
      const { groups, skippedCount } = await findDuplicatesWithSummary(entries, files, {
        onProgress: setDuplicateProgress,
        signal: controller.signal,
      })
      setDuplicates(groups, skippedCount)
      const reclaimable = groups.reduce((sum, item) => sum + item.reclaimableSize, 0)
      pushToast({
        tone: groups.length > 0 ? 'success' : 'info',
        title: groups.length > 0 ? `发现 ${groups.length} 组重复文件` : '未发现重复文件',
        message:
          groups.length > 0
            ? `预计可释放 ${formatBytes(reclaimable)} 空间`
            : '所有同体积候选均未命中相同指纹',
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setDuplicateStatus(duplicates.length > 0 ? 'complete' : 'idle')
        setDuplicateProgress(null)
        pushToast({ tone: 'info', title: '已取消重复文件检测' })
        return
      }
      setDuplicateStatus('error')
      setDuplicateProgress(null)
      pushToast({
        tone: 'error',
        title: '重复检测失败',
        message: '请检查当前浏览器 Web Worker 与 Web Crypto 支持状态。',
      })
    } finally {
      abortRef.current = null
    }
  }

  const cancelRun = () => {
    abortRef.current?.abort()
  }

  const handleCopyPath = async (path: string) => {
    if (await copyTextToClipboard(path)) {
      pushToast({ tone: 'success', title: '路径已复制', message: path })
    }
  }

  const handleExportQuarantine = (shell: 'sh' | 'ps1') => {
    exportDuplicateQuarantineScript(duplicates, rootName || 'workspace', shell)
    pushToast({
      tone: 'success',
      title: `已生成 ${shell === 'sh' ? 'Bash' : 'PowerShell'} 安全隔离脚本`,
      message: '脚本仅将冗余副本移入隔离目录，不执行直接删除。',
    })
  }

  const progressPct =
    duplicateProgress && duplicateProgress.total > 0
      ? Math.min(100, Math.round((duplicateProgress.processed / duplicateProgress.total) * 100))
      : 0

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DUPLICATES</span>
          <h1>重复文件检测</h1>
          <p>按大体积优先排序候选 → 首中尾 64 KB 抽样哈希 → 128 MB 内完整 SHA-256 精确确认，并给出智能保留建议。</p>
        </div>
        {duplicateStatus === 'running' ? (
          <button type="button" className="button danger-button" onClick={cancelRun}>
            <XCircle size={17} />
            <span>取消检测</span>
          </button>
        ) : (
          <button type="button" className="button primary-button" onClick={() => void run()}>
            <Fingerprint size={17} />
            <span>{duplicates.length ? '重新检测' : '开始深度检测'}</span>
          </button>
        )}
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
          <span>候选优先级策略</span>
          <strong className="tabular-nums">大体积优先（上限 5,000）</strong>
        </div>
      </div>

      {duplicateSkippedCount > 0 && (
        <div className="notice warning">
          <AlertTriangle size={18} />
          <span>
            同体积候选超出单次 5,000 上限，已优先完成体积最大的 5,000 个文件校验，跳过末尾 {duplicateSkippedCount.toLocaleString()} 个微小候选。
          </span>
        </div>
      )}

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
          description="点击右上角「开始深度检测」后，Web Worker 将按文件从大到小在本地计算 SHA-256 指纹。"
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
          <strong>
            {duplicateProgress
              ? duplicateProgress.phase === 'sampling'
                ? `正在执行抽样哈希校验 (${duplicateProgress.processed.toLocaleString()} / ${duplicateProgress.total.toLocaleString()})…`
                : `正在执行完整 SHA-256 精确确认 (${duplicateProgress.processed.toLocaleString()} / ${duplicateProgress.total.toLocaleString()})…`
              : '正在后台 Worker 中准备同体积分组…'}
          </strong>
          {duplicateProgress && (
            <div className="inline-progress-track" role="progressbar" aria-valuenow={progressPct}>
              <span className="inline-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          )}
          <p>文件内容仅在本地内存中分片读取，可随时点击右上角取消。</p>
        </div>
      )}

      {duplicateStatus === 'complete' && duplicates.length === 0 && (
        <EmptyState
          variant="inline"
          title="没有发现重复文件"
          description="当前目录中没有通过体积分组与 SHA-256 指纹校验的重复对象。"
        />
      )}

      {duplicates.length > 0 && duplicateStatus !== 'running' && (
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

            <div className="script-export-actions">
              <button
                type="button"
                className="chip-btn active"
                title="生成将冗余副本移入隔离目录的 macOS/Linux 脚本"
                onClick={() => handleExportQuarantine('sh')}
              >
                <Terminal size={12} />
                <span>生成隔离脚本 (.sh)</span>
              </button>
              <button
                type="button"
                className="chip-btn"
                title="生成将冗余副本移入隔离目录的 Windows PowerShell 脚本"
                onClick={() => handleExportQuarantine('ps1')}
              >
                <FileCode2 size={12} />
                <span>PowerShell (.ps1)</span>
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
                          {file.isRecommendedKeep && (
                            <b className="keep-recommend-pill" title={file.keepReason}>
                              <Award size={11} /> 推荐保留
                            </b>
                          )}
                        </div>
                        <div className="duplicate-file-path">
                          <small>{file.relativePath}</small>
                          <div className="row-inline-btns">
                            <button
                              type="button"
                              className="mini-action-btn"
                              title="预览文件详情"
                              aria-label={`预览 ${file.name}`}
                              onClick={() => openPreview(file.id)}
                            >
                              <Eye size={13} />
                            </button>
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
                      </div>
                    ))}
                  </div>

                  <footer>
                    <span>保留「推荐保留」主副本后，预计可释放 </span>
                    <strong className="tabular-nums">{formatBytes(group.reclaimableSize)}</strong>
                    <span> · 可导出上方安全隔离脚本辅助本地归档清理。</span>
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
