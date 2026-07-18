import type { FileEntryRecord, ScanProgress, ScanResult, ScanStatistics } from '../types'
import { calculateStatistics, createEntryId, getExtension, normalizeFileName } from '../utils/file'

const DEFAULT_IGNORES = new Set(['node_modules', '.git', '.idea', '.vscode', 'dist', 'build', 'target', '.next', '.cache'])

export interface ScanOptions {
  ignoreDefaults?: boolean
  onProgress?: (progress: ScanProgress) => void
  signal?: AbortSignal
}

async function analyze(entries: FileEntryRecord[]): Promise<ScanStatistics> {
  if (!('Worker' in window)) return calculateStatistics(entries)
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event) => {
      resolve(event.data as ScanStatistics)
      worker.terminate()
    }
    worker.onerror = (event) => {
      reject(new Error(event.message))
      worker.terminate()
    }
    worker.postMessage({ entries })
  })
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('扫描已取消', 'AbortError')
}

function emitProgress(entries: FileEntryRecord[], currentPath: string, onProgress?: ScanOptions['onProgress']): void {
  if (!onProgress) return
  let files = 0
  let directories = 0
  let totalSize = 0
  for (const entry of entries) {
    if (entry.kind === 'file') {
      files += 1
      totalSize += entry.size
    } else directories += 1
  }
  onProgress({ files, directories, totalSize, currentPath })
}

export async function scanDirectoryHandle(root: FileSystemDirectoryHandle, options: ScanOptions = {}): Promise<ScanResult> {
  const entries: FileEntryRecord[] = []
  const files = new Map<string, File>()
  const queue: Array<{ handle: FileSystemDirectoryHandle; relativePath: string; depth: number }> = [
    { handle: root, relativePath: root.name, depth: 0 },
  ]
  let processedSinceYield = 0

  while (queue.length) {
    assertNotAborted(options.signal)
    const current = queue.shift()!
    const children: Array<[string, FileSystemHandle]> = []
    for await (const child of current.handle.values()) children.push([child.name, child])

    entries.push({
      id: createEntryId(current.relativePath, 'directory'),
      name: current.handle.name,
      normalizedName: normalizeFileName(current.handle.name),
      relativePath: current.relativePath,
      parentPath: current.relativePath.includes('/') ? current.relativePath.slice(0, current.relativePath.lastIndexOf('/')) : '',
      kind: 'directory',
      extension: '',
      mimeType: '',
      size: 0,
      lastModified: 0,
      depth: current.depth,
      isEmptyDirectory: children.length === 0,
    })

    for (const [name, child] of children) {
      assertNotAborted(options.signal)
      if (options.ignoreDefaults !== false && DEFAULT_IGNORES.has(name)) continue
      const relativePath = `${current.relativePath}/${name}`
      if (child.kind === 'directory') {
        queue.push({ handle: child as FileSystemDirectoryHandle, relativePath, depth: current.depth + 1 })
      } else {
        const file = await (child as FileSystemFileHandle).getFile()
        const id = createEntryId(relativePath, 'file')
        entries.push({
          id,
          name: file.name,
          normalizedName: normalizeFileName(file.name),
          relativePath,
          parentPath: current.relativePath,
          kind: 'file',
          extension: getExtension(file.name),
          mimeType: file.type,
          size: file.size,
          lastModified: file.lastModified,
          depth: current.depth + 1,
        })
        files.set(id, file)
      }
      processedSinceYield += 1
      if (processedSinceYield >= 200) {
        emitProgress(entries, relativePath, options.onProgress)
        processedSinceYield = 0
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
  }

  emitProgress(entries, root.name, options.onProgress)
  return { rootName: root.name, entries, files, statistics: await analyze(entries) }
}

export async function scanFileList(fileList: FileList, options: ScanOptions = {}): Promise<ScanResult> {
  const entries: FileEntryRecord[] = []
  const files = new Map<string, File>()
  const directories = new Set<string>()
  const sourceFiles = Array.from(fileList)
  const rootName = sourceFiles[0]?.webkitRelativePath?.split('/')[0] || '已选择文件'

  for (let index = 0; index < sourceFiles.length; index += 1) {
    assertNotAborted(options.signal)
    const file = sourceFiles[index]
    const relativePath = file.webkitRelativePath || `${rootName}/${file.name}`
    const segments = relativePath.split('/')
    for (let depth = 0; depth < segments.length - 1; depth += 1) {
      directories.add(segments.slice(0, depth + 1).join('/'))
    }
    const id = createEntryId(relativePath, 'file')
    entries.push({
      id,
      name: file.name,
      normalizedName: normalizeFileName(file.name),
      relativePath,
      parentPath: segments.slice(0, -1).join('/'),
      kind: 'file',
      extension: getExtension(file.name),
      mimeType: file.type,
      size: file.size,
      lastModified: file.lastModified,
      depth: segments.length - 1,
    })
    files.set(id, file)
    if (index % 200 === 0) {
      emitProgress(entries, relativePath, options.onProgress)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  for (const path of directories) {
    const segments = path.split('/')
    entries.push({
      id: createEntryId(path, 'directory'),
      name: segments.at(-1) ?? path,
      normalizedName: normalizeFileName(segments.at(-1) ?? path),
      relativePath: path,
      parentPath: segments.slice(0, -1).join('/'),
      kind: 'directory',
      extension: '',
      mimeType: '',
      size: 0,
      lastModified: 0,
      depth: segments.length - 1,
      isEmptyDirectory: false,
    })
  }

  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'))
  emitProgress(entries, rootName, options.onProgress)
  return { rootName, entries, files, statistics: await analyze(entries) }
}
