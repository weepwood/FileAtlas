import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Copy,
  Eye,
  Fingerprint,
  FolderSearch,
  HardDrive,
  Layers3,
  LoaderCircle,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FileTypeIcon } from './FileBadge'
import { computeSingleFileSha256 } from '../services/duplicates'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import type { FileEntryRecord } from '../types'
import { formatBytes, formatRelativeAge } from '../utils/file'
import { copyTextToClipboard } from '../utils/spotlight'

const PREVIEW_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'ico'])
const PREVIEW_VIDEO_EXT = new Set(['mp4', 'mov', 'webm', 'm4v'])
const PREVIEW_AUDIO_EXT = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'])
const PREVIEW_TEXT_EXT = new Set([
  'md',
  'txt',
  'json',
  'csv',
  'tsv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'rs',
  'go',
  'java',
  'cpp',
  'c',
  'h',
  'css',
  'scss',
  'html',
  'vue',
  'svelte',
  'yaml',
  'yml',
  'toml',
  'xml',
  'sql',
  'sh',
  'log',
])

const TEXT_SLICE_LIMIT = 48 * 1024

function parseCsvRows(text: string, delimiter: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 12)
    .map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, '')))
}

function FilePreviewDrawerContent({
  entry,
  fileObj,
  onClose,
}: {
  entry: FileEntryRecord
  fileObj: File | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { pushToast } = useUiStore()

  const [textSnippet, setTextSnippet] = useState<string | null>(null)
  const [textTruncated, setTextTruncated] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null)
  const [hashState, setHashState] = useState<{
    status: 'idle' | 'loading' | 'done' | 'error'
    hash?: string
    mode?: 'full' | 'sample'
  }>({ status: 'idle' })

  const ext = entry.extension.toLocaleLowerCase()
  const isImage = entry.kind === 'file' && PREVIEW_IMAGE_EXT.has(ext)
  const isVideo = entry.kind === 'file' && PREVIEW_VIDEO_EXT.has(ext)
  const isAudio = entry.kind === 'file' && PREVIEW_AUDIO_EXT.has(ext)
  const isText = entry.kind === 'file' && PREVIEW_TEXT_EXT.has(ext)

  const objectUrl = useMemo(() => {
    if (!fileObj || (!isImage && !isVideo && !isAudio)) return null
    return URL.createObjectURL(fileObj)
  }, [fileObj, isAudio, isImage, isVideo])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  useEffect(() => {
    if (!fileObj || !isText || fileObj.size === 0) return
    let active = true
    void fileObj
      .slice(0, TEXT_SLICE_LIMIT)
      .text()
      .then((raw) => {
        if (!active) return
        let formatted = raw
        if (ext === 'json' && fileObj.size <= TEXT_SLICE_LIMIT) {
          try {
            formatted = JSON.stringify(JSON.parse(raw), null, 2)
          } catch {
            // Keep raw text if invalid JSON
          }
        }
        setTextSnippet(formatted)
        setTextTruncated(fileObj.size > TEXT_SLICE_LIMIT)
      })
      .catch(() => {
        if (active) setTextSnippet(null)
      })

    return () => {
      active = false
    }
  }, [ext, fileObj, isText])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const copyValue = async (text: string, label: string) => {
    if (await copyTextToClipboard(text)) {
      pushToast({ tone: 'success', title: `${label}已复制`, message: text })
    }
  }

  const runSingleHash = async () => {
    if (!fileObj) return
    setHashState({ status: 'loading' })
    try {
      const res = await computeSingleFileSha256(fileObj)
      setHashState({ status: 'done', hash: res.hash, mode: res.mode })
    } catch {
      setHashState({ status: 'error' })
    }
  }

  const csvRows =
    textSnippet && (ext === 'csv' || ext === 'tsv')
      ? parseCsvRows(textSnippet, ext === 'tsv' ? '\t' : ',')
      : null

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="preview-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`对象详情预览：${entry.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div className="drawer-title-wrap">
            <FileTypeIcon kind={entry.kind} extension={entry.extension} size={18} />
            <div className="drawer-title-copy">
              <strong>{entry.name}</strong>
              <small>{entry.relativePath}</small>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="关闭预览面板" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-action-row">
            <button
              type="button"
              className="chip-btn"
              onClick={() => void copyValue(entry.relativePath, '相对路径')}
            >
              <Copy size={12} />
              <span>复制路径</span>
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => void copyValue(entry.name, '名称')}
            >
              <Copy size={12} />
              <span>复制名称</span>
            </button>
            {entry.kind === 'directory' && (
              <>
                <button
                  type="button"
                  className="chip-btn active"
                  onClick={() => {
                    onClose()
                    navigate(`/space?scope=${encodeURIComponent(entry.relativePath)}`)
                  }}
                >
                  <BarChart3 size={12} />
                  <span>空间树图下钻</span>
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => {
                    onClose()
                    navigate(`/explorer?parent=${encodeURIComponent(entry.relativePath)}`)
                  }}
                >
                  <FolderSearch size={12} />
                  <span>浏览目录内容</span>
                </button>
              </>
            )}
          </div>

          <section className="drawer-meta-grid">
            <div className="drawer-meta-card">
              <span>类型</span>
              <strong>{entry.kind === 'directory' ? '文件夹' : entry.extension.toUpperCase()}</strong>
            </div>
            <div className="drawer-meta-card">
              <span>{entry.kind === 'directory' ? '递归累计体积' : '文件大小'}</span>
              <strong className="tabular-nums">{formatBytes(entry.size)}</strong>
              <small className="tabular-nums">{entry.size.toLocaleString()} 字节</small>
            </div>
            <div className="drawer-meta-card">
              <span>最后修改</span>
              <strong className="tabular-nums">{formatRelativeAge(entry.lastModified)}</strong>
              <small className="tabular-nums">
                {entry.lastModified ? new Date(entry.lastModified).toLocaleString('zh-CN') : '—'}
              </small>
            </div>
            <div className="drawer-meta-card">
              <span>{entry.kind === 'directory' ? '包含对象' : '目录层级'}</span>
              {entry.kind === 'directory' ? (
                <>
                  <strong className="tabular-nums">
                    {(entry.childFileCount ?? 0).toLocaleString()} 个文件
                  </strong>
                  <small className="tabular-nums">
                    {(entry.childDirectoryCount ?? 0).toLocaleString()} 个子目录 · 第 {entry.depth} 层
                  </small>
                </>
              ) : (
                <>
                  <strong className="tabular-nums">第 {entry.depth} 层</strong>
                  <small className="truncate-text" title={entry.parentPath}>
                    {entry.parentPath || '根目录'}
                  </small>
                </>
              )}
            </div>
          </section>

          {entry.kind === 'file' && (
            <section className="drawer-section">
              <div className="drawer-section-head">
                <span>
                  <Fingerprint size={14} /> 本地 SHA-256 校验
                </span>
                {fileObj && hashState.status === 'idle' && (
                  <button type="button" className="chip-btn active" onClick={() => void runSingleHash()}>
                    立即计算指纹
                  </button>
                )}
              </div>

              {!fileObj && (
                <p className="drawer-muted-box">
                  当前条目仅载入了元数据（如示例虚拟大文件），未挂载原始字节句柄，跳过内容读取。
                </p>
              )}

              {fileObj && hashState.status === 'idle' && (
                <p className="drawer-muted-box">
                  按需在当前设备内存中计算 SHA-256，不主动读取未请求的大文件。
                </p>
              )}

              {hashState.status === 'loading' && (
                <div className="drawer-muted-box inline-flex-box">
                  <LoaderCircle size={15} className="spin" />
                  <span>正在计算 SHA-256 指纹…</span>
                </div>
              )}

              {hashState.status === 'done' && hashState.hash && (
                <div className="drawer-hash-box">
                  <div className="drawer-hash-meta">
                    <span>{hashState.mode === 'full' ? '完整 SHA-256' : '首中尾 64KB 抽样 SHA-256'}</span>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => void copyValue(hashState.hash!, 'SHA-256')}
                    >
                      <Copy size={11} /> 复制
                    </button>
                  </div>
                  <code>{hashState.hash}</code>
                </div>
              )}
            </section>
          )}

          {entry.kind === 'file' && (
            <section className="drawer-section">
              <div className="drawer-section-head">
                <span>
                  <Eye size={14} /> 本地沙盒内容预览
                </span>
                {imageDimensions && (
                  <small className="tabular-nums">
                    {imageDimensions.w} × {imageDimensions.h} px
                  </small>
                )}
                {textTruncated && <small>仅读取前 48 KB 片段</small>}
              </div>

              {entry.size === 0 ? (
                <div className="drawer-muted-box">这是一个 0 字节空文件，不包含任何内容字节。</div>
              ) : isImage && objectUrl ? (
                <div className="drawer-media-frame">
                  <img
                    src={objectUrl}
                    alt={entry.name}
                    onLoad={(e) =>
                      setImageDimensions({
                        w: e.currentTarget.naturalWidth,
                        h: e.currentTarget.naturalHeight,
                      })
                    }
                  />
                </div>
              ) : isVideo && objectUrl ? (
                <div className="drawer-media-frame">
                  <video src={objectUrl} controls preload="metadata" />
                </div>
              ) : isAudio && objectUrl ? (
                <div className="drawer-media-frame audio-frame">
                  <audio src={objectUrl} controls preload="metadata" />
                </div>
              ) : csvRows && csvRows.length > 0 ? (
                <div className="drawer-table-wrap">
                  <table className="drawer-csv-table">
                    <thead>
                      <tr>
                        {csvRows[0].map((col, idx) => (
                          <th key={`${col}-${idx}`}>{col || `列 ${idx + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(1).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : textSnippet !== null ? (
                <pre className="drawer-code-preview">
                  <code>{textSnippet}</code>
                </pre>
              ) : fileObj ? (
                <div className="drawer-muted-box inline-flex-box">
                  <HardDrive size={15} />
                  <span>二进制格式（.{entry.extension}）暂不支持直接解码渲染，可通过上方按钮校验 SHA-256。</span>
                </div>
              ) : (
                <div className="drawer-muted-box inline-flex-box">
                  <Layers3 size={15} />
                  <span>当前为轻量元数据模式（未包含原始二进制流），在真实本地文件夹扫描中可直接预览图片、音视频与代码文档。</span>
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

export function FilePreviewDrawer() {
  const { entries, files } = useFileAtlasStore()
  const { previewEntryId, closePreview } = useUiStore()

  const entry = useMemo(
    () => (previewEntryId ? entries.find((item) => item.id === previewEntryId) ?? null : null),
    [entries, previewEntryId],
  )

  if (!entry) return null
  return (
    <FilePreviewDrawerContent
      key={entry.id}
      entry={entry}
      fileObj={files.get(entry.id) ?? null}
      onClose={closePreview}
    />
  )
}
