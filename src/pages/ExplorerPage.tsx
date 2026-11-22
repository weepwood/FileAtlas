import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Eye, FilterX, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { AGE_BUCKETS, formatBytes, getAgeBucket, getSizeBucket, SIZE_BUCKETS } from '../utils/file'
import { copyTextToClipboard, getFileCategory, type FileCategory } from '../utils/spotlight'

type SortField = 'name' | 'kind' | 'size' | 'lastModified'
type SortDirection = 'asc' | 'desc'

const CATEGORY_OPTIONS: Array<{ value: 'all' | FileCategory; label: string }> = [
  { value: 'all', label: '全部大类' },
  { value: 'video', label: '视频' },
  { value: 'image', label: '图片' },
  { value: 'document', label: '文档' },
  { value: 'code', label: '代码' },
  { value: 'archive', label: '压缩包' },
  { value: 'audio', label: '音频' },
  { value: 'data', label: '数据' },
  { value: 'other', label: '其他' },
]

export function ExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { entries, status } = useFileAtlasStore()
  const { pushToast, openPreview } = useUiStore()

  const extParam = searchParams.get('ext') ?? ''
  const parentParam = searchParams.get('parent') ?? ''
  const initialSizeBucket = searchParams.get('sizeBucket') ?? 'all'
  const initialAgeBucket = searchParams.get('ageBucket') ?? 'all'

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [kind, setKind] = useState<'all' | 'file' | 'directory'>(
    extParam || initialSizeBucket !== 'all' || initialAgeBucket !== 'all' ? 'file' : 'all',
  )
  const [category, setCategory] = useState<'all' | FileCategory>('all')
  const [sizeBucket, setSizeBucket] = useState<string>(initialSizeBucket)
  const [ageBucket, setAgeBucket] = useState<string>(initialAgeBucket)
  const [sortField, setSortField] = useState<SortField>('size')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const parentRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const counts = useMemo(() => {
    let fileCount = 0
    let dirCount = 0
    for (const item of entries) {
      if (item.kind === 'file') fileCount += 1
      else dirCount += 1
    }
    return { all: entries.length, file: fileCount, directory: dirCount }
  }, [entries])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const normalizedExt = extParam.trim().toLocaleLowerCase()
    const parentPrefix = parentParam ? `${parentParam}/` : ''

    const base = entries.filter((entry) => {
      if (kind !== 'all' && entry.kind !== kind) return false
      if (parentPrefix && !entry.relativePath.startsWith(parentPrefix)) return false
      if (normalizedQuery && !entry.relativePath.toLocaleLowerCase().includes(normalizedQuery)) return false
      if (normalizedExt) {
        if (entry.kind !== 'file' || entry.extension.toLocaleLowerCase() !== normalizedExt) return false
      }
      if (category !== 'all') {
        if (entry.kind !== 'file' || getFileCategory(entry.extension) !== category) return false
      }
      if (sizeBucket !== 'all') {
        if (getSizeBucket(entry.size) !== sizeBucket) return false
      }
      if (ageBucket !== 'all') {
        if (getAgeBucket(entry.lastModified) !== ageBucket) return false
      }
      return true
    })

    const factor = sortDirection === 'asc' ? 1 : -1
    return [...base].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name, 'zh-CN') * factor
      }
      if (sortField === 'kind') {
        const typeA = a.kind === 'directory' ? '0_directory' : a.extension
        const typeB = b.kind === 'directory' ? '0_directory' : b.extension
        return typeA.localeCompare(typeB, 'zh-CN') * factor
      }
      if (sortField === 'size') {
        return (a.size - b.size) * factor
      }
      return (a.lastModified - b.lastModified) * factor
    })
  }, [ageBucket, category, entries, extParam, kind, parentParam, query, sizeBucket, sortDirection, sortField])

  const filteredTotalSize = useMemo(
    () =>
      filtered.reduce((sum, item) => (item.kind === 'file' ? sum + item.size : sum), 0),
    [filtered],
  )

  // TanStack Virtual intentionally exposes mutable measurement functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 14,
  })

  if (status === 'idle') return <EmptyState />

  const hasActiveFilters = Boolean(
    query ||
      kind !== 'all' ||
      category !== 'all' ||
      sizeBucket !== 'all' ||
      ageBucket !== 'all' ||
      extParam ||
      parentParam,
  )

  const clearAllFilters = () => {
    setQuery('')
    setKind('all')
    setCategory('all')
    setSizeBucket('all')
    setAgeBucket('all')
    if (searchParams.size > 0) {
      setSearchParams({}, { replace: true })
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'name' || field === 'kind' ? 'asc' : 'desc')
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={13} className="sort-icon muted" />
    return sortDirection === 'asc' ? (
      <ArrowUp size={13} className="sort-icon active" />
    ) : (
      <ArrowDown size={13} className="sort-icon active" />
    )
  }

  const handleCopyPath = async (path: string) => {
    if (await copyTextToClipboard(path)) {
      pushToast({ tone: 'success', title: '路径已复制', message: path })
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPLORER</span>
          <h1>文件浏览</h1>
          <p>支持目录递归体积排序、多维组合过滤与单击本地沙盒快速预览。</p>
        </div>
      </div>

      <article className="panel explorer-panel">
        <div className="toolbar">
          <label className="search-box">
            <Search size={16} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文件名、扩展名或相对路径…"
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                aria-label="清空搜索词"
                onClick={() => setQuery('')}
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="kbd-hint" title="按 / 键快速聚焦">
                /
              </kbd>
            )}
          </label>

          <div className="segmented-tabs" role="tablist" aria-label="条目类型筛选">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'all'}
              className={kind === 'all' ? 'seg-tab active' : 'seg-tab'}
              onClick={() => setKind('all')}
            >
              全部 <em className="tabular-nums">{counts.all.toLocaleString()}</em>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'file'}
              className={kind === 'file' ? 'seg-tab active' : 'seg-tab'}
              onClick={() => setKind('file')}
            >
              文件 <em className="tabular-nums">{counts.file.toLocaleString()}</em>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'directory'}
              className={kind === 'directory' ? 'seg-tab active' : 'seg-tab'}
              onClick={() => setKind('directory')}
            >
              文件夹 <em className="tabular-nums">{counts.directory.toLocaleString()}</em>
            </button>
          </div>

          <span className="result-count tabular-nums">
            匹配 {filtered.length.toLocaleString()} 条
            {filteredTotalSize > 0 ? ` · ${formatBytes(filteredTotalSize)}` : ''}
          </span>
        </div>

        <div className="explorer-subtoolbar">
          <div className="category-pills-row" role="group" aria-label="文件大类快捷筛选">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={category === opt.value ? 'chip-btn active' : 'chip-btn'}
                onClick={() => {
                  setCategory(opt.value)
                  if (opt.value !== 'all' && kind === 'directory') setKind('all')
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="explorer-selects-row">
            <select
              className="compact-select"
              aria-label="按体积区间筛选"
              value={sizeBucket}
              onChange={(event) => setSizeBucket(event.target.value)}
            >
              <option value="all">全部体积区间</option>
              {SIZE_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  体积：{bucket}
                </option>
              ))}
            </select>

            <select
              className="compact-select"
              aria-label="按修改时间筛选"
              value={ageBucket}
              onChange={(event) => setAgeBucket(event.target.value)}
            >
              <option value="all">全部修改时间</option>
              {AGE_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  时间：{bucket}
                </option>
              ))}
            </select>

            {extParam && (
              <button
                type="button"
                className="chip-btn active"
                onClick={() => {
                  const next = new URLSearchParams(searchParams)
                  next.delete('ext')
                  setSearchParams(next, { replace: true })
                }}
              >
                <span>扩展名: .{extParam.toUpperCase()}</span>
                <X size={11} />
              </button>
            )}

            {parentParam && (
              <button
                type="button"
                className="chip-btn active"
                onClick={() => {
                  const next = new URLSearchParams(searchParams)
                  next.delete('parent')
                  setSearchParams(next, { replace: true })
                }}
              >
                <span>限定目录: {parentParam.split('/').at(-1)}</span>
                <X size={11} />
              </button>
            )}

            {hasActiveFilters && (
              <button type="button" className="chip-btn reset" onClick={clearAllFilters}>
                <FilterX size={12} />
                <span>重置筛选</span>
              </button>
            )}
          </div>
        </div>

        <div className="table-head">
          <button type="button" className="th-sort" onClick={() => toggleSort('name')}>
            <span>名称与路径</span>
            {renderSortIcon('name')}
          </button>
          <button type="button" className="th-sort" onClick={() => toggleSort('kind')}>
            <span>类型</span>
            {renderSortIcon('kind')}
          </button>
          <button type="button" className="th-sort" onClick={() => toggleSort('size')}>
            <span>大小</span>
            {renderSortIcon('size')}
          </button>
          <button type="button" className="th-sort" onClick={() => toggleSort('lastModified')}>
            <span>修改时间</span>
            {renderSortIcon('lastModified')}
          </button>
        </div>

        <div ref={parentRef} className="virtual-list">
          {filtered.length === 0 ? (
            <div className="explorer-empty">
              <div>
                <p>没有匹配当前筛选条件的条目。</p>
                {hasActiveFilters && (
                  <button type="button" className="chip-btn active" onClick={clearAllFilters}>
                    清空筛选条件
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const entry = filtered[virtualRow.index]
                return (
                  <div
                    className="file-row file-row-clickable"
                    key={entry.id}
                    onClick={() => openPreview(entry.id)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="file-name-cell">
                      <FileTypeIcon kind={entry.kind} extension={entry.extension} size={16} />
                      <div className="file-name-copy">
                        <strong>{entry.name}</strong>
                        <small>{entry.relativePath}</small>
                      </div>
                      <div className="row-hover-actions" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="row-copy-btn"
                          title="本地预览详情"
                          aria-label={`预览 ${entry.name}`}
                          onClick={() => openPreview(entry.id)}
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="row-copy-btn"
                          title="复制相对路径"
                          aria-label={`复制 ${entry.name} 路径`}
                          onClick={() => void handleCopyPath(entry.relativePath)}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                    <span>
                      <b className="ext-pill">
                        {entry.kind === 'directory'
                          ? `文件夹${entry.childFileCount ? ` · ${entry.childFileCount}` : ''}`
                          : entry.extension.toUpperCase()}
                      </b>
                    </span>
                    <span className="tabular-nums">{formatBytes(entry.size)}</span>
                    <span className="tabular-nums">
                      {entry.lastModified ? new Date(entry.lastModified).toLocaleString('zh-CN') : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  )
}
