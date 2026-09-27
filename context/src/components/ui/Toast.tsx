import { AlertTriangle, Check, Info } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'

/* Subtle bottom-right toasts (spec §50). Rendered once at app root. */

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
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md animate-fade-up',
            tones[t.tone ?? 'success'],
          )}
        >
          {icons[t.tone ?? 'success']}
          <span className="text-ink">{t.message}</span>
        </button>
      ))}
    </div>
  )
}
