import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'blue'
  | 'success'
  | 'warning'
  | 'error'
  | 'outline'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-deep text-ink-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent-line',
  blue: 'bg-blue-soft text-blue border-transparent',
  success: 'bg-emerald-soft text-emerald border-transparent',
  warning: 'bg-amber-soft text-amber border-transparent',
  error: 'bg-coral-soft text-coral border-transparent',
  outline: 'bg-transparent text-ink-subtle border-line',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  mono?: boolean
  icon?: ReactNode
}

/** Small status/label pill. Mono variant is used for technical values. */
export function Badge({
  tone = 'neutral',
  mono = false,
  icon,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-px',
        mono ? 'font-mono text-3xs uppercase tracking-wider' : 'text-2xs',
        'leading-4',
        tones[tone],
        className,
      ].join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </span>
  )
}
