import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArchiveRestore,
  BarChart3,
  Command,
  Database,
  FileSearch,
  Files,
  FolderTree,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Tags,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FileTypeIcon } from './FileBadge'
import { generateDemoWorkspace } from '../services/demo'
import { exportHtml } from '../services/export'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'

interface PaletteItem {
  id: string
  group: '快捷导航与动作' | '匹配文件与目录'
  title: string
  subtitle: string
  rightMeta?: string
  renderIcon: () => React.ReactNode
  onSelect: () => void
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { rootName, entries, statistics, duplicates, status, setResult } = useFileAtlasStore()
  const { theme, toggleTheme, setIsDemo, pushToast, openPreview } = useUiStore()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLocaleLowerCase()

    const actions: PaletteItem[] = [
      {
        id: 'nav-dashboard',
        group: '快捷导航与动作',
        title: '前往：文件系统总览',
        subtitle: '查看核心统计卡片、格式环形图与冷热数据分布',
        renderIcon: () => <LayoutDashboard size={16} />,
        onSelect: () => {
          onClose()
          navigate('/')
        },
      },
      {
        id: 'nav-explorer',
        group: '快捷导航与动作',
        title: '前往：文件浏览',
        subtitle: '按类别、体积、修改时间检索全量文件与目录',
        renderIcon: () => <FolderTree size={16} />,
        onSelect: () => {
          onClose()
          navigate('/explorer')
        },
      },
      {
        id: 'nav-space',
        group: '快捷导航与动作',
        title: '前往：空间分析树图',
        subtitle: '交互式下钻检视各级目录占用比例',
        renderIcon: () => <BarChart3 size={16} />,
        onSelect: () => {
          onClose()
          navigate('/space')
        },
      },
      {
        id: 'nav-duplicates',
        group: '快捷导航与动作',
        title: '前往：重复文件检测',
        subtitle: '本地 SHA-256 指纹去重与安全隔离脚本生成',
        renderIcon: () => <Files size={16} />,
        onSelect: () => {
          onClose()
          navigate('/duplicates')
        },
      },
      {
        id: 'nav-naming',
        group: '快捷导航与动作',
        title: '前往：命名整理与批量重命名',
        subtitle: '正则/序号/日期模板预览与冲突预检',
        renderIcon: () => <Tags size={16} />,
        onSelect: () => {
          onClose()
          navigate('/naming')
        },
      },
      {
        id: 'nav-health',
        group: '快捷导航与动作',
        title: '前往：目录健康审计',
        subtitle: '健康度评分、临时垃圾残留、空对象与冷数据核查',
        renderIcon: () => <FileSearch size={16} />,
        onSelect: () => {
          onClose()
          navigate('/health')
        },
      },
      {
        id: 'nav-snapshots',
        group: '快捷导航与动作',
        title: '前往：快照与移动/重命名对比',
        subtitle: 'IndexedDB 历史快照与差异追踪',
        renderIcon: () => <Database size={16} />,
        onSelect: () => {
          onClose()
          navigate('/snapshots')
        },
      },
      {
        id: 'nav-exports',
        group: '快捷导航与动作',
        title: '前往：导出中心',
        subtitle: '导出独立 HTML 可视化报告、CSV、JSON 与 Markdown',
        renderIcon: () => <ArchiveRestore size={16} />,
        onSelect: () => {
          onClose()
          navigate('/exports')
        },
      },
      {
        id: 'nav-settings',
        group: '快捷导航与动作',
        title: '前往：扫描过滤配置与隐私能力',
        subtitle: '自定义忽略目录、扫描深度上限与最近目录',
        renderIcon: () => <Settings size={16} />,
        onSelect: () => {
          onClose()
          navigate('/settings')
        },
      },
      {
        id: 'act-theme',
        group: '快捷导航与动作',
        title: theme === 'dark' ? '动作：切换为浅色晨雾主题' : '动作：切换为深色星云主题',
        subtitle: '即时切换全局界面外观配色',
        renderIcon: () => (theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />),
        onSelect: () => {
          toggleTheme()
          onClose()
        },
      },
      {
        id: 'act-demo',
        group: '快捷导航与动作',
        title: '动作：载入示例工作区',
        subtitle: '一键加载包含真实 SHA-256 重复项与代码文档预览的样本',
        renderIcon: () => <Sparkles size={16} />,
        onSelect: () => {
          const demo = generateDemoWorkspace()
          setIsDemo(true)
          setResult(demo.rootName, demo.entries, demo.files, demo.statistics)
          onClose()
          pushToast({ tone: 'info', title: '已载入示例工作区' })
        },
      },
    ]

    if (status === 'complete') {
      actions.push({
        id: 'act-export-html',
        group: '快捷导航与动作',
        title: '动作：立即导出 HTML 独立诊断报告',
        subtitle: `为「${rootName}」生成离线可浏览的单文件报告`,
        renderIcon: () => <Command size={16} />,
        onSelect: () => {
          exportHtml(entries, statistics, rootName, duplicates)
          onClose()
          pushToast({ tone: 'success', title: 'HTML 独立诊断报告已生成' })
        },
      })
    }

    const filteredActions = q
      ? actions.filter(
          (item) =>
            item.title.toLocaleLowerCase().includes(q) || item.subtitle.toLocaleLowerCase().includes(q),
        )
      : actions.slice(0, 7)

    const matchedEntries: PaletteItem[] =
      status === 'complete'
        ? entries
            .filter((entry) =>
              q ? entry.relativePath.toLocaleLowerCase().includes(q) : entry.kind === 'file',
            )
            .sort((a, b) => b.size - a.size)
            .slice(0, q ? 16 : 6)
            .map((entry) => ({
              id: `entry-${entry.id}`,
              group: '匹配文件与目录',
              title: entry.name,
              subtitle: entry.relativePath,
              rightMeta: formatBytes(entry.size),
              renderIcon: () => <FileTypeIcon kind={entry.kind} extension={entry.extension} size={15} />,
              onSelect: () => {
                onClose()
                openPreview(entry.id)
              },
            }))
        : []

    return [...filteredActions, ...matchedEntries]
  }, [
    duplicates,
    entries,
    navigate,
    onClose,
    openPreview,
    pushToast,
    query,
    rootName,
    setIsDemo,
    setResult,
    statistics,
    status,
    theme,
    toggleTheme,
  ])

  const safeActiveIndex = items.length > 0 ? Math.min(activeIndex, items.length - 1) : 0

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => (prev - 1 + items.length) % items.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      items[safeActiveIndex]?.onSelect()
    }
  }

  return (
    <div className="palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="全局命令与文件快速检索"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="palette-search-bar">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="输入文件名、路径关键字或快捷指令…"
          />
          <kbd className="kbd-hint">ESC</kbd>
        </div>

        <div className="palette-results">
          {items.length === 0 ? (
            <div className="palette-empty">未找到匹配「{query}」的指令或文件条目</div>
          ) : (
            items.map((item, idx) => {
              const showGroupHeader = idx === 0 || items[idx - 1].group !== item.group
              return (
                <div key={item.id}>
                  {showGroupHeader && <div className="palette-group-label">{item.group}</div>}
                  <button
                    type="button"
                    className={idx === safeActiveIndex ? 'palette-item is-active' : 'palette-item'}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.onSelect}
                  >
                    <span className="palette-item-icon">{item.renderIcon()}</span>
                    <span className="palette-item-copy">
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                    {item.rightMeta && <b className="palette-item-meta tabular-nums">{item.rightMeta}</b>}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      } else if (event.key === 'Escape' && commandPaletteOpen) {
        event.preventDefault()
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  if (!commandPaletteOpen) return null
  return <CommandPaletteDialog onClose={() => setCommandPaletteOpen(false)} />
}
