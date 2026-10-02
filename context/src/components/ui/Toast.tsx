import { AlertTriangle, Check, Info } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'

/* Subtle bottom-right toasts (spec §50). Rendered once at app root.
   Phase 21: destructive toasts can carry an inline "Undo" action —
   the message area dismisses the toast, the action button runs first. */

const icons = {
  success: <Check size={13} aria-hidden />,
  info: <Info size={13} aria-hidden />,
  error: <AlertTriangle size={13} aria-hidden />,
}

const tones = {
  success: 'text-emerald',
  info: 'text-ink-muted',
  error: 'text-coral',
}

export function ToastViewport() {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-auto flex-col items-end gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md animate-fade-up',
            tones[t.tone ?? 'success'],
          )}
        >
          {icons[t.tone ?? 'success']}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label={`Dismiss notification: ${t.message}`}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line rounded"
          >
            <span className="text-ink">{t.message}</span>
          </button>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.run()
                dismiss(t.id)
              }}
              className={cn(
                'shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-2xs font-semibold uppercase tracking-wide transition-colors',
                'text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line',
              )}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
