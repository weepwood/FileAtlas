import type { EntryKind, FileEntryRecord } from '../types'
import { getExtension } from './file'

export type SpaceScaleMode = 'perceptual' | 'linear'

export interface SpaceNode {
  /** Unique full relative path (used as ECharts node name for exact lookup) */
  path: string
  /** Short display name of the folder or file */
  label: string
  kind: EntryKind
  extension: string
  /** Exact cumulative size in bytes */
  realSize: number
  /** Share within current directory scope (0 - 100) */
  scopeShare: number
  /** Share within root workspace (0 - 100) */
  rootShare: number
  /** Number of files inside (1 if kind === 'file') */
  fileCount: number
  /** Number of nested subdirectories inside */
  dirCount: number
  /** Whether this node is considered a tiny item (< 2% of scope size or 0 B) */
  isSmall: boolean
}

export interface TreemapDatum extends SpaceNode {
  name: string
  value: number
}

export const SMALL_ITEM_SHARE_THRESHOLD = 2

export function aggregateSpaceNodes(
  entries: FileEntryRecord[],
  scopePath: string,
  rootTotalSize: number,
): { nodes: SpaceNode[]; scopeTotalSize: number } {
  const prefix = `${scopePath}/`
  const map = new Map<
    string,
    {
      path: string
      label: string
      kind: EntryKind
      extension: string
      realSize: number
      fileCount: number
      dirCount: number
    }
  >()

  for (const entry of entries) {
    if (entry.relativePath === scopePath || !entry.relativePath.startsWith(prefix)) continue
    const rest = entry.relativePath.slice(prefix.length)
    if (!rest) continue

    const slashIndex = rest.indexOf('/')
    if (slashIndex === -1) {
      // Direct child of scopePath
      if (entry.kind === 'file') {
        map.set(entry.relativePath, {
          path: entry.relativePath,
          label: entry.name,
          kind: 'file',
          extension: entry.extension || getExtension(entry.name),
          realSize: entry.size,
          fileCount: 1,
          dirCount: 0,
        })
      } else {
        const existing = map.get(entry.relativePath)
        if (!existing) {
          map.set(entry.relativePath, {
            path: entry.relativePath,
            label: entry.name,
            kind: 'directory',
            extension: '',
            realSize: 0,
            fileCount: 0,
            dirCount: 0,
          })
        }
      }
    } else {
      // Descendant inside a direct child directory
      const childDirName = rest.slice(0, slashIndex)
      const childDirPath = `${scopePath}/${childDirName}`
      let bucket = map.get(childDirPath)
      if (!bucket) {
        bucket = {
          path: childDirPath,
          label: childDirName,
          kind: 'directory',
          extension: '',
          realSize: 0,
          fileCount: 0,
          dirCount: 0,
        }
        map.set(childDirPath, bucket)
      }
      if (entry.kind === 'file') {
        bucket.realSize += entry.size
        bucket.fileCount += 1
      } else {
        bucket.dirCount += 1
      }
    }
  }

  const rawItems = [...map.values()]
  const scopeTotalSize = rawItems.reduce((sum, item) => sum + item.realSize, 0)

  const nodes: SpaceNode[] = rawItems
    .map((item) => {
      const scopeShare = scopeTotalSize > 0 ? (item.realSize / scopeTotalSize) * 100 : 0
      const rootShare = rootTotalSize > 0 ? (item.realSize / rootTotalSize) * 100 : 0
      const isSmall = item.realSize === 0 || (rawItems.length > 1 && scopeShare < SMALL_ITEM_SHARE_THRESHOLD)
      return {
        ...item,
        scopeShare,
        rootShare,
        isSmall,
      }
    })
    .sort((a, b) => b.realSize - a.realSize || a.label.localeCompare(b.label, 'zh-CN'))

  return { nodes, scopeTotalSize }
}

/**
 * Computes ECharts treemap values so that:
 * - In 'perceptual' mode, extreme size disparities (e.g. 2 GB vs 4 KB or 0 B) are compressed
 *   with a strictly monotonic power curve + guaranteed minimum area floor, making every small
 *   folder or file comfortably hoverable and clickable while keeping exact realSize intact.
 * - In 'linear' mode, areas stay proportional to bytes with a tiny non-zero floor so 0 B items remain visible.
 */
export function buildTreemapData(nodes: SpaceNode[], mode: SpaceScaleMode): TreemapDatum[] {
  if (!nodes.length) return []

  const maxSize = Math.max(...nodes.map((node) => node.realSize), 0)
  if (maxSize === 0) {
    return nodes.map((node) => ({ ...node, name: node.path, value: 1 }))
  }

  if (mode === 'linear') {
    const zeroFloor = Math.max(1, maxSize * 0.0025)
    return nodes.map((node) => ({
      ...node,
      name: node.path,
      value: node.realSize > 0 ? node.realSize : zeroFloor,
    }))
  }

  // Perceptual mode: monotonic power curve + guaranteed hit-target floor
  const count = nodes.length
  const minFloor = Math.min(0.14, 0.72 / Math.max(count, 4))

  return nodes.map((node) => {
    let weight: number
    if (node.realSize <= 0) {
      weight = minFloor * 0.85
    } else {
      const normalized = node.realSize / maxSize
      weight = minFloor + (1 - minFloor) * normalized ** 0.35
    }
    return {
      ...node,
      name: node.path,
      value: Number((weight * 1000).toFixed(4)),
    }
  })
}

export function formatSharePercent(pct: number): string {
  if (pct <= 0) return '0%'
  if (pct < 0.1) return '< 0.1%'
  return `${pct.toFixed(1)}%`
}
