import { cn } from '../../lib/cn'

/* Segmented control — used for tone selection and panel toggles. */

export interface SegmentOption {
  value: string
  label: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: {
  options: SegmentOption[]
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-canvas-deep p-0.5',
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md font-medium transition-colors duration-[var(--duration-micro)] ease-[var(--ease-out-soft)]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
              selected
                ? 'bg-surface text-ink shadow-sm border border-line'
                : 'text-ink-subtle hover:text-ink border border-transparent',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
