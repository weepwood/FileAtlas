import { describe, expect, it } from 'vitest'
import { generateDemoWorkspace } from '../services/demo'
import { getFileCategory } from '../utils/spotlight'

describe('demo workspace & spotlight utilities', () => {
  it('generates a realistic demo workspace with files, directories, and hashable duplicate blobs', () => {
    const demo = generateDemoWorkspace()
    expect(demo.rootName).toBe('Creative-Studio-Workspace')
    expect(demo.statistics.fileCount).toBeGreaterThan(20)
    expect(demo.statistics.directoryCount).toBeGreaterThan(10)
    expect(demo.statistics.emptyFileCount).toBeGreaterThanOrEqual(2)
    expect(demo.statistics.emptyDirectoryCount).toBeGreaterThanOrEqual(2)
    expect(demo.files.size).toBeGreaterThanOrEqual(7)
  })

  it('classifies file extensions into semantic categories', () => {
    expect(getFileCategory('tsx')).toBe('code')
    expect(getFileCategory('WEBP')).toBe('image')
    expect(getFileCategory('mov')).toBe('video')
    expect(getFileCategory('zip')).toBe('archive')
    expect(getFileCategory('pdf')).toBe('document')
    expect(getFileCategory('csv')).toBe('data')
    expect(getFileCategory('unknownext')).toBe('other')
  })
})
