import {
  ArchiveRestore,
  BarChart3,
  Database,
  Files,
  FileSearch,
  FolderTree,
  GitBranch,
  LayoutDashboard,
  ListRestart,
  Settings,
  ShieldCheck,
  Tags,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { ScanButton } from './ScanButton'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { formatBytes } from '../utils/file'

const navigation = [
  { to: '/', label: '总览', icon: LayoutDashboard },
  { to: '/explorer', label: '文件浏览', icon: FolderTree },
  { to: '/space', label: '空间分析', icon: BarChart3 },
  { to: '/duplicates', label: '重复文件', icon: Files },
  { to: '/naming', label: '命名整理', icon: Tags },
  { to: '/health', label: '目录健康', icon: FileSearch },
  { to: '/snapshots', label: '快照对比', icon: Database },
  { to: '/exports', label: '导出中心', icon: ArchiveRestore },
  { to: '/settings', label: '能力与隐私', icon: Settings },
]

export function Layout() {
  const { rootName, status, progress } = useFileAtlasStore()
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ListRestart size={22} /></div>
          <div><strong>FileAtlas</strong><span>Local file intelligence</span></div>
        </div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a href="https://github.com/weepwood/FileAtlas" target="_blank" rel="noreferrer"><GitBranch size={16} /> GitHub</a>
          <div className="privacy-note"><ShieldCheck size={16} /><span>文件内容不会上传</span></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="current-folder">
            <span>当前目录</span>
            <strong>{rootName || '尚未选择'}</strong>
            {status === 'scanning' && <small>{progress.currentPath || '正在建立本地索引'} · {progress.files.toLocaleString()} 个文件 · {formatBytes(progress.totalSize)}</small>}
          </div>
          <ScanButton />
        </header>
        <section className="content"><Outlet /></section>
      </main>
    </div>
  )
}
