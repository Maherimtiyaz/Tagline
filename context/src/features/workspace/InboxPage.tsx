import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CornerDownLeft, Plus, Search, X } from 'lucide-react'
import { useAppStore, type InboxView } from '../../lib/store'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { timeAgo } from '../../hooks/useTransformPipeline'
import { ThoughtCard } from '../../components/ui/ThoughtCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'

/* ============================================================
   Inbox — where raw thoughts live. One list screen drives three
   sidebar views (spec §18): Inbox (unprocessed), Workspace
   (everything active), Drafts (empty or untouched new captures).
   Global search over thoughts + outputs with highlighted matches
   (spec §33). "N" focuses the new-thought flow; "/" focuses search.
   ============================================================ */

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

const VIEW_META: Record<InboxView, { title: string; blurb: string; emptyTitle: string; emptyBody: string }> = {
  inbox: {
    title: 'Inbox',
    blurb: 'thoughts waiting to become something',
    emptyTitle: 'Inbox zero.',
    emptyBody: 'Nothing unprocessed. Capture a rough thought and Context will find the shape inside it.',
  },
  workspace: {
    title: 'Workspace',
    blurb: 'every active thought and its outputs',
    emptyTitle: 'No thoughts yet.',
    emptyBody: 'Capture something and Context will help you turn it into something useful.',
  },
  drafts: {
    title: 'Drafts',
    blurb: 'started, not finished',
    emptyTitle: 'No drafts.',
    emptyBody: 'A draft is a thought you captured but never transformed. Press N and start typing — nothing gets lost.',
  },
}

export function InboxPage({ view = 'inbox' }: { view?: InboxView }) {
  const thoughts = useAppStore((s) => s.thoughts)
  const addThought = useAppStore((s) => s.addThought)
  const select = useAppStore((s) => s.select)
  const transform = useAppStore((s) => s.transform)
  const deleteThought = useAppStore((s) => s.deleteThought)
  const setPalette = useAppStore((s) => s.setPalette)
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const meta = VIEW_META[view]
  const nonArchived = thoughts.filter((t) => t.status !== 'archived')
  const scoped = useMemo(() => {
    if (view === 'inbox') return nonArchived.filter((t) => t.status === 'raw')
    if (view === 'workspace') return nonArchived
    return nonArchived.filter((t) => t.text.trim() === '' || (t.status === 'raw' && t.outputs.length === 0))
  }, [view, nonArchived])

  const results = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    const th = nonArchived.filter((t) => t.text.toLowerCase().includes(q))
    const outs = nonArchived.flatMap((t) =>
      t.outputs.filter((o) => (o.title + o.body).toLowerCase().includes(q)).map((o) => ({ thought: t, output: o })),
    )
    return { th, outs }
  }, [query, nonArchived])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onNew() }
      else if (e.key === 'Escape') setQuery('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onNew = () => {
    const id = addThought('')
    select(id)
    navigate(`/app/thought/${id}`)
  }

  const today = scoped.filter((t) => Date.now() - t.createdAt < 24 * 3600_000)
  const earlier = scoped.filter((t) => Date.now() - t.createdAt >= 24 * 3600_000)
  const subtitle =
    view === 'inbox'
      ? `${scoped.length} unprocessed · demo data`
      : view === 'drafts'
        ? `${scoped.length} draft${scoped.length === 1 ? '' : 's'} · demo data`
        : `${nonArchived.filter((t) => t.status === 'raw').length} unprocessed of ${scoped.length} · demo data`

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      {/* header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight">{meta.title}</h1>
          <p className="font-mono text-3xs text-ink-faint">{subtitle}</p>
        </div>
        <label className="relative flex-1 basis-48 md:basis-64">
          <span className="sr-only">Search thoughts and outputs</span>
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…  /"
            className="h-8 w-full rounded-md border border-line bg-canvas-deep pl-8 pr-7 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
              <X size={12} />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={onNew}
          className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <Plus size={14} aria-hidden /> New
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {results ? (
          /* ---------- SEARCH RESULTS ---------- */
          <div className="space-y-5">
            <p className="font-mono text-2xs text-ink-subtle">
              {results.th.length} thought{results.th.length === 1 ? '' : 's'} · {results.outs.length} output{results.outs.length === 1 ? '' : 's'}
            </p>
            {results.th.map((t) => (
              <ThoughtCard
                key={t.id}
                id={t.id} text={t.text} source={t.source} createdAt={t.createdAt}
                status={t.status} outputCount={t.outputs.length}
                onOpen={() => navigate(`/app/thought/${t.id}`)}
                onTransform={() => { transform(t.id, 'email'); navigate(`/app/thought/${t.id}`) }}
              />
            ))}
            {results.outs.map(({ thought, output }) => (
              <button
                key={output.id}
                type="button"
                onClick={() => navigate(`/app/thought/${thought.id}`)}
                className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
              >
                <Badge tone="accent">{output.type}</Badge>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium"><Highlight text={output.title} q={query} /></span>
                  <span className="block truncate text-xs text-ink-muted"><Highlight text={output.body.split('\n')[0]} q={query} /></span>
                </span>
                <span className="ml-auto shrink-0 font-mono text-3xs text-ink-faint">{timeAgo(output.createdAt)}</span>
              </button>
            ))}
            {results.th.length === 0 && results.outs.length === 0 && (
              <EmptyState title="Nothing matches that." body="Try a name, a day of the week, or a word from the thought itself." />
            )}
          </div>
        ) : scoped.length === 0 ? (
          /* ---------- EMPTY ---------- */
          <EmptyState
            title={meta.emptyTitle}
            body={meta.emptyBody}
            action={
              <button type="button" onClick={onNew} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover">
                Start a thought
              </button>
            }
          />
        ) : (
          /* ---------- GROUPED LIST ---------- */
          <div className="space-y-7">
            {[{ label: 'Today', list: today }, { label: 'Earlier', list: earlier }].map(({ label, list }) =>
              list.length === 0 ? null : (
                <section key={label} aria-label={label}>
                  <p className="label-mono mb-2">{label}</p>
                  <AnimatePresence initial={false}>
                    <div className="space-y-2.5">
                      {list.map((t) => (
                        <motion.div
                          key={t.id}
                          layout={!reduced}
                          initial={reduced ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduced ? undefined : { opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.22 }}
                        >
                          <ThoughtCard
                            id={t.id} text={t.text} source={t.source} createdAt={t.createdAt}
                            status={t.status} outputCount={t.outputs.length}
                            onOpen={() => navigate(`/app/thought/${t.id}`)}
                            onTransform={() => { transform(t.id, 'email'); navigate(`/app/thought/${t.id}`) }}
                            onDelete={view === 'drafts' ? () => deleteThought(t.id) : undefined}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </AnimatePresence>
                </section>
              ),
            )}
            <p className={cn('flex items-center gap-1.5 pt-1 font-mono text-3xs text-ink-faint')}>
              <CornerDownLeft size={10} aria-hidden /> click a thought to open the editor · press N for a new one
            </p>
          </div>
        )}
      </div>

      <button type="button" className="sr-only" onClick={() => setPalette(true)}>Open command palette</button>
    </div>
  )
}
