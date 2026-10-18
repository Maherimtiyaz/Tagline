/* Phase 44 — Week-over-week digest comparison coverage harness.
 * Run: npx tsx qa/phase44-digest-compare.test.ts
 * Covers: analytics.compareDigestWeeks (pure fold incl. prev resolution,
 * explicit prevKey, malformed/poisoned inputs, item counting), store
 * compareDigest delegation (no side effects: no generation, no toast,
 * no timeline growth), and end-to-end diffs over real generated digests. */

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

import { compareDigestWeeks } from '../src/lib/analytics'
import { addWeeks, isoWeekKey, weekStart } from '../src/lib/mockAI'
import { useAppStore } from '../src/lib/store'
import type { WeeklyDigest } from '../src/data/types'

let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}`); fail++ }
}

const s = () => useAppStore.getState()
const DAY = 86_400_000

/* Fixed Monday anchor: 2026-10-05. All week keys are derived from the
   engine's own isoWeekKey/addWeeks so this fixture can never drift from
   corrected ISO week math (previously hardcoded W40/W39 — stale since
   the Jan-4-anchor fix shifted this anchor to W41). */
const MON_NOON = new Date(2026, 9, 5, 12, 0, 0).getTime()
const WEEK = isoWeekKey(MON_NOON) /* 2026-W41 */
const PREV = isoWeekKey(addWeeks(MON_NOON, -1)) /* 2026-W40 */
const PREV2 = isoWeekKey(addWeeks(MON_NOON, -2)) /* 2026-W39 */
const PREV3 = isoWeekKey(addWeeks(MON_NOON, -3)) /* 2026-W38 */
const NEXT = isoWeekKey(addWeeks(MON_NOON, 1)) /* 2026-W42 */

const mk = (
  weekKey: string,
  captured: number,
  transformed: number,
  exported: number,
  items: number,
): WeeklyDigest => ({
  weekKey,
  from: 0,
  to: DAY - 1,
  generatedAt: 1000,
  headline: `${captured} captures`,
  captured,
  transformed,
  exported,
  sections: items > 0 ? [{ heading: 'S', items: Array.from({ length: items }, (_, i) => `i${i}`) }] : [],
})

console.log('Phase 44: week-over-week digest comparison')

/* ---- compareDigestWeeks: pure fold ---- */
check('null container degrades to null', compareDigestWeeks(null, WEEK) === null)
check('undefined container degrades to null', compareDigestWeeks(undefined, WEEK) === null)
check('array container rejected (poisoned payload)', compareDigestWeeks([] as never, WEEK) === null)
check('empty map → null (nothing to compare)', compareDigestWeeks({}, WEEK) === null)
check('missing current row → null', compareDigestWeeks({ [PREV]: mk(PREV, 1, 0, 0, 0) }, WEEK) === null)
check('unknown weekKey "" → null', compareDigestWeeks({ [WEEK]: mk(WEEK, 1, 0, 0, 0) }, '') === null)
check('current row with non-string weekKey dropped → null',
  compareDigestWeeks({ [WEEK]: { ...mk(WEEK, 1, 0, 0, 0), weekKey: 42 as never } }, WEEK) === null)

check('basic diff: deltas = current − previous', (() => {
  const c = compareDigestWeeks(
    { [WEEK]: mk(WEEK, 5, 2, 1, 6), [PREV]: mk(PREV, 3, 1, 2, 4) },
    WEEK,
  )
  return !!c &&
    c.prevWeekKey === PREV &&
    c.captured.delta === 2 && c.captured.current === 5 && c.captured.previous === 3 &&
    c.transformed.delta === 1 &&
    c.exported.delta === -1 &&
    c.items.delta === 2 &&
    c.busier === true
})())

check('negative deltas when the week slowed down', (() => {
  const c = compareDigestWeeks(
    { [WEEK]: mk(WEEK, 1, 0, 0, 1), [PREV]: mk(PREV, 4, 2, 3, 9) },
    WEEK,
  )
  return !!c && c.captured.delta === -3 && c.transformed.delta === -2 && c.exported.delta === -3 && !c.busier
})())

check('flat week → all-zero deltas, busier false', (() => {
  const c = compareDigestWeeks({ [WEEK]: mk(WEEK, 2, 1, 1, 3), [PREV]: mk(PREV, 2, 1, 1, 3) }, WEEK)
  return !!c && c.captured.delta === 0 && c.transformed.delta === 0 && c.exported.delta === 0 && c.items.delta === 0 && !c.busier
})())

check('prev auto-resolves to CLOSEST earlier stored week (not oldest)', (() => {
  const map = {
    [WEEK]: mk(WEEK, 5, 0, 0, 0),
    [PREV2]: mk(PREV2, 3, 0, 0, 0),
    [PREV3]: mk(PREV3, 9, 0, 0, 0),
  }
  const c = compareDigestWeeks(map, WEEK)
  return !!c && c.prevWeekKey === PREV2 && c.captured.delta === 2
})())

check('explicit prevKey overrides auto-resolution', (() => {
  const map = {
    [WEEK]: mk(WEEK, 5, 0, 0, 0),
    [PREV2]: mk(PREV2, 3, 0, 0, 0),
    [PREV3]: mk(PREV3, 9, 0, 0, 0),
  }
  const c = compareDigestWeeks(map, WEEK, PREV3)
  return !!c && c.prevWeekKey === PREV3 && c.captured.delta === -4
})())

check('explicit prevKey equal to current is ignored → auto-resolve', (() => {
  const map = { [WEEK]: mk(WEEK, 5, 0, 0, 0), [PREV]: mk(PREV, 2, 0, 0, 0) }
  const c = compareDigestWeeks(map, WEEK, WEEK)
  return !!c && c.prevWeekKey === PREV
})())

check('later weeks are never picked as prev', (() => {
  const map = { [WEEK]: mk(WEEK, 1, 0, 0, 0), [NEXT]: mk(NEXT, 8, 0, 0, 0) }
  return compareDigestWeeks(map, WEEK) === null
})())

check('non-finite stat fields invalidate the diff → null', (() => {
  const bad = { ...mk(WEEK, Number.NaN, 0, 0, 0) }
  return compareDigestWeeks({ [WEEK]: bad, [PREV]: mk(PREV, 1, 0, 0, 0) }, WEEK) === null
})())

check('stringified stats rejected → null (poisoned row)', (() => {
  const bad = { ...mk(WEEK, 3, 0, 0, 0), captured: '3' as never }
  return compareDigestWeeks({ [WEEK]: bad, [PREV]: mk(PREV, 1, 0, 0, 0) }, WEEK) === null
})())

check('null prev rows skipped during auto-resolution', (() => {
  const map = {
    [WEEK]: mk(WEEK, 4, 0, 0, 0),
    [PREV2]: null as never,
    [PREV3]: mk(PREV3, 1, 0, 0, 0),
  }
  const c = compareDigestWeeks(map, WEEK)
  return !!c && c.prevWeekKey === PREV3 && c.captured.delta === 3
})())

check('items counted across ALL sections; missing sections count 0', (() => {
  const cur = { ...mk(WEEK, 1, 0, 0, 0), sections: [
    { heading: 'A', items: ['a', 'b'] },
    { heading: 'B', items: ['c'] },
  ] }
  const c = compareDigestWeeks({ [WEEK]: cur, [PREV]: mk(PREV, 1, 0, 0, 0) }, WEEK)
  return !!c && c.items.current === 3 && c.items.previous === 0 && c.items.delta === 3
})())

check('malformed sections tolerated (non-array items → 0)', (() => {
  const cur = { ...mk(WEEK, 1, 0, 0, 0), sections: [{ heading: 'A', items: 'nope' as never }] }
  const c = compareDigestWeeks({ [WEEK]: cur, [PREV]: mk(PREV, 1, 0, 0, 0) }, WEEK)
  return !!c && c.items.current === 0
})())

check('fold is pure: repeated calls byte-equal, input untouched', (() => {
  const map = { [WEEK]: mk(WEEK, 5, 2, 1, 6), [PREV]: mk(PREV, 3, 1, 2, 4) }
  const snapshot = JSON.stringify(map)
  const a = JSON.stringify(compareDigestWeeks(map, WEEK))
  const b = JSON.stringify(compareDigestWeeks(map, WEEK))
  return a === b && JSON.stringify(map) === snapshot
})())

/* ---- store integration: compareDigest action ---- */
s().resetDemo()
check('fresh store → compareDigest null everywhere', s().compareDigest(WEEK) === null && s().compareDigest('') === null)

const g1 = s().generateDigest(addWeeks(MON_NOON, -1)) /* PREV */
const g2 = s().generateDigest(MON_NOON)               /* WEEK */
check('two real weeks generated for the e2e diff', g1.created && g2.created && g1.digest.weekKey === PREV && g2.digest.weekKey === WEEK)

const timelineLen = s().timeline.length
const toastLen = s().toasts.length
const cmp = s().compareDigest(WEEK)
check('store compare matches pure fold output exactly',
  JSON.stringify(cmp) === JSON.stringify(compareDigestWeeks(s().digests, WEEK)))
check('comparison is side-effect free (no new timeline events)', s().timeline.length === timelineLen)
check('comparison is side-effect free (no new toasts)', s().toasts.length === toastLen)
check('deltas align with the two generated digests', (() => {
  const d39 = s().digests[PREV]
  const d40 = s().digests[WEEK]
  return !!cmp &&
    cmp.captured.current === d40.captured &&
    cmp.captured.previous === d39.captured &&
    cmp.captured.delta === d40.captured - d39.captured &&
    cmp.prevWeekKey === PREV
})())

check('single-week store → compare null (no earlier baseline)', (() => {
  s().clearDigest(PREV)
  return s().compareDigest(WEEK) === null
})())

check('explicit prevKey pointing at a later week still auto-resolves safely', (() => {
  s().generateDigest(addWeeks(MON_NOON, -2)) /* PREV2 */
  const c = s().compareDigest(WEEK, NEXT) /* NEXT not stored → ignored; the only earlier stored week (PREV2) wins */
  return !!c && c.prevWeekKey === PREV2
})())

check('clearing every earlier week drops comparison again', (() => {
  s().clearDigest(PREV)
  s().clearDigest(PREV2)
  return s().compareDigest(WEEK) === null
})())

check('week math sanity under test: anchors key as expected', isoWeekKey(addWeeks(MON_NOON, -1)) === PREV && isoWeekKey(weekStart(MON_NOON)) === WEEK)

check('resetDemo wipes digests → compare null', (() => {
  s().generateDigest(MON_NOON)
  s().generateDigest(addWeeks(MON_NOON, -1))
  s().resetDemo()
  return s().compareDigest(WEEK) === null && Object.keys(s().digests).length === 0
})())

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail === 0 ? 0 : 1)
