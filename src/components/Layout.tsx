import { useMemo, useState, type DragEvent } from 'react'
import {
  ArchiveRestore,
  BarChart3,
  Database,
  Files,
  FileSearch,
  FolderSync,
  FolderTree,
  GitBranch,
  HardDriveDownload,
  LayoutDashboard,
  ListRestart,
  Moon,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Tags,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ScanButton } from './ScanButton'
import { ToastViewport } from './ToastViewport'
import { scanDroppedDataTransfer } from '../services/scanner'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'

const navGroups = [
  {
    heading: '洞察与检索',
    items: [
      { to: '/', label: '总览', icon: LayoutDashboard, badgeKey: null },
      { to: '/explorer', label: '文件浏览', icon: FolderTree, badgeKey: 'files' as const },
      { to: '/space', label: '空间分析', icon: BarChart3, badgeKey: null },
    ],
  },
  {
    heading: '治理与审计',
    items: [
      { to: '/duplicates', label: '重复文件', icon: Files, badgeKey: 'duplicates' as const },
      { to: '/naming', label: '命名整理', icon: Tags, badgeKey: null },
      { to: '/health', label: '目录健康', icon: FileSearch, badgeKey: 'risks' as const },
    ],
  },
  {
    heading: '历史与系统',
    items: [
      { to: '/snapshots', label: '快照对比', icon: Database, badgeKey: null },
      { to: '/exports', label: '导出中心', icon: ArchiveRestore, badgeKey: null },
      { to: '/settings', label: '能力与隐私', icon: Settings, badgeKey: null },
    ],
  },
]

export function Layout() {
  const location = useLocation()
  const { rootName, entries, statistics, duplicates, status, progress, setScanning, setProgress, setResult, setError, reset } =
    useFileAtlasStore()
  const { theme, toggleTheme, isDemo, setIsDemo, pushToast } = useUiStore()
  const [dragDepth, setDragDepth] = useState(0)

  const riskCount = useMemo(() => {
    if (status !== 'complete') return 0
    return entries.reduce((sum, entry) => {
      const isEmptyFile = entry.kind === 'file' && entry.size === 0
      const isEmptyDir = entry.kind === 'directory' && entry.isEmptyDirectory
      const isDeep = entry.depth >= 8
      const isLong = entry.name.length >= 120
      return sum + (isEmptyFile || isEmptyDir || isDeep || isLong ? 1 : 0)
    }, 0)
  }, [entries, status])

  const getBadge = (key: 'files' | 'duplicates' | 'risks' | null): string | null => {
    if (status !== 'complete' || !key) return null
    if (key === 'files') return statistics.fileCount > 9999 ? '9.9k+' : statistics.fileCount.toLocaleString()
    if (key === 'duplicates') return duplicates.length > 0 ? String(duplicates.length) : null
    if (key === 'risks') return riskCount > 0 ? String(riskCount) : null
    return null
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    setDragDepth((prev) => prev + 1)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    setDragDepth((prev) => Math.max(0, prev - 1))
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragDepth(0)
    if (status === 'scanning' || !event.dataTransfer) return

    setIsDemo(false)
    setScanning()
    try {
      const result = await scanDroppedDataTransfer(event.dataTransfer, { onProgress: setProgress })
      if (!result) {
        reset()
        return
      }
      setResult(result.rootName, result.entries, result.files, result.statistics)
      pushToast({
        tone: 'success',
        title: `已通过拖拽载入「${result.rootName}」`,
        message: `共索引 ${result.statistics.fileCount.toLocaleString()} 个文件 · ${formatBytes(result.statistics.totalSize)}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message)
      pushToast({ tone: 'error', title: '拖拽读取失败', message })
    }
  }

  const handleReset = () => {
    reset()
    setIsDemo(false)
    pushToast({ tone: 'info', title: '已清空当前会话索引' })
  }

  return (
    <div
      className="app-shell"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
    >
      {dragDepth > 0 && (
        <div className="drop-overlay" role="dialog" aria-label="拖拽文件夹扫描">
          <div className="drop-overlay-card">
            <div className="drop-overlay-icon">
              <HardDriveDownload size={34} />
            </div>
            <h2>释放鼠标以本地扫描目录</h2>
            <p>所有文件索引与哈希仅在当前浏览器沙盒中运行，不会上传任何数据。</p>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ListRestart size={21} />
          </div>
          <div className="brand-copy">
            <strong>FileAtlas</strong>
            <span>Local File Intelligence</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.heading}>
              <small className="nav-group-title">{group.heading}</small>
              {group.items.map(({ to, label, icon: Icon, badgeKey }) => {
                const badge = getBadge(badgeKey)
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                  >
                    <span className="nav-icon-wrap">
                      <Icon size={17} />
                    </span>
                    <span className="nav-label">{label}</span>
                    {badge && <em className={`nav-badge badge-${badgeKey}`}>{badge}</em>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="privacy-shield-card">
            <div className="privacy-shield-icon">
              <ShieldCheck size={16} />
            </div>
            <div>
              <strong>100% 本地计算</strong>
              <span>只读授权 · 零数据上传</span>
            </div>
          </div>
          <a
            className="github-link"
            href="https://github.com/weepwood/FileAtlas"
            target="_blank"
            rel="noreferrer"
          >
            <GitBranch size={15} />
            <span>weepwood/FileAtlas</span>
          </a>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="workspace-indicator">
            <div className={`workspace-folder-badge ${status === 'complete' ? 'is-loaded' : ''}`}>
              <FolderSync size={16} className={status === 'scanning' ? 'spin' : ''} />
            </div>
            <div className="current-folder">
              <div className="current-folder-meta">
                <span>当前工作目录</span>
                {isDemo && status === 'complete' && (
                  <b className="demo-pill">
                    <Sparkles size={11} />
                    示例数据
                  </b>
                )}
              </div>
              <strong>{rootName || '尚未选择本地目录'}</strong>
              {status === 'scanning' && (
                <small className="tabular-nums">
                  {progress.currentPath || '正在建立本地索引'} · {progress.files.toLocaleString()} 个文件 ·{' '}
                  {formatBytes(progress.totalSize)}
                </small>
              )}
              {status === 'complete' && (
                <small className="tabular-nums">
                  {statistics.fileCount.toLocaleString()} 个文件 · {statistics.directoryCount.toLocaleString()} 个目录 ·{' '}
                  {formatBytes(statistics.totalSize)}
                </small>
              )}
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
              title={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {status === 'complete' && (
              <button
                type="button"
                className="icon-button"
                aria-label="重置当前工作区"
                title="清空当前目录索引"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
              </button>
            )}

            <ScanButton label={status === 'complete' ? '切换目录' : '选择文件夹'} />
          </div>

          {status === 'scanning' && <div className="scan-progress-ribbon" aria-hidden="true" />}
        </header>

        <section className="content">
          <div key={location.pathname} className="route-stage">
            <Outlet />
          </div>
        </section>
      </main>

      <ToastViewport />
    </div>
  )
}
