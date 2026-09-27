import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

/* ============================================================
   Accessible listbox Select — keyboard driven (↑ ↓ Enter Esc,
   typeahead), closes on outside click. Used for tone/format
   pickers where a native select can't be styled coherently.
   ============================================================ */

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  options,
  value,
  onChange,
  className,
  ariaLabel,
  size = 'md',
}: {
  options: SelectOption[]
  value: string
  onChange: (v: string) => void
  className?: string
  ariaLabel: string
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const commit = (i: number) => {
    onChange(options[i].value)
    setOpen(false)
    btnRef.current?.focus()
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openList()
          }
        }}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-ink',
          'transition-colors duration-[var(--duration-micro)] hover:border-line-strong',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          size === 'sm' ? 'h-7' : 'h-9',
        )}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown size={14} className={cn('shrink-0 text-ink-subtle transition-transform duration-[var(--duration-fast)]', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length) }
            else if (e.key === 'Enter') { e.preventDefault(); commit(active) }
          }}
          ref={(el) => el?.focus()}
          className="absolute left-0 top-full z-popover mt-1 max-h-64 w-full min-w-40 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-lg animate-fade-in"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                i === active ? 'bg-surface-hover text-ink' : 'text-ink-muted',
              )}
            >
              <Check size={13} className={cn(o.value === value ? 'text-accent' : 'opacity-0')} aria-hidden />
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
