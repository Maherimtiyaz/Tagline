import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, CalendarRange, Check, ChevronLeft, ChevronRight, Copy, Download, Layers, Link2, MailCheck, Minus, RotateCcw, Sparkles } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'
import { SEED_THOUGHTS, SEED_TIMELINE } from '../../data/mock'
import type { Thought, TimelineEvent } from '../../data/types'
import type { DigestStatDelta } from '../../lib/analytics'
import {
  addWeeks,
  buildWeeklyDigest,
  copyDigestEmail,
  createDigestShareLink,
  downloadDigestMarkdown,
  formatWeekKey,
  isoWeekKey,
  recentWeekKeys,
} from '../../lib/mockAI'
import { copyToClipboard } from '../../lib/share'

/* ============================================================
   Phase 42 — Weekly Digest page. The Phase 40 engine and the
   Phase 41 export layer finally get a first-class surface:
   week navigation (addWeeks / recentWeekKeys), one-click
   generation (idempotent store action), rendered sections and
   a "Download .md" button wired to digestToMarkdown. All data
   is local; the only clock read is the initial anchor week.
   ============================================================ */

const DAY_MS = 86_400_000

/* Phase 42 shipped a local copy of this helper; Phase 46 promoted a
   calendar-safe (DST-proof) implementation into lib/mockAI next to
   addWeeks/isoWeekKey — the whole week-math family now lives in one
   place and DigestPage/store.digestStreak provably agree. Re-exported
   under the same name so existing importers (and the P42 harness)
   keep working untouched. */
export { weekStartFromKey } from '../../lib/mockAI'

const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/* Phase 44 — signed delta chip for the week-over-week strip. */
function DeltaChip({ label, d }: { label: string; d: DigestStatDelta }) {
  const up = d.delta > 0
  const flat = d.delta === 0
  return (
    <span className="inline-flex items-center gap-1 font-mono text-3xs tabular-nums">
      <span className="text-ink-faint">{label}</span>
      {flat ? (
        <Minus size={10} className="text-ink-faint" aria-label="no change" />
      ) : up ? (
        <ArrowUpRight size={10} className="text-emerald" aria-label="increase" />
      ) : (
        <ArrowDown size={10} className="text-coral" aria-label="decrease" />
      )}
      <span className={cn('font-medium', flat ? 'text-ink-muted' : up ? 'text-emerald' : 'text-coral')}>
        {up ? `+${d.delta}` : d.delta}
      </span>
    </span>
  )
}

export function DigestPage() {
  /* Anchor starts at "now"; navigation moves it whole weeks only. */
  const [anchorTs, setAnchorTs] = useState(() => Date.now())
  const weekKey = isoWeekKey(anchorTs)

  const thoughts = useAppStore((s) => s.thoughts)
  const timeline = useAppStore((s) => s.timeline)
  const digests = useAppStore((s) => s.digests)
  const generateDigest = useAppStore((s) => s.generateDigest)
  const clearDigest = useAppStore((s) => s.clearDigest)
  /* Phase 43 — batch backfill + email copy. */
  const generateDigestBatch = useAppStore((s) => s.generateDigestBatch)
  /* Phase 44 — week-over-week comparison (pure read over stored digests). */
  const compareDigest = useAppStore((s) => s.compareDigest)
  const pushToast = useAppStore((s) => s.pushToast)
  const [emailCopied, setEmailCopied] = useState(false)
  /* Phase 45 — share-link state: copied flash + a dismissible reveal
     panel so the (long) link is selectable even without clipboard. */
  const [linkCopied, setLinkCopied] = useState(false)
  const [shareRevealed, setShareRevealed] = useState(false)
  const shareLinkRef = useRef<HTMLTextAreaElement | null>(null)
  const stored = digests[weekKey]

  const comparison = useMemo(
    () => (stored ? compareDigest(weekKey) : null),
    [stored, weekKey, compareDigest],
  )

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

  /* Phase 43 — week key resets whenever the anchor moves, so a stale
     "copied" flash can never bleed onto a different digest.
     Phase 45 extends the same reset to the share-link states. */
  const gotoWeek = (updater: (ts: number) => number) => {
    setAnchorTs(updater)
    setEmailCopied(false)
    setLinkCopied(false)
    setShareRevealed(false)
  }

  /* Phase 45 — deterministic share link for the STORED digest only
     (previews are unfrozen data; sharing them would be lying). */
  const shareLink = useMemo(() => (stored ? createDigestShareLink(stored) : ''), [stored])

  /* Auto-select the revealed link once per open so Ctrl+C is enough. */
  useEffect(() => {
    if (shareRevealed && shareLinkRef.current) {
      shareLinkRef.current.focus()
      shareLinkRef.current.select()
    }
  }, [shareRevealed])

  const handleCopyLink = async () => {
    if (!stored || !shareLink) return
    const ok = await copyToClipboard(shareLink)
    setLinkCopied(ok)
    pushToast(
      ok ? `Digest link copied · ${stored.weekKey}` : 'Clipboard unavailable — reveal the link instead',
      ok ? 'success' : 'error',
    )
    if (ok) window.setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleCopyEmail = async () => {
    if (!stored) return
    const ok = await copyDigestEmail(stored)
    setEmailCopied(ok)
    pushToast(
      ok ? `Digest email copied · ${stored.weekKey}` : 'Clipboard unavailable in this browser',
      ok ? 'success' : 'error',
    )
    if (ok) window.setTimeout(() => setEmailCopied(false), 2000)
  }

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
            onClick={() => gotoWeek((ts) => addWeeks(ts, -1))}
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
            onClick={() => gotoWeek((ts) => addWeeks(ts, 1))}
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
              onClick={() => gotoWeek(() => weekStartFromKey(k))}
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
          {/* Phase 44 — week-over-week strip (stored digests only; the
              preview has no frozen baseline to compare against). */}
          {stored && (
            <div
              className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-line bg-canvas px-3 py-2"
              aria-label="Week over week comparison"
            >
              <span className="label-mono text-ink-faint">vs previous</span>
              {comparison ? (
                <>
                  <DeltaChip label="captured" d={comparison.captured} />
                  <DeltaChip label="transformed" d={comparison.transformed} />
                  <DeltaChip label="exported" d={comparison.exported} />
                  <span className="font-mono text-3xs text-ink-faint">
                    vs {formatWeekKey(comparison.prevWeekKey)}
                  </span>
                </>
              ) : (
                <span className="font-mono text-3xs text-ink-faint">
                  no earlier digest stored — backfill a week to compare
                </span>
              )}
            </div>
          )}
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
                {/* Phase 43 — copy the deterministic email rendering of this
                    digest to the clipboard (subject + plain-text body). */}
                <button
                  type="button"
                  aria-label="Copy digest as email to clipboard"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {emailCopied ? <MailCheck size={13} className="text-emerald" /> : <Sparkles size={13} />}
                  {emailCopied ? 'Copied!' : 'Copy as email'}
                </button>
                <button
                  type="button"
                  aria-label="Copy digest share link to clipboard"
                  onClick={handleCopyLink}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-accent',
                    linkCopied
                      ? 'border-accent-line bg-accent-soft text-ink'
                      : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {linkCopied ? <Check size={13} className="text-emerald" /> : <Link2 size={13} />}
                  {linkCopied ? 'Copied!' : 'Share link'}
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
              <>
                <button
                  type="button"
                  onClick={() => generateDigest(anchorTs)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Sparkles size={13} /> Generate this week
                </button>
                {/* Phase 43 — backfill last 4 weeks in one click; existing weeks are no-ops. */}
                <button
                  type="button"
                  aria-label="Backfill digests for the last four weeks"
                  onClick={() => generateDigestBatch(4, anchorTs)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Layers size={13} /> Backfill last 4 weeks
                </button>
              </>
            )}
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-3xs text-ink-faint">
              <CalendarRange size={11} aria-hidden /> stored under {weekKey}
            </span>
          </div>

          {/* Phase 45 — share-link reveal panel: the link rides entirely
              in the URL fragment (no server), so offer it as selectable
              text next to a native copy button. */}
          {stored && shareRevealed && (
            <div
              className="mt-3 flex items-start gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-2"
              role="group"
              aria-label="Digest share link"
            >
              <textarea
                ref={shareLinkRef}
                readOnly
                rows={2}
                value={shareLink}
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Digest share link, selectable text"
                className="min-h-0 w-full resize-none bg-transparent font-mono text-2xs leading-relaxed break-all text-ink outline-none"
              />
              <button
                type="button"
                onClick={() => setShareRevealed(false)}
                aria-label="Dismiss share link panel"
                className="shrink-0 rounded-md border border-line bg-surface px-2 py-1 font-mono text-3xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
              >
                Done
              </button>
            </div>
          )}
          {stored && !shareRevealed && (
            <button
              type="button"
              onClick={() => setShareRevealed(true)}
              className="mt-2 inline-flex items-center gap-1 font-mono text-3xs text-ink-faint underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Copy size={10} aria-hidden /> clipboard not working? show the full link
            </button>
          )}
        </section>

        <p className="pb-2 text-center font-mono text-3xs text-ink-faint">
          digests never leave this device · asking twice for the same week is a no-op
        </p>
      </div>
    </div>
  )
}
