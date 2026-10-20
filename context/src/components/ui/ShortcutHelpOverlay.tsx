import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { formatShortcut, isMacPlatform, matchKeyCombo, shouldIgnoreShortcut } from '../../lib/hotkeys'
import { Kbd } from './Kbd'

/* ============================================================
   Phase 61 — Global shortcut help overlay.

   Extracted from InboxPage's view-local dialog so pressing "?"
   works on EVERY /app route (Digest, Collections, History…).
   Open state lives in the store (`helpOpen`); this component is
   mounted once inside AppShell and listens for the bare-key "?"
   itself — with the shared typing guards from lib/hotkeys so it
   never fires while the user types into a field. Escape closes
   via the same window listener that already clears the palette.
   ============================================================ */

/** Single source of truth for the shortcut table. Specs run through
 *  formatShortcut so Mac users see ⌘K-style hints and everyone else
 *  sees Ctrl+…; 'Mod' resolves per platform. */
export const SHORTCUT_HELP: Array<{ spec: string; label: string }> = [
  { spec: 'Mod+k', label: 'Open command palette' },
  { spec: 'n', label: 'New thought' },
  { spec: '/', label: 'Focus search' },
  { spec: '?', label: 'Toggle this help' },
  { spec: 'Escape', label: 'Clear search / close overlays' },
  { spec: 'Mod+s', label: 'Save draft in editor' },
  { spec: 'Mod+Enter', label: 'Transform thought (editor)' },
]

export function ShortcutHelpOverlay() {
  const open = useAppStore((s) => s.helpOpen)
  const setHelp = useAppStore((s) => s.setHelp)
  const paletteOpen = useAppStore((s) => s.paletteOpen)
  const reduced = useReducedMotion()

  /* Bare "?" toggles the overlay from any route. shouldIgnoreShortcut
     keeps it out of text fields / IME composition; the palette check
     prevents "?" typed into the palette search from flipping layers.
     Escape closes the dialog while it is open — handled here rather
     than relying on InboxPage's global Escape, because this overlay is
     mounted on every /app route (Phase 61). */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => {
      if (paletteOpen) return
      if (open && matchKeyCombo(e, 'Escape', false)) {
        e.preventDefault()
        setHelp(false)
        return
      }
      if (e.key !== '?') return
      if (shouldIgnoreShortcut(e.target, e)) return
      e.preventDefault()
      setHelp(!open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, paletteOpen, setHelp])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={() => setHelp(false)}
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.21, 0.6, 0.35, 1] }}
            className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={() => setHelp(false)}
                aria-label="Close shortcut help"
                className="rounded-md p-1 text-ink-subtle hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <ul className="space-y-2">
              {SHORTCUT_HELP.map(({ spec, label }) => (
                <li key={spec} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-ink-muted">{label}</span>
                  <Kbd keys={formatShortcut(spec, isMacPlatform()).split('+')} />
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-3xs text-ink-subtle">
              press {formatShortcut('?', isMacPlatform())} again to close
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
