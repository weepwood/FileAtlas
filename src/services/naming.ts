import type { FileEntryRecord } from '../types'
import { validateFileNameSafety } from '../utils/file'

export interface SimilarNameGroup {
  id: string
  score: number
  files: FileEntryRecord[]
}

export type RenameCaseMode = 'none' | 'kebab' | 'snake' | 'lower'

export interface RenameRuleOptions {
  prefix: string
  suffix: string
  replaceFrom: string
  replaceTo: string
  useRegex?: boolean
  caseMode?: RenameCaseMode
  extensionFilter?: string
}

export interface RenamePreviewItem extends FileEntryRecord {
  target: string
  changed: boolean
  hasCollision: boolean
  safetyError: string | null
  index: number
}

export interface RenamePlanResult {
  items: RenamePreviewItem[]
  changedCount: number
  collisionCount: number
  invalidCount: number
  regexError: string | null
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  const current = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

function similarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length)
  return maxLength ? 1 - levenshtein(a, b) / maxLength : 1
}

function extractCoreStem(normalizedName: string): string {
  const stripped = normalizedName
    .replace(/^(?:\d{4}[-_\s]?\d{1,2}[-_\s]?\d{1,2}|\d{2,8}|v\d+)[-_\s]*/giu, '')
    .replace(/[-_\s]*(?:v\d+|\d{1,4})$/giu, '')
    .trim()
  return stripped.length >= 2 ? stripped : normalizedName
}

export function findSimilarNames(entries: FileEntryRecord[]): SimilarNameGroup[] {
  const files = entries.filter((entry) => entry.kind === 'file').slice(0, 4000)
  const extBuckets = new Map<string, Array<{ entry: FileEntryRecord; core: string }>>()

  for (const file of files) {
    if (!file.normalizedName) continue
    const core = extractCoreStem(file.normalizedName)
    const bucket = extBuckets.get(file.extension) ?? []
    bucket.push({ entry: file, core })
    extBuckets.set(file.extension, bucket)
  }

  const used = new Set<string>()
  const groups: SimilarNameGroup[] = []

  const clusterSubset = (subset: Array<{ entry: FileEntryRecord; core: string }>) => {
    for (let i = 0; i < subset.length; i += 1) {
      const base = subset[i]
      if (used.has(base.entry.id)) continue
      const matches = [base.entry]
      let scoreTotal = 0

      for (let j = i + 1; j < subset.length; j += 1) {
        const candidate = subset[j]
        if (used.has(candidate.entry.id)) continue

        // Quick length-ratio filter before O(L^2) Levenshtein
        const maxNormLen = Math.max(base.entry.normalizedName.length, candidate.entry.normalizedName.length)
        const minNormLen = Math.min(base.entry.normalizedName.length, candidate.entry.normalizedName.length)
        const maxCoreLen = Math.max(base.core.length, candidate.core.length)
        const minCoreLen = Math.min(base.core.length, candidate.core.length)

        if (minNormLen / Math.max(1, maxNormLen) < 0.55 && minCoreLen / Math.max(1, maxCoreLen) < 0.72) {
          continue
        }

        const normScore = similarity(base.entry.normalizedName, candidate.entry.normalizedName)
        const coreScore =
          base.core.length >= 3 && candidate.core.length >= 3
            ? similarity(base.core, candidate.core) * 0.94
            : 0
        const bestScore = Math.max(normScore, coreScore)

        if (bestScore >= 0.78) {
          matches.push(candidate.entry)
          scoreTotal += bestScore
        }
      }

      if (matches.length > 1) {
        matches.forEach((file) => used.add(file.id))
        groups.push({
          id: crypto.randomUUID(),
          score: Math.min(1, scoreTotal / (matches.length - 1)),
          files: matches,
        })
      }
    }
  }

  for (const list of extBuckets.values()) {
    if (list.length <= 350) {
      // Small/medium extension group: compare directly so prefixed variants (e.g. report.pdf vs 2026_report.pdf) never miss!
      clusterSubset(list)
    } else {
      // Very large extension group: sub-bucket by core stem prefix
      const subBuckets = new Map<string, Array<{ entry: FileEntryRecord; core: string }>>()
      for (const item of list) {
        const key = item.core.slice(0, 2)
        const arr = subBuckets.get(key) ?? []
        arr.push(item)
        subBuckets.set(key, arr)
      }
      for (const sub of subBuckets.values()) {
        clusterSubset(sub)
      }
    }
  }

  return groups.sort((a, b) => b.score - a.score)
}

function applyCaseTransform(stem: string, mode: RenameCaseMode): string {
  if (mode === 'none') return stem
  if (mode === 'lower') return stem.toLocaleLowerCase()
  const tokenized = stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[\s_-]+/g, ' ')
    .trim()
    .toLocaleLowerCase()
  if (mode === 'kebab') return tokenized.replace(/\s+/g, '-')
  if (mode === 'snake') return tokenized.replace(/\s+/g, '_')
  return stem
}

function expandTemplateTokens(template: string, seqNumber: number, lastModified: number): string {
  if (!template) return ''
  const dateObj = lastModified > 0 ? new Date(lastModified) : new Date()
  const yyyy = dateObj.getFullYear()
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
  const dd = String(dateObj.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}-${mm}-${dd}`

  return template
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{index(?::0?(\d+))?\}/gi, (_, widthStr?: string) => {
      const width = widthStr ? Math.min(8, Math.max(1, Number(widthStr))) : 2
      return String(seqNumber).padStart(width, '0')
    })
}

export function buildRenamePlan(entries: FileEntryRecord[], options: RenameRuleOptions): RenamePlanResult {
  const allFiles = entries.filter((entry) => entry.kind === 'file')
  const extFilter = options.extensionFilter?.trim().toLocaleLowerCase() || ''

  let compiledRegex: RegExp | null = null
  let regexError: string | null = null
  if (options.useRegex && options.replaceFrom) {
    try {
      compiledRegex = new RegExp(options.replaceFrom, 'gu')
    } catch (error) {
      regexError = error instanceof Error ? error.message : '无效的正则表达式'
    }
  }

  // Track final lowercase target paths across ALL files in workspace to catch collisions with untouched files too
  const targetByFileId = new Map<string, string>()
  const draftItems: Array<{
    entry: FileEntryRecord
    target: string
    changed: boolean
    safetyError: string | null
    index: number
  }> = []

  let matchedIndex = 0
  for (const file of allFiles) {
    const inScope = !extFilter || file.extension.toLocaleLowerCase() === extFilter
    if (!inScope || regexError) {
      targetByFileId.set(file.id, file.name)
      if (inScope) {
        draftItems.push({
          entry: file,
          target: file.name,
          changed: false,
          safetyError: null,
          index: matchedIndex,
        })
        matchedIndex += 1
      }
      continue
    }

    matchedIndex += 1
    const dot = file.name.lastIndexOf('.')
    const base = dot > 0 ? file.name.slice(0, dot) : file.name
    const ext = dot > 0 ? file.name.slice(dot) : ''

    let replaced = base
    if (options.replaceFrom) {
      replaced = compiledRegex
        ? base.replace(compiledRegex, options.replaceTo)
        : base.replaceAll(options.replaceFrom, options.replaceTo)
    }
    replaced = applyCaseTransform(replaced, options.caseMode ?? 'none')

    const resolvedPrefix = expandTemplateTokens(options.prefix, matchedIndex, file.lastModified)
    const resolvedSuffix = expandTemplateTokens(options.suffix, matchedIndex, file.lastModified)
    const target = `${resolvedPrefix}${replaced}${resolvedSuffix}${ext}`
    const changed = target !== file.name
    const safetyError = changed ? validateFileNameSafety(target) : null

    targetByFileId.set(file.id, target)
    draftItems.push({
      entry: file,
      target,
      changed,
      safetyError,
      index: matchedIndex - 1,
    })
  }

  const pathCounts = new Map<string, number>()
  for (const file of allFiles) {
    const targetName = targetByFileId.get(file.id) ?? file.name
    const key = `${file.parentPath}/${targetName.toLocaleLowerCase()}`
    pathCounts.set(key, (pathCounts.get(key) ?? 0) + 1)
  }

  let collisionCount = 0
  for (const count of pathCounts.values()) {
    if (count > 1) collisionCount += count - 1
  }

  let changedCount = 0
  let invalidCount = 0
  const items: RenamePreviewItem[] = draftItems.map((draft) => {
    const key = `${draft.entry.parentPath}/${draft.target.toLocaleLowerCase()}`
    const hasCollision = (pathCounts.get(key) ?? 0) > 1
    if (draft.changed) changedCount += 1
    if (draft.safetyError) invalidCount += 1
    return {
      ...draft.entry,
      target: draft.target,
      changed: draft.changed,
      hasCollision,
      safetyError: draft.safetyError,
      index: draft.index,
    }
  })

  return {
    items,
    changedCount,
    collisionCount,
    invalidCount,
    regexError,
  }
}
