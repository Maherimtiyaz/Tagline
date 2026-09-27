import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

const base =
  'w-full rounded-md border border-line bg-canvas-deep text-ink placeholder:text-ink-faint ' +
  'transition-colors duration-[var(--duration-micro)] ease-[var(--ease-out-soft)] ' +
  'hover:border-line-strong focus:border-accent focus:outline-none ' +
  'disabled:opacity-45 disabled:pointer-events-none'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className = '', rows = 4, ...rest }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={[base, 'px-3 py-2 text-base leading-relaxed resize-y', invalid && 'border-coral', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  ),
)
Textarea.displayName = 'Textarea'
