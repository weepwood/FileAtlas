// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../App'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore, DEFAULT_SCAN_CONFIG } from '../store/useUiStore'

let latestChartOption: any = null

vi.mock('../components/Chart', () => ({
  Chart: ({ option, height }: { option: any; height?: number }) => {
    latestChartOption = option
    return <div data-testid="mock-chart" style={{ height }} />
  },
}))

describe('FileAtlas UI & interactions', () => {
  beforeEach(() => {
    useFileAtlasStore.getState().reset()
    useUiStore.setState({
      theme: 'dark',
      isDemo: false,
      toasts: [],
      previewEntryId: null,
      commandPaletteOpen: false,
      scanConfig: { ...DEFAULT_SCAN_CONFIG },
    })
    document.documentElement.dataset.theme = 'dark'
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders onboarding hero and loads demo workspace interactively', async () => {
    render(<App />)

    expect(await screen.findByText('看见结构，理解空间，安心整理')).toBeInTheDocument()
    const demoBtn = screen.getByRole('button', { name: /体验示例工作区/ })
    fireEvent.click(demoBtn)

    expect(await screen.findByText('文件系统总览')).toBeInTheDocument()
    expect(screen.getByText('Creative-Studio-Workspace')).toBeInTheDocument()
    expect(screen.getByText('示例数据')).toBeInTheDocument()
    expect(screen.getByText('Showreel-2026-Master-ProRes.mov')).toBeInTheDocument()
  })

  it('toggles between dark and light themes cleanly', async () => {
    render(<App />)
    await screen.findByText('看见结构，理解空间，安心整理')

    expect(document.documentElement.dataset.theme).toBe('dark')
    const toggleBtn = screen.getByRole('button', { name: '切换为浅色主题' })
    fireEvent.click(toggleBtn)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('filters directory health risks including system junk and shows health score', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /体验示例工作区/ }))
    await screen.findByText('文件系统总览')

    fireEvent.click(screen.getByRole('link', { name: /目录健康/ }))
    expect(await screen.findByText('目录健康审计')).toBeInTheDocument()
    expect(screen.getByText('目录健康度评分')).toBeInTheDocument()

    const emptyFileCard = screen.getByRole('button', { name: /空文件(?!夹)/ })
    fireEvent.click(emptyFileCard)
    expect(emptyFileCard).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('draft-notes-pending.md')).toBeInTheDocument()

    const junkCard = screen.getByRole('button', { name: /临时与系统残留/ })
    fireEvent.click(junkCard)
    expect(junkCard).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('.DS_Store')).toBeInTheDocument()
  })

  it('allows selecting tiny folders and drilling down in Space Analysis', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /体验示例工作区/ }))
    await screen.findByText('文件系统总览')

    fireEvent.click(screen.getByRole('link', { name: /空间分析/ }))
    expect(await screen.findByText('目录与文件空间矩形树图')).toBeInTheDocument()

    // Ensure treemap series sets explicit inset box margins without 100% overflow against ECharts 6 defaults
    const treemapSeries = latestChartOption?.series?.[0]
    expect(treemapSeries?.type).toBe('treemap')
    expect(treemapSeries?.top).toBe(12)
    expect(treemapSeries?.bottom).toBe(14)
    expect(treemapSeries?.left).toBe(14)
    expect(treemapSeries?.right).toBe(14)
    expect(treemapSeries?.width).toBe('auto')
    expect(treemapSeries?.height).toBe('auto')

    // Select a tiny folder via the quick direct-select pill bar
    const tinyEngineeringPill = screen.getByRole('button', { name: /Engineering.*KB/i })
    fireEvent.click(tinyEngineeringPill)
    expect(screen.getByText('已锁定选中')).toBeInTheDocument()

    // Drill down into Engineering to inspect small files inside it
    fireEvent.click(screen.getByRole('button', { name: /进入子目录/ }))
    expect((await screen.findAllByText('package.json')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('tsconfig.json').length).toBeGreaterThanOrEqual(1)

    // Navigate back up via breadcrumb button
    fireEvent.click(screen.getByRole('button', { name: /返回上级/ }))
    expect((await screen.findAllByText('Media-Production')).length).toBeGreaterThanOrEqual(1)
  })

  it('opens Command Palette (Ctrl+K) and previews local Markdown file in Quick Preview Drawer', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /体验示例工作区/ }))
    await screen.findByText('文件系统总览')

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const paletteInput = await screen.findByPlaceholderText(/输入文件名、路径关键字或快捷指令/)
    fireEvent.change(paletteInput, { target: { value: 'Architecture-Whitepaper.md' } })

    const resultBtn = await screen.findByRole('button', { name: /Architecture-Whitepaper\.md/ })
    fireEvent.click(resultBtn)

    expect(await screen.findByRole('dialog', { name: /对象详情预览：Architecture-Whitepaper\.md/ })).toBeInTheDocument()
    expect(await screen.findByText(/FileAtlas 本地架构白皮书/)).toBeInTheDocument()
  })

  it('configures custom scan ignore rules on Settings page', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: /能力与隐私/ }))
    expect(await screen.findByText('扫描过滤与深度策略')).toBeInTheDocument()

    const input = screen.getByPlaceholderText(/输入目录或文件名/)
    fireEvent.change(input, { target: { value: 'venv' } })
    fireEvent.click(screen.getByRole('button', { name: /添加/ }))

    expect(screen.getByText('venv')).toBeInTheDocument()
    expect(useUiStore.getState().scanConfig.customIgnores).toContain('venv')
  })
})
