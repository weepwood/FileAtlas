import { Chart } from '../components/Chart'
import { EmptyState } from '../components/EmptyState'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { formatBytes } from '../utils/file'

export function SpacePage() {
  const { entries, statistics, status } = useFileAtlasStore()
  if (status === 'idle') return <EmptyState />
  const directorySizes = new Map<string, number>()
  for (const entry of entries) {
    if (entry.kind !== 'file') continue
    const topLevel = entry.relativePath.split('/').slice(0, 2).join('/')
    directorySizes.set(topLevel, (directorySizes.get(topLevel) ?? 0) + entry.size)
  }
  const treeData = [...directorySizes].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, value]) => ({ name, value }))
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">STORAGE</span><h1>空间分析</h1><p>从目录、类型与文件体积三个维度定位空间热点。</p></div></div>
      <article className="panel chart-panel">
        <div className="panel-title"><div><h2>一级目录空间矩形树图</h2><p>面积越大，占用空间越多</p></div><strong>{formatBytes(statistics.totalSize)}</strong></div>
        <Chart option={{
          tooltip: { formatter: (params: any) => `${params.name}<br/>${formatBytes(params.value)}` },
          series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, label: { color: '#f8fafc', formatter: (params: any) => `${params.name}\n${formatBytes(params.value)}` }, itemStyle: { borderColor: '#0f172a', borderWidth: 3, gapWidth: 3 }, data: treeData }],
        }} height={480} />
      </article>
      <article className="panel">
        <div className="panel-title"><div><h2>空间热点排行</h2><p>按一级目录累计占用排序</p></div></div>
        <div className="rank-list">
          {[...directorySizes].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, size], index) => (
            <div className="rank-row" key={name}><span className="rank-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{name}</strong><small>{statistics.totalSize ? ((size / statistics.totalSize) * 100).toFixed(1) : 0}% 总空间</small></div><b>{formatBytes(size)}</b></div>
          ))}
        </div>
      </article>
    </div>
  )
}
