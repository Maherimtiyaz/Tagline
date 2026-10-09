import { useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, Download, RotateCcw, Sparkles } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'
import { SEED_THOUGHTS, SEED_TIMELINE } from '../../data/mock'
import type { Thought, TimelineEvent } from '../../data/types'
import {
  addWeeks,
  buildWeeklyDigest,
  downloadDigestMarkdown,
  formatWeekKey,
  isoWeekKey,
  recentWeekKeys,
} from '../../lib/mockAI'

/* ============================================================
   Phase 42 — Weekly Digest page. The Phase 40 engine and the
   Phase 41 export layer finally get a first-class surface:
   week navigation (addWeeks / recentWeekKeys), one-click
   generation (idempotent store action), rendered sections and
   a "Download .md" button wired to digestToMarkdown. All data
   is local; the only clock read is the initial anchor week.
   ============================================================ */

const DAY_MS = 86_400_000

/** Monday 00:00 local for an ISO week key. Falls back to `now` for
    malformed keys (mirrors formatWeekKey's never-throw stance). */
export function weekStartFromKey(weekKey: string, now = Date.now()): number {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey)
  if (!m) return now
  const isoYear = Number(m[1])
  const week = Number(m[2])
  const jan1 = new Date(isoYear, 0, 1)
  const jan1IsoDow = (jan1.getDay() + 6) % 7 + 1
  const firstMondayOffset = jan1IsoDow === 1 ? 0 : 8 - jan1IsoDow
  const w1 = new Date(isoYear, 0, 1 + firstMondayOffset)
  let monday = new Date(w1.getTime() + (week - 1) * 7 * DAY_MS)
  monday.setHours(0, 0, 0, 0)
  /* DST guard: if the re-anchored Monday keyed into a neighbouring
     week, step ±1 day until it lands back on the requested key. */
  if (isoWeekKey(monday.getTime()) !== weekKey) {
    const alt = new Date(monday.getTime() + DAY_MS)
    alt.setHours(0, 0, 0, 0)
    if (isoWeekKey(alt.getTime()) === weekKey) monday = alt
  }
  return monday.getTime()
}

const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function DigestPage() {
  /* Anchor starts at "now"; navigation moves it whole weeks only. */
  const [anchorTs, setAnchorTs] = useState(() => Date.now())
  const weekKey = isoWeekKey(anchorTs)

  const thoughts = useAppStore((s) => s.thoughts)
  const timeline = useAppStore((s) => s.timeline)
  const digests = useAppStore((s) => s.digests)
  const generateDigest = useAppStore((s) => s.generateDigest)
  const clearDigest = useAppStore((s) => s.clearDigest)
  const stored = digests[weekKey]

  /* Merge seed rows with live store rows exactly like InsightsPage —
     store rehydration dedupes seeds by id, so this is the full truth. */
  const allData = useMemo(() => {
    const tMap = new Map<string, Thought>()
    ;[...SEED_THOUGHTS, ...thoughts].forEach((t) => tMap.set(t.id, t))
    const eMap = new Map<string, TimelineEvent>()
    ;[...SEED_TIMELINE, ...timeline].forEach((e) => eMap.set(e.id, e))
    return { thoughts: [...tMap.values()], timeline: [...eMap.values()] }
  }, [thoughts, timeline])

  /* Preview of what THIS week would contain if generated now — same
     engine, frozen generatedAt, so preview == future output verbatim. */
  const preview = useMemo(
    () =>
      stored
        ? null
        : buildWeeklyDigest(anchorTs, allData.thoughts, allData.timeline, weekStartFromKey(weekKey, anchorTs)),
    [stored, anchorTs, weekKey, allData],
  )

  const shown = stored ?? preview
  const weeks = useMemo(() => recentWeekKeys(Date.now(), 8), [])

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Weekly Digest</h1>
          <p className="font-mono text-3xs text-ink-subtle">
            one deterministic recap per ISO week · generated locally
          </p>
        </div>
        {/* Week stepper — whole-week jumps, Monday re-anchored (P41 helper). */}
        <div className="flex items-center gap-1" role="group" aria-label="Week navigation">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setAnchorTs((ts) => addWeeks(ts, -1))}
            className="rounded-md border border-line p-1.5 text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[9.5rem] text-center font-mono text-xs tabular-nums text-ink" aria-live="polite">
            {formatWeekKey(weekKey)}
          </span>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setAnchorTs((ts) => addWeeks(ts, 1))}
            className="rounded-md border border-line p-1.5 text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
        {/* ---------- Recent weeks rail ---------- */}
        <section aria-label="Recent weeks" className="flex flex-wrap gap-2">
          {weeks.map((k) => (
            <button
              key={k}
              type="button"
              aria-current={k === weekKey ? 'true' : undefined}
              onClick={() => setAnchorTs(weekStartFromKey(k))}
              className={cn(
                'rounded-full border px-3 py-1 font-mono text-3xs transition-colors focus-visible:ring-2 focus-visible:ring-accent',
                k === weekKey
                  ? 'border-accent-line bg-accent-soft text-ink'
                  : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {formatWeekKey(k)}
              {digests[k] ? (
                <span className="ml-1.5 text-emerald" role="img" aria-label="digest available">
                  ●
                </span>
              ) : null}
            </button>
          ))}
        </section>

        {/* ---------- Current week card ---------- */}
        <section
          aria-label={`Digest for ${formatWeekKey(weekKey)}`}
          className="rounded-lg border border-line bg-surface p-4 md:p-5"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              {fmtDay(shown.from)} – {fmtDay(shown.to)}
            </h2>
            <span className="font-mono text-3xs text-ink-faint">
              {stored
                ? `generated ${new Date(stored.generatedAt).toLocaleString('en-US')}`
                : 'not generated yet'}
            </span>
          </div>

          <p className="mb-2 text-sm font-medium text-ink">{shown.headline}</p>
          <p className="mb-4 font-mono text-3xs tabular-nums text-ink-subtle">
            Captured {shown.captured} · Transformed {shown.transformed} · Exported {shown.exported}
          </p>
          {!stored && (
            <p className="mb-3 rounded-md border border-dashed border-line px-3 py-2 text-3xs text-ink-faint">
              Preview — computed live from your data. Generate to freeze this week&apos;s recap.
            </p>
          )}
          <div className="space-y-4">
            {shown.sections.map((sec) => (
              <div key={sec.heading}>
                <h3 className="label-mono mb-1.5 text-ink-subtle">{sec.heading}</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-muted marker:text-ink-faint">
                  {sec.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {stored ? (
              <>
                <button
                  type="button"
                  onClick={() => downloadDigestMarkdown(stored)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Download size={13} /> Download .md
                </button>
                <button
                  type="button"
                  onClick={() => clearDigest(weekKey)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <RotateCcw size={13} /> Clear &amp; regenerate
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => generateDigest(anchorTs)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Sparkles size={13} /> Generate this week
              </button>
            )}
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-3xs text-ink-faint">
              <CalendarRange size={11} aria-hidden /> stored under {weekKey}
            </span>
          </div>
        </section>

        <p className="pb-2 text-center font-mono text-3xs text-ink-faint">
          digests never leave this device · asking twice for the same week is a no-op
        </p>
      </div>
    </div>
  )
}
