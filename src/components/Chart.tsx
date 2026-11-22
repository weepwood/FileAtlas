import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, PieChart, TreemapChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
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

export function Chart({ option, height = 330 }: { option: EChartsCoreOption; height?: number }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const theme = useUiStore((state) => state.theme)

  useEffect(() => {
    if (!elementRef.current) return
    const chart = echarts.init(elementRef.current)
    const isDark = theme === 'dark'

    const mergedOption: EChartsCoreOption = {
      color: CHART_PALETTE,
      animation: true,
      animationDuration: 720,
      animationEasing: 'cubicOut',
      textStyle: {
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      },
      ...option,
      tooltip: {
        backgroundColor: isDark ? 'rgba(9, 16, 30, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        borderColor: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.12)',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: isDark ? '#eef4ff' : '#0f172a',
          fontSize: 12,
        },
        extraCssText: 'backdrop-filter: blur(14px); border-radius: 12px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.26);',
        ...(option.tooltip as Record<string, unknown> | undefined),
      },
    }

    chart.setOption(mergedOption, true)
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(elementRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [option, theme])

  return <div className="chart-canvas" ref={elementRef} style={{ height, width: '100%' }} />
}
