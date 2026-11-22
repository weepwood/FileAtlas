import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Search, X } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FileTypeIcon } from '../components/FileBadge'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'
import { copyTextToClipboard } from '../utils/spotlight'

type SortField = 'name' | 'kind' | 'size' | 'lastModified'
type SortDirection = 'asc' | 'desc'

export function ExplorerPage() {
  const { entries, status } = useFileAtlasStore()
  const { pushToast } = useUiStore()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'file' | 'directory'>('all')
  const [sortField, setSortField] = useState<SortField>('size')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const parentRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
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
    const base = entries.filter((entry) => {
      const matchesQuery = !normalizedQuery || entry.relativePath.toLocaleLowerCase().includes(normalizedQuery)
      return matchesQuery && (kind === 'all' || entry.kind === kind)
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
  }, [entries, kind, query, sortDirection, sortField])

  // TanStack Virtual intentionally exposes mutable measurement functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 14,
  })

  if (status === 'idle') return <EmptyState />

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
          <p>虚拟列表按可视区域高性能渲染，支持按列实时排序与快捷键检索。</p>
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
              <kbd className="kbd-hint" title="按 / 键快速聚焦">/</kbd>
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

          <span className="result-count tabular-nums">匹配 {filtered.length.toLocaleString()} 条</span>
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
              <p>没有匹配「{query}」的条目，请尝试其他关键词或切换类型筛选。</p>
            </div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const entry = filtered[virtualRow.index]
                return (
                  <div
                    className="file-row"
                    key={entry.id}
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
                    <span>
                      <b className="ext-pill">
                        {entry.kind === 'directory' ? '文件夹' : entry.extension.toUpperCase()}
                      </b>
                    </span>
                    <span className="tabular-nums">{entry.kind === 'file' ? formatBytes(entry.size) : '—'}</span>
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
