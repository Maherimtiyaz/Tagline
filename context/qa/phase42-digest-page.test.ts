/* Phase 42 — Digest page & Insights coverage harness.
 * Run: npx tsx qa/phase42-digest-page.test.ts
 * Covers: weekStartFromKey (pure inverse of isoWeekKey), recentDigestStats
 * (pure fold over the digests map incl. poisoned-input guards), and the
 * store integration the Digest page relies on (generate → hasWeek true,
 * clear → false, idempotency visible through the stats layer). */

const kv = new Map<string, string>()
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (kv.has(k) ? kv.get(k)! : null),
    setItem: (k: string, v: string) => void kv.set(k, String(v)),
    removeItem: (k: string) => void kv.delete(k),
    clear: () => kv.clear(),
  },
}
;(globalThis as Record<string, unknown>).localStorage = (globalThis as { window: { localStorage: unknown } }).window.localStorage

import { recentDigestStats } from '../src/lib/analytics'
import { addWeeks, formatWeekKey, isoWeekKey, recentWeekKeys } from '../src/lib/mockAI'
import { useAppStore } from '../src/lib/store'
import type { WeeklyDigest } from '../src/data/types'
import { weekStartFromKey } from '../src/features/digest/DigestPage'

let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const s = () => useAppStore.getState()
const DAY = 86_400_000

/* Fixed Monday anchor: 2026-10-05 → ISO week 2026-W40. */
const MON_NOON = new Date(2026, 9, 5, 12, 0, 0).getTime()
const WEEK = '2026-W40'

console.log('Phase 42: digest page helpers + insights coverage')

/* ---- weekStartFromKey: exact inverse of isoWeekKey ---- */
check('weekStartFromKey returns local Monday 00:00', (() => {
  const d = new Date(weekStartFromKey(WEEK))
  return d.getDay() === 1 && d.getHours() === 0 && d.getMinutes() === 0 && d.getDate() === 5 && d.getMonth() === 9
})())
check('isoWeekKey(weekStartFromKey(k)) === k for W40', isoWeekKey(weekStartFromKey(WEEK)) === WEEK)
check('round-trip holds across 30 consecutive weeks', (() => {
  for (let i = 0; i < 30; i++) {
    const key = isoWeekKey(addWeeks(MON_NOON, -i))
    if (isoWeekKey(weekStartFromKey(key)) !== key) return false
  }
  return true
})())
check('round-trip holds into past ISO years (W53 boundary)', (() => {
  /* 2027-01-01 is a Friday → keys as 2026-W53. */
  const late = new Date(2027, 0, 1, 9).getTime()
  const key = isoWeekKey(late)
  return key === '2026-W53' && isoWeekKey(weekStartFromKey(key)) === key
})())
check('malformed key falls back to provided now (never throws)', weekStartFromKey('garbage', 1234) === 1234)
check('empty-string key falls back too', weekStartFromKey('', 999) === 999)
check('weekStartFromKey output feeds addWeeks cleanly', (() => {
  const mon = weekStartFromKey(WEEK)
  return addWeeks(mon, 1) - mon === DAY && isoWeekKey(addWeeks(mon, 1)) === '2026-W41'
})())

/* ---- recentDigestStats: pure fold ---- */
const mk = (weekKey: string, captured: number, generatedAt: number): WeeklyDigest => ({
  weekKey, from: generatedAt - DAY, to: generatedAt, generatedAt,
  headline: `${captured} captures`, captured, transformed: 0, exported: 0, sections: [],
})
check('empty map → zeros, null lastGeneratedAt, hasWeek false', (() => {
  const st = recentDigestStats({})
  return st.total === 0 && st.coveredThoughts === 0 && st.lastGeneratedAt === null && !st.hasWeek(WEEK)
})())
check('undefined input degrades to empty stats', recentDigestStats(undefined).total === 0)
check('null input degrades to empty stats', recentDigestStats(null).total === 0)
check('array container rejected (poisoned payload)', recentDigestStats([] as never).total === 0)
check('counts + coverage sum across rows', (() => {
  const st = recentDigestStats({
    '2026-W40': mk('2026-W40', 3, 1000),
    '2026-W39': mk('2026-W39', 5, 2000),
  })
  return st.total === 2 && st.coveredThoughts === 8 && st.lastGeneratedAt === 2000
})())
check('hasWeek true only for stored keys', (() => {
  const st = recentDigestStats({ '2026-W40': mk('2026-W40', 1, 5) })
  return st.hasWeek('2026-W40') && !st.hasWeek('2026-W39') && !st.hasWeek('')
})())
check('null rows dropped', recentDigestStats({ x: null as never, y: mk('y', 2, 9) }).total === 1)
check('rows with non-string weekKey dropped', recentDigestStats({ x: { ...mk('x', 1, 1), weekKey: 42 as never } }).total === 0)
check('rows with non-number captured dropped', recentDigestStats({ x: { ...mk('x', 1, 1), captured: '3' as never } }).total === 0)
check('missing generatedAt tolerated (lastGeneratedAt stays null)', (() => {
  const d = mk('2026-W40', 4, 0)
  delete (d as Partial<WeeklyDigest>).generatedAt
  const st = recentDigestStats({ '2026-W40': d as WeeklyDigest })
  return st.total === 1 && st.coveredThoughts === 4 && st.lastGeneratedAt === null
})())
check('stats are recomputed per call — no shared mutable state', (() => {
  const map = { '2026-W40': mk('2026-W40', 1, 1) }
  const a = recentDigestStats(map)
  map['2026-W39'] = mk('2026-W39', 2, 2)
  const b = recentDigestStats(map)
  return a.total === 1 && b.total === 2
})())

/* ---- store integration: what the Digest page actually calls ---- */
s().resetDemo()
check('fresh store → no digests, rail all-missing', (() => {
  const st = recentDigestStats(s().digests)
  const rail = recentWeekKeys(MON_NOON, 8).map((k) => st.hasWeek(k))
  return st.total === 0 && rail.every((h) => !h)
})())

const gen = s().generateDigest(MON_NOON)
check('generateDigest stores under isoWeekKey(anchor)', s().digests[WEEK] !== undefined && gen.digest.weekKey === WEEK)
check('after generate → hasWeek(week) true, covered == captured', (() => {
  const st = recentDigestStats(s().digests)
  return st.hasWeek(WEEK) && st.total === 1 && st.coveredThoughts === gen.digest.captured
})())
check('lastGeneratedAt reflects the stored digest', recentDigestStats(s().digests).lastGeneratedAt === gen.digest.generatedAt)

/* Second week, older, via the page's own navigation math. */
const prevMon = weekStartFromKey('2026-W39')
const gen2 = s().generateDigest(prevMon)
check('older week generates independently (created=true)', gen2.created && gen2.digest.weekKey === '2026-W39')
check('stats aggregate both weeks', (() => {
  const st = recentDigestStats(s().digests)
  return st.total === 2 && st.hasWeek('2026-W39') && st.hasWeek(WEEK)
})())

const tlCountBefore = s().timeline.length
const again = s().generateDigest(MON_NOON)
check('regenerating same week is a no-op (created=false)', !again.created && again.digest === s().digests[WEEK])
check('no-op adds no timeline event', s().timeline.length === tlCountBefore)

check('clearDigest flips hasWeek back to false', (() => {
  s().clearDigest(WEEK)
  return !recentDigestStats(s().digests).hasWeek(WEEK) && recentDigestStats(s().digests).total === 1
})())
check('formatWeekKey renders rail labels without throwing', formatWeekKey('2026-W39') === 'Week 39 · 2026')

s().resetDemo()
check('resetDemo wipes digests → stats zeroed', recentDigestStats(s().digests).total === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
