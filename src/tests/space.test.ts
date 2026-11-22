import { describe, expect, it } from 'vitest'
import type { FileEntryRecord } from '../types'
import { normalizeFileName } from '../utils/file'
import { aggregateSpaceNodes, buildTreemapData, formatSharePercent } from '../utils/space'

const makeEntry = (
  relativePath: string,
  kind: 'file' | 'directory',
  size = 0,
): FileEntryRecord => {
  const parts = relativePath.split('/')
  const name = parts.at(-1) ?? relativePath
  return {
    id: `${kind}:${relativePath}`,
    name,
    normalizedName: normalizeFileName(name),
    relativePath,
    parentPath: parts.slice(0, -1).join('/'),
    kind,
    extension: kind === 'file' ? name.split('.').at(-1) ?? '' : '',
    mimeType: '',
    size,
    lastModified: 1,
    depth: parts.length - 1,
    isEmptyDirectory: kind === 'directory' && size === 0,
  }
}

describe('space analysis aggregation & perceptual scaling', () => {
  const entries: FileEntryRecord[] = [
    makeEntry('root', 'directory'),
    makeEntry('root/videos', 'directory'),
    makeEntry('root/videos/master.mov', 'file', 2_000_000_000),
    makeEntry('root/configs', 'directory'),
    makeEntry('root/configs/env.json', 'file', 512),
    makeEntry('root/empty-slot', 'directory'),
    makeEntry('root/README.md', 'file', 2_048),
  ]
  const totalSize = 2_000_002_560

  it('aggregates direct child folders, 0-byte folders, and files with small-item detection', () => {
    const { nodes, scopeTotalSize } = aggregateSpaceNodes(entries, 'root', totalSize)
    expect(scopeTotalSize).toBe(totalSize)
    expect(nodes).toHaveLength(4)

    const videos = nodes.find((item) => item.label === 'videos')!
    const configs = nodes.find((item) => item.label === 'configs')!
    const emptySlot = nodes.find((item) => item.label === 'empty-slot')!
    const readme = nodes.find((item) => item.label === 'README.md')!

    expect(videos.realSize).toBe(2_000_000_000)
    expect(videos.isSmall).toBe(false)

    expect(configs.realSize).toBe(512)
    expect(configs.isSmall).toBe(true)

    expect(emptySlot.realSize).toBe(0)
    expect(emptySlot.isSmall).toBe(true)

    expect(readme.kind).toBe('file')
    expect(readme.realSize).toBe(2_048)
    expect(readme.isSmall).toBe(true)
  })

  it('boosts tiny & zero-byte items in perceptual mode while maintaining monotonic order and exact realSize', () => {
    const { nodes } = aggregateSpaceNodes(entries, 'root', totalSize)
    const treemap = buildTreemapData(nodes, 'perceptual')

    const videos = treemap.find((item) => item.label === 'videos')!
    const readme = treemap.find((item) => item.label === 'README.md')!
    const configs = treemap.find((item) => item.label === 'configs')!
    const emptySlot = treemap.find((item) => item.label === 'empty-slot')!

    // Monotonic order preserved: 2 GB > 2 KB > 512 B > 0 B
    expect(videos.value).toBeGreaterThan(readme.value)
    expect(readme.value).toBeGreaterThan(configs.value)
    expect(configs.value).toBeGreaterThan(emptySlot.value)

    // Guaranteed generous hit-target floor (>= 10% of max weight for 4 items)
    expect(configs.value / videos.value).toBeGreaterThan(0.1)
    expect(emptySlot.value / videos.value).toBeGreaterThan(0.08)

    // Exact byte values preserved
    expect(configs.realSize).toBe(512)
    expect(emptySlot.realSize).toBe(0)
  })

  it('supports drilling down into a subdirectory scope', () => {
    const { nodes, scopeTotalSize } = aggregateSpaceNodes(entries, 'root/configs', totalSize)
    expect(scopeTotalSize).toBe(512)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].label).toBe('env.json')
    expect(nodes[0].kind).toBe('file')
  })

  it('formats tiny share percentages cleanly', () => {
    expect(formatSharePercent(0)).toBe('0%')
    expect(formatSharePercent(0.004)).toBe('< 0.1%')
    expect(formatSharePercent(12.34)).toBe('12.3%')
  })
})
