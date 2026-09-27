import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Mic } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { pickVoiceTranscript } from '../../lib/mockAI'
import { cn } from '../../lib/cn'
import { Waveform } from '../../animations/Transformation'

/* ============================================================
   Voice capture — an honest simulation (spec §22/§23). No fake
   audio APIs; explicit states: idle → listening → processing →
   complete. Hold-to-speak on desktop (pointer), tap-toggle for
   keyboard users (Space/Enter). Cancel with Escape / drag-away.
   ============================================================ */

type VoiceState = 'idle' | 'listening' | 'processing' | 'complete'

export function VoiceCapture({
  seed = 0,
  onComplete,
  compact = false,
}: {
  seed?: number
  onComplete: (transcript: string) => void
  compact?: boolean
}) {
  const reduced = useReducedMotion()
  const [state, setState] = useState<VoiceState>('idle')
  const [shown, setShown] = useState('')
  const timers = useRef<number[]>([])
  const holdRef = useRef(false)

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const full = pickVoiceTranscript(seed)

  const startListening = useCallback(() => {
    if (state === 'listening' || state === 'processing') return
    clearTimers()
    holdRef.current = true
    setState('listening')
    setShown('')
    if (reduced) {
      setShown(full)
      return
    }
    // typewriter transcript
    let i = 0
    const step = () => {
      if (!holdRef.current) return
      i += 3
      setShown(full.slice(0, i))
      if (i < full.length) timers.current.push(window.setTimeout(step, 42))
    }
    timers.current.push(window.setTimeout(step, 350))
  }, [state, reduced, full])

  const finish = useCallback(() => {
    if (state !== 'listening') return
    holdRef.current = false
    clearTimers()
    setShown(full)
    setState('processing')
    timers.current.push(
      window.setTimeout(() => {
        setState('complete')
        timers.current.push(window.setTimeout(() => onComplete(full), 600))
      }, reduced ? 200 : 900),
    )
  }, [state, full, reduced, onComplete])

  const cancel = useCallback(() => {
    holdRef.current = false
    clearTimers()
    setState('idle')
    setShown('')
  }, [])

  const label =
    state === 'idle' ? 'Hold to speak' :
    state === 'listening' ? 'Listening — release when done' :
    state === 'processing' ? 'Understanding…' :
    'Transcript ready'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border border-line bg-surface',
        compact ? 'p-4' : 'p-6',
      )}
    >
      <button
        type="button"
        aria-label={label}
        aria-live="polite"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); startListening() }}
        onPointerUp={finish}
        onPointerLeave={() => state === 'listening' && cancel()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && state !== 'listening') {
            e.preventDefault()
            startListening()
          } else if (e.key === 'Escape' && state === 'listening') {
            cancel()
          }
        }}
        onKeyUp={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && state === 'listening') {
            e.preventDefault()
            finish()
          }
        }}
        className={cn(
          'relative flex items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
          compact ? 'h-16 w-16' : 'h-14 w-14',
          state === 'idle' && 'border border-line bg-canvas-deep text-ink-muted hover:border-accent-line hover:text-accent',
          state === 'listening' && 'bg-accent text-accent-ink shadow-md',
          state === 'processing' && 'border border-accent-line bg-accent-soft text-accent',
          state === 'complete' && 'border border-transparent bg-emerald-soft text-emerald',
        )}
      >
        {state === 'listening' && !reduced && (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />
        )}
        {state === 'complete' ? <CheckCircle2 size={compact ? 26 : 22} aria-hidden /> : <Mic size={compact ? 26 : 22} aria-hidden />}
      </button>

      <div className="flex min-h-10 w-full flex-col items-center gap-2 text-center">
        <p className="text-sm font-medium text-ink">{label}</p>
        {(state === 'listening' || state === 'processing') && <Waveform active={state === 'listening'} bars={compact ? 32 : 24} />}
        {state !== 'idle' && shown && (
          <p className="max-w-md text-xs leading-relaxed text-ink-muted" aria-live="polite">
            "{shown}"{state === 'listening' && shown.length < full.length && !reduced && <span className="animate-pulse-dot">▍</span>}
          </p>
        )}
        {state === 'idle' && (
          <p className="text-xs text-ink-subtle">
            Hold the button and speak. Release to stop. This is a simulated transcript.
          </p>
        )}
      </div>
    </div>
  )
}
