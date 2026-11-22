import { describe, expect, it } from 'vitest'
import { findDuplicatesWithSummary } from '../services/duplicates'
import { buildStandaloneHtmlReport } from '../services/export'
import { buildRenamePlan, findSimilarNames } from '../services/naming'
import { scanFileList } from '../services/scanner'
import type { FileEntryRecord } from '../types'
import { calculateStatistics, normalizeFileName } from '../utils/file'

const makeEntry = (relativePath: string, size = 1024, lastModified = 1_700_000_000_000): FileEntryRecord => {
  const parts = relativePath.split('/')
  const name = parts.at(-1) ?? relativePath
  const dot = name.lastIndexOf('.')
  return {
    id: `file:${relativePath}`,
    name,
    normalizedName: normalizeFileName(name),
    relativePath,
    parentPath: parts.slice(0, -1).join('/'),
    kind: 'file',
    extension: dot > 0 ? name.slice(dot + 1).toLocaleLowerCase() : '无扩展名',
    mimeType: '',
    size,
    lastModified,
    depth: parts.length - 1,
  }
}

function makeWebkitFile(relativePath: string, content: string): File {
  const name = relativePath.split('/').at(-1) ?? relativePath
  const file = new File([content], name)
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

describe('scanner rules, duplicates priority, naming governance & HTML export', () => {
  it('applies unified ignore rules, hidden file filtering, and maxDepth in scanFileList', async () => {
    const files = [
      makeWebkitFile('proj/src/app.ts', 'const x = 1'),
      makeWebkitFile('proj/node_modules/pkg/index.js', 'module.exports = {}'),
      makeWebkitFile('proj/custom_cache/blob.bin', '1234'),
      makeWebkitFile('proj/.env', 'SECRET=1'),
      makeWebkitFile('proj/a/b/c/d/deep.txt', 'deep'),
    ]

    const res = await scanFileList(files, {
      ignoreDefaults: true,
      customIgnores: ['custom_cache'],
      skipHidden: true,
      maxDepth: 3,
    })

    const filePaths = res.entries.filter((e) => e.kind === 'file').map((e) => e.relativePath)
    expect(filePaths).toEqual(['proj/src/app.ts'])
    const rootDir = res.entries.find((e) => e.relativePath === 'proj')!
    expect(rootDir.size).toBe(files[0].size)
  })

  it('prioritizes largest duplicate candidates first and marks cleanest copy as recommendedKeep', async () => {
    const largeBytes = 'A'.repeat(2048)
    const smallBytes = 'B'.repeat(16)

    const eLargeClean = makeEntry('ws/Design/Hero-Visual.webp', 2048)
    const eLargeCopy = makeEntry('ws/Legacy-Archive/Hero-Visual-副本.webp', 2048)
    const eSmall1 = makeEntry('ws/icons/dot-1.svg', 16)
    const eSmall2 = makeEntry('ws/icons/dot-2.svg', 16)

    const fileMap = new Map<string, File>([
      [eLargeClean.id, new File([largeBytes], eLargeClean.name)],
      [eLargeCopy.id, new File([largeBytes], eLargeCopy.name)],
      [eSmall1.id, new File([smallBytes], eSmall1.name)],
      [eSmall2.id, new File([smallBytes], eSmall2.name)],
    ])

    const { groups, skippedCount } = await findDuplicatesWithSummary(
      [eLargeClean, eLargeCopy, eSmall1, eSmall2],
      fileMap,
      { maxCandidates: 2 },
    )

    expect(skippedCount).toBe(2)
    expect(groups).toHaveLength(1)
    expect(groups[0].size).toBe(2048)
    expect(groups[0].recommendedKeepId).toBe(eLargeClean.id)
    expect(groups[0].files.find((f) => f.id === eLargeClean.id)?.isRecommendedKeep).toBe(true)
  })

  it('clusters similar names even when one file has a leading year prefix, and checks full collisions', () => {
    const entries = [
      makeEntry('ws/docs/report_final.pdf', 500),
      makeEntry('ws/docs/2026_report_final.pdf', 500),
      makeEntry('ws/docs/existing-target.pdf', 500),
    ]

    const clusters = findSimilarNames(entries)
    expect(clusters.length).toBeGreaterThanOrEqual(1)
    expect(clusters[0].files.map((f) => f.name)).toEqual(
      expect.arrayContaining(['report_final.pdf', '2026_report_final.pdf']),
    )

    // Collision against an untouched file in the same directory
    const collisionPlan = buildRenamePlan(entries, {
      prefix: '',
      suffix: '',
      replaceFrom: 'report_final',
      replaceTo: 'existing-target',
      caseMode: 'none',
    })
    expect(collisionPlan.collisionCount).toBeGreaterThanOrEqual(1)

    // Template tokens & kebab-case transform
    const cleanPlan = buildRenamePlan([makeEntry('ws/docs/Quarterly_Brand Review.pdf', 500)], {
      prefix: '{index:03}-',
      suffix: '',
      replaceFrom: '',
      replaceTo: '',
      caseMode: 'kebab',
    })
    expect(cleanPlan.items[0].target).toBe('001-quarterly-brand-review.pdf')
    expect(cleanPlan.collisionCount).toBe(0)
    expect(cleanPlan.invalidCount).toBe(0)
  })

  it('generates a self-contained HTML diagnostic report', () => {
    const entries = [makeEntry('ws/video/master.mov', 10_485_760)]
    const stats = calculateStatistics(entries)
    const html = buildStandaloneHtmlReport(entries, stats, 'Studio<Root>', [])
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Studio&lt;Root&gt;')
    expect(html).toContain('10.0 MB')
  })
})
