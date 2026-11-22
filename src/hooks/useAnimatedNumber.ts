import { useEffect, useRef, useState } from 'react'

export function useAnimatedNumber(target: number, durationMs = 680): number {
  const [displayValue, setDisplayValue] = useState(target)
  const previousRef = useRef(target)

  useEffect(() => {
    const from = previousRef.current
    previousRef.current = target

    if (from === target || !Number.isFinite(target)) {
      const immediate = window.requestAnimationFrame(() => setDisplayValue(target))
      return () => window.cancelAnimationFrame(immediate)
    }

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const reduced = window.requestAnimationFrame(() => setDisplayValue(target))
      return () => window.cancelAnimationFrame(reduced)
    }

    let frameId = 0
    const startTime = performance.now()
    const delta = target - from

    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / durationMs)
      // Ease out quartic: snappy start, smooth landing
      const eased = 1 - (1 - elapsed) ** 4
      const current = from + delta * eased
      setDisplayValue(elapsed >= 1 ? target : current)
      if (elapsed < 1) {
        frameId = window.requestAnimationFrame(step)
      }
    }

    frameId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frameId)
  }, [durationMs, target])

  return displayValue
}
