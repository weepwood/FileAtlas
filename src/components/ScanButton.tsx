import { useRef, useState, type InputHTMLAttributes } from 'react'
import { FolderOpen, LoaderCircle } from 'lucide-react'
import { detectCapabilities } from '../services/capabilities'
import { saveRecentDirectory } from '../services/database'
import { scanDirectoryHandle, scanFileList } from '../services/scanner'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'
import { formatBytes } from '../utils/file'

export function ScanButton({ label = '选择文件夹' }: { label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [controller, setController] = useState<AbortController | null>(null)
  const { status, setScanning, setProgress, setResult, setError } = useFileAtlasStore()
  const { scanConfig, setIsDemo, pushToast } = useUiStore()

  const run = async () => {
    const capabilities = detectCapabilities()
    if (!capabilities.directoryPicker) {
      inputRef.current?.click()
      return
    }
    const nextController = new AbortController()
    setController(nextController)
    try {
      const handle = await window.showDirectoryPicker?.({ mode: 'read', id: 'fileatlas-root' })
      if (!handle) return
      setIsDemo(false)
      setScanning()
      const result = await scanDirectoryHandle(handle, {
        ...scanConfig,
        onProgress: setProgress,
        signal: nextController.signal,
      })
      setResult(result.rootName, result.entries, result.files, result.statistics)
      void saveRecentDirectory({
        id: `dir:${result.rootName}`,
        name: result.rootName,
        lastScannedAt: Date.now(),
        fileCount: result.statistics.fileCount,
        totalSize: result.statistics.totalSize,
        handle,
      })
      pushToast({
        tone: 'success',
        title: `已完成「${result.rootName}」扫描`,
        message: `共索引 ${result.statistics.fileCount.toLocaleString()} 个文件 · ${formatBytes(result.statistics.totalSize)}`,
      })
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
        if (error.name === 'AbortError' && status === 'scanning') {
          setError('扫描已取消')
          pushToast({ tone: 'info', title: '扫描已取消' })
        }
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      setError(message)
      pushToast({ tone: 'error', title: '扫描遇到问题', message })
    } finally {
      setController(null)
    }
  }

  const onFallbackFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const nextController = new AbortController()
    setController(nextController)
    setIsDemo(false)
    setScanning()
    try {
      const result = await scanFileList(files, {
        ...scanConfig,
        onProgress: setProgress,
        signal: nextController.signal,
      })
      setResult(result.rootName, result.entries, result.files, result.statistics)
      pushToast({
        tone: 'success',
        title: `已完成「${result.rootName}」扫描`,
        message: `共索引 ${result.statistics.fileCount.toLocaleString()} 个文件 · ${formatBytes(result.statistics.totalSize)}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message)
      pushToast({ tone: 'error', title: '扫描遇到问题', message })
    } finally {
      setController(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (status === 'scanning') {
    return (
      <button type="button" className="button danger-button" onClick={() => controller?.abort()}>
        <LoaderCircle className="spin" size={17} />
        <span>取消扫描</span>
      </button>
    )
  }

  return (
    <>
      <button type="button" className="button primary-button" onClick={() => void run()}>
        <FolderOpen size={17} />
        <span>{label}</span>
      </button>
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple
        {...({ webkitdirectory: '' } as InputHTMLAttributes<HTMLInputElement>)}
        onChange={(event) => void onFallbackFiles(event.target.files)}
      />
    </>
  )
}
