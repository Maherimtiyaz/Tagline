/* ============================================================
   CONTEXT — Phase 30: Insights aggregation (pure, UI-free)
   Derives usage stats from the store's thoughts + timeline so
   the dashboard can be re-computed cheaply on every render and
   unit-tested without React or localStorage.
   ============================================================ */

import type { OutputType, Thought, TimelineEvent } from '../data/types'

export interface CountRow {
  key: string
  label: string
  count: number
}

export interface Insights {
  /** Total thoughts captured (all statuses). */
  totalThoughts: number
  /** Thoughts that have at least one generated output. */
  transformed: number
  /** transformed / totalThoughts, 0..1 (0 when empty). */
  transformRate: number
  /** Sum of every generated output across all thoughts. */
  totalOutputs: number
  /** Outputs carrying a 👍/👎 rating (Phase 29). */
  ratedOutputs: number
  helpful: number
  needsWork: number
  /** helpful / ratedOutputs, 0..1 (null → show "no signal yet"). */
  satisfaction: number | null
  /** Outputs with at least one archived version snapshot (P19). */
  versionedOutputs: number
  /** Outputs saved into any collection (P12). */
  savedOutputs: number
  /** Outputs with an export event on the timeline (P11 proxy). */
  exportedOutputs: number
  /** Outputs shared via link/sheet (timeline 'share' events, P16/18). */
  sharedOutputs: number
  /** Total captures grouped by source channel (voice/text/…). */
  bySource: CountRow[]
  /** Output counts per format type, descending. */
  byType: CountRow[]
  /** Captures in the last 7 calendar days (oldest first). */
  week: { day: string; count: number }[]
  /** Distinct tags in use, most-used first. */
  tagCounts: CountRow[]
  /** Starred thought count. */
  starred: number
  /** Pinned thought count. */
  pinned: number
}

const SOURCE_LABELS: Record<string, string> = {
  voice: 'Voice',
  text: 'Typed',
  screenshot: 'Screenshot',
  import: 'Imported',
}

const TYPE_LABELS: Record<OutputType, string> = {
  email: 'Email',
  plan: 'Plan',
  tasks: 'Task list',
  summary: 'Summary',
  brief: 'Brief',
  post: 'Post',
  decision: 'Decision memo',
  slack: 'Slack message',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Stable-ish label for a date used in the weekly strip. */
function dayKey(ts: number): string {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Pure reducer: everything the dashboard renders comes from here. */
export function computeInsights(
  thoughts: Thought[],
  timeline: TimelineEvent[],
  now: number = Date.now(),
): Insights {
  let transformed = 0
  let totalOutputs = 0
  let helpful = 0
  let needsWork = 0
  let versionedOutputs = 0
  let starred = 0
  let pinned = 0

  const sourceMap = new Map<string, number>()
  const typeMap = new Map<OutputType, number>()
  const tagMap = new Map<string, number>()

  /* Weekly capture strip: buckets keyed by midnight-normalized day. */
  const DAY_MS = 86_400_000
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const startToday = today.getTime()
  const weekBuckets: { day: string; key: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startToday - i * DAY_MS)
    weekBuckets.push({
      day: i === 0 ? 'Today' : DAY_NAMES[d.getDay()],
      key: dayKey(d.getTime()),
      count: 0,
    })
  }
  const bucketIndex = new Map(weekBuckets.map((b, i) => [b.key, i]))

  for (const t of thoughts) {
    if (t.outputs.length > 0) transformed++
    if (t.starred) starred++
    if (t.pinned) pinned++

    sourceMap.set(t.source, (sourceMap.get(t.source) ?? 0) + 1)
    for (const tag of t.tags ?? []) {
      const norm = tag.trim().toLowerCase()
      if (norm) tagMap.set(norm, (tagMap.get(norm) ?? 0) + 1)
    }

    const wi = bucketIndex.get(dayKey(t.createdAt))
    if (wi !== undefined) weekBuckets[wi].count++

    for (const o of t.outputs) {
      totalOutputs++
      typeMap.set(o.type, (typeMap.get(o.type) ?? 0) + 1)
      if (o.feedback?.rating === 'helpful') helpful++
      else if (o.feedback?.rating === 'needs-work') needsWork++
      if ((o.versions?.length ?? 0) > 0) versionedOutputs++
    }
  }

  /* Timeline-derived counters. Export/share events reference outputs by
     detail string; we count distinct thought+label combos conservatively
     as raw event totals — good enough for a demo-grade insight card. */
  let savedOutputs = 0
  let exportedOutputs = 0
  let sharedOutputs = 0
  for (const e of timeline) {
    if (e.kind === 'save') savedOutputs++
    else if (e.kind === 'export') exportedOutputs++
    else if ((e.kind as string) === 'share') sharedOutputs++
  }

  const rated = helpful + needsWork
  const toRows = <T extends string>(
    map: Map<T, number>,
    labels: Partial<Record<T, string>>,
  ): CountRow[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([key, count]) => ({ key, label: labels[key] ?? key, count }))

  return {
    totalThoughts: thoughts.length,
    transformed,
    transformRate: thoughts.length ? transformed / thoughts.length : 0,
    totalOutputs,
    ratedOutputs: rated,
    helpful,
    needsWork,
    satisfaction: rated ? helpful / rated : null,
    versionedOutputs,
    savedOutputs,
    exportedOutputs,
    sharedOutputs,
    bySource: toRows(sourceMap, SOURCE_LABELS),
    byType: toRows(typeMap, TYPE_LABELS),
    week: weekBuckets.map(({ day, count }) => ({ day, count })),
    tagCounts: [...tagMap.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([key, count]) => ({ key, label: `#${key}`, count })),
    starred,
    pinned,
  }
}

/** Compact percent formatter shared by cards ("67%", "—"). */
export function pct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  return `${Math.round(n * 100)}%`
}
