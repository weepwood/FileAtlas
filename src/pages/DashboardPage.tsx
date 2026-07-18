import { Chart } from '../components/Chart'
import { Database, Files, FolderOpen, Gauge, Layers3, Trash2 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { StatCard } from '../components/StatCard'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { formatBytes } from '../utils/file'

export function DashboardPage() {
  const { status, statistics, error } = useFileAtlasStore()
  if (status === 'idle') return <EmptyState />
  if (status === 'error') return <EmptyState title="扫描没有完成" description={error || '请重新选择目录。'} />

  const typeData = Object.entries(statistics.typeCounts)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 12)
    .map(([name, value]) => ({ name: name.toUpperCase(), value: value.size }))
  const sizeData = Object.entries(statistics.sizeBuckets)

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><span className="eyebrow">LOCAL OVERVIEW</span><h1>文件系统总览</h1><p>扫描结果仅保留在当前浏览器会话与本地 IndexedDB 中。</p></div>
        <div className="status-chip"><span className={status === 'scanning' ? 'pulse-dot' : 'ok-dot'} />{status === 'scanning' ? '正在扫描' : '分析完成'}</div>
      </div>

      <div className="stat-grid">
        <StatCard label="文件总数" value={statistics.fileCount.toLocaleString()} icon={Files} />
        <StatCard label="文件夹" value={statistics.directoryCount.toLocaleString()} icon={FolderOpen} hint={`最深 ${statistics.maxDepth} 层`} />
        <StatCard label="总占用" value={formatBytes(statistics.totalSize)} icon={Database} />
        <StatCard label="平均文件" value={formatBytes(statistics.averageFileSize)} icon={Gauge} />
        <StatCard label="空文件" value={statistics.emptyFileCount.toLocaleString()} icon={Trash2} />
        <StatCard label="空文件夹" value={statistics.emptyDirectoryCount.toLocaleString()} icon={Layers3} />
      </div>

      <div className="chart-grid">
        <article className="panel chart-panel">
          <div className="panel-title"><div><h2>文件类型占用</h2><p>按扩展名统计空间占比</p></div></div>
          <Chart option={{
            tooltip: { trigger: 'item', formatter: (params: any) => `${params.name}<br/>${formatBytes(params.value)}` },
            legend: { bottom: 0, textStyle: { color: '#94a3b8' } },
            series: [{ type: 'pie', radius: ['48%', '72%'], center: ['50%', '44%'], itemStyle: { borderRadius: 6, borderWidth: 3, borderColor: '#111827' }, label: { show: false }, data: typeData }],
          }} height={330} />
        </article>
        <article className="panel chart-panel">
          <div className="panel-title"><div><h2>文件大小分布</h2><p>观察小文件碎片与大文件集中度</p></div></div>
          <Chart option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 44, right: 16, top: 20, bottom: 68 },
            xAxis: { type: 'category', data: sizeData.map(([name]) => name), axisLabel: { color: '#94a3b8', rotate: 24 }, axisLine: { lineStyle: { color: '#334155' } } },
            yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
            series: [{ type: 'bar', data: sizeData.map(([, value]) => value), barMaxWidth: 36, itemStyle: { borderRadius: [6, 6, 0, 0] } }],
          }} height={330} />
        </article>
      </div>

      <article className="panel">
        <div className="panel-title"><div><h2>最大的文件</h2><p>优先检查最可能释放空间的对象</p></div></div>
        <div className="rank-list">
          {statistics.largestFiles.slice(0, 8).map((file, index) => (
            <div className="rank-row" key={file.id}>
              <span className="rank-index">{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{file.name}</strong><small>{file.relativePath}</small></div>
              <b>{formatBytes(file.size)}</b>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}
