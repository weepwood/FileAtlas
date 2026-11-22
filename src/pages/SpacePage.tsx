import { FolderKanban } from 'lucide-react'
import { Chart } from '../components/Chart'
import { EmptyState } from '../components/EmptyState'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'
import { handleSpotlightMove } from '../utils/spotlight'

export function SpacePage() {
  const { entries, statistics, status } = useFileAtlasStore()
  const theme = useUiStore((state) => state.theme)

  if (status === 'idle') return <EmptyState />

  const isDark = theme === 'dark'
  const directorySizes = new Map<string, number>()
  for (const entry of entries) {
    if (entry.kind !== 'file') continue
    const topLevel = entry.relativePath.split('/').slice(0, 2).join('/')
    directorySizes.set(topLevel, (directorySizes.get(topLevel) ?? 0) + entry.size)
  }

  const sortedDirs = [...directorySizes].sort((a, b) => b[1] - a[1])
  const treeData = sortedDirs.slice(0, 30).map(([name, value]) => ({ name, value }))
  const topDir = sortedDirs[0]
  const maxDirSize = topDir?.[1] || 1

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STORAGE INTELLIGENCE</span>
          <h1>空间分析</h1>
          <p>从一级目录矩形树图与累计占用分布快速定位存储空间热点。</p>
        </div>
      </div>

      <div className="metric-strip">
        <div>
          <span>目录总空间</span>
          <strong className="tabular-nums">{formatBytes(statistics.totalSize)}</strong>
        </div>
        <div>
          <span>最大一级单元</span>
          <strong className="truncate-text">{topDir ? topDir[0].split('/').at(-1) : '—'}</strong>
        </div>
        <div>
          <span>最大单文件</span>
          <strong className="tabular-nums">
            {statistics.largestFiles[0] ? formatBytes(statistics.largestFiles[0].size) : '0 B'}
          </strong>
        </div>
      </div>

      <article className="panel chart-panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>一级目录空间矩形树图</h2>
            <p>色块面积越大代表累计占用空间越多，悬停可查看精确体积</p>
          </div>
          <strong className="tabular-nums">{formatBytes(statistics.totalSize)}</strong>
        </div>
        <Chart
          option={{
            tooltip: {
              formatter: (params: any) => {
                const share = statistics.totalSize ? ((params.value / statistics.totalSize) * 100).toFixed(1) : '0.0'
                return `<strong>${params.name}</strong><br/>占用：${formatBytes(params.value)} (${share}%)`
              },
            },
            series: [
              {
                type: 'treemap',
                roam: false,
                nodeClick: false,
                breadcrumb: { show: false },
                label: {
                  color: '#f8fafc',
                  fontWeight: 600,
                  fontSize: 12,
                  formatter: (params: any) => `${params.name.split('/').at(-1)}\n${formatBytes(params.value)}`,
                },
                itemStyle: {
                  borderColor: isDark ? '#091324' : '#f8fafc',
                  borderWidth: 3,
                  gapWidth: 3,
                  borderRadius: 8,
                },
                emphasis: {
                  itemStyle: {
                    borderColor: '#38bdf8',
                  },
                },
                data: treeData,
              },
            ],
          }}
          height={460}
        />
      </article>

      <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>空间热点排行</h2>
            <p>按一级目录累计体积降序排列前 15 项</p>
          </div>
          <span className="panel-pill tabular-nums">共 {sortedDirs.length} 个一级单元</span>
        </div>
        <div className="rank-list">
          {sortedDirs.slice(0, 15).map(([name, size], index) => {
            const pct = statistics.totalSize ? ((size / statistics.totalSize) * 100).toFixed(1) : '0.0'
            const barWidth = Math.max(3, Math.round((size / maxDirSize) * 100))
            return (
              <div className="rank-row rank-row-bar" key={name}>
                <span className="rank-index tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                <div className="rank-entity">
                  <span className="file-type-glyph cat-folder">
                    <FolderKanban size={16} />
                  </span>
                  <div className="rank-entity-copy">
                    <strong>{name}</strong>
                    <small className="tabular-nums">占总空间 {pct}%</small>
                    <div className="proportional-track" aria-hidden="true">
                      <span className="proportional-fill" style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                </div>
                <div className="rank-meta">
                  <span className="share-pill tabular-nums">{pct}%</span>
                  <b className="tabular-nums">{formatBytes(size)}</b>
                </div>
              </div>
            )
          })}
        </div>
      </article>
    </div>
  )
}
