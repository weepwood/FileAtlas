import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { handleSpotlightMove } from '../utils/spotlight'

export type StatTone = 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: StatTone
  rawValue?: number
  formatter?: (value: number) => string
  index?: number
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'cyan',
  rawValue,
  formatter,
  index = 0,
}: StatCardProps) {
  const animated = useAnimatedNumber(rawValue ?? 0)
  const renderedValue =
    rawValue !== undefined
      ? formatter
        ? formatter(animated)
        : Math.round(animated).toLocaleString()
      : value

  return (
    <article
      className={`stat-card spotlight-surface tone-${tone} stagger-item`}
      style={{ '--stagger': index } as CSSProperties}
      onPointerMove={handleSpotlightMove}
    >
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <div className="stat-icon">
          <Icon size={17} />
        </div>
      </div>
      <strong className="tabular-nums">{renderedValue}</strong>
      {hint ? <small className="stat-hint">{hint}</small> : <small className="stat-hint stat-hint-placeholder">&nbsp;</small>}
    </article>
  )
}
