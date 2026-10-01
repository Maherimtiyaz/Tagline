import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ArchiveRestore, Check, FolderInput, Trash2, X } from 'lucide-react'
import { COLLECTIONS } from '../../data/mock'
import type { Collection } from '../../data/types'
import { useAppStore } from '../../lib/store'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { cn } from '../../lib/cn'

/* Tailwind can't see dynamically-built class names, so collection dot
   colors come from a static map (same one CollectionsPage uses). */
const DOT: Record<string, string> = {
  accent: 'bg-accent', blue: 'bg-blue', emerald: 'bg-emerald',
  amber: 'bg-amber', coral: 'bg-coral', neutral: 'bg-ink-faint',
}

/* ============================================================
   BulkActionBar — Phase 20 (spec §35 multi-select). A floating
   bar that appears when one or more thoughts are selected in
   any inbox view. Actions: Save to collection · Archive /
   Restore (contextual) · Delete (with explicit confirmation —
   destructive bulk actions never fire on a single click).
   Keyboard: Escape clears the selection.
   ============================================================ */

export function BulkActionBar({ ids }: { ids: string[] }) {
  const thoughts = useAppStore((s) => s.thoughts)
  const userCollections = useAppStore((s) => s.userCollections)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const bulkArchive = useAppStore((s) => s.bulkArchive)
  const bulkRestore = useAppStore((s) => s.bulkRestore)
  const bulkDelete = useAppStore((s) => s.bulkDelete)
  const bulkSaveToCollection = useAppStore((s) => s.bulkSaveToCollection)
  const reduced = useReducedMotion()
  const barRef = useRef<HTMLDivElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [collectionMenu, setCollectionMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const count = ids.length
  /* The bar is driven by the caller's visible ids, but stale ids can
     survive navigation; resolve against live state for the labels. */
  const selected = useMemo(() => thoughts.filter((t) => ids.includes(t.id)), [thoughts, ids])
  const allArchived = selected.length > 0 && selected.every((t) => t.status === 'archived')
  const withOutputs = selected.filter((t) => t.outputs.length > 0).length

  const collections: Collection[] = useMemo(
    () => [...COLLECTIONS, ...userCollections],
    [userCollections],
  )

  /* Collapse confirm/menu states whenever the selection changes. */
  useEffect(() => {
    setConfirming(false)
    setCollectionMenu(false)
  }, [count])

  useEffect(() => {
    if (count === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (collectionMenu) setCollectionMenu(false)
        else if (confirming) setConfirming(false)
        else clearSelection()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (collectionMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCollectionMenu(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [count, confirming, collectionMenu, clearSelection])

  const btn =
    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line'

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          ref={barRef}
          role="toolbar"
          aria-label={`Bulk actions for ${count} selected thought${count === 1 ? '' : 's'}`}
          initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto absolute bottom-5 left-1/2 z-30 w-[min(94%,34rem)] -translate-x-1/2 rounded-xl border border-line-strong bg-surface p-2 shadow-lg backdrop-blur"
        >
          {confirming ? (
            /* ---------- destructive confirmation ---------- */
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-xs text-ink">
                Delete <strong className="tabular-nums">{count - withOutputs}</strong> selected
                thought{count - withOutputs === 1 ? '' : 's'}?{' '}
                {withOutputs > 0 && (
                  <span className="text-ink-subtle">
                    {withOutputs} with outputs will be kept — archive those instead.
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  bulkDelete(ids)
                  setConfirming(false)
                }}
                className={cn(btn, 'bg-coral text-white hover:opacity-90')}
              >
                <Trash2 size={13} aria-hidden /> Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={cn(btn, 'border border-line text-ink-muted hover:text-ink')}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1.5 font-mono text-2xs tabular-nums text-accent">
                <Check size={12} aria-hidden /> {count} selected
              </span>

              {/* Save to collection — dropdown of seed + user collections */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setCollectionMenu((v) => !v)}
                  aria-expanded={collectionMenu}
                  aria-haspopup="menu"
                  className={cn(btn, 'text-ink-muted hover:bg-canvas-deep hover:text-ink')}
                >
                  <FolderInput size={13} aria-hidden /> Save to…
                </button>
                <AnimatePresence>
                  {collectionMenu && (
                    <motion.ul
                      role="menu"
                      aria-label="Choose a collection"
                      initial={reduced ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: 4 }}
                      transition={{ duration: 0.16 }}
                      className="absolute bottom-full left-0 mb-2 max-h-56 w-52 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
                    >
                      {collections.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              bulkSaveToCollection(ids, c.name)
                              setCollectionMenu(false)
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink"
                          >
                            <span
                              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[c.color] ?? 'bg-ink-faint')}
                              aria-hidden
                            />
                            {c.name}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              {allArchived ? (
                <button
                  type="button"
                  onClick={() => bulkRestore(ids)}
                  className={cn(btn, 'text-ink-muted hover:bg-canvas-deep hover:text-ink')}
                >
                  <ArchiveRestore size={13} aria-hidden /> Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => bulkArchive(ids)}
                  className={cn(btn, 'text-ink-muted hover:bg-canvas-deep hover:text-ink')}
                >
                  <Archive size={13} aria-hidden /> Archive
                </button>
              )}

              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={cn(btn, 'text-coral hover:bg-coral-soft')}
              >
                <Trash2 size={13} aria-hidden /> Delete
              </button>

              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear selection"
                className={cn(btn, 'ml-auto text-ink-faint hover:text-ink')}
              >
                <X size={13} aria-hidden /> Clear
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
