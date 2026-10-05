import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Download, GitBranch, Share2, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { CountRow } from '../../lib/analytics'
import { computeInsights, pct } from '../../lib/analytics'
import { SEED_THOUGHTS, SEED_TIMELINE } from '../../data/mock'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'

/* ============================================================
   Phase 30 — Insights dashboard. Pure aggregation lives in
   lib/analytics.ts; this file only renders it. All numbers are
   derived live from thoughts + timeline (seed ∪ store), so the
   page updates as the demo is used. Spec §56 conversion spirit:
   shows capture → transform → export funnel health.
   ============================================================ */

/** Merge seed data with live store rows exactly like HistoryPage does
    (store rehydration already dedupes seeds by id). */
function useAllData() {
  const thoughts = useAppStore((s) => s.thoughts)
  const timeline = useAppStore((s) => s.timeline)
  return useMemo(() => {
    const tMap = new Map<string, (typeof SEED_THOUGHTS)[number]>()
    ;[...SEED_THOUGHTS, ...thoughts].forEach((t) => tMap.set(t.id, t))
    const eMap = new Map<string, (typeof SEED_TIMELINE)[number]>()
    ;[...SEED_TIMELINE, ...timeline].forEach((e) => eMap.set(e.id, e))
    return { thoughts: [...tMap.values()], timeline: [...eMap.values()] }
  }, [thoughts, timeline])
}

function StatCard({
  icon,
  label,
  value,
  sub,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  onClick?: () => void
  tone?: 'default' | 'positive' | 'warning'
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-left transition-colors',
        onClick && 'cursor-pointer hover:border-line-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      <span className="flex items-center gap-1.5 label-mono text-ink-subtle">
        <span
          className={cn(
            tone === 'positive' ? 'text-emerald' : tone === 'warning' ? 'text-coral' : 'text-accent',
          )}
          aria-hidden
        >
          {icon}
        </span>
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</span>
      {sub && <span className="text-xs text-ink-muted">{sub}</span>}
    </Comp>
  )
}

/** Horizontal bar list shared by "by format" and "by source". */
function BarList({ rows, max, empty }: { rows: CountRow[]; max: number; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-ink-faint">{empty}</p>
  return (
    <ul className="space-y-2.5" role="list">
      {rows.map((r, i) => (
        <li key={r.key} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm text-ink">{r.label}</span>
            <span className="font-mono text-xs tabular-nums text-ink-subtle">{r.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-canvas-deep" aria-hidden>
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[var(--duration-base)]"
              /* width relative to the largest row; min sliver keeps 1s visible */
              style={{ width: `${Math.max(6, (r.count / Math.max(max, 1)) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function InsightsPage() {
  const { thoughts, timeline } = useAllData()
  const navigate = useNavigate()
  const stats = useMemo(() => computeInsights(thoughts, timeline), [thoughts, timeline])

  const weekMax = Math.max(...stats.week.map((d) => d.count), 1)
  const sourceMax = Math.max(...stats.bySource.map((r) => r.count), 1)
  const typeMax = Math.max(...stats.byType.map((r) => r.count), 1)

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <header className="border-b border-line px-4 py-3 md:px-6">
        <h1 className="text-base font-semibold tracking-tight">Insights</h1>
        <p className="font-mono text-3xs text-ink-subtle">how your thoughts turned into output · demo data</p>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
        {/* ---------- Funnel headline cards ---------- */}
        <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={<GitBranch size={13} />}
            label="Captured"
            value={String(stats.totalThoughts)}
            sub={`${stats.starred} starred · ${stats.pinned} pinned`}
            onClick={() => navigate('/app')}
          />
          <StatCard
            icon={<Sparkles size={13} />}
            label="Transformed"
            value={String(stats.transformed)}
            sub={`${pct(stats.transformRate)} of captures became documents`}
            onClick={() => navigate('/app/workspace')}
          />
          <StatCard
            icon={<BarChart3 size={13} />}
            label="Outputs"
            value={String(stats.totalOutputs)}
            sub={`${stats.versionedOutputs} have version history`}
          />
          <StatCard
            icon={<ThumbsUp size={13} />}
            label="Satisfaction"
            value={pct(stats.satisfaction)}
            sub={
              stats.ratedOutputs
                ? `${stats.helpful} helpful · ${stats.needsWork} flagged`
                : 'no ratings yet — rate outputs 👍/👎'
            }
            tone={stats.satisfaction === null ? 'default' : stats.satisfaction >= 0.6 ? 'positive' : 'warning'}
          />
        </section>

        {/* ---------- Weekly capture strip ---------- */}
        <section aria-label="Captures this week" className="rounded-lg border border-line bg-surface p-4">
          <h2 className="label-mono mb-3 text-ink-subtle">Last 7 days</h2>
          <div className="flex items-end gap-2" role="img" aria-label={`Weekly captures: ${stats.week.map((d) => `${d.day} ${d.count}`).join(', ')}`}>
            {stats.week.map((d, i) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-3xs tabular-nums text-ink-faint">{d.count || ''}</span>
                <div
                  className={cn(
                    'w-full rounded-sm transition-[height] duration-[var(--duration-base)] animate-fade-up',
                    d.count > 0 ? 'bg-accent-soft ring-1 ring-accent-line' : 'bg-canvas-deep',
                  )}
                  style={{
                    height: `${8 + (d.count / weekMax) * 56}px`,
                    animationDelay: `${i * 40}ms`,
                  }}
                  title={`${d.day}: ${d.count} capture${d.count === 1 ? '' : 's'}`}
                />
                <span className={cn('text-3xs', d.day === 'Today' ? 'font-semibold text-ink' : 'text-ink-subtle')}>{d.day}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Distributions ---------- */}
        <div className="grid gap-3 md:grid-cols-2">
          <section aria-label="Outputs by format" className="rounded-lg border border-line bg-surface p-4">
            <h2 className="label-mono mb-3 text-ink-subtle">Outputs by format</h2>
            <BarList rows={stats.byType} max={typeMax} empty="No outputs generated yet." />
          </section>
          <section aria-label="Captures by source" className="rounded-lg border border-line bg-surface p-4">
            <h2 className="label-mono mb-3 text-ink-subtle">Captures by source</h2>
            <BarList rows={stats.bySource} max={sourceMax} empty="No captures yet." />
          </section>
        </div>

        {/* ---------- Reach & filing counters ---------- */}
        <section aria-label="Output reach" className="grid grid-cols-3 gap-3">
          <StatCard icon={<Download size={13} />} label="Exported" value={String(stats.exportedOutputs)} sub="files downloaded" />
          <StatCard icon={<Share2 size={13} />} label="Shared" value={String(stats.sharedOutputs)} sub="links & share sheets" />
          <StatCard
            icon={<ThumbsDown size={13} />}
            label="Needs work"
            value={String(stats.needsWork)}
            sub="flagged for rework"
            tone={stats.needsWork > 0 ? 'warning' : 'default'}
          />
        </section>

        {/* ---------- Tag cloud ---------- */}
        <section aria-label="Tags in use" className="rounded-lg border border-line bg-surface p-4">
          <h2 className="label-mono mb-3 text-ink-subtle">Tags in use</h2>
          {stats.tagCounts.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-faint">No tags yet — add some from any thought card.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.tagCounts.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => navigate(`/app/inbox?tag=${encodeURIComponent(t.key)}`)}
                  className="rounded-full border border-line bg-canvas px-2.5 py-1 font-mono text-xs text-ink-muted transition-colors hover:border-accent-line hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Filter inbox by tag ${t.label}, ${t.count} thoughts`}
                >
                  {t.label} <span className="tabular-nums text-ink-faint">×{t.count}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <p className="pb-2 text-center font-mono text-3xs text-ink-faint">
          insights recompute live from local demo data · nothing leaves this device
        </p>
      </div>
    </div>
  )
}
