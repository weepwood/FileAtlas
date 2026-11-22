import type { FileEntryRecord, ScanResult } from '../types'
import {
  calculateStatistics,
  createEntryId,
  getExtension,
  hydrateDirectoryAggregates,
  normalizeFileName,
} from '../utils/file'

interface DemoSpec {
  path: string
  size: number
  daysAgo: number
  realBytesSeed?: number
  textContent?: string
  mimeType?: string
}

function buildDeterministicBytes(length: number, seed: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(length)
  const view = new Uint8Array(buffer)
  let state = seed >>> 0
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    view[i] = state & 0xff
  }
  return view
}

const DEMO_SVG_PRIMARY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="240" height="120">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect width="240" height="120" rx="20" fill="#091326"/>
  <circle cx="62" cy="60" r="28" fill="url(#g)"/>
  <text x="108" y="57" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="18" font-weight="700">FileAtlas</text>
  <text x="108" y="77" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="11">Local Intelligence</text>
</svg>`

const DEMO_WHITEPAPER_MD = `# FileAtlas 本地架构白皮书

## 核心隐私原则
1. **100% 设备内运行**：目录遍历、SHA-256 指纹与可视化均在本地沙盒完成。
2. **只读优先**：默认不执行任何磁盘删除或覆写操作。
3. **增量可追溯**：通过 IndexedDB 保存轻量快照并识别移动、重命名与净体积变化。
`

const DEMO_CSV_SAMPLE = `metric,segment,q3_value,q4_value,delta_pct
scan_throughput_files_sec,Chromium_FSA,14200,28600,+101.4%
duplicate_precision,Full_SHA256,100%,100%,0.0%
memory_peak_mb,100k_Entries,94.2,61.8,-34.4%
cold_data_identified_gb,Archive_Audit,1.8,4.6,+155.6%
`

const DEMO_PACKAGE_JSON = JSON.stringify(
  {
    name: '@creative-studio/ui-core',
    version: '2.4.0',
    private: true,
    type: 'module',
    exports: {
      '.': './src/index.ts',
      './theme.css': './src/theme-tokens.css',
    },
    dependencies: {
      react: '^19.2.0',
      zustand: '^5.0.0',
    },
  },
  null,
  2,
)

const DEMO_TS_SOURCE = `export interface SpotlightOptions {
  radiusPx?: number
  intensity?: number
}

export function attachSpotlight(node: HTMLElement, options: SpotlightOptions = {}) {
  const radius = options.radiusPx ?? 420
  node.style.setProperty('--spotlight-radius', \`\${radius}px\`)
}
`

export function generateDemoWorkspace(): ScanResult {
  const rootName = 'Creative-Studio-Workspace'
  const now = Date.now()
  const dayMs = 86_400_000

  const directorySpecs: Array<{ path: string; isEmpty?: boolean }> = [
    { path: `${rootName}` },
    { path: `${rootName}/Media-Production` },
    { path: `${rootName}/Media-Production/Renders-4K` },
    { path: `${rootName}/Media-Production/Audio-Stems` },
    { path: `${rootName}/Design-System` },
    { path: `${rootName}/Design-System/Brand-Kit` },
    { path: `${rootName}/Design-System/Exports` },
    { path: `${rootName}/Product-Docs` },
    { path: `${rootName}/Product-Docs/2026-Q4` },
    { path: `${rootName}/Engineering` },
    { path: `${rootName}/Engineering/packages` },
    { path: `${rootName}/Engineering/packages/ui-core` },
    { path: `${rootName}/Engineering/packages/ui-core/src` },
    { path: `${rootName}/Engineering/packages/ui-core/src/components` },
    { path: `${rootName}/Engineering/packages/ui-core/src/components/primitives` },
    { path: `${rootName}/Engineering/packages/ui-core/src/components/primitives/internal` },
    { path: `${rootName}/Engineering/packages/ui-core/src/components/primitives/internal/legacy` },
    { path: `${rootName}/Client-Deliverables` },
    { path: `${rootName}/Legacy-Archive` },
    { path: `${rootName}/Legacy-Archive/2023-Unmounted-Slot`, isEmpty: true },
    { path: `${rootName}/Temp-Scratch` },
    { path: `${rootName}/Temp-Scratch/Stale-Render-Cache`, isEmpty: true },
  ]

  const longFileName =
    '2026-Q4-Global-Product-Launch-Cross-Platform-Visual-Identity-And-Motion-Specification-Review-Package-Final-Approved-Version-zhCN-enUS.pdf'

  const fileSpecs: DemoSpec[] = [
    // Large media & production files
    { path: `${rootName}/Media-Production/Renders-4K/Showreel-2026-Master-ProRes.mov`, size: 1_524_629_504, daysAgo: 2 },
    { path: `${rootName}/Media-Production/Renders-4K/Product-Reveal-60fps-HDR.mp4`, size: 468_713_472, daysAgo: 4 },
    { path: `${rootName}/Media-Production/Renders-4K/Feature-Tour-Cutdown-v2.mp4`, size: 194_510_848, daysAgo: 6 },
    { path: `${rootName}/Media-Production/Renders-4K/Feature-Tour-Cutdown-v1.mp4`, size: 189_267_968, daysAgo: 11 },
    { path: `${rootName}/Media-Production/Audio-Stems/Ambient-Theme-Master-24bit.wav`, size: 78_643_200, daysAgo: 8 },
    { path: `${rootName}/Media-Production/Audio-Stems/UI-Micro-Sound-Pack.flac`, size: 24_117_248, daysAgo: 15 },
    { path: `${rootName}/Media-Production/Audio-Stems/Voiceover-Intro-zhCN.m4a`, size: 9_437_184, daysAgo: 5 },

    // Design assets + Real SHA-256 duplicates (Group 1: 640 KB WebP x 3)
    { path: `${rootName}/Design-System/FileAtlas-Component-Library.fig`, size: 256_901_120, daysAgo: 1 },
    { path: `${rootName}/Design-System/Marketing-Motion-Templates.psd`, size: 142_606_336, daysAgo: 9 },
    { path: `${rootName}/Design-System/.DS_Store`, size: 6_148, daysAgo: 12 },
    { path: `${rootName}/Design-System/Exports/Hero-Key-Visual-Dark.webp`, size: 655_360, daysAgo: 3, realBytesSeed: 1001 },
    { path: `${rootName}/Client-Deliverables/Hero-Key-Visual-Dark-副本.webp`, size: 655_360, daysAgo: 3, realBytesSeed: 1001 },
    { path: `${rootName}/Legacy-Archive/Hero-Key-Visual-Dark-backup.webp`, size: 655_360, daysAgo: 19, realBytesSeed: 1001 },
    { path: `${rootName}/Design-System/Exports/Hero-Key-Visual-Light.webp`, size: 612_352, daysAgo: 3, realBytesSeed: 2002 },

    // Real SHA-256 duplicates (Group 2: 384 KB PDF x 2)
    { path: `${rootName}/Product-Docs/2026-Q4/季度品牌视觉规范_v2.pdf`, size: 393_216, daysAgo: 4, realBytesSeed: 3003 },
    { path: `${rootName}/Client-Deliverables/季度品牌视觉规范-最终版.pdf`, size: 393_216, daysAgo: 2, realBytesSeed: 3003 },
    { path: `${rootName}/Product-Docs/2026-Q4/季度品牌视觉规范_v1.pdf`, size: 368_640, daysAgo: 14 },

    // Real SHA-256 duplicates (Group 3: 192 KB ZIP x 2)
    { path: `${rootName}/Design-System/Brand-Kit/Brand-Icon-Sprites.zip`, size: 196_608, daysAgo: 7, realBytesSeed: 4004 },
    { path: `${rootName}/Engineering/Brand-Icon-Sprites-copy.zip`, size: 196_608, daysAgo: 7, realBytesSeed: 4004 },
    {
      path: `${rootName}/Design-System/Brand-Kit/Brand-Logo-Primary.svg`,
      size: 18_432,
      daysAgo: 21,
      textContent: DEMO_SVG_PRIMARY,
      mimeType: 'image/svg+xml',
    },
    {
      path: `${rootName}/Design-System/Brand-Kit/Brand-Logo-Monochrome.svg`,
      size: 16_896,
      daysAgo: 21,
      textContent: DEMO_SVG_PRIMARY.replace('#38bdf8', '#94a3b8').replace('#818cf8', '#cbd5e1'),
      mimeType: 'image/svg+xml',
    },

    // Cold / stale archives & deliverables
    { path: `${rootName}/Legacy-Archive/2025-Annual-Assets-Snapshot.zip`, size: 713_031_680, daysAgo: 420 },
    { path: `${rootName}/Legacy-Archive/Prototype-Playground-Archive.tar.gz`, size: 88_080_384, daysAgo: 240 },
    { path: `${rootName}/Client-Deliverables/Launch_Keynote_Deck.pptx`, size: 54_525_952, daysAgo: 5 },
    { path: `${rootName}/Client-Deliverables/Launch_Keynote_Deck_v2.pptx`, size: 56_623_104, daysAgo: 2 },
    { path: `${rootName}/Client-Deliverables/~$Launch_Keynote_Deck.pptx`, size: 162, daysAgo: 1 },
    { path: `${rootName}/Client-Deliverables/${longFileName}`, size: 12_582_912, daysAgo: 1 },

    // Product docs & data (with live previewable text content)
    {
      path: `${rootName}/Product-Docs/Architecture-Whitepaper.md`,
      size: 48_120,
      daysAgo: 6,
      textContent: DEMO_WHITEPAPER_MD,
      mimeType: 'text/markdown',
    },
    {
      path: `${rootName}/Product-Docs/Privacy-Security-Checklist.md`,
      size: 22_540,
      daysAgo: 10,
      textContent: '# 隐私与安全核查清单\n\n- [x] CSP 默认阻断外部上报\n- [x] File 句柄仅驻留内存会话\n- [x] IndexedDB 仅保存聚合快照元数据\n',
      mimeType: 'text/markdown',
    },
    {
      path: `${rootName}/Product-Docs/User-Research-Metrics-2026.csv`,
      size: 4_194_304,
      daysAgo: 8,
      textContent: DEMO_CSV_SAMPLE,
      mimeType: 'text/csv',
    },
    {
      path: `${rootName}/Product-Docs/Benchmark-Telemetry-Sample.json`,
      size: 2_359_296,
      daysAgo: 12,
      textContent: JSON.stringify(
        {
          suite: 'FileAtlas Local Engine v0.2',
          environment: 'WebWorker + SubtleCrypto',
          benchmarks: [
            { stage: 'BFS Directory Walk', p95Ms: 42 },
            { stage: '64KBx3 Sample Digest', p95Ms: 1.8 },
            { stage: 'Virtual Grid Render', fps: 60 },
          ],
        },
        null,
        2,
      ),
      mimeType: 'application/json',
    },
    { path: `${rootName}/Product-Docs/draft-notes-pending.md`, size: 0, daysAgo: 1 },

    // Engineering source & deep path
    {
      path: `${rootName}/Engineering/package.json`,
      size: 3_420,
      daysAgo: 3,
      textContent: DEMO_PACKAGE_JSON,
      mimeType: 'application/json',
    },
    {
      path: `${rootName}/Engineering/tsconfig.json`,
      size: 1_280,
      daysAgo: 30,
      textContent: JSON.stringify({ compilerOptions: { target: 'ES2023', strict: true, jsx: 'react-jsx' } }, null, 2),
      mimeType: 'application/json',
    },
    {
      path: `${rootName}/Engineering/packages/ui-core/src/index.ts`,
      size: 4_890,
      daysAgo: 4,
      textContent: DEMO_TS_SOURCE,
      mimeType: 'text/typescript',
    },
    { path: `${rootName}/Engineering/packages/ui-core/src/theme-tokens.css`, size: 19_640, daysAgo: 2 },
    { path: `${rootName}/Engineering/packages/ui-core/src/components/WorkspaceShell.tsx`, size: 14_320, daysAgo: 2 },
    { path: `${rootName}/Engineering/packages/ui-core/src/components/VirtualDataGrid.tsx`, size: 21_760, daysAgo: 5 },
    {
      path: `${rootName}/Engineering/packages/ui-core/src/components/primitives/SpotlightSurface.tsx`,
      size: 8_540,
      daysAgo: 3,
      textContent: DEMO_TS_SOURCE,
      mimeType: 'text/typescript',
    },
    { path: `${rootName}/Engineering/packages/ui-core/src/components/primitives/internal/focus-trap.ts`, size: 5_120, daysAgo: 18 },
    { path: `${rootName}/Engineering/packages/ui-core/src/components/primitives/internal/legacy/deprecated-adapter.ts`, size: 6_780, daysAgo: 390 },

    // Scratch / zero-byte file
    { path: `${rootName}/Temp-Scratch/.lock-session-placeholder.tmp`, size: 0, daysAgo: 0 },
  ]

  const rawEntries: FileEntryRecord[] = []
  const files = new Map<string, File>()

  for (const dir of directorySpecs) {
    const segments = dir.path.split('/')
    const name = segments.at(-1) ?? dir.path
    rawEntries.push({
      id: createEntryId(dir.path, 'directory'),
      name,
      normalizedName: normalizeFileName(name),
      relativePath: dir.path,
      parentPath: segments.length > 1 ? segments.slice(0, -1).join('/') : '',
      kind: 'directory',
      extension: '',
      mimeType: '',
      size: 0,
      lastModified: 0,
      depth: segments.length - 1,
      isEmptyDirectory: Boolean(dir.isEmpty),
    })
  }

  for (const spec of fileSpecs) {
    const segments = spec.path.split('/')
    const name = segments.at(-1) ?? spec.path
    const id = createEntryId(spec.path, 'file')
    const lastModified = now - spec.daysAgo * dayMs
    const extension = getExtension(name)

    rawEntries.push({
      id,
      name,
      normalizedName: normalizeFileName(name),
      relativePath: spec.path,
      parentPath: segments.slice(0, -1).join('/'),
      kind: 'file',
      extension,
      mimeType: spec.mimeType ?? '',
      size: spec.size,
      lastModified,
      depth: segments.length - 1,
    })

    if (spec.realBytesSeed !== undefined) {
      const bytes = buildDeterministicBytes(spec.size, spec.realBytesSeed)
      files.set(id, new File([bytes], name, { lastModified, type: spec.mimeType ?? '' }))
    } else if (spec.textContent !== undefined) {
      files.set(id, new File([spec.textContent], name, { lastModified, type: spec.mimeType ?? 'text/plain' }))
    }
  }

  rawEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'))
  const entries = hydrateDirectoryAggregates(rawEntries)
  const statistics = calculateStatistics(entries, now)

  return {
    rootName,
    entries,
    files,
    statistics,
  }
}
