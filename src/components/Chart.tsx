import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, PieChart, TreemapChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import { useUiStore } from '../store/useUiStore'

echarts.use([BarChart, PieChart, TreemapChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const CHART_PALETTE = [
  '#38bdf8',
  '#818cf8',
  '#34d399',
  '#a78bfa',
  '#fbbf24',
  '#2dd4bf',
  '#f472b6',
  '#60a5fa',
  '#fb7185',
  '#f59e0b',
  '#4ade80',
  '#c084fc',
]

export interface ChartProps {
  option: EChartsCoreOption
  height?: number
  externalHighlightName?: string | null
  onItemHover?: (name: string | null) => void
  onItemClick?: (name: string) => void
  onItemDoubleClick?: (name: string) => void
}

export function Chart({
  option,
  height = 330,
  externalHighlightName,
  onItemHover,
  onItemClick,
  onItemDoubleClick,
}: ChartProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const hoverCallbackRef = useRef(onItemHover)
  const clickCallbackRef = useRef(onItemClick)
  const dblClickCallbackRef = useRef(onItemDoubleClick)
  const theme = useUiStore((state) => state.theme)

  useEffect(() => {
    hoverCallbackRef.current = onItemHover
    clickCallbackRef.current = onItemClick
    dblClickCallbackRef.current = onItemDoubleClick
  }, [onItemHover, onItemClick, onItemDoubleClick])

  useEffect(() => {
    const mountEl = elementRef.current
    if (!mountEl) return
    const chart = echarts.init(mountEl)
    chartRef.current = chart

    const handleMouseOver = (params: { name?: unknown }) => {
      if (typeof params.name === 'string' && params.name) {
        hoverCallbackRef.current?.(params.name)
      }
    }
    const handleGlobalOut = () => {
      hoverCallbackRef.current?.(null)
    }
    const handleClick = (params: { name?: unknown }) => {
      if (typeof params.name === 'string' && params.name) {
        clickCallbackRef.current?.(params.name)
      }
    }
    const handleDblClick = (params: { name?: unknown }) => {
      if (typeof params.name === 'string' && params.name) {
        dblClickCallbackRef.current?.(params.name)
      }
    }

    chart.on('mouseover', handleMouseOver)
    chart.on('globalout', handleGlobalOut)
    chart.on('click', handleClick)
    chart.on('dblclick', handleDblClick)

    const observer = new ResizeObserver(() => {
      chart.resize()
    })
    observer.observe(mountEl)

    const rafId = window.requestAnimationFrame(() => {
      chart.resize()
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      observer.disconnect()
      chart.off('mouseover', handleMouseOver)
      chart.off('globalout', handleGlobalOut)
      chart.off('click', handleClick)
      chart.off('dblclick', handleDblClick)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const isDark = theme === 'dark'

    const mergedOption: EChartsCoreOption = {
      color: CHART_PALETTE,
      animation: true,
      animationDuration: 520,
      animationEasing: 'cubicOut',
      textStyle: {
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      },
      ...option,
      tooltip: {
        appendTo: 'body',
        confine: true,
        enterable: false,
        backgroundColor: isDark ? 'rgba(9, 16, 30, 0.95)' : 'rgba(255, 255, 255, 0.97)',
        borderColor: isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 23, 42, 0.14)',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: isDark ? '#eef4ff' : '#0f172a',
          fontSize: 12,
        },
        extraCssText:
          'z-index: 9999; pointer-events: none; backdrop-filter: blur(14px); border-radius: 12px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);',
        ...(option.tooltip as Record<string, unknown> | undefined),
      },
    }

    chart.setOption(mergedOption, true)
  }, [option, theme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || externalHighlightName === undefined) return
    chart.dispatchAction({ type: 'downplay', seriesIndex: 0 })
    if (externalHighlightName) {
      chart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: externalHighlightName })
      chart.dispatchAction({ type: 'showTip', seriesIndex: 0, name: externalHighlightName })
    } else {
      chart.dispatchAction({ type: 'hideTip' })
    }
  }, [externalHighlightName])

  return (
    <div className="chart-shell" style={{ height }}>
      <div className="chart-mount" ref={elementRef} />
    </div>
  )
}
