import type { FileEntryRecord, ScanConfig, ScanProgress, ScanResult, ScanStatistics } from '../types'
import { DEFAULT_IGNORE_NAMES } from '../store/useUiStore'
import {
  calculateStatistics,
  createEntryId,
  getExtension,
  hydrateDirectoryAggregates,
  normalizeFileName,
} from '../utils/file'

export interface ScanOptions extends Partial<ScanConfig> {
  onProgress?: (progress: ScanProgress) => void
  signal?: AbortSignal
}

const FILE_READ_BATCH_SIZE = 24

function buildIgnoreSet(options: ScanOptions): Set<string> {
  const set = new Set<string>()
  if (options.ignoreDefaults !== false) {
    for (const name of DEFAULT_IGNORE_NAMES) {
      set.add(name.toLocaleLowerCase())
    }
  }
  if (options.customIgnores?.length) {
    for (const item of options.customIgnores) {
      const trimmed = item.trim().toLocaleLowerCase()
      if (trimmed) set.add(trimmed)
    }
  }
  return set
}

export function shouldIgnoreSegment(name: string, depth: number, ignoreSet: Set<string>, options: ScanOptions): boolean {
  if (options.maxDepth && options.maxDepth > 0 && depth > options.maxDepth) return true
  const lower = name.toLocaleLowerCase()
  if (ignoreSet.has(lower)) return true
  if (options.skipHidden && name.startsWith('.') && name !== '.') return true
  return false
}

async function analyze(entries: FileEntryRecord[]): Promise<ScanStatistics> {
  if (typeof window === 'undefined' || !('Worker' in window)) return calculateStatistics(entries)
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

export async function scanDirectoryHandle(
  root: FileSystemDirectoryHandle,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const rawEntries: FileEntryRecord[] = []
  const files = new Map<string, File>()
  const ignoreSet = buildIgnoreSet(options)
  const queue: Array<{ handle: FileSystemDirectoryHandle; relativePath: string; depth: number }> = [
    { handle: root, relativePath: root.name, depth: 0 },
  ]

  let fileCount = 0
  let directoryCount = 0
  let totalSize = 0
  let processedSinceYield = 0

  const reportProgress = (currentPath: string) => {
    options.onProgress?.({
      files: fileCount,
      directories: directoryCount,
      totalSize,
      currentPath,
    })
  }

  while (queue.length) {
    assertNotAborted(options.signal)
    const current = queue.shift()!
    const children: Array<[string, FileSystemHandle]> = []
    for await (const child of current.handle.values()) children.push([child.name, child])

    rawEntries.push({
      id: createEntryId(current.relativePath, 'directory'),
      name: current.handle.name,
      normalizedName: normalizeFileName(current.handle.name),
      relativePath: current.relativePath,
      parentPath: current.relativePath.includes('/')
        ? current.relativePath.slice(0, current.relativePath.lastIndexOf('/'))
        : '',
      kind: 'directory',
      extension: '',
      mimeType: '',
      size: 0,
      lastModified: 0,
      depth: current.depth,
      isEmptyDirectory: children.length === 0,
    })
    directoryCount += 1

    const pendingFiles: Array<{ name: string; handle: FileSystemFileHandle; relativePath: string; depth: number }> = []

    for (const [name, child] of children) {
      assertNotAborted(options.signal)
      const nextDepth = current.depth + 1
      if (shouldIgnoreSegment(name, nextDepth, ignoreSet, options)) continue
      const relativePath = `${current.relativePath}/${name}`
      if (child.kind === 'directory') {
        queue.push({ handle: child as FileSystemDirectoryHandle, relativePath, depth: nextDepth })
      } else {
        pendingFiles.push({
          name,
          handle: child as FileSystemFileHandle,
          relativePath,
          depth: nextDepth,
        })
      }
    }

    for (let offset = 0; offset < pendingFiles.length; offset += FILE_READ_BATCH_SIZE) {
      assertNotAborted(options.signal)
      const chunk = pendingFiles.slice(offset, offset + FILE_READ_BATCH_SIZE)
      const resolved = await Promise.all(
        chunk.map(async (item) => ({
          item,
          file: await item.handle.getFile(),
        })),
      )

      for (const { item, file } of resolved) {
        const id = createEntryId(item.relativePath, 'file')
        rawEntries.push({
          id,
          name: file.name,
          normalizedName: normalizeFileName(file.name),
          relativePath: item.relativePath,
          parentPath: current.relativePath,
          kind: 'file',
          extension: getExtension(file.name),
          mimeType: file.type,
          size: file.size,
          lastModified: file.lastModified,
          depth: item.depth,
        })
        files.set(id, file)
        fileCount += 1
        totalSize += file.size
        processedSinceYield += 1
      }

      if (processedSinceYield >= 200) {
        reportProgress(chunk.at(-1)?.relativePath ?? current.relativePath)
        processedSinceYield = 0
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }
  }

  const entries = hydrateDirectoryAggregates(rawEntries)
  reportProgress(root.name)
  return { rootName: root.name, entries, files, statistics: await analyze(entries) }
}

export async function scanFileList(fileList: FileList | File[], options: ScanOptions = {}): Promise<ScanResult> {
  const rawEntries: FileEntryRecord[] = []
  const files = new Map<string, File>()
  const directories = new Set<string>()
  const ignoreSet = buildIgnoreSet(options)
  const sourceFiles = Array.from(fileList)
  const rootName = sourceFiles[0]?.webkitRelativePath?.split('/')[0] || '已选择文件'

  let fileCount = 0
  let totalSize = 0

  for (let index = 0; index < sourceFiles.length; index += 1) {
    assertNotAborted(options.signal)
    const file = sourceFiles[index]
    const relativePath = file.webkitRelativePath || `${rootName}/${file.name}`
    const segments = relativePath.split('/')

    // Apply unified ignore & depth rules to every segment beneath rootName
    let skipped = false
    for (let segIdx = 1; segIdx < segments.length; segIdx += 1) {
      if (shouldIgnoreSegment(segments[segIdx], segIdx, ignoreSet, options)) {
        skipped = true
        break
      }
    }
    if (skipped) continue

    for (let depth = 0; depth < segments.length - 1; depth += 1) {
      directories.add(segments.slice(0, depth + 1).join('/'))
    }
    const id = createEntryId(relativePath, 'file')
    rawEntries.push({
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
    fileCount += 1
    totalSize += file.size

    if (fileCount % 200 === 0) {
      options.onProgress?.({
        files: fileCount,
        directories: directories.size,
        totalSize,
        currentPath: relativePath,
      })
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  if (!directories.size && rootName) {
    directories.add(rootName)
  }

  for (const path of directories) {
    const segments = path.split('/')
    rawEntries.push({
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

  rawEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'))
  const entries = hydrateDirectoryAggregates(rawEntries)
  options.onProgress?.({
    files: fileCount,
    directories: directories.size,
    totalSize,
    currentPath: rootName,
  })
  return { rootName, entries, files, statistics: await analyze(entries) }
}

async function readWebkitDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (!batch.length) break
    all.push(...batch)
  }
  return all
}

export async function scanDroppedDataTransfer(
  dataTransfer: DataTransfer,
  options: ScanOptions = {},
): Promise<ScanResult | null> {
  const itemList = Array.from(dataTransfer.items ?? [])
  const firstItem = itemList[0]
  if (!firstItem) return null

  // Prefer modern File System Access handle when supported
  if (typeof firstItem.getAsFileSystemHandle === 'function') {
    const handle = await firstItem.getAsFileSystemHandle()
    if (handle && handle.kind === 'directory') {
      return scanDirectoryHandle(handle as FileSystemDirectoryHandle, options)
    }
  }

  // Fallback to standard webkitGetAsEntry recursive traversal
  const rootEntry = firstItem.webkitGetAsEntry?.()
  if (rootEntry && rootEntry.isDirectory) {
    const dirRoot = rootEntry as FileSystemDirectoryEntry
    const rawEntries: FileEntryRecord[] = []
    const files = new Map<string, File>()
    const ignoreSet = buildIgnoreSet(options)
    const queue: Array<{ entry: FileSystemDirectoryEntry; relativePath: string; depth: number }> = [
      { entry: dirRoot, relativePath: dirRoot.name, depth: 0 },
    ]
    let fileCount = 0
    let directoryCount = 0
    let totalSize = 0
    let processed = 0

    while (queue.length) {
      assertNotAborted(options.signal)
      const current = queue.shift()!
      const children = await readWebkitDirectoryEntries(current.entry.createReader())

      rawEntries.push({
        id: createEntryId(current.relativePath, 'directory'),
        name: current.entry.name,
        normalizedName: normalizeFileName(current.entry.name),
        relativePath: current.relativePath,
        parentPath: current.relativePath.includes('/')
          ? current.relativePath.slice(0, current.relativePath.lastIndexOf('/'))
          : '',
        kind: 'directory',
        extension: '',
        mimeType: '',
        size: 0,
        lastModified: 0,
        depth: current.depth,
        isEmptyDirectory: children.length === 0,
      })
      directoryCount += 1

      for (const child of children) {
        assertNotAborted(options.signal)
        const nextDepth = current.depth + 1
        if (shouldIgnoreSegment(child.name, nextDepth, ignoreSet, options)) continue
        const relativePath = `${current.relativePath}/${child.name}`
        if (child.isDirectory) {
          queue.push({ entry: child as FileSystemDirectoryEntry, relativePath, depth: nextDepth })
        } else if (child.isFile) {
          const file = await new Promise<File>((resolve, reject) => {
            ;(child as FileSystemFileEntry).file(resolve, reject)
          })
          const id = createEntryId(relativePath, 'file')
          rawEntries.push({
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
            depth: nextDepth,
          })
          files.set(id, file)
          fileCount += 1
          totalSize += file.size
        }
        processed += 1
        if (processed >= 200) {
          options.onProgress?.({
            files: fileCount,
            directories: directoryCount,
            totalSize,
            currentPath: relativePath,
          })
          processed = 0
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
        }
      }
    }

    rawEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'))
    const entries = hydrateDirectoryAggregates(rawEntries)
    options.onProgress?.({
      files: fileCount,
      directories: directoryCount,
      totalSize,
      currentPath: dirRoot.name,
    })
    return { rootName: dirRoot.name, entries, files, statistics: await analyze(entries) }
  }

  // Fallback if loose files were dropped
  if (dataTransfer.files?.length) {
    return scanFileList(dataTransfer.files, options)
  }

  return null
}
