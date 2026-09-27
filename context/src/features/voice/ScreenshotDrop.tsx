import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageUp, ScanLine } from 'lucide-react'
import { SCREENSHOT_ANALYSIS } from '../../lib/mockAI'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { cn } from '../../lib/cn'
import { Badge } from '../../components/ui/Badge'

/* ============================================================
   Screenshot drop zone — simulated image understanding (§24).
   Drop anywhere (or click "use sample") → analyzing → detected
   elements → UX summary. No real vision, honestly labelled.
   ============================================================ */

type ShotState = 'idle' | 'analyzing' | 'done'

export function ScreenshotDrop({ onSummary }: { onSummary?: (summary: string) => void }) {
  const reduced = useReducedMotion()
  const [state, setState] = useState<ShotState>('idle')
  const [dragOver, setDragOver] = useState(false)
  const timer = useRef<number>(0)

  const analyze = useCallback(() => {
    setState('analyzing')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setState('done')
      onSummary?.(SCREENSHOT_ANALYSIS.summary)
    }, reduced ? 250 : 1400)
  }, [reduced, onSummary])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a screenshot here to analyse it (simulated)"
        onClick={state === 'idle' ? analyze : undefined}
        onKeyDown={(e) => { if (e.key === 'Enter' && state === 'idle') analyze() }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); analyze() }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors duration-[var(--duration-fast)]',
          dragOver ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas-deep hover:border-line-strong hover:bg-surface-hover',
          state !== 'idle' && 'cursor-default',
        )}
      >
        {state === 'idle' && (
          <>
            <ImageUp size={22} className="text-ink-faint" aria-hidden />
            <p className="text-sm font-medium">Drop a screenshot here</p>
            <p className="text-xs text-ink-subtle">or click to analyse a sample capture</p>
          </>
        )}
        {state === 'analyzing' && (
          <>
            <ScanLine size={22} className="text-accent animate-pulse-dot" aria-hidden />
            <p className="font-mono text-xs text-ink">Analyzing image…</p>
            <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-line">
              <div className="h-full w-1/2 rounded-full bg-accent animate-shimmer" />
            </div>
          </>
        )}
        {state === 'done' && (
          <>
            <Badge tone="success">Analysis complete</Badge>
            <p className="text-xs text-ink-subtle">Simulated result · no image leaves this demo</p>
          </>
        )}
      </div>

      {state === 'done' && (
        <div className="animate-fade-up space-y-3">
          <div>
            <p className="label-mono mb-1.5">Detected</p>
            <div className="flex flex-wrap gap-1.5">
              {SCREENSHOT_ANALYSIS.detected.map((d) => (
                <Badge key={d} tone="blue">{d}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="label-mono mb-1.5">UX summary</p>
            <p className="rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-ink-muted">
              {SCREENSHOT_ANALYSIS.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="text-xs text-accent hover:underline"
          >
            Analyse another
          </button>
        </div>
      )}
    </div>
  )
}
