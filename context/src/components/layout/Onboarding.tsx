import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Inbox, Sparkles, X } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { cn } from '../../lib/cn'

/* ============================================================
   First-run onboarding (spec §56 — "click Try the demo, then
   immediately interact"). A single lightweight welcome card
   shown once over the workspace; dismissal is persisted so
   returning visitors go straight in. Keyboard-first: Enter
   starts, Esc skips. Honours prefers-reduced-motion.
   ============================================================ */

const STEPS = [
  { icon: Inbox, title: 'Capture anything', body: 'Type, speak, or drop a screenshot into the inbox.' },
  { icon: Sparkles, title: 'Transform it', body: 'Watch a messy thought become a clear email, brief, or plan.' },
] as const

export function Onboarding() {
  const seen = useAppStore((s) => s.onboardingSeen)
  const dismiss = useAppStore((s) => s.dismissOnboarding)
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  /* Defer mount by one frame so the entrance transition actually plays. */
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (seen) return
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [seen])

  useEffect(() => {
    if (seen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [seen, dismiss])

  if (seen) return null

  const start = () => {
    dismiss()
    navigate('/app/thought/new')
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-modal flex items-end justify-center p-4 sm:items-center',
        shown ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        aria-hidden
        onClick={dismiss}
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-[var(--duration-base)]',
          shown || reduced ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cn(
          'relative w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-lg',
          'transition-all duration-[var(--duration-base)] ease-out',
          shown || reduced ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip onboarding"
          className="absolute right-3 top-3 rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <X size={15} aria-hidden />
        </button>

        <p className="label-mono">Welcome to Context</p>
        <h2 id="onboarding-title" className="mt-1 text-lg font-semibold tracking-tight">
          Turn messy thoughts into clear output
        </h2>

        <ul className="mt-4 space-y-3">
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <s.icon size={14} aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-ink-muted">{s.body}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={start}
            autoFocus
            className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Start capturing <ArrowRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-3 py-2 text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            Explore first
          </button>
        </div>
        <p className="mt-3 font-mono text-3xs text-ink-faint">
          demo mode · everything stays in your browser
        </p>
      </div>
    </div>
  )
}
