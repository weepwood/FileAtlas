import { useEffect, useState, type ReactNode } from 'react'
import { Cpu, Database, FolderClock, FolderSearch, HardDriveDownload, ShieldCheck, Sparkles, X } from 'lucide-react'
import { ScanButton } from './ScanButton'
import { deleteRecentDirectory, listRecentDirectories, saveRecentDirectory } from '../services/database'
import { generateDemoWorkspace } from '../services/demo'
import { scanDirectoryHandle } from '../services/scanner'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import type { RecentDirectoryRecord } from '../types'
import { formatBytes, formatRelativeAge, nowTimestamp } from '../utils/file'
import { handleSpotlightMove } from '../utils/spotlight'

interface EmptyStateProps {
  title?: string
  description?: string
  variant?: 'workspace' | 'inline'
  action?: ReactNode
}

export function EmptyState({
  title = '尚未扫描文件夹',
  description = '选择一个本地目录或直接拖拽文件夹至此处，所有扫描、哈希与分析计算均 100% 在当前设备浏览器内完成。',
  variant,
  action,
}: EmptyStateProps) {
  const { status, setScanning, setProgress, setResult, setError } = useFileAtlasStore()
  const { scanConfig, setIsDemo, pushToast } = useUiStore()
  const resolvedVariant = variant ?? (status === 'idle' ? 'workspace' : 'inline')
  const [recentDirs, setRecentDirs] = useState<RecentDirectoryRecord[]>([])

  useEffect(() => {
    if (resolvedVariant !== 'workspace') return
    let active = true
    void listRecentDirectories().then((items) => {
      if (active) setRecentDirs(items.filter((item) => Boolean(item.handle)))
    })
    return () => {
      active = false
    }
  }, [resolvedVariant])

  const loadDemo = () => {
    const demo = generateDemoWorkspace()
    setIsDemo(true)
    setResult(demo.rootName, demo.entries, demo.files, demo.statistics)
    pushToast({
      tone: 'info',
      title: '已载入示例工作区',
      message: '包含可验证 SHA-256 的重复文件、代码文档预览与健康审计样本。',
    })
  }

  const reopenRecent = async (record: RecentDirectoryRecord) => {
    if (!record.handle) return
    try {
      const currentPerm = await record.handle.queryPermission?.({ mode: 'read' })
      if (currentPerm !== 'granted') {
        const nextPerm = await record.handle.requestPermission?.({ mode: 'read' })
        if (nextPerm !== 'granted') return
      }
      setIsDemo(false)
      setScanning()
      const result = await scanDirectoryHandle(record.handle, {
        ...scanConfig,
        onProgress: setProgress,
      })
      setResult(result.rootName, result.entries, result.files, result.statistics)
      void saveRecentDirectory({
        ...record,
        lastScannedAt: nowTimestamp(),
        fileCount: result.statistics.fileCount,
        totalSize: result.statistics.totalSize,
      })
      pushToast({
        tone: 'success',
        title: `已快速重扫「${result.rootName}」`,
        message: `共索引 ${result.statistics.fileCount.toLocaleString()} 个文件 · ${formatBytes(result.statistics.totalSize)}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message)
      pushToast({ tone: 'error', title: '重新读取目录失败', message })
    }
  }

  const removeRecent = async (id: string) => {
    await deleteRecentDirectory(id)
    setRecentDirs((prev) => prev.filter((item) => item.id !== id))
  }

  if (resolvedVariant === 'inline') {
    return (
      <div className="empty-state empty-state-inline spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="empty-icon">
          <FolderSearch size={26} />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        {action && <div className="empty-actions">{action}</div>}
      </div>
    )
  }

  return (
    <section className="hero-empty spotlight-surface" onPointerMove={handleSpotlightMove}>
      <div className="hero-orb-stage" aria-hidden="true">
        <div className="hero-ring ring-outer" />
        <div className="hero-ring ring-middle" />
        <div className="hero-ring ring-inner" />
        <div className="hero-core">
          <FolderSearch size={30} />
        </div>
        <span className="floating-chip chip-top">SHA-256</span>
        <span className="floating-chip chip-right">Zero Upload</span>
        <span className="floating-chip chip-left">Web Worker</span>
      </div>

      <span className="eyebrow">PRIVACY-FIRST LOCAL WORKSPACE</span>
      <h1 className="hero-title">{title === '尚未扫描文件夹' ? '看见结构，理解空间，安心整理' : title}</h1>
      <p className="hero-description">{description}</p>

      <div className="hero-cta-row">
        <ScanButton label="选择本地文件夹" />
        <button type="button" className="button secondary-button" onClick={loadDemo}>
          <Sparkles size={16} />
          <span>体验示例工作区</span>
        </button>
      </div>

      <div className="drop-hint-pill">
        <HardDriveDownload size={14} />
        <span>支持将任意本地文件夹直接拖拽到浏览器窗口中快速扫描 · 按 Ctrl/⌘ + K 全局检索</span>
      </div>

      {recentDirs.length > 0 && (
        <div className="recent-dirs-box" aria-label="最近扫描目录">
          <span className="recent-dirs-label">
            <FolderClock size={13} /> 最近访问目录（一键授权重扫）：
          </span>
          <div className="recent-dirs-list">
            {recentDirs.map((item) => (
              <div className="recent-dir-pill" key={item.id}>
                <button
                  type="button"
                  className="recent-dir-main"
                  onClick={() => void reopenRecent(item)}
                >
                  <strong>{item.name}</strong>
                  <small className="tabular-nums">
                    {formatBytes(item.totalSize)} · {formatRelativeAge(item.lastScannedAt)}
                  </small>
                </button>
                <button
                  type="button"
                  className="recent-dir-remove"
                  aria-label={`移除最近目录 ${item.name}`}
                  onClick={() => void removeRecent(item.id)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hero-pillars">
        <div className="hero-pillar">
          <ShieldCheck size={17} />
          <div>
            <strong>隐私零上传</strong>
            <span>默认只读模式，内容绝不离机</span>
          </div>
        </div>
        <div className="hero-pillar">
          <Cpu size={17} />
          <div>
            <strong>多线程指纹引擎</strong>
            <span>大体积优先校验 + 抽样/完整 SHA-256</span>
          </div>
        </div>
        <div className="hero-pillar">
          <Database size={17} />
          <div>
            <strong>本地快照与导出</strong>
            <span>移动重命名识别 + 独立 HTML 报告</span>
          </div>
        </div>
      </div>
    </section>
  )
}
