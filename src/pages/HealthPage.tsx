import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Clock3,
  Copy,
  Eye,
  FileWarning,
  FolderX,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import type { FileEntryRecord } from '../types'
import {
  calculateHealthScore,
  detectJunkReason,
  formatBytes,
  formatRelativeAge,
  nowTimestamp,
} from '../utils/file'
import { copyTextToClipboard, handleSpotlightMove } from '../utils/spotlight'

type RiskKey = 'all' | 'emptyFile' | 'emptyDir' | 'deep' | 'longName' | 'junk' | 'stale'

interface TaggedRiskItem {
  entry: FileEntryRecord
  riskKey: Exclude<RiskKey, 'all'>
  riskLabel: string
}

const STALE_DAYS_THRESHOLD = 180
const STALE_MIN_BYTES = 1024 * 1024 // >= 1 MB cold assets

export function HealthPage() {
  const { entries, status } = useFileAtlasStore()
  const { pushToast, openPreview } = useUiStore()
  const [activeFilter, setActiveFilter] = useState<RiskKey>('all')

  const [referenceTime] = useState(nowTimestamp)

  const {
    emptyFiles,
    emptyDirectories,
    deepEntries,
    longNames,
    junkEntries,
    staleEntries,
    staleTotalBytes,
    healthScore,
    allItems,
  } = useMemo(() => {
    const now = referenceTime
    const staleCutoff = now - STALE_DAYS_THRESHOLD * 86_400_000

    const eFiles = entries.filter((entry) => entry.kind === 'file' && entry.size === 0)
    const eDirs = entries.filter((entry) => entry.kind === 'directory' && entry.isEmptyDirectory)
    const deep = entries.filter((entry) => entry.depth >= 8)
    const long = entries.filter((entry) => entry.name.length >= 120 || entry.relativePath.length >= 240)
    const junk: Array<{ entry: FileEntryRecord; reason: string }> = []
    const stale: FileEntryRecord[] = []

    for (const entry of entries) {
      const reason = detectJunkReason(entry)
      if (reason && entry.size > 0) {
        junk.push({ entry, reason })
      }
      if (
        entry.kind === 'file' &&
        entry.size >= STALE_MIN_BYTES &&
        entry.lastModified > 0 &&
        entry.lastModified <= staleCutoff
      ) {
        stale.push(entry)
      }
    }

    stale.sort((a, b) => b.size - a.size)
    const staleBytes = stale.reduce((sum, item) => sum + item.size, 0)

    const scoreInfo = calculateHealthScore({
      totalEntries: entries.length,
      emptyFileCount: eFiles.length,
      emptyDirCount: eDirs.length,
      deepCount: deep.length,
      longNameCount: long.length,
      junkCount: junk.length,
    })

    const tagged: TaggedRiskItem[] = [
      ...eFiles.map((entry) => ({ entry, riskKey: 'emptyFile' as const, riskLabel: '0 B 空文件' })),
      ...eDirs.map((entry) => ({ entry, riskKey: 'emptyDir' as const, riskLabel: '空文件夹' })),
      ...junk.map(({ entry, reason }) => ({ entry, riskKey: 'junk' as const, riskLabel: reason })),
      ...long.map((entry) => ({ entry, riskKey: 'longName' as const, riskLabel: `${entry.name.length} 字符` })),
      ...deep.map((entry) => ({ entry, riskKey: 'deep' as const, riskLabel: `第 ${entry.depth} 层` })),
      ...stale.map((entry) => ({
        entry,
        riskKey: 'stale' as const,
        riskLabel: `冷归档 · ${formatRelativeAge(entry.lastModified, now)}`,
      })),
    ]

    return {
      emptyFiles: eFiles,
      emptyDirectories: eDirs,
      deepEntries: deep,
      longNames: long,
      junkEntries: junk,
      staleEntries: stale,
      staleTotalBytes: staleBytes,
      healthScore: scoreInfo,
      allItems: tagged,
    }
  }, [entries, referenceTime])

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
      key: 'junk' as const,
      label: '临时与系统残留',
      value: junkEntries.length,
      icon: Sparkles,
      tone: 'violet',
      description: '识别 .DS_Store、Thumbs.db、~$ 锁文件与 .tmp/.bak 备份残留。',
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
      description: '单名 ≥ 120 字符或全路径 ≥ 240 字符，跨系统备份易触发截断。',
    },
    {
      key: 'stale' as const,
      label: '陈旧冷数据',
      value: staleEntries.length,
      icon: Clock3,
      tone: 'emerald',
      description:
        staleTotalBytes > 0
          ? `超过半年未修改的大文件，共占用 ${formatBytes(staleTotalBytes)}。`
          : '未发现超过 180 天未修改的 MB 级冷归档文件。',
    },
  ]

  const displayedItems = (
    activeFilter === 'all' ? allItems : allItems.filter((item) => item.riskKey === activeFilter)
  ).slice(0, 120)

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
          <p>综合评估空对象、系统临时残留、路径风险与半年以上冷归档数据；点击卡片按类筛选。</p>
        </div>
        <div className="health-score-badge">
          <ShieldCheck size={18} className="accent-emerald" />
          <div>
            <span>目录健康度评分</span>
            <strong className="tabular-nums">
              {healthScore.score} 分 · <em>{healthScore.grade}</em>
            </strong>
          </div>
        </div>
      </div>

      <div className="health-grid health-grid-6">
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
            <p>按审计规则聚合展示线索（点击任意项可查看本地预览详情）</p>
          </div>
          {activeFilter !== 'all' && (
            <button type="button" className="chip-btn" onClick={() => setActiveFilter('all')}>
              显示全部 ({allItems.length})
            </button>
          )}
        </div>

        <div className="health-list">
          {displayedItems.map(({ entry, riskKey, riskLabel }) => (
            <div
              className="health-row health-row-clickable"
              key={`${riskKey}-${entry.id}`}
              onClick={() => openPreview(entry.id)}
            >
              <div className="health-row-main">
                <FileTypeIcon kind={entry.kind} extension={entry.extension} size={15} />
                <div>
                  <span>{entry.name}</span>
                  <small>{entry.relativePath}</small>
                </div>
              </div>
              <div className="health-row-meta" onClick={(event) => event.stopPropagation()}>
                <em className={`risk-tag risk-${riskKey}`}>{riskLabel}</em>
                <b className="tabular-nums">{entry.kind === 'file' ? formatBytes(entry.size) : '目录'}</b>
                <button
                  type="button"
                  className="mini-action-btn"
                  title="预览详情"
                  aria-label={`预览 ${entry.name}`}
                  onClick={() => openPreview(entry.id)}
                >
                  <Eye size={13} />
                </button>
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
