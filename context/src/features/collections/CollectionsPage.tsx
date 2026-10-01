import { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Collection, GeneratedOutput, Thought } from '../../data/types'
import { COLLECTIONS } from '../../data/mock'
import { useAppStore } from '../../lib/store'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { clockTime } from '../../hooks/useTransformPipeline'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'

/* ============================================================
   Collections (spec §37) — organise outputs into named sets.
   Phase 12: collections live in the persisted store, so user-
   created ones survive refresh; filing happens by collection
   id via an accessible picker (no nested buttons); filed
   outputs can be moved or unfiled inline.
   Phase 13: full CRUD — rename and delete (with inline confirm)
   for user-created collections; seeds stay immutable. Deleting
   never destroys outputs — they fall back to the Unfiled list.
   ============================================================ */

const DOT: Record<string, string> = {
  accent: 'bg-accent', blue: 'bg-blue', emerald: 'bg-emerald',
  amber: 'bg-amber', coral: 'bg-coral', neutral: 'bg-ink-faint',
}

interface Entry {
  output: GeneratedOutput
  thought: Thought
  collectionId?: string
}

/** Small dropdown that lists collections; picks one per row. */
function FilePicker({
  value,
  options,
  onPick,
  label,
}: {
  value: string
  options: { id: string; name: string }[]
  onPick: (id: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find((o) => o.id === value)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1 rounded-md border border-line bg-canvas-deep px-2 text-2xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        {current ? current.name : 'Save to…'}
        <ChevronDown size={11} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Choose a collection"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
          >
            {options.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  onClick={() => { onPick(o.id); setOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover',
                    o.id === value ? 'text-accent' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {o.id === value ? <Check size={11} aria-hidden /> : <span className="h-2 w-2 rounded-full bg-line-strong" aria-hidden />}
                  {o.name}
                </button>
              </li>
            ))}
            {value && (
              <li role="option" aria-selected={false} className="border-t border-line">
                <button
                  type="button"
                  onClick={() => { onPick(''); setOpen(false) }}
                  className="w-full px-3 py-1.5 text-left text-xs text-ink-subtle transition-colors hover:bg-surface-hover hover:text-coral"
                >
                  Remove from collection
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Inline rename + delete (with confirm) for user-created collections. */
function CollectionActions({ collection }: { collection: Collection }) {
  const isSeed = COLLECTIONS.some((c) => c.id === collection.id)
  const renameCollection = useAppStore((s) => s.renameCollection)
  const removeCollection = useAppStore((s) => s.removeCollection)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState(collection.name)

  if (isSeed) return null

  const commit = () => {
    renameCollection(collection.id, draft)
    setEditing(false)
  }

  return (
    <div className="ml-2 flex shrink-0 items-center gap-0.5">
      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); commit() }}
          className="flex items-center gap-1"
        >
          <label className="sr-only" htmlFor={`rename-${collection.id}`}>Rename collection</label>
          <input
            id={`rename-${collection.id}`}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setDraft(collection.name) } }}
            onBlur={commit}
            className="h-6 w-32 rounded border border-accent bg-canvas-deep px-1.5 text-xs focus:outline-none"
          />
        </form>
      ) : confirming ? (
        <span className="flex items-center gap-1 font-mono text-3xs text-ink-subtle">
          Delete? Outputs stay as unfiled.
          <button
            type="button"
            autoFocus
            onClick={() => { removeCollection(collection.id); setConfirming(false) }}
            className="rounded bg-coral px-1.5 py-0.5 font-sans text-2xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded px-1.5 py-0.5 text-2xs text-ink-muted transition-colors hover:text-ink"
          >
            Keep
          </button>
        </span>
      ) : (
        <>
          <button
            type="button"
            aria-label={`Rename collection ${collection.name}`}
            onClick={() => { setDraft(collection.name); setEditing(true) }}
            className="rounded p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Pencil size={11} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete collection ${collection.name}`}
            onClick={() => setConfirming(true)}
            className="rounded p-1 text-ink-faint transition-colors hover:bg-surface-hover hover:text-coral"
          >
            <Trash2 size={11} aria-hidden />
          </button>
        </>
      )}
    </div>
  )
}

export function CollectionsPage() {
  const { id: collectionId } = useParams()
  const navigate = useNavigate()
  const thoughts = useAppStore((s) => s.thoughts)
  const userCollections = useAppStore((s) => s.userCollections)
  const addCollection = useAppStore((s) => s.addCollection)
  const moveToCollection = useAppStore((s) => s.moveToCollection)

  const reduced = useReducedMotion()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const allCollections = useMemo(
    () => [...COLLECTIONS, ...userCollections],
    [userCollections],
  )

  /* Every output, with its filing status. Seed outputs carry a
     collectionId on the thought; user-saved ones do too. */
  const entries = useMemo<Entry[]>(
    () =>
      thoughts.flatMap((t) =>
        t.outputs.map((o) => ({ output: o, thought: t, collectionId: t.collectionId })),
      ),
    [thoughts],
  )

  const active = collectionId ? allCollections.find((c) => c.id === collectionId) : undefined
  /* Deleting the collection we're viewing → bounce back to the index. */
  useEffect(() => {
    if (collectionId && !active) navigate('/app/collections', { replace: true })
  }, [collectionId, active, navigate])
  const lists = active ? [active] : allCollections

  const createCollection = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    addCollection(trimmed)
    setName('')
    setCreating(false)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        {active && (
          <button type="button" onClick={() => navigate('/app/collections')} className="rounded-md px-1.5 py-1 text-xs text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink">
            ← All
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight">{active ? active.name : 'Collections'}</h1>
          <p className="font-mono text-3xs text-ink-faint">{active ? active.description : 'organised outputs · saved locally'}</p>
        </div>
        {!active && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            aria-expanded={creating}
            className="flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Plus size={14} aria-hidden /> New
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {/* create row */}
        <AnimatePresence initial={false}>
          {creating && !active && (
            <motion.form
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={(e) => { e.preventDefault(); createCollection() }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex gap-2 rounded-lg border border-accent-line bg-accent-soft/40 p-2">
                <label className="sr-only" htmlFor="collection-name">Collection name</label>
                <input
                  id="collection-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Client work"
                  className="h-8 flex-1 rounded-md border border-line bg-canvas-deep px-2.5 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
                <button type="submit" className="h-8 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink hover:bg-accent-hover">
                  Create
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className={cn('grid gap-4', !active && 'sm:grid-cols-2')}>
          {lists.map((c) => {
            const outs = entries.filter((e) => e.collectionId === c.id)
            return (
              <article key={c.id} className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[c.color] ?? DOT.neutral)} aria-hidden />
                  <h2 className="min-w-0 truncate text-sm font-semibold">
                    {active ? 'Outputs' : (
                      <button type="button" onClick={() => navigate(`/app/collections/${c.id}`)} className="rounded transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        {c.name}
                      </button>
                    )}
                  </h2>
                  {!active && <CollectionActions collection={c} />}
                  <span className="ml-auto font-mono text-3xs text-ink-faint">{outs.length}</span>
                </div>
                {!active && <p className="mb-3 text-xs text-ink-muted">{c.description}</p>}
                {outs.length === 0 ? (
                  <p className="pt-2 text-xs text-ink-faint">Nothing here yet — save an output and it will appear.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {outs.map(({ output: o, thought: t }) => (
                      <li key={o.id}>
                        <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas-deep pl-3 pr-1.5 py-2 transition-colors hover:border-line-strong">
                          <button
                            type="button"
                            onClick={() => navigate(`/app/output/${t.id}/${o.id}`)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <Badge tone={o.type === 'email' ? 'accent' : 'outline'}>{o.type}</Badge>
                            <span className="min-w-0 flex-1 truncate text-sm">{o.title}</span>
                            <ArrowRight size={12} className="shrink-0 text-ink-faint" aria-hidden />
                          </button>
                          {active && (
                            <>
                              <span className="shrink-0 font-mono text-3xs text-ink-faint">{clockTime(o.createdAt)}</span>
                              <FilePicker
                                value={c.id}
                                options={allCollections}
                                onPick={(id) => moveToCollection(t.id, id)}
                                label={`Move "${o.title}" to another collection`}
                              />
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
        </div>

        {/* Unfiled outputs — the inbox of finished work */}
        {!active && (() => {
          const unfiled = entries.filter((e) => !e.collectionId)
          if (unfiled.length === 0) return null
          return (
            <section aria-label="Unfiled outputs" className="mt-8">
              <p className="label-mono mb-2">Unfiled outputs</p>
              <ul className="space-y-2">
                {unfiled.map(({ output: o, thought: t }) => (
                  <li key={o.id} className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-3 py-2">
                    <Badge tone="outline">{o.type}</Badge>
                    <button type="button" onClick={() => navigate(`/app/output/${t.id}/${o.id}`)} className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent">
                      {o.title}
                    </button>
                    <FilePicker
                      value=""
                      options={allCollections}
                      onPick={(id) => moveToCollection(t.id, id)}
                      label={`Save "${o.title}" to a collection`}
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-3xs text-ink-faint">
                <Check size={10} aria-hidden /> saving files the output and records it in History
              </p>
            </section>
          )
        })()}
      </div>
    </div>
  )
}
