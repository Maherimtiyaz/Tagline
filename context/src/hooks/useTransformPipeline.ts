import { useCallback, useEffect, useRef, useState } from 'react'
import type { TransformStage } from '../data/types'
import { STAGE_ORDER } from '../lib/outputMeta'

/* ============================================================
   Transformation runner — one reusable state machine for every
   simulated AI surface (hero demo, workspace, templates).

   Stages advance on a deterministic schedule totalling ~1.6s
   (spec §26: never make users wait unnecessarily). With
   prefers-reduced-motion the pipeline collapses to a single
   "ready" transition while keeping the same final state.
   ============================================================ */

const BASE_MS = [380, 340, 360, 340] // understanding → intent → structuring → writing

export interface TransformRun {
  stage: TransformStage
  /** 0..1 index into STAGE_ORDER — useful for progress bars. */
  stageIndex: number
  run: (onReady?: () => void) => void
  reset: () => void
  error: () => void
}

export function useTransformPipeline(reducedMotion: boolean): TransformRun {
  const [stage, setStage] = useState<TransformStage>('idle')
  const timers = useRef<number[]>([])

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  const run = useCallback(
    (onReady?: () => void) => {
      clear()
      if (reducedMotion) {
        setStage('understanding')
        const t = window.setTimeout(() => {
          setStage('ready')
          onReady?.()
        }, 250)
        timers.current.push(t)
        return
      }
      setStage('understanding')
      let acc = 0
      STAGE_ORDER.slice(1).forEach((next, i) => {
        acc += BASE_MS[i] ?? 350
        const t = window.setTimeout(() => {
          setStage(next as TransformStage)
          if (next === 'ready') onReady?.()
        }, acc)
        timers.current.push(t)
      })
    },
    [clear, reducedMotion],
  )

  const reset = useCallback(() => {
    clear()
    setStage('idle')
  }, [clear])

  const error = useCallback(() => {
    clear()
    setStage('error')
  }, [clear])

  useEffect(() => clear, [clear])

  const stageIndex = Math.max(0, STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]))
  return { stage, stageIndex, run, reset, error }
}

/** Small helper to format relative timestamps consistently. */
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.floor(h / 24)} d ago`
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Compact day label for timeline grouping (History, spec §34). */
export function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yst = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yst.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
