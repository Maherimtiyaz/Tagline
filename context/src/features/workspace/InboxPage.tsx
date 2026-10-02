import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckSquare, CornerDownLeft, LayoutTemplate, Plus, Search, Square, X } from 'lucide-react'
import { useAppStore, type InboxView } from '../../lib/store'
import { TEMPLATES } from '../../data/mock'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { timeAgo } from '../../hooks/useTransformPipeline'
import { ThoughtCard } from '../../components/ui/ThoughtCard'
import { BulkActionBar } from '../../components/ui/BulkActionBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
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
  /* Phase 20 — multi-select (spec §35). Selection lives in the store so
     it survives view switches; actions act on ids, never indices. */
  const selectedIds = useAppStore((s) => s.selectedIds)
  const toggleSelected = useAppStore((s) => s.toggleSelected)
  const setSelection = useAppStore((s) => s.setSelection)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  /* Hydration/loading state (QA §71): the persisted store rehydrates from
     localStorage a beat after first paint — show skeleton cards instead of
     a flash of "empty" or unstyled list. */
  const [booted, setBooted] = useState(() => thoughts.length > 0)
  useEffect(() => {
    if (booted) return
    const t = window.setTimeout(() => setBooted(true), 350)
    return () => window.clearTimeout(t)
  }, [booted])

  const meta = VIEW_META[view]
  const nonArchived = thoughts.filter((t) => t.status !== 'archived')
  /* Phase 23: tag filter chips — every distinct tag across active thoughts,
     with counts. Selection is view-local (not persisted).
     Phase 24: initial selection can come from ?tag= (command palette deep
     link); chip row and clear button stay in sync because they read/write
     the same state. */
  const [searchParams] = useSearchParams()
  const [activeTag, setActiveTag] = useState<string | null>(() => searchParams.get('tag'))
  /* Phase 26: ?signal=starred|pinned deep links from the sidebar — show only
     that bucket; any other navigation (or clearing) restores normal view. */
  const [signal, setSignal] = useState<'starred' | 'pinned' | null>(() => {
    const s = searchParams.get('signal')
    return s === 'starred' || s === 'pinned' ? s : null
  })
  useEffect(() => {
    const t = searchParams.get('tag')
    if (t) setActiveTag(t)
    else setActiveTag(null) // sidebar tag toggle-off navigates to plain /app/inbox
    const s = searchParams.get('signal')
    setSignal(s === 'starred' || s === 'pinned' ? s : null)
  }, [searchParams])
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of nonArchived)
      for (const tag of t.tags ?? []) m.set(tag, (m.get(tag) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [nonArchived])

  const scopedBase = useMemo(() => {
    if (view === 'inbox') return nonArchived.filter((t) => t.status === 'raw')
    if (view === 'workspace') return nonArchived
    return nonArchived.filter((t) => t.text.trim() === '' || (t.status === 'raw' && t.outputs.length === 0))
  }, [view, nonArchived])
  const scoped = useMemo(
    () => (activeTag ? scopedBase.filter((t) => t.tags?.some((x) => x.toLowerCase() === activeTag.toLowerCase())) : scopedBase),
    [scopedBase, activeTag],
  )

  const results = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    /* Phase 23: search also matches user tags (e.g. "#launch" → "launch"). */
    const th = nonArchived.filter(
      (t) => t.text.toLowerCase().includes(q) || (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    )
    const outs = nonArchived.flatMap((t) =>
      t.outputs.filter((o) => (o.title + o.body).toLowerCase().includes(q)).map((o) => ({ thought: t, output: o })),
    )
    const tpl = TEMPLATES.filter((tp) => (tp.name + tp.description).toLowerCase().includes(q))
    return { th, outs, tpl }
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

  /* Palette "Search thoughts and outputs" hands the query to us (spec §33). */
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  useEffect(() => {
    if (searchQuery) {
      setQuery(searchQuery)
      setSearchQuery('')
      searchRef.current?.focus()
    }
  }, [searchQuery, setSearchQuery])

  const onNew = () => {
    const id = addThought('')
    select(id)
    navigate(`/app/thought/${id}`)
  }

  /* Phase 22: pinned thoughts float above everything in every view.
     Phase 25: starred outrank pinned — Starred / Pinned / Today / Earlier,
     with each bucket excluding members of the ones above it. */
  const isPinned = (t: { pinned?: boolean }) => !!t.pinned
  const isStarred = (t: { starred?: boolean }) => !!t.starred
  const starredList = scoped.filter(isStarred)
  const pinnedList = scoped.filter((t) => !isStarred(t) && isPinned(t))
  const rest = scoped.filter((t) => !isStarred(t) && !isPinned(t))
  const today = rest.filter((t) => Date.now() - t.createdAt < 24 * 3600_000)
  const earlier = rest.filter((t) => Date.now() - t.createdAt >= 24 * 3600_000)

  /* Visible ids for bulk actions — "Select all" only ever touches what
     the user can see in this view, never hidden/stale selections. */
  const visibleIds = useMemo(() => scoped.map((t) => t.id), [scoped])
  const visibleSelected = useMemo(
    () => selectedIds.filter((id) => visibleIds.includes(id)),
    [selectedIds, visibleIds],
  )
  const allVisibleSelected = visibleIds.length > 0 && visibleSelected.length === visibleIds.length
  const toggleAll = () => {
    if (allVisibleSelected) clearSelection()
    else setSelection(visibleIds)
  }

  const subtitle =
    view === 'inbox'
      ? `${scoped.length} unprocessed · demo data`
      : view === 'drafts'
        ? `${scoped.length} draft${scoped.length === 1 ? '' : 's'} · demo data`
        : `${nonArchived.filter((t) => t.status === 'raw').length} unprocessed of ${scoped.length} · demo data`

  return (
    <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col">
      {/* header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight">{meta.title}</h1>
          <p className="font-mono text-3xs tabular-nums text-ink-subtle">
            {subtitle}
            {visibleSelected.length > 0 && (
              <span className="ml-2 text-accent" aria-live="polite">
                · {visibleSelected.length} selected
              </span>
            )}
          </p>
        </div>
        {/* Phase 20: select-all toggle for the visible list */}
        {scoped.length > 0 && !query.trim() && (
          <button
            type="button"
            onClick={toggleAll}
            role="checkbox"
            aria-checked={allVisibleSelected ? true : visibleSelected.length > 0 ? 'mixed' : false}
            aria-label={allVisibleSelected ? 'Deselect all thoughts in view' : 'Select all thoughts in view'}
            title={allVisibleSelected ? 'Deselect all' : 'Select all'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-faint transition-colors hover:border-accent-line hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
          >
            {allVisibleSelected ? <CheckSquare size={14} aria-hidden /> : <Square size={14} aria-hidden />}
          </button>
        )}
        <label className="relative flex-1 basis-48 md:basis-64">
          <span className="sr-only">Search thoughts and outputs</span>
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…  /"
            className="h-8 w-full rounded-md border border-line bg-canvas-deep pl-8 pr-7 text-sm placeholder:text-ink-subtle focus:border-accent focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink">
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

      {/* Phase 23: tag filter row (only when tags exist in this data set) */}
      {tagCounts.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line px-4 py-2 md:px-6" role="group" aria-label="Filter by tag">
          {tagCounts.slice(0, 10).map(([tag, count]) => {
            const on = activeTag === tag
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(on ? null : tag)}
                aria-pressed={on}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-3xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line',
                  on
                    ? 'border-accent-line bg-accent-soft text-accent-ink'
                    : 'border-line bg-canvas-deep text-ink-subtle hover:border-line-strong hover:text-ink-muted',
                )}
              >
                #{tag}
                <span className="tabular-nums opacity-60">{count}</span>
              </button>
            )
          })}
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-3xs text-ink-faint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
            >
              <X size={10} aria-hidden /> clear
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {!booted ? (
          /* ---------- LOADING (store rehydration) ---------- */
          <div className="space-y-2.5" role="status" aria-label="Loading thoughts">
            {[76, 92, 68].map((h, i) => (
              <Skeleton key={i} className="rounded-lg" style={{ height: h }} />
            ))}
          </div>
        ) : results ? (
          /* ---------- SEARCH RESULTS ---------- */
          <div className="space-y-5">
            <p className="font-mono text-2xs text-ink-subtle">
              {results.th.length} thought{results.th.length === 1 ? '' : 's'} · {results.outs.length} output{results.outs.length === 1 ? '' : 's'}
              {results.tpl.length > 0 && ` · ${results.tpl.length} template${results.tpl.length === 1 ? '' : 's'}`}
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
                <span className="ml-auto shrink-0 font-mono text-3xs tabular-nums text-ink-subtle">{timeAgo(output.createdAt)}</span>
              </button>
            ))}
            {results.tpl.map((tp) => (
              <button
                key={tp.id}
                type="button"
                onClick={() => navigate(`/app/thought/new?template=${tp.id}`)}
                className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
              >
                <LayoutTemplate size={15} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium"><Highlight text={tp.name} q={query} /></span>
                  <span className="block truncate text-xs text-ink-muted"><Highlight text={tp.description} q={query} /></span>
                </span>
                <span className="ml-auto shrink-0 font-mono text-3xs text-ink-subtle">template</span>
              </button>
            ))}
            {results.th.length === 0 && results.outs.length === 0 && results.tpl.length === 0 && (
              <EmptyState title="Nothing matches that." body="Try a name, a day of the week, or a word from the thought itself." />
            )}
          </div>
        ) : scoped.length === 0 ? (
          /* ---------- EMPTY (tag-filtered vs genuinely empty) ---------- */
          <EmptyState
            title={activeTag ? `Nothing tagged #${activeTag}.` : meta.emptyTitle}
            body={activeTag ? 'No thoughts in this view carry that tag. Clear the filter to see everything, or add the tag from a thought\'s editor.' : meta.emptyBody}
            action={
              activeTag ? (
                <button type="button" onClick={() => setActiveTag(null)} className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:border-line-strong">
                  Clear filter
                </button>
              ) : (
                <button type="button" onClick={onNew} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover">
                  Start a thought
                </button>
              )
            }
          />
        ) : (
          /* ---------- GROUPED LIST ---------- */
          <div className="space-y-7">
            {signal && (
              <div className="-mt-2 flex items-center gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-1.5 text-sm text-accent-ink" role="status">
                <span>Showing {signal === 'starred' ? 'starred' : 'pinned'} thoughts only.</span>
                <button
                  type="button"
                  onClick={() => navigate('/app/inbox')}
                  className="ml-auto inline-flex items-center gap-1 font-mono text-3xs underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
                >
                  <X size={10} aria-hidden /> show all
                </button>
              </div>
            )}
            {(
              signal === 'starred'
                ? [{ label: 'Starred', list: starredList }]
                : signal === 'pinned'
                  ? [{ label: 'Pinned', list: pinnedList }]
                  : [{ label: 'Starred', list: starredList }, { label: 'Pinned', list: pinnedList }, { label: 'Today', list: today }, { label: 'Earlier', list: earlier }]
            ).map(({ label, list }) =>
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
                            status={t.status} outputCount={t.outputs.length} pinned={t.pinned} starred={t.starred} tags={t.tags}
                            onOpen={() => navigate(`/app/thought/${t.id}`)}
                            onTransform={() => { transform(t.id, 'email'); navigate(`/app/thought/${t.id}`) }}
                            onDelete={view === 'drafts' ? () => deleteThought(t.id) : undefined}
                            selection={{ checked: selectedIds.includes(t.id), onToggle: () => toggleSelected(t.id) }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </AnimatePresence>
                </section>
              ),
            )}
            <p className={cn('flex items-center gap-1.5 pt-1 font-mono text-3xs text-ink-subtle')}>
              <CornerDownLeft size={10} aria-hidden /> click a thought to open the editor · press N for a new one
            </p>
          </div>
        )}
      </div>

      {/* Phase 20: floating bulk-action bar (spec §35) */}
      <BulkActionBar ids={visibleSelected} />

      <button type="button" className="sr-only" onClick={() => setPalette(true)}>Open command palette</button>
    </div>
  )
}
