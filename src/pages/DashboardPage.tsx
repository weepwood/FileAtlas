import { useState, type CSSProperties } from 'react'
import { ArrowUpRight, Clock3, Copy, Database, Eye, Files, FolderOpen, Gauge, Layers3, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Chart } from '../components/Chart'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { StatCard } from '../components/StatCard'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { AGE_BUCKETS, formatBytes } from '../utils/file'
import { formatSharePercent } from '../utils/space'
import { copyTextToClipboard, handleSpotlightMove } from '../utils/spotlight'

export function DashboardPage() {
  const navigate = useNavigate()
  const { status, statistics, error } = useFileAtlasStore()
  const { theme, pushToast, openPreview } = useUiStore()
  const [distTab, setDistTab] = useState<'size' | 'age'>('size')

  if (status === 'idle') return <EmptyState />
  if (status === 'error') return <EmptyState variant="inline" title="扫描没有完成" description={error || '请重新选择目录。'} />

  const isDark = theme === 'dark'
  const typeData = Object.entries(statistics.typeCounts)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
    .map(([name, value]) => ({ name: name.toUpperCase(), rawExt: name, value: value.size, count: value.count }))
  const sizeData = Object.entries(statistics.sizeBuckets)
  const ageData = AGE_BUCKETS.map((bucket) => [
    bucket,
    statistics.ageBuckets?.[bucket] ?? { count: 0, size: 0 },
  ] as const)

  const coldBytes =
    (statistics.ageBuckets?.['6–12 个月']?.size ?? 0) + (statistics.ageBuckets?.['1 年以上']?.size ?? 0)

  const largestTop = statistics.largestFiles.slice(0, 8)
  const maxLargestSize = largestTop[0]?.size || 1

  const onCopyPath = async (path: string) => {
    const ok = await copyTextToClipboard(path)
    if (ok) {
      pushToast({ tone: 'success', title: '路径已复制到剪贴板', message: path })
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOCAL OVERVIEW</span>
          <h1>文件系统总览</h1>
          <p>扫描结果仅保留在当前浏览器会话与本地 IndexedDB 中；点击图表色块可直接联动跳转筛选。</p>
        </div>
        <div className="heading-actions">
          <div className="status-chip">
            <span className={status === 'scanning' ? 'pulse-dot' : 'ok-dot'} />
            <span>{status === 'scanning' ? '正在流式扫描' : '本地索引就绪'}</span>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          index={0}
          tone="cyan"
          label="文件总数"
          value={statistics.fileCount.toLocaleString()}
          rawValue={statistics.fileCount}
          hint={`${Object.keys(statistics.typeCounts).length} 种扩展类型`}
          icon={Files}
        />
        <StatCard
          index={1}
          tone="indigo"
          label="目录总数"
          value={statistics.directoryCount.toLocaleString()}
          rawValue={statistics.directoryCount}
          hint={`最深 ${statistics.maxDepth} 层嵌套`}
          icon={FolderOpen}
        />
        <StatCard
          index={2}
          tone="emerald"
          label="总空间占用"
          value={formatBytes(statistics.totalSize)}
          rawValue={statistics.totalSize}
          formatter={formatBytes}
          hint={coldBytes > 0 ? `半年以上冷数据 ${formatBytes(coldBytes)}` : '按实际字节累计'}
          icon={Database}
        />
        <StatCard
          index={3}
          tone="violet"
          label="平均单文件"
          value={formatBytes(statistics.averageFileSize)}
          rawValue={statistics.averageFileSize}
          formatter={formatBytes}
          hint="均值体积参考"
          icon={Gauge}
        />
        <StatCard
          index={4}
          tone={statistics.emptyFileCount > 0 ? 'amber' : 'cyan'}
          label="空文件"
          value={statistics.emptyFileCount.toLocaleString()}
          rawValue={statistics.emptyFileCount}
          hint={statistics.emptyFileCount > 0 ? '可在健康页核查' : '未发现 0 字节文件'}
          icon={Trash2}
        />
        <StatCard
          index={5}
          tone={statistics.emptyDirectoryCount > 0 ? 'rose' : 'indigo'}
          label="空文件夹"
          value={statistics.emptyDirectoryCount.toLocaleString()}
          rawValue={statistics.emptyDirectoryCount}
          hint={statistics.emptyDirectoryCount > 0 ? '可在健康页核查' : '结构整洁'}
          icon={Layers3}
        />
      </div>

      <div className="quick-jump-strip">
        <Link to="/space" className="quick-jump-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div>
            <span>空间热点定位</span>
            <strong>查看目录树图下钻与占比排行</strong>
          </div>
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/duplicates" className="quick-jump-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div>
            <span>深度去重分析</span>
            <strong>运行大体积优先 SHA-256 指纹校验</strong>
          </div>
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/health" className="quick-jump-card spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div>
            <span>健康度与冷数据体检</span>
            <strong>排查空对象、临时残留与陈旧归档</strong>
          </div>
          <ArrowUpRight size={17} />
        </Link>
      </div>

      <div className="chart-grid">
        <article className="panel chart-panel spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="panel-title">
            <div>
              <h2>文件类型占用</h2>
              <p>按扩展名聚合前 10 类空间分布（点击扇区可筛选浏览）</p>
            </div>
            <span className="panel-pill tabular-nums">{typeData.length} 类主流格式</span>
          </div>
          <Chart
            onItemClick={(name) => {
              const matched = typeData.find((item) => item.name === name)
              const ext = matched ? matched.rawExt : name.toLocaleLowerCase()
              navigate(`/explorer?ext=${encodeURIComponent(ext)}`)
            }}
            option={{
              tooltip: {
                trigger: 'item',
                formatter: (params: any) => {
                  const pct = statistics.totalSize ? (Number(params.value) / statistics.totalSize) * 100 : 0
                  const count = params.data?.count ?? 0
                  return `<strong>${params.name}</strong><br/>空间：${formatBytes(params.value)} (${formatSharePercent(pct)})<br/>文件数：${Number(count).toLocaleString()} 个<br/><span style="opacity:.72;font-size:11px">点击前往文件浏览筛选此类型</span>`
                },
              },
              legend: {
                bottom: 6,
                icon: 'circle',
                itemWidth: 8,
                itemHeight: 8,
                textStyle: { color: isDark ? '#94a3b8' : '#475569', fontSize: 11 },
              },
              series: [
                {
                  type: 'pie',
                  minAngle: 7,
                  radius: ['50%', '74%'],
                  center: ['50%', '43%'],
                  avoidLabelOverlap: true,
                  itemStyle: {
                    borderRadius: 7,
                    borderWidth: 3,
                    borderColor: isDark ? '#0c1627' : '#ffffff',
                  },
                  label: {
                    show: true,
                    position: 'center',
                    formatter: () => `{total|${formatBytes(statistics.totalSize)}}\n{sub|总占用空间}`,
                    rich: {
                      total: {
                        fontSize: 18,
                        fontWeight: 700,
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        lineHeight: 26,
                      },
                      sub: {
                        fontSize: 11,
                        color: '#64748b',
                      },
                    },
                  },
                  emphasis: {
                    scale: true,
                    scaleSize: 6,
                  },
                  data: typeData,
                },
              ],
            }}
            height={340}
          />
        </article>

        <article className="panel chart-panel spotlight-surface" onPointerMove={handleSpotlightMove}>
          <div className="panel-title">
            <div>
              <h2>{distTab === 'size' ? '文件大小分布' : '冷热数据时间分布'}</h2>
              <p>
                {distTab === 'size'
                  ? '观察小文件碎片密度与大文件区间（点击柱条筛选）'
                  : '按最后修改时间透视活跃资产与陈旧冷归档空间'}
              </p>
            </div>
            <div className="segmented-tabs" role="tablist" aria-label="分布视角切换">
              <button
                type="button"
                role="tab"
                aria-selected={distTab === 'size'}
                className={distTab === 'size' ? 'seg-tab active' : 'seg-tab'}
                onClick={() => setDistTab('size')}
              >
                大小区间
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={distTab === 'age'}
                className={distTab === 'age' ? 'seg-tab active' : 'seg-tab'}
                onClick={() => setDistTab('age')}
              >
                <Clock3 size={12} /> 冷热时间
              </button>
            </div>
          </div>

          {distTab === 'size' ? (
            <Chart
              key="dist-size"
              onItemClick={(bucketName) => {
                navigate(`/explorer?sizeBucket=${encodeURIComponent(bucketName)}`)
              }}
              option={{
                tooltip: {
                  trigger: 'axis',
                  axisPointer: { type: 'shadow' },
                  formatter: (params: any) => {
                    const item = Array.isArray(params) ? params[0] : params
                    return `<strong>${item.name}</strong><br/>数量：${Number(item.value).toLocaleString()} 个文件<br/><span style="opacity:.72;font-size:11px">点击查看该体积区间文件</span>`
                  },
                },
                grid: { left: 48, right: 18, top: 24, bottom: 68 },
                xAxis: {
                  type: 'category',
                  data: sizeData.map(([name]) => name),
                  axisLabel: { color: isDark ? '#94a3b8' : '#475569', rotate: 22, fontSize: 11 },
                  axisLine: { lineStyle: { color: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.12)' } },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { color: isDark ? '#94a3b8' : '#475569', fontSize: 11 },
                  splitLine: {
                    lineStyle: {
                      color: isDark ? 'rgba(148,163,184,0.09)' : 'rgba(15,23,42,0.07)',
                      type: 'dashed',
                    },
                  },
                },
                series: [
                  {
                    type: 'bar',
                    data: sizeData.map(([name, value]) => ({ name, value })),
                    barMaxWidth: 34,
                    itemStyle: {
                      borderRadius: [8, 8, 2, 2],
                      color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                          { offset: 0, color: '#38bdf8' },
                          { offset: 1, color: '#6366f1' },
                        ],
                      },
                    },
                  },
                ],
              }}
              height={340}
            />
          ) : (
            <Chart
              key="dist-age"
              onItemClick={(ageName) => {
                navigate(`/explorer?ageBucket=${encodeURIComponent(ageName)}`)
              }}
              option={{
                tooltip: {
                  trigger: 'axis',
                  axisPointer: { type: 'shadow' },
                  formatter: (params: any) => {
                    const item = Array.isArray(params) ? params[0] : params
                    const count = item.data?.count ?? 0
                    return `<strong>${item.name}</strong><br/>占用空间：${formatBytes(Number(item.value))}<br/>文件数量：${Number(count).toLocaleString()} 个<br/><span style="opacity:.72;font-size:11px">点击筛选该时间段文件</span>`
                  },
                },
                grid: { left: 56, right: 18, top: 24, bottom: 52 },
                xAxis: {
                  type: 'category',
                  data: ageData.map(([name]) => name),
                  axisLabel: { color: isDark ? '#94a3b8' : '#475569', fontSize: 11 },
                  axisLine: { lineStyle: { color: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.12)' } },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: {
                    color: isDark ? '#94a3b8' : '#475569',
                    fontSize: 11,
                    formatter: (val: number) => formatBytes(val),
                  },
                  splitLine: {
                    lineStyle: {
                      color: isDark ? 'rgba(148,163,184,0.09)' : 'rgba(15,23,42,0.07)',
                      type: 'dashed',
                    },
                  },
                },
                series: [
                  {
                    type: 'bar',
                    data: ageData.map(([name, info]) => ({ name, value: info.size, count: info.count })),
                    barMaxWidth: 38,
                    itemStyle: {
                      borderRadius: [8, 8, 2, 2],
                      color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                          { offset: 0, color: '#34d399' },
                          { offset: 1, color: '#0284c7' },
                        ],
                      },
                    },
                  },
                ],
              }}
              height={340}
            />
          )}
        </article>
      </div>

      <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>体积最大的文件</h2>
            <p>点击任意行可打开本地快速预览抽屉与单文件 SHA-256 校验</p>
          </div>
          <Link to="/explorer" className="text-link">
            浏览全部文件 <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="rank-list">
          {largestTop.map((file, index) => {
            const ratio = Math.max(3, Math.round((file.size / maxLargestSize) * 100))
            return (
              <div
                className="rank-row rank-row-bar rank-row-interactive"
                key={file.id}
                style={{ '--bar-ratio': `${ratio}%` } as CSSProperties}
                onClick={() => openPreview(file.id)}
              >
                <span className="rank-index tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                <div className="rank-entity">
                  <FileTypeIcon kind="file" extension={file.extension} size={16} />
                  <div className="rank-entity-copy">
                    <strong>{file.name}</strong>
                    <small>{file.relativePath}</small>
                    <div className="proportional-track" aria-hidden="true">
                      <span className="proportional-fill" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                </div>
                <div className="rank-meta" onClick={(event) => event.stopPropagation()}>
                  <b className="tabular-nums">{formatBytes(file.size)}</b>
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
                    title="复制相对路径"
                    aria-label={`复制 ${file.name} 路径`}
                    onClick={() => void onCopyPath(file.relativePath)}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </article>
    </div>
  )
}
