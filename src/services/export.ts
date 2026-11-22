import type { DuplicateGroup, FileEntryRecord, ScanStatistics } from '../types'
import { AGE_BUCKETS, detectJunkReason, formatBytes } from '../utils/file'
import type { RenamePreviewItem } from './naming'

export function downloadBlob(content: BlobPart, filename: string, type: string): void {
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

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function stripRootPrefix(relativePath: string, rootName: string): string {
  const prefix = `${rootName}/`
  return relativePath.startsWith(prefix) ? relativePath.slice(prefix.length) : relativePath
}

function quoteSh(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function quotePs(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
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
  downloadBlob(
    `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')}`,
    `${rootName}-fileatlas.csv`,
    'text/csv;charset=utf-8',
  )
}

export function exportJson(entries: FileEntryRecord[], statistics: ScanStatistics, rootName: string): void {
  downloadBlob(
    JSON.stringify({ rootName, createdAt: new Date().toISOString(), statistics, entries }, null, 2),
    `${rootName}-fileatlas.json`,
    'application/json',
  )
}

export function exportMarkdown(
  entries: FileEntryRecord[],
  statistics: ScanStatistics,
  rootName: string,
  duplicates: DuplicateGroup[] = [],
): void {
  const largest = statistics.largestFiles.slice(0, 12)
  const topTypes = Object.entries(statistics.typeCounts)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
  const maxTreeLines = 300
  const treeSlice = entries.slice(0, maxTreeLines)
  const truncatedCount = Math.max(0, entries.length - maxTreeLines)
  const reclaimable = duplicates.reduce((sum, g) => sum + g.reclaimableSize, 0)

  const body = [
    `# ${rootName} · FileAtlas 本地诊断报告`,
    '',
    `> 生成时间：${new Date().toLocaleString('zh-CN')}（100% 本地生成）`,
    '',
    '## 1. 核心概览',
    '',
    `- **文件总数**：${statistics.fileCount.toLocaleString()}`,
    `- **文件夹总数**：${statistics.directoryCount.toLocaleString()}`,
    `- **总占用空间**：${formatBytes(statistics.totalSize)}`,
    `- **最大目录深度**：${statistics.maxDepth} 层`,
    `- **空文件 / 空文件夹**：${statistics.emptyFileCount} / ${statistics.emptyDirectoryCount}`,
    ...(duplicates.length > 0
      ? [`- **检出重复组**：${duplicates.length} 组（预计可释放 ${formatBytes(reclaimable)}）`]
      : []),
    '',
    '## 2. 主要文件类型分布',
    '',
    '| 扩展类型 | 文件数 | 占用空间 | 占比 |',
    '|---|---:|---:|---:|',
    ...topTypes.map(([ext, info]) => {
      const pct = statistics.totalSize > 0 ? ((info.size / statistics.totalSize) * 100).toFixed(1) : '0.0'
      return `| ${ext.toUpperCase()} | ${info.count.toLocaleString()} | ${formatBytes(info.size)} | ${pct}% |`
    }),
    '',
    '## 3. 冷热数据时间分布',
    '',
    '| 最后修改区间 | 文件数 | 占用空间 |',
    '|---|---:|---:|',
    ...AGE_BUCKETS.map((bucket) => {
      const item = statistics.ageBuckets?.[bucket] ?? { count: 0, size: 0 }
      return `| ${bucket} | ${item.count.toLocaleString()} | ${formatBytes(item.size)} |`
    }),
    '',
    '## 4. 体积最大的文件',
    '',
    '| 路径 | 大小 |',
    '|---|---:|',
    ...largest.map((file) => `| ${file.relativePath.replaceAll('|', '\\|')} | ${formatBytes(file.size)} |`),
    '',
    `## 5. 目录结构摘录（前 ${treeSlice.length} 项）`,
    '',
    ...treeSlice.map(
      (entry) =>
        `${'  '.repeat(Math.max(0, entry.depth - 1))}- ${entry.kind === 'directory' ? '📁' : '📄'} ${entry.name}${
          entry.size > 0 ? ` (${formatBytes(entry.size)})` : ''
        }`,
    ),
    ...(truncatedCount > 0 ? ['', `> 其余 ${truncatedCount.toLocaleString()} 个条目已省略，完整明细请参考 CSV 或 JSON 导出。`] : []),
  ].join('\n')
  downloadBlob(body, `${rootName}-fileatlas.md`, 'text/markdown;charset=utf-8')
}

export function buildStandaloneHtmlReport(
  entries: FileEntryRecord[],
  statistics: ScanStatistics,
  rootName: string,
  duplicates: DuplicateGroup[] = [],
): string {
  const topTypes = Object.entries(statistics.typeCounts)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
  const topDirs = entries
    .filter((entry) => entry.kind === 'directory' && entry.depth === 1)
    .sort((a, b) => b.size - a.size)
    .slice(0, 12)
  const junkItems = entries.filter((entry) => Boolean(detectJunkReason(entry)))
  const reclaimable = duplicates.reduce((sum, g) => sum + g.reclaimableSize, 0)
  const maxTypeSize = topTypes[0]?.[1].size || 1
  const maxDirSize = topDirs[0]?.size || 1

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(rootName)} · FileAtlas 诊断报告</title>
  <style>
    :root {
      color-scheme: dark light;
      --bg: #070e1c; --panel: #101b31; --line: rgba(148,163,184,0.18);
      --text: #eef4ff; --muted: #8ea0ba; --accent: #38bdf8; --accent2: #818cf8; --ok: #34d399;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f4f7fb; --panel: #ffffff; --line: rgba(15,23,42,0.1);
        --text: #0f172a; --muted: #52637a; --accent: #0284c7; --accent2: #4f46e5; --ok: #059669;
      }
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--text); line-height: 1.55; padding: 32px 20px 64px; }
    .wrap { max-width: 1120px; margin: 0 auto; display: grid; gap: 20px; }
    .hero, .card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 22px 24px; }
    .eyebrow { color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
    h1 { margin: 6px 0 8px; font-size: 26px; }
    h2 { margin: 0 0 14px; font-size: 16px; }
    .sub { color: var(--muted); font-size: 13px; margin: 0; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .kpi { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; }
    .kpi strong { display: block; margin-top: 6px; font-size: 22px; font-variant-numeric: tabular-nums; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--line); }
    th { color: var(--muted); font-size: 11.5px; text-transform: uppercase; }
    .num { text-align: right; white-space: nowrap; }
    .bar { height: 6px; border-radius: 999px; background: rgba(148,163,184,0.16); overflow: hidden; margin-top: 5px; }
    .bar > i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); }
    .foot { text-align: center; color: var(--muted); font-size: 12px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="eyebrow">FILEATLAS OFFLINE REPORT</div>
      <h1>${escapeHtml(rootName)} · 空间与结构诊断报告</h1>
      <p class="sub">生成时间：${escapeHtml(new Date().toLocaleString('zh-CN'))} · 本报告由浏览器在本地离线生成，不包含任何外部脚本或网络请求。</p>
    </header>

    <section class="kpis">
      <div class="kpi"><span>文件总数</span><strong>${statistics.fileCount.toLocaleString()}</strong></div>
      <div class="kpi"><span>目录总数</span><strong>${statistics.directoryCount.toLocaleString()}</strong></div>
      <div class="kpi"><span>总占用空间</span><strong>${escapeHtml(formatBytes(statistics.totalSize))}</strong></div>
      <div class="kpi"><span>最深目录层级</span><strong>${statistics.maxDepth} 层</strong></div>
      <div class="kpi"><span>空对象 / 临时残留</span><strong>${statistics.emptyFileCount + statistics.emptyDirectoryCount} / ${junkItems.length}</strong></div>
      <div class="kpi"><span>重复文件可回收</span><strong>${duplicates.length ? escapeHtml(formatBytes(reclaimable)) : '未运行查重'}</strong></div>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>一级子目录空间排行</h2>
        <table>
          <thead><tr><th>目录名</th><th class="num">包含文件</th><th class="num">累计体积</th></tr></thead>
          <tbody>
            ${
              topDirs.length
                ? topDirs
                    .map((dir) => {
                      const pct = Math.max(2, Math.round((dir.size / maxDirSize) * 100))
                      return `<tr><td><strong>📁 ${escapeHtml(dir.name)}</strong><div class="bar"><i style="width:${pct}%"></i></div></td><td class="num">${(dir.childFileCount ?? 0).toLocaleString()}</td><td class="num">${escapeHtml(formatBytes(dir.size))}</td></tr>`
                    })
                    .join('')
                : '<tr><td colspan="3">根目录下无子文件夹</td></tr>'
            }
          </tbody>
        </table>
      </article>

      <article class="card">
        <h2>文件类型占用 Top 10</h2>
        <table>
          <thead><tr><th>格式</th><th class="num">数量</th><th class="num">体积</th></tr></thead>
          <tbody>
            ${topTypes
              .map(([ext, info]) => {
                const pct = Math.max(2, Math.round((info.size / maxTypeSize) * 100))
                return `<tr><td><strong>${escapeHtml(ext.toUpperCase())}</strong><div class="bar"><i style="width:${pct}%"></i></div></td><td class="num">${info.count.toLocaleString()}</td><td class="num">${escapeHtml(formatBytes(info.size))}</td></tr>`
              })
              .join('')}
          </tbody>
        </table>
      </article>
    </section>

    <section class="grid-2">
      <article class="card">
        <h2>冷热数据时间分布</h2>
        <table>
          <thead><tr><th>最后修改时间</th><th class="num">文件数量</th><th class="num">空间占用</th></tr></thead>
          <tbody>
            ${AGE_BUCKETS.map((bucket) => {
              const info = statistics.ageBuckets?.[bucket] ?? { count: 0, size: 0 }
              return `<tr><td>${escapeHtml(bucket)}</td><td class="num">${info.count.toLocaleString()}</td><td class="num">${escapeHtml(formatBytes(info.size))}</td></tr>`
            }).join('')}
          </tbody>
        </table>
      </article>

      <article class="card">
        <h2>最大单文件 Top 12</h2>
        <table>
          <thead><tr><th>文件与路径</th><th class="num">大小</th></tr></thead>
          <tbody>
            ${statistics.largestFiles
              .slice(0, 12)
              .map(
                (file) =>
                  `<tr><td><strong>${escapeHtml(file.name)}</strong><br/><small style="color:var(--muted)">${escapeHtml(file.relativePath)}</small></td><td class="num">${escapeHtml(formatBytes(file.size))}</td></tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </article>
    </section>

    <div class="foot">Generated locally by FileAtlas · Zero Upload Local File Intelligence</div>
  </div>
</body>
</html>`
}

export function exportHtml(
  entries: FileEntryRecord[],
  statistics: ScanStatistics,
  rootName: string,
  duplicates: DuplicateGroup[] = [],
): void {
  const html = buildStandaloneHtmlReport(entries, statistics, rootName, duplicates)
  downloadBlob(html, `${rootName}-fileatlas-report.html`, 'text/html;charset=utf-8')
}

export function exportDuplicateQuarantineScript(
  duplicates: DuplicateGroup[],
  rootName: string,
  shell: 'sh' | 'ps1',
): void {
  const timestamp = new Date().toISOString().slice(0, 10)
  const quarantineDir = `_FileAtlas_Quarantine_${timestamp}`

  if (shell === 'sh') {
    const lines: string[] = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `# FileAtlas 安全隔离脚本（请在「${rootName}」根目录下审阅后执行）`,
      '# 本脚本不会直接删除任何文件，而是将重复副本按原目录层级移入隔离文件夹。',
      '',
      `QUARANTINE_DIR=${quoteSh(quarantineDir)}`,
      'mkdir -p "$QUARANTINE_DIR"',
      '',
    ]

    duplicates.forEach((group, index) => {
      const keep = group.files.find((f) => f.isRecommendedKeep) ?? group.files[0]
      const redundant = group.files.filter((f) => f.id !== keep.id)
      lines.push(`# 重复组 #${index + 1} (${formatBytes(group.size)}) — 保留: ${stripRootPrefix(keep.relativePath, rootName)}`)
      for (const item of redundant) {
        const rel = stripRootPrefix(item.relativePath, rootName)
        const relDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '.'
        lines.push(`if [ -f ${quoteSh(rel)} ]; then`)
        lines.push(`  mkdir -p "$QUARANTINE_DIR"/${quoteSh(relDir)}`)
        lines.push(`  mv -n ${quoteSh(rel)} "$QUARANTINE_DIR"/${quoteSh(rel)}`)
        lines.push('fi')
      }
      lines.push('')
    })

    lines.push('echo "已完成安全隔离，请核查 $QUARANTINE_DIR 后自行决定是否清理。"')
    downloadBlob(lines.join('\n'), `${rootName}-quarantine-duplicates.sh`, 'text/x-shellscript;charset=utf-8')
    return
  }

  const psLines: string[] = [
    '$ErrorActionPreference = "Stop"',
    `# FileAtlas 安全隔离脚本（请在「${rootName}」根目录下审阅后执行）`,
    '# 本脚本不会直接删除任何文件，而是将重复副本移入隔离文件夹。',
    '',
    `$Quarantine = ${quotePs(quarantineDir)}`,
    'New-Item -ItemType Directory -Force -Path $Quarantine | Out-Null',
    '',
  ]

  duplicates.forEach((group, index) => {
    const keep = group.files.find((f) => f.isRecommendedKeep) ?? group.files[0]
    const redundant = group.files.filter((f) => f.id !== keep.id)
    psLines.push(`# 重复组 #${index + 1} (${formatBytes(group.size)}) — 保留: ${stripRootPrefix(keep.relativePath, rootName)}`)
    for (const item of redundant) {
      const rel = stripRootPrefix(item.relativePath, rootName).replaceAll('/', '\\')
      psLines.push(`if (Test-Path -LiteralPath ${quotePs(rel)}) {`)
      psLines.push(`  $Dest = Join-Path $Quarantine ${quotePs(rel)}`)
      psLines.push('  $DestDir = Split-Path -Parent $Dest')
      psLines.push('  New-Item -ItemType Directory -Force -Path $DestDir | Out-Null')
      psLines.push(`  if (-not (Test-Path -LiteralPath $Dest)) { Move-Item -LiteralPath ${quotePs(rel)} -Destination $Dest }`)
      psLines.push('}')
    }
    psLines.push('')
  })

  psLines.push('Write-Host "已完成安全隔离，请核查 $Quarantine 目录。"')
  downloadBlob(`\uFEFF${psLines.join('\r\n')}`, `${rootName}-quarantine-duplicates.ps1`, 'text/plain;charset=utf-8')
}

export function exportRenameScript(
  changedItems: RenamePreviewItem[],
  rootName: string,
  shell: 'sh' | 'ps1',
): void {
  if (shell === 'sh') {
    const lines: string[] = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `# FileAtlas 批量重命名脚本（请在「${rootName}」根目录下审阅后执行）`,
      `# 共包含 ${changedItems.length} 项无冲突重命名映射`,
      '',
    ]
    for (const item of changedItems) {
      const srcRel = stripRootPrefix(item.relativePath, rootName)
      const dstRel = srcRel.includes('/')
        ? `${srcRel.slice(0, srcRel.lastIndexOf('/'))}/${item.target}`
        : item.target
      lines.push(`if [ -f ${quoteSh(srcRel)} ] && [ ! -e ${quoteSh(dstRel)} ]; then`)
      lines.push(`  mv -n ${quoteSh(srcRel)} ${quoteSh(dstRel)}`)
      lines.push('fi')
    }
    lines.push('', `echo "已完成 ${changedItems.length} 项文件重命名。"`)
    downloadBlob(lines.join('\n'), `${rootName}-rename-plan.sh`, 'text/x-shellscript;charset=utf-8')
    return
  }

  const psLines: string[] = [
    '$ErrorActionPreference = "Stop"',
    `# FileAtlas 批量重命名脚本（请在「${rootName}」根目录下审阅后执行）`,
    `# 共包含 ${changedItems.length} 项无冲突重命名映射`,
    '',
  ]
  for (const item of changedItems) {
    const srcRel = stripRootPrefix(item.relativePath, rootName).replaceAll('/', '\\')
    const dstRel = srcRel.includes('\\')
      ? `${srcRel.slice(0, srcRel.lastIndexOf('\\'))}\\${item.target}`
      : item.target
    psLines.push(`if ((Test-Path -LiteralPath ${quotePs(srcRel)}) -and -not (Test-Path -LiteralPath ${quotePs(dstRel)})) {`)
    psLines.push(`  Rename-Item -LiteralPath ${quotePs(srcRel)} -NewName ${quotePs(item.target)}`)
    psLines.push('}')
  }
  psLines.push('', `Write-Host "已完成 ${changedItems.length} 项文件重命名。"`)
  downloadBlob(`\uFEFF${psLines.join('\r\n')}`, `${rootName}-rename-plan.ps1`, 'text/plain;charset=utf-8')
}
