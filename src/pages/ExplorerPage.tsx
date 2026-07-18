import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { File, Folder, Search } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { formatBytes } from '../utils/file'

export function ExplorerPage() {
  const { entries, status } = useFileAtlasStore()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'file' | 'directory'>('all')
  const parentRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => entries.filter((entry) => {
    const matchesQuery = !query || entry.relativePath.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    return matchesQuery && (kind === 'all' || entry.kind === kind)
  }), [entries, kind, query])
  // TanStack Virtual intentionally exposes mutable measurement functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({ count: filtered.length, getScrollElement: () => parentRef.current, estimateSize: () => 54, overscan: 12 })

  if (status === 'idle') return <EmptyState />
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">EXPLORER</span><h1>文件浏览</h1><p>虚拟列表按需渲染，适合查看大型目录索引。</p></div></div>
      <article className="panel explorer-panel">
        <div className="toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名或路径" /></label>
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">全部类型</option><option value="file">仅文件</option><option value="directory">仅文件夹</option></select>
          <span className="result-count">{filtered.length.toLocaleString()} 条</span>
        </div>
        <div className="table-head"><span>名称</span><span>类型</span><span>大小</span><span>修改时间</span></div>
        <div ref={parentRef} className="virtual-list">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filtered[virtualRow.index]
              return (
                <div className="file-row" key={entry.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
                  <div className="file-name-cell">{entry.kind === 'directory' ? <Folder size={17} /> : <File size={17} />}<div><strong>{entry.name}</strong><small>{entry.relativePath}</small></div></div>
                  <span>{entry.kind === 'directory' ? '文件夹' : entry.extension.toUpperCase()}</span>
                  <span>{entry.kind === 'file' ? formatBytes(entry.size) : '—'}</span>
                  <span>{entry.lastModified ? new Date(entry.lastModified).toLocaleString('zh-CN') : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </article>
    </div>
  )
}
