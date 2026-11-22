import { useMemo, useState } from 'react'
import { AlertCircle, Copy, FileWarning, FolderX, Layers3 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import type { FileEntryRecord } from '../types'
import { formatBytes } from '../utils/file'
import { copyTextToClipboard, handleSpotlightMove } from '../utils/spotlight'

type RiskKey = 'all' | 'emptyFile' | 'emptyDir' | 'deep' | 'longName'

interface TaggedRiskItem {
  entry: FileEntryRecord
  riskKey: Exclude<RiskKey, 'all'>
  riskLabel: string
}

export function HealthPage() {
  const { entries, status } = useFileAtlasStore()
  const { pushToast } = useUiStore()
  const [activeFilter, setActiveFilter] = useState<RiskKey>('all')

  const { emptyFiles, emptyDirectories, deepEntries, longNames, allItems } = useMemo(() => {
    const eFiles = entries.filter((entry) => entry.kind === 'file' && entry.size === 0)
    const eDirs = entries.filter((entry) => entry.kind === 'directory' && entry.isEmptyDirectory)
    const deep = entries.filter((entry) => entry.depth >= 8)
    const long = entries.filter((entry) => entry.name.length >= 120)

    const tagged: TaggedRiskItem[] = [
      ...eFiles.map((entry) => ({ entry, riskKey: 'emptyFile' as const, riskLabel: '0 B 空文件' })),
      ...eDirs.map((entry) => ({ entry, riskKey: 'emptyDir' as const, riskLabel: '空文件夹' })),
      ...long.map((entry) => ({ entry, riskKey: 'longName' as const, riskLabel: `${entry.name.length} 字符` })),
      ...deep.map((entry) => ({ entry, riskKey: 'deep' as const, riskLabel: `第 ${entry.depth} 层` })),
    ]

    return {
      emptyFiles: eFiles,
      emptyDirectories: eDirs,
      deepEntries: deep,
      longNames: long,
      allItems: tagged,
    }
  }, [entries])

  if (status === 'idle') return <EmptyState />

  const risks = [
    {
      key: 'emptyFile' as const,
      label: '空文件',
      value: emptyFiles.length,
      icon: FileWarning,
      tone: 'amber',
      description: '可能是未完成写入、锁占位文件或构建残留产物。',
    },
    {
      key: 'emptyDir' as const,
      label: '空文件夹',
      value: emptyDirectories.length,
      icon: FolderX,
      tone: 'rose',
      description: '完整目录句柄授权或拖拽目录模式可精确识别空目录。',
    },
    {
      key: 'deep' as const,
      label: '深层路径',
      value: deepEntries.length,
      icon: Layers3,
      tone: 'indigo',
      description: '目录嵌套达到 8 层及以上，归档与检索心智负担较高。',
    },
    {
      key: 'longName' as const,
      label: '超长文件名',
      value: longNames.length,
      icon: AlertCircle,
      tone: 'cyan',
      description: '单名称达 120 字符及以上，跨系统备份迁移时易触发路径截断。',
    },
  ]

  const displayedItems = (
    activeFilter === 'all' ? allItems : allItems.filter((item) => item.riskKey === activeFilter)
  ).slice(0, 100)

  const handleCopyPath = async (path: string) => {
    if (await copyTextToClipboard(path)) {
      pushToast({ tone: 'success', title: '路径已复制', message: path })
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DIRECTORY HEALTH</span>
          <h1>目录健康审计</h1>
          <p>点击任意风险卡片即可按类别过滤下方核查清单；所有规则仅作治理线索参考。</p>
        </div>
      </div>

      <div className="health-grid">
        {risks.map(({ key, label, value, icon: Icon, description, tone }) => {
          const isSelected = activeFilter === key
          return (
            <button
              type="button"
              aria-pressed={isSelected}
              className={`panel health-card spotlight-surface tone-${tone} ${isSelected ? 'is-selected' : ''}`}
              key={key}
              onPointerMove={handleSpotlightMove}
              onClick={() => setActiveFilter((prev) => (prev === key ? 'all' : key))}
            >
              <div className="health-card-top">
                <span className="stat-icon">
                  <Icon size={19} />
                </span>
                <span className="filter-state-pill">{isSelected ? '已筛选' : '点击筛选'}</span>
              </div>
              <strong className="tabular-nums">{value.toLocaleString()}</strong>
              <h2>{label}</h2>
              <p>{description}</p>
            </button>
          )
        })}
      </div>

      <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>需要关注的对象</h2>
            <p>按审计规则聚合展示前 100 条线索</p>
          </div>
          {activeFilter !== 'all' && (
            <button type="button" className="chip-btn" onClick={() => setActiveFilter('all')}>
              显示全部 ({allItems.length})
            </button>
          )}
        </div>

        <div className="health-list">
          {displayedItems.map(({ entry, riskKey, riskLabel }) => (
            <div className="health-row" key={`${riskKey}-${entry.id}`}>
              <div className="health-row-main">
                <FileTypeIcon kind={entry.kind} extension={entry.extension} size={15} />
                <div>
                  <span>{entry.name}</span>
                  <small>{entry.relativePath}</small>
                </div>
              </div>
              <div className="health-row-meta">
                <em className={`risk-tag risk-${riskKey}`}>{riskLabel}</em>
                <b className="tabular-nums">{entry.kind === 'file' ? formatBytes(entry.size) : '目录'}</b>
                <button
                  type="button"
                  className="mini-action-btn"
                  title="复制相对路径"
                  aria-label={`复制 ${entry.name} 路径`}
                  onClick={() => void handleCopyPath(entry.relativePath)}
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
          ))}
          {!displayedItems.length && <p className="muted-text">当前筛选条件下没有发现需要特别关注的对象。</p>}
        </div>
      </article>
    </div>
  )
}
