import type { FileEntryRecord, ScanStatistics } from '../types'
import { formatBytes } from '../utils/file'

function download(content: BlobPart, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function exportCsv(entries: FileEntryRecord[], rootName: string): void {
  const header = ['relativePath', 'name', 'kind', 'extension', 'size', 'lastModified', 'depth']
  const rows = entries.map((entry) => [
    entry.relativePath,
    entry.name,
    entry.kind,
    entry.extension,
    entry.size,
    entry.lastModified ? new Date(entry.lastModified).toISOString() : '',
    entry.depth,
  ])
  download(`\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')}`, `${rootName}-fileatlas.csv`, 'text/csv;charset=utf-8')
}

export function exportJson(entries: FileEntryRecord[], statistics: ScanStatistics, rootName: string): void {
  download(JSON.stringify({ rootName, createdAt: new Date().toISOString(), statistics, entries }, null, 2), `${rootName}-fileatlas.json`, 'application/json')
}

export function exportMarkdown(entries: FileEntryRecord[], statistics: ScanStatistics, rootName: string): void {
  const largest = statistics.largestFiles.slice(0, 10)
  const body = [
    `# ${rootName} · FileAtlas 分析报告`,
    '',
    `- 文件：${statistics.fileCount}`,
    `- 文件夹：${statistics.directoryCount}`,
    `- 总大小：${formatBytes(statistics.totalSize)}`,
    `- 空文件：${statistics.emptyFileCount}`,
    `- 空文件夹：${statistics.emptyDirectoryCount}`,
    '',
    '## 最大文件',
    '',
    '| 路径 | 大小 |',
    '|---|---:|',
    ...largest.map((file) => `| ${file.relativePath.replaceAll('|', '\\|')} | ${formatBytes(file.size)} |`),
    '',
    '## 目录清单',
    '',
    ...entries.map((entry) => `${'  '.repeat(Math.max(0, entry.depth - 1))}- ${entry.kind === 'directory' ? '📁' : '📄'} ${entry.name}`),
  ].join('\n')
  download(body, `${rootName}-fileatlas.md`, 'text/markdown;charset=utf-8')
}
