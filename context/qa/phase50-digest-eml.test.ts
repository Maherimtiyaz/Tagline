/* Phase 50 — Digest .eml export harness.
 * Run: npx tsx qa/phase50-digest-eml.test.ts
 * Covers: formatDigestEmailClipboard (determinism, exact Subject-header
 * shape, purity), downloadDigestEmail Node-inertness + browser-shape
 * DOM flow via a minimal document/Blob/URL shim (blob MIME type, .eml
 * filename, append→click→remove lifecycle, revoke scheduled on the
 * next tick), store.downloadDigestEmailFile (stored digest → true +
 * exactly one download; ''/unknown/garbage keys → false with NO
 * download and NO generation side effect; resetDemo → false) and
 * copyDigestEmail's byte-parity with the shared formatter after the
 * Phase 50 refactor. */

const kv = new Map<string, string>()
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (kv.has(k) ? kv.get(k)! : null),
    setItem: (k: string, v: string) => void kv.set(k, String(v)),
    removeItem: (k: string) => void kv.delete(k),
    clear: () => kv.clear(),
  },
  /* The download helpers defer URL.revokeObjectURL through
     window.setTimeout; mirror the frozen global stub here so the
     revoke stays scheduled-but-unfired under this harness. */
  setTimeout: (fn: () => void) => { return 0 as unknown as ReturnType<typeof setTimeout> },
}
;(globalThis as Record<string, unknown>).localStorage = (globalThis as { window: { localStorage: unknown } }).window.localStorage

/* Toasts self-dismiss via setTimeout(…, 2600). Synchronous checks run
   back-to-back, so freeze real timers to keep behavior stable (same
   trick as the Phase 43 harness); restore before the awaited section. */
const realSetTimeout = globalThis.setTimeout
type Timer = ReturnType<typeof setTimeout>
globalThis.setTimeout = ((fn: () => void) => { return 0 as unknown as Timer }) as typeof setTimeout

import {
  addWeeks,
  buildWeeklyDigest,
  copyDigestEmail,
  digestToEmail,
  downloadDigestEmail,
  formatDigestEmailClipboard,
  formatWeekKey,
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

/* Fixed Monday anchor: 2026-10-05 → ISO week 2026-W41 (W40 starts
   Sep 28). Derived from the engine's own isoWeekKey so this fixture
   can never silently drift from a leap-year change. */
const MON_NOON = new Date(2026, 9, 5, 12, 0, 0).getTime()
const WEEK = isoWeekKey(MON_NOON) /* 2026-W41 */

console.log('Phase 50: digest .eml export')

/* ---- fixtures: engine-built digests (two weeks) ---- */
const d1 = buildWeeklyDigest(MON_NOON, s().thoughts, s().timeline, MON_NOON)
const d2 = buildWeeklyDigest(addWeeks(MON_NOON, -1), s().thoughts, s().timeline, addWeeks(MON_NOON, -1))

/* ---- formatDigestEmailClipboard: determinism & shape ---- */
check('formatDigestEmailClipboard is byte-identical across calls',
  formatDigestEmailClipboard(d1) === formatDigestEmailClipboard(d1))
check('different weeks render different clipboard texts',
  formatDigestEmailClipboard(d1) !== formatDigestEmailClipboard(d2))
check('exact shape: "Subject: <subject>\\n\\n<body>"', (() => {
  const e = digestToEmail(d1)
  return formatDigestEmailClipboard(d1) === `Subject: ${e.subject}\n\n${e.body}`
})())
check('starts with the Subject header naming the formatted week',
  formatDigestEmailClipboard(d1).startsWith(`Subject: Your Context digest — ${formatWeekKey(WEEK)}`))
check('header separated from body by exactly one blank line', (() => {
  const t = formatDigestEmailClipboard(d1)
  const nl = t.indexOf('\n')
  return t[nl + 1] === '\n' && t[nl + 2] !== '\n' && t.slice(0, nl).startsWith('Subject: ')
})())
check('formatter never mutates its input', (() => {
  const before = JSON.stringify(d1)
  formatDigestEmailClipboard(d1)
  return JSON.stringify(d1) === before
})())

/* ---- downloadDigestEmail: inert outside the browser ---- */
let threw = false
try { downloadDigestEmail(d1) } catch { threw = true }
check('download helper does not throw in Node (no document)', !threw)

/* ---- store.downloadDigestEmailFile: guards (still no DOM) ---- */
check('store action returns false for empty key', s().downloadDigestEmailFile('') === false)
check('store action returns false for unknown key', s().downloadDigestEmailFile('2030-W01') === false)
check('store action returns false for garbage key', s().downloadDigestEmailFile('garbage') === false)
check('store action returns false while no digests are stored', s().downloadDigestEmailFile(WEEK) === false)
check('failed downloads never generate a digest as a side effect',
  s().digests[WEEK] === undefined && Object.keys(s().digests).length === 0)

/* ---- browser-shape DOM harness (installed only for these checks) ---- */
interface FakeAnchor {
  tag: string
  href: string
  download: string
  clicked: number
  removed: boolean
  click(): void
  remove(): void
}
const created: FakeAnchor[] = []
const appended: FakeAnchor[] = []
const revoked: string[] = []
const blobs: { text: string; type: string }[] = []
let urlSeq = 0
const g = globalThis as Record<string, unknown>

class FakeBlob {
  constructor(parts: unknown[], opts?: { type?: string }) {
    blobs.push({ text: parts.map(String).join(''), type: opts?.type ?? '' })
  }
}
g.Blob = FakeBlob
g.URL = {
  createObjectURL: () => {
    const rec = blobs[blobs.length - 1]
    /* Encode the blob's MIME type in the fake URL so assertions can
       tie an href back to the payload it was built from. */
    return `blob:fake/${++urlSeq}?type=${encodeURIComponent(rec.type)}&len=${rec.text.length}`
  },
  revokeObjectURL: (u: string) => { revoked.push(u) },
}
g.document = {
  createElement: (tag: string): FakeAnchor => {
    const a: FakeAnchor = {
      tag, href: '', download: '', clicked: 0, removed: false,
      click() { a.clicked++ },
      remove() { a.removed = true },
    }
    created.push(a)
    return a
  },
  body: { appendChild: (n: FakeAnchor) => { appended.push(n) } },
}

downloadDigestEmail(d1)
const a1 = created[created.length - 1]
check('DOM flow creates exactly one anchor', created.length === 1 && a1.tag === 'a')
check('anchor carries the rendered email bytes with rfc822 MIME', (() => {
  const b = blobs[0]
  return !!b && b.type === 'message/rfc822;charset=utf-8' &&
    b.text === formatDigestEmailClipboard(d1) &&
    a1.href.includes(encodeURIComponent(b.type)) &&
    a1.href.includes(`len=${b.text.length}`)
})())
check('download attribute names context-weekly-digest-<weekKey>.eml',
  a1.download === `context-weekly-digest-${WEEK}.eml`)
check('anchor appended to body, clicked once, then removed',
  appended.length === 1 && appended[0] === a1 && a1.clicked === 1 && a1.removed === true)
check('revoke is deferred through setTimeout (frozen stub ⇒ not yet run)',
  revoked.length === 0)

/* Deterministic second call for the previous week */
created.length = 0; appended.length = 0; blobs.length = 0
downloadDigestEmail(d2)
const a2 = created[0]
check('second download targets the previous week key with identical bytes',
  a2.download === `context-weekly-digest-${d2.weekKey}.eml` &&
  blobs[0].text === formatDigestEmailClipboard(d2))

/* ---- store action happy path against the DOM shim ---- */
const gen = s().generateDigest(MON_NOON)
check('fixture: digest generated into the store for the anchor week',
  gen.created && gen.digest.weekKey === WEEK && s().digests[WEEK] !== undefined)
created.length = 0; appended.length = 0; blobs.length = 0
const dlOk = s().downloadDigestEmailFile(WEEK)
check('store action returns true for a stored week', dlOk === true)
check('store action triggers exactly one .eml download of the STORED digest', (() => {
  const a = created[0]
  return created.length === 1 && blobs.length === 1 &&
    a.download === `context-weekly-digest-${WEEK}.eml` &&
    blobs[0].text === formatDigestEmailClipboard(s().digests[WEEK])
})())
check('store action never regenerates (no extra digest timeline events)', (() => {
  const before = s().timeline.filter((e) => e.kind === 'digest').length
  s().downloadDigestEmailFile(WEEK)
  return s().timeline.filter((e) => e.kind === 'digest').length === before
})())

/* ---- resetDemo drops the map → action goes back to false ---- */
s().resetDemo()
created.length = 0; blobs.length = 0
check('after resetDemo the action returns false and downloads nothing',
  s().downloadDigestEmailFile(WEEK) === false && created.length === 0 && blobs.length === 0)

/* ---- teardown: remove DOM shims so later sections see pure Node ---- */
delete g.document
delete g.Blob
delete g.URL

/* ---- copyDigestEmail parity with the shared formatter (async) ---- */
globalThis.setTimeout = realSetTimeout // restore timers before awaiting
async function runClipboardChecks() {
  let written = ''
  g.navigator = { clipboard: { writeText: async (t: string) => { written = t } } }
  const ok = await copyDigestEmail(d2)
  check('copyDigestEmail writes EXACTLY formatDigestEmailClipboard output',
    ok && written === formatDigestEmailClipboard(d2))
  g.navigator = { clipboard: { writeText: async () => { throw new Error('denied') } } }
  check('copyDigestEmail still resolves false on rejection', (await copyDigestEmail(d2)) === false)
  delete g.navigator
}
await runClipboardChecks()

/* ---- summary ---- */
console.log(`\n${pass}/${pass + fail} checks passed`)
if (fail > 0) process.exit(1)
