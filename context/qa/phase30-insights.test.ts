/* Phase 30 — Insights aggregation harness. Run: npx tsx qa/phase30-insights.test.ts
   Exercises the pure computeInsights reducer against synthetic fixtures,
   then a live store-driven pass (transform → rate → version) to prove the
   dashboard numbers track real demo actions. */
import { computeInsights, pct } from '../src/lib/analytics'
import type { GeneratedOutput, Thought, TimelineEvent } from '../src/data/types'
import { useAppStore } from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.error(`  ✗ ${name}`) }
}
const S = () => useAppStore.getState()

const DAY = 86_400_000
const NOW = Date.now()

function out(partial: Partial<GeneratedOutput> & Pick<GeneratedOutput, 'id' | 'type'>): GeneratedOutput {
  return { title: 't', body: 'b', createdAt: NOW, tone: 'professional', ...partial }
}
function thought(partial: Partial<Thought> & Pick<Thought, 'id'>): Thought {
  return { text: 'x', source: 'text', createdAt: NOW, status: 'raw', outputs: [], ...partial }
}
function ev(partial: Partial<TimelineEvent> & Pick<TimelineEvent, 'id' | 'kind'>): TimelineEvent {
  return { thoughtId: 'a', at: NOW, label: 'l', ...partial }
}

console.log('Phase 30: insights aggregation')

/* ---------- empty inputs ---------- */
{
  const i = computeInsights([], [], NOW)
  ok('empty: totalThoughts 0', i.totalThoughts === 0)
  ok('empty: transformRate 0 (no div-by-zero)', i.transformRate === 0)
  ok('empty: satisfaction null', i.satisfaction === null)
  ok('empty: week has 7 buckets', i.week.length === 7)
  ok('empty: week all zero', i.week.every((d) => d.count === 0))
  ok('empty: last bucket labeled Today', i.week[6].day === 'Today')
  ok('empty: distributions empty', i.bySource.length === 0 && i.byType.length === 0 && i.tagCounts.length === 0)
}

/* ---------- funnel + counts ---------- */
{
  const thoughts = [
    thought({ id: 'a', starred: true, pinned: true, tags: ['Launch', 'client comms'], outputs: [
      out({ id: 'o1', type: 'email', feedback: { rating: 'helpful', at: NOW } }),
      out({ id: 'o2', type: 'slack', versions: [{ id: 'v1', at: NOW, label: 'L', body: 'b', tone: 'friendly' }] }),
    ] }),
    thought({ id: 'b', source: 'voice', createdAt: NOW - 2 * DAY, outputs: [
      out({ id: 'o3', type: 'email', feedback: { rating: 'needs-work', at: NOW } }),
    ] }),
    thought({ id: 'c', source: 'voice', createdAt: NOW - 9 * DAY, tags: ['launch'], outputs: [] }),
    thought({ id: 'd', status: 'archived', outputs: [out({ id: 'o4', type: 'plan' })] }),
  ]
  const timeline = [
    ev({ id: 'e1', kind: 'save' }),
    ev({ id: 'e2', kind: 'export' }),
    ev({ id: 'e3', kind: 'export' }),
    ev({ id: 'e4', kind: 'share' as TimelineEvent['kind'] }),
  ]
  const i = computeInsights(thoughts, timeline, NOW)

  ok('funnel: 4 thoughts / 3 transformed', i.totalThoughts === 4 && i.transformed === 3)
  ok('funnel: rate = 0.75', Math.abs(i.transformRate - 0.75) < 1e-9)
  ok('outputs: 4 total', i.totalOutputs === 4)
  ok('feedback: 1 helpful, 1 needs-work, satisfaction 50%', i.helpful === 1 && i.needsWork === 1 && Math.abs((i.satisfaction ?? 0) - 0.5) < 1e-9)
  ok('versioned outputs counted', i.versionedOutputs === 1)
  ok('star/pin counted', i.starred === 1 && i.pinned === 1)
  ok('timeline counters: save/export/share', i.savedOutputs === 1 && i.exportedOutputs === 2 && i.sharedOutputs === 1)

  /* byType sorted desc; email(2) first */
  ok('byType desc order', i.byType[0].key === 'email' && i.byType[0].count === 2 && i.byType[0].label === 'Email')
  ok('byType includes plan', i.byType.some((r) => r.key === 'plan' && r.count === 1))
  /* bySource: voice(2) > text(1) > … */
  ok('bySource voice leads with label', i.bySource[0].key === 'voice' && i.bySource[0].count === 2 && i.bySource[0].label === 'Voice')

  /* tags normalized case-insensitively: Launch + launch merge → 2 */
  ok('tagCounts merges case', i.tagCounts[0].key === 'launch' && i.tagCounts[0].count === 2 && i.tagCounts[0].label === '#launch')

  /* weekly strip: a,d today; b two days ago; c outside window */
  const todayBucket = i.week[6], twoAgo = i.week[4]
  ok('week: today bucket has 2 captures', todayBucket.count === 2)
  ok('week: two-days-ago bucket has 1', twoAgo.count === 1)
  ok('week: stale capture excluded', i.week.reduce((n, d) => n + d.count, 0) === 3)
}

/* ---------- midnight boundary ---------- */
{
  // 23:59 yesterday and 00:01 today must land in different buckets
  const d1 = new Date(NOW); d1.setHours(23, 59, 0, 0); d1.setDate(d1.getDate() - 1)
  const d2 = new Date(NOW); d2.setHours(0, 1, 0, 0)
  const i = computeInsights(
    [thought({ id: 'x', createdAt: d1.getTime() }), thought({ id: 'y', createdAt: d2.getTime() })],
    [], NOW,
  )
  ok('boundary: yesterday 23:59 in day-6 bucket', i.week[5].count === 1)
  ok('boundary: today 00:01 in Today bucket', i.week[6].count === 1)
}

/* ---------- pct formatter ---------- */
ok('pct rounds', pct(0.666) === '67%' && pct(1) === '100%' && pct(0) === '0%')
ok('pct null → dash', pct(null) === '—')

/* ---------- live store pass ---------- */
{
  S().resetDemo()
  const before = computeInsights(S().thoughts, S().timeline)
  const id = S().addThought('Need to ship the billing migration notes to finance before Friday review')
  let after = computeInsights(S().thoughts, S().timeline)
  ok('store: capture increments totalThoughts', after.totalThoughts === before.totalThoughts + 1)
  ok('store: new raw thought not yet transformed', after.transformed === before.transformed)

  const o = S().transform(id, 'email')
  after = computeInsights(S().thoughts, S().timeline)
  ok('store: transform increments transformed + outputs', after.transformed === before.transformed + 1 && after.totalOutputs === before.totalOutputs + 1)
  ok('store: email appears in byType', after.byType.some((r) => r.key === 'email'))

  S().rateOutput(id, o.id, 'helpful')
  after = computeInsights(S().thoughts, S().timeline)
  ok('store: 👍 reflected in satisfaction numerator', after.helpful === before.helpful + 1)

  S().saveVersion(id, o.id, 'Checkpoint')
  after = computeInsights(S().thoughts, S().timeline)
  ok('store: manual version makes output versioned', after.versionedOutputs === before.versionedOutputs + 1)

  S().toggleStar(id)
  after = computeInsights(S().thoughts, S().timeline)
  ok('store: star count tracks toggle', after.starred === before.starred + 1)

  /* Seeds hold 3 text / 2 voice captures; our added thought is text → 4. */
  const typed = after.bySource.find((r) => r.key === 'text')
  ok('store: bySource counts track new capture (text 3→4)', typed?.count === before.bySource.find((r) => r.key === 'text')!.count + 1 && typed?.label === 'Typed')
  ok('store: bySource sorted desc', after.bySource.every((r, i) => i === 0 || after.bySource[i - 1].count >= r.count))

  S().resetDemo()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
