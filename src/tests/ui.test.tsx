// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../App'
import { useFileAtlasStore } from '../store/useFileAtlasStore'
import { useUiStore } from '../store/useUiStore'

vi.mock('../components/Chart', () => ({
  Chart: ({ height }: { height?: number }) => <div data-testid="mock-chart" style={{ height }} />,
}))

describe('FileAtlas UI & interactions', () => {
  beforeEach(() => {
    useFileAtlasStore.getState().reset()
    useUiStore.setState({ theme: 'dark', isDemo: false, toasts: [] })
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

  it('filters directory health risks interactively when clicking audit cards', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /体验示例工作区/ }))
    await screen.findByText('文件系统总览')

    fireEvent.click(screen.getByRole('link', { name: /目录健康/ }))
    expect(await screen.findByText('目录健康审计')).toBeInTheDocument()

    const emptyFileCard = screen.getByRole('button', { name: /空文件(?!夹)/ })
    fireEvent.click(emptyFileCard)
    expect(emptyFileCard).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('draft-notes-pending.md')).toBeInTheDocument()
  })
})
