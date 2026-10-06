import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, Check, Copy, Download, GitBranch, History, Save, Zap } from 'lucide-react'
import type { TimelineEvent, TimelineKind } from '../../data/types'
import { useAppStore } from '../../lib/store'
import { clockTime, dayLabel } from '../../hooks/useTransformPipeline'
import { SEED_TIMELINE, SEED_THOUGHTS } from '../../data/mock'
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
  version: <History size={12} aria-hidden />,
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
    const map = new Map<string, TimelineEvent>()
    ;[...SEED_TIMELINE, ...timeline].forEach((e) => map.set(e.id, e))
    /* Phase 18/19 link — fold archived output snapshots into the global
       timeline. saveVersion/restoreVersion already emit explicit events
       with matching labels; those are deduped away so each snapshot
       appears exactly once, whether it came from a manual save or an
       automatic tone/format archive. */
    const seenLabel = new Set(
      [...map.values()].flatMap((e) =>
        e.kind === 'save' && e.label.startsWith('Version saved · ') ? [`${e.thoughtId}|${e.at}|${e.label}`] : [],
      ),
    )
    for (const t of thoughts) {
      for (const o of t.outputs) {
        for (const v of o.versions ?? []) {
          const label = `Version saved · ${v.label}`
          if (seenLabel.has(`${t.id}|${v.at}|${label}`)) continue
          map.set(`ver-${v.id}`, {
            id: `ver-${v.id}`,
            thoughtId: t.id,
            at: v.at,
            kind: 'version',
            label,
            detail: `${o.title} · ${v.body.split(/\s+/).filter(Boolean).length} words`,
          })
        }
      }
    }
    /* Phase 29 — feedback ratings live on the output itself; surface them
       in the timeline too (rateOutput's explicit events are deduped by id,
       so seed/legacy ratings appear exactly once). */
    for (const t of thoughts) {
      for (const o of t.outputs) {
        if (!o.feedback) continue
        const key = `fb-${t.id}-${o.id}`
        if (map.has(key)) continue
        map.set(key, {
          id: key,
          thoughtId: t.id,
          at: o.feedback.at,
          kind: 'version',
          label: o.feedback.rating === 'helpful' ? 'Marked helpful' : 'Flagged for rework',
          detail: o.title,
        })
      }
    }
    return [...map.values()].sort((a, b) => a.at - b.at)
  }, [timeline, thoughts])

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
        <p className="font-mono text-3xs text-ink-subtle">every transformation, in order · demo data</p>
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
                  {(() => {
                    /* Day boundaries (spec §34): show a day label whenever
                       the calendar day changes within this thought's events. */
                    let prevDay: string | null = null
                    return g.events.map((e, i) => {
                      const day = dayLabel(e.at)
                      const isNewDay = day !== prevDay
                      prevDay = day
                      return (
                        <li key={e.id} className="relative pb-5 last:pb-0 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                          {isNewDay && (
                            <p className="label-mono mb-2 -mt-1 text-ink-subtle">{day}</p>
                          )}
                          <span
                            className={cn(
                              'absolute -left-[26.5px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border',
                              e.kind === 'transform' ? 'border-accent-line bg-accent-soft text-accent'
                                : e.kind === 'version' ? 'border-accent-line bg-surface text-accent'
                                  : e.kind === 'copy' || e.kind === 'save' || e.kind === 'export' ? 'border-emerald bg-emerald-soft text-emerald'
                                  : 'border-line bg-surface text-ink-subtle',
                            )}
                            aria-hidden
                          >
                            {KIND_ICON[e.kind]}
                          </span>
                          <time className="font-mono text-3xs tabular-nums text-ink-faint">{clockTime(e.at)}</time>
                          <p className="text-sm text-ink">{e.label}</p>
                          {e.detail && <p className="text-xs text-ink-muted">{e.detail}</p>}
                          {i < g.events.length - 1 && (
                            <ArrowDown size={10} className="mt-1 text-ink-faint" aria-hidden />
                          )}
                        </li>
                      )
                    })
                  })()}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* Collections view lives in features/collections/CollectionsPage.tsx */
