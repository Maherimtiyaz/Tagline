/* Phase 43 — Digest email rendering + batch backfill harness.
 * Run: npx tsx qa/phase43-digest-email-batch.test.ts
 * Covers: digestToEmail (determinism, subject/body structure, purity),
 * copyDigestEmail (Node-inert + clipboard success/failure paths),
 * generateDigestBatch pure walker (cap/clamps/injection/de-dupe keys),
 * store.generateDigestBatch (idempotency, toast semantics, timeline
 * events once per week, cap 12) and getDigestEmail (no side effects).
 * Node has no localStorage; we shim a minimal one BEFORE importing. */

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

/* Toasts self-dismiss via setTimeout(…, 2600). Synchronous checks run
   back-to-back, so freeze real timers to keep the toast log stable;
   restore before the awaited clipboard section. */
const realSetTimeout = globalThis.setTimeout
type Timer = ReturnType<typeof setTimeout>
const deferred: Array<() => void> = []
globalThis.setTimeout = ((fn: () => void) => { deferred.push(fn); return 0 as unknown as Timer }) as typeof setTimeout

import {
  addWeeks,
  buildWeeklyDigest,
  copyDigestEmail,
  digestToEmail,
  formatWeekKey,
  generateDigestBatch,
  isoWeekKey,
} from '../src/lib/mockAI'
import { useAppStore } from '../src/lib/store'


let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}`); fail++ }
}

const s = () => useAppStore.getState()

/* Fixed Monday anchor: 2026-10-05 → ISO week 2026-W40. */
const MON_NOON = new Date(2026, 9, 5, 12, 0, 0).getTime()
const WEEK = '2026-W40'

console.log('Phase 43: digest email + batch backfill')

/* ---- fixture digests (engine-built, two different weeks) ---- */
const d1 = buildWeeklyDigest(MON_NOON, s().thoughts, s().timeline, MON_NOON)
const d2 = buildWeeklyDigest(addWeeks(MON_NOON, -1), s().thoughts, s().timeline, addWeeks(MON_NOON, -1))

/* ---- digestToEmail: determinism & structure ---- */
check('digestToEmail is byte-identical across calls', (() => {
  const a = digestToEmail(d1)
  const b = digestToEmail(d1)
  return a.subject === b.subject && a.body === b.body
})())
check('different weeks render different emails', (() => {
  const a = digestToEmail(d1)
  const b = digestToEmail(d2)
  return a.subject !== b.subject && a.body !== b.body
})())
check('subject names the formatted week', digestToEmail(d1).subject === `Your Context digest — ${formatWeekKey(WEEK)}`)
check('body opens with greeting + recap line', (() => {
  const body = digestToEmail(d1).body
  return body.startsWith('Hi there,\n\n') && body.includes(`Here's your weekly recap for ${formatWeekKey(WEEK)}`)
})())
check('headline is framed by rule lines', (() => {
  const lines = digestToEmail(d1).body.split('\n')
  const i = lines.indexOf(d1.headline)
  return i > 0 && lines[i - 1] === lines[i + 1] && lines[i - 1].startsWith('─')
})())
check('stats row present with labels', (() => {
  const body = digestToEmail(d1).body
  return (
    body.includes(`Captured:    ${d1.captured}`) &&
    body.includes(`Transformed: ${d1.transformed}`) &&
    body.includes(`Exported:    ${d1.exported}`)
  )
})())
check('every section heading uppercased with bulleted items', (() => {
  const body = digestToEmail(d1).body
  return d1.sections.every((sec) => {
    if (!body.includes(sec.heading.toUpperCase())) return false
    return sec.items.every((it) => body.includes(`  • ${it}`))
  })
})())
check('privacy footer + generatedAt ISO stamp end the body', (() => {
  const lines = digestToEmail(d1).body.split('\n')
  return (
    lines[lines.length - 1] === new Date(d1.generatedAt).toISOString() &&
    lines.some((l) => l.includes('your thoughts never leave this device'))
  )
})())
check('email contains no markdown syntax', (() => {
  const body = digestToEmail(d1).body
  return !/^#/m.test(body) && !body.includes('**') && !body.includes('_Generated')
})())
check('digestToEmail never mutates its input', (() => {
  const before = JSON.stringify(d1)
  digestToEmail(d1)
  return JSON.stringify(d1) === before
})())

/* ---- copyDigestEmail (async section runs last, before the summary) ---- */
async function runClipboardChecks() {
  const g = globalThis as Record<string, unknown>
  /* Node default: navigator undefined → inert false. */
  if (g.navigator === undefined) {
    check('copyDigestEmail inert without navigator.clipboard', (await copyDigestEmail(d1)) === false)
  } else {
    const saved = g.navigator
    delete g.navigator
    check('copyDigestEmail inert without navigator.clipboard', (await copyDigestEmail(d1)) === false)
    g.navigator = saved
  }
  let written = ''
  g.navigator = { clipboard: { writeText: async (t: string) => { written = t } } }
  const ok = await copyDigestEmail(d1)
  const e = digestToEmail(d1)
  check('copyDigestEmail true + writes "Subject: …\\n\\n<body>"', ok && written === `Subject: ${e.subject}\n\n${e.body}`)
  g.navigator = { clipboard: { writeText: async () => { throw new Error('denied') } } }
  const denied = await copyDigestEmail(d1)
  check('copyDigestEmail resolves false on clipboard rejection', denied === false)
  delete g.navigator
}

/* ---- generateDigestBatch (pure walker, injected spy) ---- */
check('batch of 4 walks newest-first whole weeks', (() => {
  const seen: number[] = []
  const res = generateDigestBatch(4, MON_NOON, (ts) => {
    seen.push(ts!)
    const d = buildWeeklyDigest(ts!, [], [], ts!)
    return { digest: d, created: true }
  })
  return (
    res.length === 4 &&
    res[0].weekKey === WEEK &&
    res[1].weekKey === isoWeekKey(addWeeks(MON_NOON, -1)) &&
    seen.every((ts) => ts === addWeeks(MON_NOON, -seen.indexOf(ts)))
  )
})())
check('batch caps at 12 requests', generateDigestBatch(50, MON_NOON, (ts) => ({ digest: buildWeeklyDigest(ts!, [], [], ts!), created: true })).length === 12)
check('batch clamps count <= 0 to empty', generateDigestBatch(0, MON_NOON, () => { throw new Error('must not call') }).length === 0 && generateDigestBatch(-3, MON_NOON, () => { throw new Error('must not call') }).length === 0)
check('fractional counts floor down', generateDigestBatch(2.9, MON_NOON, (ts) => ({ digest: buildWeeklyDigest(ts!, [], [], ts!), created: true })).length === 2)
check('existing weeks report created:false untouched', (() => {
  const res = generateDigestBatch(3, MON_NOON, (ts) => ({ digest: buildWeeklyDigest(ts!, [], [], ts!), created: false }))
  return res.length === 3 && res.every((r) => r.created === false)
})())
check('week keys in results are unique (whole-week steps)', (() => {
  const res = generateDigestBatch(8, MON_NOON, (ts) => ({ digest: buildWeeklyDigest(ts!, [], [], ts!), created: true }))
  return new Set(res.map((r) => r.weekKey)).size === 8
})())

/* ---- store: generateDigestBatch ---- */
s().resetDemo()
check('store batch creates 4 fresh weeks + one summary toast', (() => {
  const before = s().toasts.length
  const r = s().generateDigestBatch(4, MON_NOON)
  const after = s().toasts
  return (
    r.created === 4 && r.total === 4 &&
    Object.keys(s().digests).length === 4 &&
    /* per-week generateDigest toasts + exactly one new summary toast */
    after.length >= before + 1 &&
    after[after.length - 1].message.includes('Backfilled 4 digests · 4 stored')
  )
})())
check('second identical batch is a pure no-op (0 created, no toast)', (() => {
  const before = s().toasts.length
  const tlBefore = s().timeline.length
  const r = s().generateDigestBatch(4, MON_NOON)
  return r.created === 0 && r.total === 4 && s().toasts.length === before && s().timeline.length === tlBefore
})())
check('each created week logged exactly one digest timeline event', (() => {
  const evs = s().timeline.filter((e) => e.kind === 'digest')
  const keys = evs.map((e) => e.label!.replace('Weekly digest · ', ''))
  return evs.length === 4 && new Set(keys).size === 4 && keys.every((k) => k in s().digests)
})())
check('mixed backfill reports only the new weeks', (() => {
  /* Batch(4) produced W37..W40; ask for 6 ending at W40 → W35,W36 new (2). */
  const r = s().generateDigestBatch(6, MON_NOON)
  return r.created === 2 && r.total === 6
})())
check('count 0 / negative create nothing and toast nothing', (() => {
  const before = s().toasts.length
  const r0 = s().generateDigestBatch(0, MON_NOON)
  const rn = s().generateDigestBatch(-2, MON_NOON)
  return r0.created === 0 && rn.created === 0 && s().toasts.length === before
})())
check('store batch honors cap 12', (() => {
  s().resetDemo()
  const r = s().generateDigestBatch(20, MON_NOON)
  return r.created === 12 && Object.keys(s().digests).length === 12
})())

/* ---- store: getDigestEmail ---- */
check('getDigestEmail renders the STORED digest deterministically', (() => {
  s().resetDemo()
  const { digest } = s().generateDigest(MON_NOON)
  const e = s().getDigestEmail(WEEK)
  const direct = digestToEmail(digest)
  return !!e && e.subject === direct.subject && e.body === direct.body
})())
check('getDigestEmail returns null for unknown key', s().getDigestEmail('2030-W01') === null)
check('getDigestEmail returns null for empty/garbage keys', s().getDigestEmail('') === null && s().getDigestEmail('garbage') === null)
check('getDigestEmail never generates as a side effect', (() => {
  const before = Object.keys(s().digests).length
  s().getDigestEmail(isoWeekKey(addWeeks(MON_NOON, -3)))
  return Object.keys(s().digests).length === before
})())

/* ---- persistence round-trip of batch output ---- */
check('persisted payload carries all 3 batch weeks', (() => {
  s().resetDemo()
  s().generateDigestBatch(3, MON_NOON)
  const key = [...kv.keys()].find((k) => k.includes('context'))
  if (!key) return false
  const parsed = JSON.parse(kv.get(key)!)
  const stored = parsed.state?.digests ?? parsed.digests
  return !!stored && Object.keys(stored).length === 3
})())

/* Clipboard checks run last (they mutate globalThis.navigator). */
globalThis.setTimeout = realSetTimeout // restore timers before awaiting
await runClipboardChecks()

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail > 0 ? 1 : 0)
