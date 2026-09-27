import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — also used as tooltip label. Required. */
  label: string
  icon: ReactNode
  size?: 'sm' | 'md'
  active?: boolean
}

/**
 * Square icon-only button with mandatory accessible label.
 * Hover reveals a subtle surface; never "jumps".
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, size = 'md', active = false, className = '', ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={[
        'inline-flex items-center justify-center rounded-md border border-transparent',
        'text-ink-subtle transition-colors duration-[var(--duration-micro)] ease-[var(--ease-out-soft)]',
        'hover:bg-surface-hover hover:text-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:opacity-45 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        active ? 'bg-accent-soft text-accent' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon}
    </button>
  ),
)
IconButton.displayName = 'IconButton'
