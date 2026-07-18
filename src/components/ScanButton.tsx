import { useRef, useState, type InputHTMLAttributes } from 'react'
import { FolderOpen, LoaderCircle } from 'lucide-react'
import { detectCapabilities } from '../services/capabilities'
import { scanDirectoryHandle, scanFileList } from '../services/scanner'
import { useFileAtlasStore } from '../store/useFileAtlasStore'

export function ScanButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [controller, setController] = useState<AbortController | null>(null)
  const { status, setScanning, setProgress, setResult, setError } = useFileAtlasStore()

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
      setScanning()
      const result = await scanDirectoryHandle(handle, { onProgress: setProgress, signal: nextController.signal })
      setResult(result.rootName, result.entries, result.files, result.statistics)
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
        if (error.name === 'AbortError' && status === 'scanning') setError('扫描已取消')
        return
      }
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setController(null)
    }
  }

  const onFallbackFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const nextController = new AbortController()
    setController(nextController)
    setScanning()
    try {
      const result = await scanFileList(files, { onProgress: setProgress, signal: nextController.signal })
      setResult(result.rootName, result.entries, result.files, result.statistics)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setController(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (status === 'scanning') {
    return (
      <button className="button danger-button" onClick={() => controller?.abort()}>
        <LoaderCircle className="spin" size={17} /> 取消扫描
      </button>
    )
  }

  return (
    <>
      <button className="button primary-button" onClick={run}>
        <FolderOpen size={17} /> 选择文件夹
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
