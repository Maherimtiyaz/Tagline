import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

/* ============================================================
   Modal dialog with focus trap + Escape handling. On small
   screens it renders as a bottom sheet (spec §40, §70).
   ============================================================ */

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false,
  sheet = false,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  wide?: boolean
  /** Force sheet presentation (mobile drawers). */
  sheet?: boolean
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement
    const node = ref.current
    node?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Tab' && node) {
        const focusables = node.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-stretch justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col border border-line bg-surface outline-none animate-fade-up',
          sheet
            ? 'mt-auto max-h-[88dvh] rounded-t-2xl sm:mx-auto sm:mt-0 sm:max-h-[80vh] sm:rounded-xl'
            : 'm-auto max-h-[85dvh] rounded-xl shadow-lg',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        {title && (
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
            <h2 id={labelledBy} className="text-sm font-semibold tracking-tight">
              {title}
            </h2>
            <IconButton label="Close dialog" icon={<X size={15} />} onClick={onClose} size="sm" />
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
