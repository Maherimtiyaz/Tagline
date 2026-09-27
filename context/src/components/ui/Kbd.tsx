import type { HTMLAttributes } from 'react'

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  keys: string[]
}

/** Monospace keyboard hint, e.g. <Kbd keys={['⌘', 'K']} /> */
export function Kbd({ keys, className = '', ...rest }: KbdProps) {
  return (
    <kbd
      className={[
        'inline-flex items-center gap-0.5 rounded border border-line bg-canvas-deep px-1.5 py-0.5',
        'font-mono text-3xs text-ink-subtle leading-none select-none',
        className,
      ].join(' ')}
      {...rest}
    >
      {keys.map((k) => (
        <span key={k}>{k}</span>
      ))}
    </kbd>
  )
}
