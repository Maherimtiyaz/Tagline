import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none ' +
  'rounded-md border transition-[background-color,border-color,color,box-shadow,transform] ' +
  'duration-[var(--duration-micro)] ease-[var(--ease-out-soft)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:opacity-45 disabled:pointer-events-none active:translate-y-px'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-ink border-accent hover:bg-accent-hover hover:border-accent-hover',
  secondary:
    'bg-surface text-ink border-line hover:border-line-strong hover:bg-surface-hover',
  ghost:
    'bg-transparent text-ink-muted border-transparent hover:bg-surface-hover hover:text-ink',
  danger:
    'bg-coral text-white border-coral hover:opacity-90 dark:text-canvas-deep',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',   /* 28px — dense toolbar actions */
  md: 'h-9 px-3.5 text-sm',   /* 36px — default               */
  lg: 'h-11 px-5 text-lg',    /* 44px — landing CTAs, mobile  */
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      iconLeft,
      iconRight,
      fullWidth,
      className = '',
      children,
      disabled,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[base, variants[variant], sizes[size], fullWidth ? 'w-full' : '', className].join(' ')}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  ),
)
Button.displayName = 'Button'
