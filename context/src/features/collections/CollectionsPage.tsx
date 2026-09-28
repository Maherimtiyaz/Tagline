import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Plus } from 'lucide-react'
import type { GeneratedOutput, Thought } from '../../data/types'
import { COLLECTIONS } from '../../data/mock'
import { useAppStore } from '../../lib/store'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { clockTime } from '../../hooks/useTransformPipeline'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'

/* ============================================================
   Collections (spec §37) — organise outputs into named sets.
   New collections are session-only (demo state); seeded ones
   match the sidebar. "Save to collection" is available inline
   on every unfiled output.
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

export function CollectionsPage({ collectionId }: { collectionId?: string }) {
  const thoughts = useAppStore((s) => s.thoughts)
  const saveToCollection = useAppStore((s) => s.saveToCollection)
  const pushToast = useAppStore((s) => s.pushToast)
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [localCollections, setLocalCollections] = useState<{ id: string; name: string }[]>([])

  const allCollections = useMemo(
    () => [...COLLECTIONS, ...localCollections.map((c) => ({ ...c, description: 'Created in this session · demo data', color: 'neutral' }))],
    [localCollections],
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
  const lists = active ? [active] : allCollections

  const createCollection = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = 'c-' + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    setLocalCollections((cs) => (cs.some((c) => c.id === id) ? cs : [...cs, { id, name: trimmed }]))
    setName('')
    setCreating(false)
    pushToast(`Collection "${trimmed}" created`, 'success')
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
          <p className="font-mono text-3xs text-ink-faint">{active ? active.description : 'organised outputs · demo data'}</p>
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
            const outs = entries.filter((e) => e.collectionId === c.id || e.collectionId === c.name)
            return (
              <article key={c.id} className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[c.color] ?? DOT.neutral)} aria-hidden />
                  <h2 className="text-sm font-semibold">
                    {active ? 'Outputs' : (
                      <button type="button" onClick={() => navigate(`/app/collections/${c.id}`)} className="rounded transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        {c.name}
                      </button>
                    )}
                  </h2>
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
                            onClick={() => navigate(`/app/thought/${t.id}`)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <Badge tone={o.type === 'email' ? 'accent' : 'outline'}>{o.type}</Badge>
                            <span className="min-w-0 flex-1 truncate text-sm">{o.title}</span>
                            <ArrowRight size={12} className="shrink-0 text-ink-faint" aria-hidden />
                          </button>
                          {active && (
                            <span className="shrink-0 font-mono text-3xs text-ink-faint">{clockTime(o.createdAt)}</span>
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
                    <button type="button" onClick={() => navigate(`/app/thought/${t.id}`)} className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent">
                      {o.title}
                    </button>
                    <select
                      aria-label={`Save "${o.title}" to a collection`}
                      value=""
                      onChange={(e) => { if (e.target.value) saveToCollection(t.id, o.id, e.target.value) }}
                      className="h-7 rounded-md border border-line bg-canvas-deep px-1.5 text-2xs text-ink-muted focus:border-accent focus:outline-none"
                    >
                      <option value="">Save to…</option>
                      {allCollections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
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
