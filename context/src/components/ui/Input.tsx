import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

const fieldBase =
  'w-full rounded-md border border-line bg-canvas-deep text-ink placeholder:text-ink-faint ' +
  'transition-colors duration-[var(--duration-micro)] ease-[var(--ease-out-soft)] ' +
  'hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-none ' +
  'disabled:opacity-45 disabled:pointer-events-none'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, className = '', ...rest }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={[fieldBase, 'h-9 px-3 text-sm', invalid && 'border-coral', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  ),
)
Input.displayName = 'Input'
