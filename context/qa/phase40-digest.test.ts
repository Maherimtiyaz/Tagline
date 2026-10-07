/* Phase 40 — Weekly digest harness. Run: npx tsx qa/phase40-digest.test.ts
   Exercises the pure rollup (buildWeeklyDigest, dominantSignal, isoWeekKey)
   and the store action generateWeeklyDigest against a fake localStorage. */
import { buildWeeklyDigest, dominantSignal } from '../src/lib/mockAI'
import { isoWeekKey, useAppStore } from '../src/lib/store'
import type { Thought, TypeSignal } from '../src/data/types'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.error(`  ✗ ${name}`) }
}
const S = () => useAppStore.getState()

/* ---- fake browser environment (same pattern as phase31 harness) -------- */
const lsMap = new Map<string, string>()
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => lsMap.get(k) ?? null,
    setItem: (k: string, v: string) => void lsMap.set(k, String(v)),
    removeItem: (k: string) => void lsMap.delete(k),
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 7, 12) // Wed 2026-10-07
const thought = (over: Partial<Thought>): Thought => ({
  id: 't', text: 'x', source: 'text', createdAt: NOW, status: 'raw', outputs: [],
  ...over,
})

/* ---------- isoWeekKey ---------- */
ok('isoWeekKey known date 2026-10-07 -> W41', isoWeekKey(Date.UTC(2026, 9, 7)) === '2026-W41')
ok('isoWeekKey 2021-01-01 -> W53 of 2020', isoWeekKey(Date.UTC(2021, 0, 1)) === '2020-W53')
ok('isoWeekKey 2021-01-04 -> W01 of 2021', isoWeekKey(Date.UTC(2021, 0, 4)) === '2021-W01')
ok('isoWeekKey 2026-12-31 -> W53 of 2026', isoWeekKey(Date.UTC(2026, 11, 31)) === '2026-W53')
ok('isoWeekKey default arg works', /^\d{4}-W\d{2}$/.test(isoWeekKey()))

/* ---------- dominantSignal ---------- */
ok('dominant empty -> null', dominantSignal([]) === null)
ok('dominant undefined -> null', dominantSignal(undefined) === null)
ok('dominant all-zero -> null', dominantSignal([{ type: 'email', score: 0 }]) === null)
ok('dominant picks largest |score|', dominantSignal([{ type: 'email', score: 1 }, { type: 'tasks', score: -2 }])?.type === 'tasks')
ok('dominant clamps before comparing', dominantSignal([{ type: 'email', score: 99 }, { type: 'tasks', score: 3 }])?.type === 'email')

/* ---------- buildWeeklyDigest (pure) ---------- */
const rows: Thought[] = [
  thought({ id: 'a', createdAt: NOW - 1 * DAY, status: 'processed', starred: true,
    outputs: [{ id: 'o1', type: 'email', title: '', body: '', createdAt: NOW, tone: 'professional', feedback: { rating: 'helpful', at: NOW } },
              { id: 'o2', type: 'tasks', title: '', body: '', createdAt: NOW, tone: 'professional' }] }),
  thought({ id: 'b', createdAt: NOW - 3 * DAY, outputs: [{ id: 'o3', type: 'email', title: '', body: '', createdAt: NOW, tone: 'professional' }] }),
  thought({ id: 'c', createdAt: NOW - 10 * DAY }), // prev week only
  thought({ id: 'd', createdAt: NOW - 20 * DAY }), // older than both windows
  thought({ id: 'e', createdAt: Number.NaN }),      // garbage timestamp -> counted this week
]
const d = buildWeeklyDigest(rows, [{ type: 'email', score: 2 }], NOW)
ok('stats Captured counts this-week + undated', d.stats[0].value === 3)
ok('stats Processed', d.stats[1].value === 1)
ok('stats Outputs total', d.stats[2].value === 3)
ok('stats Starred', d.stats[3].value === 1)
ok('topTypes ranked by count desc', d.topTypes[0].type === 'email' && d.topTypes[0].count === 2)
ok('topTypes fold learned score', d.topTypes[0].score === 2)
ok('insights mention improvement vs prev week', d.insights.some((i) => i.text.includes('up from 1')))
ok('insights include preference line', d.insights.some((i) => i.text.includes('prefer Email')))
ok('insights include helpful ratio', d.insights.some((i) => i.text.includes('1/1 rated')))
ok('body is markdown with heading', d.body.startsWith('# Your Context Week'))
ok('body lists top types', d.body.includes('- Email ×2'))
ok('weekOf is ISO date', /^\d{4}-\d{2}-\d{2}$/.test(d.weekOf))

const quiet = buildWeeklyDigest([], [], NOW)
ok('empty inbox -> single quiet-week insight', quiet.insights.length === 1 && quiet.insights[0].text.includes('Quiet week'))
ok('empty inbox stats all zero', quiet.stats.every((s) => s.value === 0))
const neg = buildWeeklyDigest(rows, [{ type: 'email', score: -2 }], NOW)
ok('negative signal uses warning tone', neg.insights.some((i) => i.tone === 'warning' && i.text.includes('needs work')))

/* ---------- store action: create / idempotent refresh ---------- */
S().resetDemo()
const baseCount = S().thoughts.length
const id1 = S().generateWeeklyDigest()
ok('digest created on seeded demo', typeof id1 === 'string' && id1 !== '')
ok('digest row exists with digest source', S().thoughts.some((t) => t.id === id1 && t.source === 'digest'))
ok('digest row transformed to processed with summary output', (() => {
  const t = S().thoughts.find((x) => x.id === id1)!
  return t.status === 'processed' && t.outputs[0]?.type === 'summary'
})())
ok('digest embeds current iso week marker', S().thoughts.find((t) => t.id === id1)!.text.includes(`week:${isoWeekKey()}`))
ok('timeline recorded capture + transform', S().timeline.filter((e) => e.thoughtId === id1).length >= 2)

const id2 = S().generateWeeklyDigest()
ok('same-week rerun returns same id', id2 === id1)
ok('same-week rerun does not duplicate rows', S().thoughts.filter((t) => t.source === 'digest').length === 1)
ok('rerun adds another summary output version row', (S().thoughts.find((t) => t.id === id1)?.outputs.length ?? 0) >= 2)
ok('row count grew by exactly one overall', S().thoughts.length === baseCount + 1)

/* reset clears digests too (seed state has none) */
S().resetDemo()
ok('resetDemo removes digest row', !S().thoughts.some((t) => t.source === 'digest'))

/* persistence round-trip: digest survives serialize */
S().generateWeeklyDigest()
const raw = lsMap.get('context-demo-state-v1')
ok('persist envelope written', !!raw)
ok('digest present in persisted payload', !!raw && JSON.parse(raw).state.thoughts.some((t: Thought) => t.source === 'digest'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
