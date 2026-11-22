import { useCallback, useMemo, useState } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronRight,
  Copy,
  CornerLeftUp,
  Eye,
  FolderOpen,
  Home,
  LocateFixed,
  MousePointerClick,
  Pin,
  PinOff,
  RotateCcw,
  Scaling,
  ZoomIn,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Chart } from '../components/Chart'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { createEntryId, formatBytes } from '../utils/file'
import {
  aggregateSpaceNodes,
  buildTreemapData,
  formatSharePercent,
  type SpaceNode,
  type SpaceScaleMode,
} from '../utils/space'
import { copyTextToClipboard, handleSpotlightMove } from '../utils/spotlight'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function SpacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { rootName, entries, statistics, status } = useFileAtlasStore()
  const { theme, pushToast, openPreview } = useUiStore()

  const scopeParam = searchParams.get('scope') ?? ''
  const [scopePath, setScopePath] = useState(scopeParam)
  const [scaleMode, setScaleMode] = useState<SpaceScaleMode>('perceptual')
  const [focusFilter, setFocusFilter] = useState<'all' | 'small'>('all')
  const [roamEnabled, setRoamEnabled] = useState(false)
  const [roamResetKey, setRoamResetKey] = useState(0)
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [chartHoverPath, setChartHoverPath] = useState<string | null>(null)
  const [listHoverPath, setListHoverPath] = useState<string | null>(null)

  const requestedScope = scopePath || scopeParam
  const activeScopePath =
    requestedScope && (requestedScope === rootName || requestedScope.startsWith(`${rootName}/`))
      ? requestedScope
      : rootName

  const { nodes: allScopeNodes, scopeTotalSize } = useMemo(
    () => aggregateSpaceNodes(entries, activeScopePath, statistics.totalSize),
    [activeScopePath, entries, statistics.totalSize],
  )

  const smallNodes = useMemo(() => allScopeNodes.filter((node) => node.isSmall), [allScopeNodes])

  const displayedNodes = useMemo(() => {
    const source = focusFilter === 'small' && smallNodes.length > 0 ? smallNodes : allScopeNodes
    return source.slice(0, 48)
  }, [allScopeNodes, focusFilter, smallNodes])

  const treemapData = useMemo(() => buildTreemapData(displayedNodes, scaleMode), [displayedNodes, scaleMode])

  const nodeByPath = useMemo(
    () => new Map<string, SpaceNode>(allScopeNodes.map((node) => [node.path, node])),
    [allScopeNodes],
  )

  const selectedNode = useMemo(
    () => (selectedPath ? nodeByPath.get(selectedPath) ?? null : null),
    [nodeByPath, selectedPath],
  )

  const activeHoverPath = listHoverPath ?? chartHoverPath
  const inspectedNode = useMemo(() => {
    if (activeHoverPath && nodeByPath.has(activeHoverPath)) {
      return nodeByPath.get(activeHoverPath)!
    }
    return selectedNode
  }, [activeHoverPath, nodeByPath, selectedNode])

  const rankedNodes = useMemo(() => {
    const base = focusFilter === 'small' && smallNodes.length > 0 ? smallNodes : allScopeNodes
    if (!sortAsc) return base
    return [...base].sort((a, b) => a.realSize - b.realSize || a.label.localeCompare(b.label, 'zh-CN'))
  }, [allScopeNodes, focusFilter, smallNodes, sortAsc])

  const breadcrumbs = useMemo(() => {
    if (!activeScopePath) return []
    const parts = activeScopePath.split('/')
    return parts.map((segment, index) => ({
      label: segment,
      path: parts.slice(0, index + 1).join('/'),
    }))
  }, [activeScopePath])

  const isDark = theme === 'dark'

  const enterDirectory = useCallback(
    (targetPath: string) => {
      setScopePath(targetPath)
      if (searchParams.has('scope')) {
        const next = new URLSearchParams(searchParams)
        if (targetPath === rootName) next.delete('scope')
        else next.set('scope', targetPath)
        setSearchParams(next, { replace: true })
      }
      setSelectedPath(null)
      setChartHoverPath(null)
      setListHoverPath(null)
      setFocusFilter('all')
    },
    [rootName, searchParams, setSearchParams],
  )

  const handleTileClick = useCallback((path: string) => {
    setSelectedPath((prev) => (prev === path ? null : path))
  }, [])

  const handleTileDoubleClick = useCallback(
    (path: string) => {
      const target = nodeByPath.get(path)
      if (target && target.kind === 'directory') {
        enterDirectory(target.path)
      }
    },
    [enterDirectory, nodeByPath],
  )

  const chartOption = useMemo(
    () => ({
      tooltip: {
        formatter: (params: any) => {
          const datum = params?.data as SpaceNode | undefined
          if (!datum) return ''
          const kindBadge = datum.kind === 'directory' ? '文件夹' : `${datum.extension.toUpperCase()} 文件`
          const subCount =
            datum.kind === 'directory' ? `<br/>包含：${datum.fileCount.toLocaleString()} 个文件` : ''
          const hint =
            datum.kind === 'directory'
              ? '<br/><span style="opacity:.72;font-size:11px">单击锁定选中 · 双击下钻进入目录</span>'
              : '<br/><span style="opacity:.72;font-size:11px">单击锁定选中查看详情与预览</span>'
          return [
            `<strong>${escapeHtml(datum.label)}</strong> <span style="opacity:.7">(${escapeHtml(kindBadge)})</span>`,
            `<br/>实际占用：<strong>${formatBytes(datum.realSize)}</strong>`,
            `<br/>当前目录占比：${formatSharePercent(datum.scopeShare)}`,
            subCount,
            hint,
          ].join('')
        },
      },
      series: [
        {
          type: 'treemap',
          left: 14,
          top: 12,
          right: 14,
          bottom: 14,
          width: 'auto',
          height: 'auto',
          roam: roamEnabled,
          nodeClick: false,
          breadcrumb: { show: false },
          visibleMin: 8,
          childrenVisibleMin: 0,
          label: {
            show: true,
            color: '#f8fafc',
            fontWeight: 620,
            fontSize: 12,
            lineHeight: 17,
            overflow: 'truncate',
            ellipsis: '…',
            padding: [4, 6],
            formatter: (params: any) => {
              const datum = params?.data as SpaceNode | undefined
              if (!datum) return ''
              return `${datum.kind === 'directory' ? '📁 ' : ''}${datum.label}\n${formatBytes(datum.realSize)}`
            },
          },
          itemStyle: {
            borderColor: isDark ? '#081120' : '#f8fafc',
            borderWidth: 1.5,
            gapWidth: 2,
            borderRadius: 7,
          },
          emphasis: {
            label: {
              fontSize: 13,
              fontWeight: 700,
            },
            itemStyle: {
              borderColor: isDark ? '#7dd3fc' : '#0284c7',
              borderWidth: 2.5,
              shadowBlur: 16,
              shadowColor: 'rgba(56, 189, 248, 0.45)',
            },
          },
          data: treemapData,
        },
      ],
    }),
    [isDark, roamEnabled, treemapData],
  )

  if (status === 'idle') return <EmptyState />

  const topNode = allScopeNodes[0]
  const maxScopeSize = topNode?.realSize || 1
  const canGoUp = breadcrumbs.length > 1

  const copyPath = async (path: string) => {
    if (await copyTextToClipboard(path)) {
      pushToast({ tone: 'success', title: '路径已复制到剪贴板', message: path })
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STORAGE INTELLIGENCE</span>
          <h1>空间分析</h1>
          <p>默认启用「智能易选比例」为微小文件夹与小文件提供保底命中面积，支持逐层下钻与列表双向联动高亮。</p>
        </div>
      </div>

      <div className="metric-strip">
        <div>
          <span>当前视图总空间</span>
          <strong className="tabular-nums">{formatBytes(scopeTotalSize)}</strong>
        </div>
        <div>
          <span>最大子项</span>
          <strong className="truncate-text">{topNode ? topNode.label : '—'}</strong>
        </div>
        <div>
          <span>微小项（&lt; 2% 或 0 B）</span>
          <strong className="tabular-nums">{smallNodes.length} 项</strong>
        </div>
      </div>

      <article className="panel chart-panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title space-panel-head">
          <div>
            <h2>目录与文件空间矩形树图</h2>
            <p>
              {scaleMode === 'perceptual'
                ? '智能易选模式：平滑压缩极端体积差并保底小色块热区，标签与详情始终展示真实字节'
                : '真实面积模式：严格按字节线性分配面积，可配合「微小项聚焦」或「滚轮缩放」检视小文件'}
            </p>
          </div>

          <div className="space-controls">
            <div className="segmented-tabs" role="group" aria-label="树图面积比例模式">
              <button
                type="button"
                className={scaleMode === 'perceptual' ? 'seg-tab active' : 'seg-tab'}
                onClick={() => setScaleMode('perceptual')}
                title="对微小目录/文件提供保底可点击面积，彻底解决极小色块难以悬停选中的问题"
              >
                <MousePointerClick size={13} />
                <span>智能易选</span>
              </button>
              <button
                type="button"
                className={scaleMode === 'linear' ? 'seg-tab active' : 'seg-tab'}
                onClick={() => setScaleMode('linear')}
                title="严格按真实字节数 1:1 映射色块面积"
              >
                <Scaling size={13} />
                <span>真实比例</span>
              </button>
            </div>

            {smallNodes.length > 0 && smallNodes.length < allScopeNodes.length && (
              <div className="segmented-tabs" role="group" aria-label="微小项聚焦筛选">
                <button
                  type="button"
                  className={focusFilter === 'all' ? 'seg-tab active' : 'seg-tab'}
                  onClick={() => setFocusFilter('all')}
                >
                  全部 <em className="tabular-nums">{allScopeNodes.length}</em>
                </button>
                <button
                  type="button"
                  className={focusFilter === 'small' ? 'seg-tab active' : 'seg-tab'}
                  onClick={() => setFocusFilter('small')}
                  title="隐去巨型目录，仅将微小文件夹与小文件铺满画布"
                >
                  <LocateFixed size={13} />
                  微小项聚焦 <em className="tabular-nums">{smallNodes.length}</em>
                </button>
              </div>
            )}

            <button
              type="button"
              aria-pressed={roamEnabled}
              className={roamEnabled ? 'chip-btn active' : 'chip-btn'}
              onClick={() => {
                setRoamEnabled((prev) => {
                  if (prev) setRoamResetKey((seed) => seed + 1)
                  return !prev
                })
              }}
              title="开启后可在树图上使用鼠标滚轮局部放大与拖拽平移"
            >
              <ZoomIn size={13} />
              <span>{roamEnabled ? '缩放已开' : '滚轮缩放'}</span>
            </button>

            {roamEnabled && (
              <button
                type="button"
                className="chip-btn"
                onClick={() => setRoamResetKey((seed) => seed + 1)}
                title="重置树图缩放与平移位置"
              >
                <RotateCcw size={12} />
                <span>重置视图</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Folder Breadcrumb Bar */}
        <div className="space-breadcrumb-bar">
          <div className="breadcrumb-trail" aria-label="目录层级路径">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <span className="breadcrumb-segment" key={crumb.path}>
                  {idx > 0 && <ChevronRight size={13} className="breadcrumb-sep" />}
                  <button
                    type="button"
                    disabled={isLast}
                    className={isLast ? 'breadcrumb-btn current' : 'breadcrumb-btn'}
                    onClick={() => enterDirectory(crumb.path)}
                  >
                    {idx === 0 && <Home size={13} />}
                    <span>{crumb.label}</span>
                  </button>
                </span>
              )
            })}
          </div>

          {canGoUp && (
            <button
              type="button"
              className="chip-btn"
              onClick={() => enterDirectory(breadcrumbs[breadcrumbs.length - 2].path)}
            >
              <CornerLeftUp size={13} />
              <span>返回上级</span>
            </button>
          )}
        </div>

        {/* Active / Pinned Item Inspector Strip */}
        <div className={inspectedNode ? 'space-inspector is-active' : 'space-inspector'}>
          {inspectedNode ? (
            <>
              <div className="inspector-main">
                <FileTypeIcon
                  kind={inspectedNode.kind}
                  extension={inspectedNode.extension}
                  size={16}
                />
                <div className="inspector-copy">
                  <div className="inspector-title-row">
                    <strong>{inspectedNode.label}</strong>
                    {selectedNode?.path === inspectedNode.path && (
                      <span className="pinned-badge">
                        <Pin size={11} /> 已锁定选中
                      </span>
                    )}
                  </div>
                  <small>{inspectedNode.path}</small>
                </div>
              </div>

              <div className="inspector-stats">
                <span className="tabular-nums">
                  体积：<strong>{formatBytes(inspectedNode.realSize)}</strong>
                </span>
                <span className="tabular-nums">
                  当前占比：<strong>{formatSharePercent(inspectedNode.scopeShare)}</strong>
                </span>
                {inspectedNode.kind === 'directory' && (
                  <span className="tabular-nums">
                    内含 {inspectedNode.fileCount.toLocaleString()} 个文件
                  </span>
                )}
              </div>

              <div className="inspector-actions">
                {inspectedNode.kind === 'directory' && (
                  <button
                    type="button"
                    className="chip-btn active"
                    onClick={() => enterDirectory(inspectedNode.path)}
                  >
                    <FolderOpen size={13} />
                    <span>进入子目录</span>
                  </button>
                )}
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => openPreview(createEntryId(inspectedNode.path, inspectedNode.kind))}
                >
                  <Eye size={12} />
                  <span>详情</span>
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => void copyPath(inspectedNode.path)}
                >
                  <Copy size={12} />
                  <span>复制路径</span>
                </button>
                {selectedNode?.path === inspectedNode.path && (
                  <button
                    type="button"
                    className="chip-btn reset"
                    onClick={() => setSelectedPath(null)}
                  >
                    <PinOff size={12} />
                    <span>取消锁定</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="inspector-placeholder">
              悬停色块、快捷胶囊或下方列表即可联动检视；单击任意项可锁定选中，双击文件夹可下钻进入子目录。
            </p>
          )}
        </div>

        {treemapData.length > 0 ? (
          <Chart
            key={`treemap-${activeScopePath}-${roamResetKey}`}
            option={chartOption}
            height={460}
            externalHighlightName={listHoverPath ?? (chartHoverPath ? undefined : selectedNode?.path ?? null)}
            onItemHover={setChartHoverPath}
            onItemClick={handleTileClick}
            onItemDoubleClick={handleTileDoubleClick}
          />
        ) : (
          <div className="explorer-empty">
            <p>当前目录为空，不包含子文件夹或文件。</p>
          </div>
        )}

        {/* Quick Direct-Select Pills for Tiny Folders & Files */}
        {smallNodes.length > 0 && focusFilter === 'all' && (
          <div className="tiny-items-strip" aria-label="微小目录与文件直达选择栏">
            <span className="tiny-strip-label">微小项直达（悬停高亮 / 单击选中）：</span>
            <div className="tiny-pills-wrap">
              {smallNodes.slice(0, 18).map((node) => {
                const isPinned = selectedNode?.path === node.path
                return (
                  <button
                    type="button"
                    key={node.path}
                    className={isPinned ? 'tiny-node-pill is-pinned' : 'tiny-node-pill'}
                    onMouseEnter={() => setListHoverPath(node.path)}
                    onMouseLeave={() => setListHoverPath(null)}
                    onFocus={() => setListHoverPath(node.path)}
                    onBlur={() => setListHoverPath(null)}
                    onClick={() => handleTileClick(node.path)}
                    onDoubleClick={() => {
                      if (node.kind === 'directory') enterDirectory(node.path)
                    }}
                  >
                    <span className="tiny-pill-name">{node.label}</span>
                    <em className="tabular-nums">{formatBytes(node.realSize)}</em>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </article>

      <article className="panel spotlight-surface" onPointerMove={handleSpotlightMove}>
        <div className="panel-title">
          <div>
            <h2>空间分布明细</h2>
            <p>鼠标移入任意行即可在上方树图中同步高亮定位对应色块</p>
          </div>
          <div className="panel-title-right">
            <button
              type="button"
              className="chip-btn"
              onClick={() => setSortAsc((prev) => !prev)}
              title="切换按体积从大到小或从小到大排序，快速查看最小文件夹/文件"
            >
              {sortAsc ? <ArrowUpNarrowWide size={13} /> : <ArrowDownWideNarrow size={13} />}
              <span>{sortAsc ? '从小到大（微小优先）' : '从大到小（热点优先）'}</span>
            </button>
            <span className="panel-pill tabular-nums">共 {rankedNodes.length} 项</span>
          </div>
        </div>

        <div className="rank-list">
          {rankedNodes.slice(0, 30).map((node, index) => {
            const barWidth = node.realSize > 0 ? Math.max(3, Math.round((node.realSize / maxScopeSize) * 100)) : 2
            const isActive =
              selectedNode?.path === node.path || listHoverPath === node.path || chartHoverPath === node.path

            return (
              <div
                className={isActive ? 'rank-row rank-row-bar rank-row-interactive is-highlighted' : 'rank-row rank-row-bar rank-row-interactive'}
                key={node.path}
                onMouseEnter={() => setListHoverPath(node.path)}
                onMouseLeave={() => setListHoverPath(null)}
                onClick={() => handleTileClick(node.path)}
              >
                <span className="rank-index tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                <div className="rank-entity">
                  <FileTypeIcon kind={node.kind} extension={node.extension} size={16} />
                  <div className="rank-entity-copy">
                    <strong>{node.label}</strong>
                    <small className="tabular-nums">
                      {node.kind === 'directory'
                        ? `文件夹 · ${node.fileCount.toLocaleString()} 个文件 · 占当前目录 ${formatSharePercent(node.scopeShare)}`
                        : `${node.extension.toUpperCase()} 文件 · 占当前目录 ${formatSharePercent(node.scopeShare)}`}
                    </small>
                    <div className="proportional-track" aria-hidden="true">
                      <span className="proportional-fill" style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rank-meta" onClick={(event) => event.stopPropagation()}>
                  {node.kind === 'directory' && (
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => enterDirectory(node.path)}
                      title={`进入 ${node.label} 查看内部文件`}
                    >
                      <FolderOpen size={12} />
                      <span>下钻</span>
                    </button>
                  )}
                  <span className="share-pill tabular-nums">{formatSharePercent(node.scopeShare)}</span>
                  <b className="tabular-nums">{formatBytes(node.realSize)}</b>
                  <button
                    type="button"
                    className="mini-action-btn"
                    title="预览详情"
                    aria-label={`查看 ${node.label} 详情`}
                    onClick={() => openPreview(createEntryId(node.path, node.kind))}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    type="button"
                    className="mini-action-btn"
                    title="复制相对路径"
                    aria-label={`复制 ${node.label} 路径`}
                    onClick={() => void copyPath(node.path)}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            )
          })}
          {!rankedNodes.length && <p className="muted-text">当前目录下没有可展示的子条目。</p>}
        </div>
      </article>
    </div>
  )
}
