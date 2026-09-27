import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, Check, Copy, Download, GitBranch, Save } from 'lucide-react'
import type { TimelineKind } from '../../data/types'
import { useAppStore } from '../../lib/store'
import { clockTime } from '../../hooks/useTransformPipeline'
import { COLLECTIONS, SEED_TIMELINE, SEED_THOUGHTS } from '../../data/mock'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'

/* ============================================================
   History — a visual timeline of transformations (spec §34),
   grouped by thought, plus the Collections view (spec §37).
   ============================================================ */

const KIND_ICON: Record<TimelineKind, React.ReactNode> = {
  capture: <GitBranch size={12} aria-hidden />,
  transform: <SparkleMini />,
  tone: <ArrowRight size={12} aria-hidden />,
  format: <ArrowRight size={12} aria-hidden />,
  copy: <Copy size={12} aria-hidden />,
  save: <Save size={12} aria-hidden />,
  export: <Download size={12} aria-hidden />,
  archive: <Check size={12} aria-hidden />,
}

function SparkleMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function HistoryPage() {
  const thoughts = useAppStore((s) => s.thoughts)
  const timeline = useAppStore((s) => s.timeline)
  const navigate = useNavigate()

  const allEvents = useMemo(() => {
    // include seed events + live store events, deduped by id
    const map = new Map<string, (typeof timeline)[number]>()
    ;[...SEED_TIMELINE, ...timeline].forEach((e) => map.set(e.id, e))
    return [...map.values()].sort((a, b) => a.at - b.at)
  }, [timeline])

  const byThought = useMemo(() => {
    const groups: { id: string; text: string; events: typeof allEvents }[] = []
    const list = [...SEED_THOUGHTS, ...thoughts]
    const seen = new Set<string>()
    for (const ev of allEvents) {
      if (seen.has(ev.thoughtId)) continue
      seen.add(ev.thoughtId)
      const t = list.find((x) => x.id === ev.thoughtId)
      groups.push({
        id: ev.thoughtId,
        text: t?.text ?? 'Archived thought',
        events: allEvents.filter((e) => e.thoughtId === ev.thoughtId),
      })
    }
    return groups.reverse()
  }, [allEvents, thoughts])

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <header className="border-b border-line px-4 py-3 md:px-6">
        <h1 className="text-base font-semibold tracking-tight">History</h1>
        <p className="font-mono text-3xs text-ink-faint">every transformation, in order · demo data</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {byThought.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-subtle">Nothing transformed yet.</p>
        ) : (
          <div className="space-y-8">
            {byThought.map((g) => (
              <section key={g.id} aria-label="Transformation timeline">
                <button
                  type="button"
                  onClick={() => navigate(`/app/thought/${g.id}`)}
                  className="mb-3 block max-w-full truncate rounded-md border border-line bg-surface px-3 py-1.5 text-left font-mono text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  "{g.text.slice(0, 90)}{g.text.length > 90 ? '…' : ''}"
                </button>
                <ol className="relative ml-2 space-y-0 border-l border-line pl-5">
                  {g.events.map((e, i) => (
                    <li key={e.id} className="relative pb-5 last:pb-0 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <span
                        className={cn(
                          'absolute -left-[26.5px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border',
                          e.kind === 'transform' ? 'border-accent-line bg-accent-soft text-accent'
                            : e.kind === 'copy' || e.kind === 'save' || e.kind === 'export' ? 'border-emerald bg-emerald-soft text-emerald'
                              : 'border-line bg-surface text-ink-subtle',
                        )}
                        aria-hidden
                      >
                        {KIND_ICON[e.kind]}
                      </span>
                      <time className="font-mono text-3xs text-ink-faint">{clockTime(e.at)}</time>
                      <p className="text-sm text-ink">{e.label}</p>
                      {e.detail && <p className="text-xs text-ink-muted">{e.detail}</p>}
                      {i < g.events.length - 1 && (
                        <ArrowDown size={10} className="mt-1 text-ink-faint" aria-hidden />
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Collections (spec §37) ---------- */

export function CollectionsPage({ collectionId }: { collectionId?: string }) {
  const thoughts = useAppStore((s) => s.thoughts)
  const navigate = useNavigate()
  const active = COLLECTIONS.find((c) => c.id === collectionId)
  const lists = active ? [active] : COLLECTIONS

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        {active && (
          <button type="button" onClick={() => navigate('/app/collections')} className="text-xs text-ink-subtle hover:text-ink">← All</button>
        )}
        <div>
          <h1 className="text-base font-semibold tracking-tight">{active ? active.name : 'Collections'}</h1>
          <p className="font-mono text-3xs text-ink-faint">{active ? active.description : 'organised outputs · demo data'}</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className={cn('grid gap-4', !active && 'sm:grid-cols-2')}>
          {lists.map((c) => {
            const items = thoughts.filter((t) => t.collectionId === c.id || t.collectionId === c.name)
            const outs = items.flatMap((t) => t.outputs.map((o) => ({ o, t })))
            return (
              <article key={c.id} className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
                <div className="mb-1 flex items-center gap-2">
                  <Dot color={c.color} />
                  <h2 className="text-sm font-semibold">
                    {active ? 'Outputs' : <button type="button" onClick={() => navigate(`/app/collections/${c.id}`)} className="hover:text-accent">{c.name}</button>}
                  </h2>
                  <span className="ml-auto font-mono text-3xs text-ink-faint">{outs.length}</span>
                </div>
                {!active && <p className="mb-3 text-xs text-ink-muted">{c.description}</p>}
                {outs.length === 0 ? (
                  <p className="pt-2 text-xs text-ink-faint">Nothing here yet — save an output and it will appear.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {outs.map(({ o, t }) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/app/thought/${t.id}`)}
                          className="flex w-full items-center gap-2 rounded-lg border border-line bg-canvas-deep px-3 py-2 text-left transition-colors hover:border-line-strong"
                        >
                          <Badge tone={o.type === 'email' ? 'accent' : 'outline'}>{o.type}</Badge>
                          <span className="min-w-0 flex-1 truncate text-sm">{o.title}</span>
                          <ArrowRight size={12} className="shrink-0 text-ink-faint" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  const map: Record<string, string> = {
    accent: 'bg-accent', blue: 'bg-blue', emerald: 'bg-emerald',
    amber: 'bg-amber', coral: 'bg-coral', neutral: 'bg-ink-faint',
  }
  return <span className={cn('h-2 w-2 rounded-full', map[color])} aria-hidden />
}
