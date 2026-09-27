import { cn } from '../../lib/cn'

/* Minimal empty-state recipe (spec §48). */

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string
  body: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center',
        className,
      )}
    >
      {icon && <span className="text-ink-faint" aria-hidden>{icon}</span>}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="max-w-xs text-sm text-ink-muted">{body}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
