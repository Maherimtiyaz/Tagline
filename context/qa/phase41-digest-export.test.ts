/* Phase 41 — Digest export, week math & persistence harness.
 * Run: npx tsx qa/phase41-digest-export.test.ts
 * Node has no localStorage; we shim a minimal one BEFORE importing the store. */

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

import {
  addWeeks,
  buildWeeklyDigest,
  digestToMarkdown,
  downloadDigestMarkdown,
  formatWeekKey,
  isoWeekKey,
  recentWeekKeys,
  weekStart,
} from '../src/lib/mockAI'
import { pullRemoteState, readPersistedDomain, useAppStore } from '../src/lib/store'
import type { WeeklyDigest } from '../src/data/types'

let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const s = () => useAppStore.getState()
const DAY = 86_400_000
const DOMAIN_KEY = 'context-demo-state-v1'

/* Fixed Monday anchor: 2026-10-05 12:00 local → ISO week 2026-W40. */
const MON_NOON = new Date(2026, 9, 5, 12, 0, 0).getTime()
const WEEK = '2026-W40'
const PREV_WEEK = '2026-W39'

console.log('Phase 41: digest export, week math, persistence')

/* ---- weekStart / addWeeks ---- */
check('weekStart anchors to Monday 00:00 local', (() => {
  const ws = new Date(weekStart(MON_NOON))
  return ws.getDay() === 1 && ws.getHours() === 0 && ws.getMinutes() === 0 && ws.getDate() === 5
})())
check('addWeeks(+1) lands exactly 7 days later (same anchor)', addWeeks(MON_NOON, 1) - weekStart(MON_NOON) === 7 * DAY)
check('addWeeks(-1) walks back one week', isoWeekKey(addWeeks(MON_NOON, -1)) === PREV_WEEK)
check('addWeeks re-anchors: nested calls stay Mon 00:00', (() => {
  const twice = addWeeks(addWeeks(MON_NOON, 3), -1)
  const d = new Date(twice)
  return d.getDay() === 1 && d.getHours() === 0
})())
check('addWeeks(0) is idempotent with weekStart', addWeeks(MON_NOON, 0) === weekStart(MON_NOON))

/* ---- recentWeekKeys ---- */
const keys = recentWeekKeys(MON_NOON, 4)
check('recentWeekKeys returns requested count', keys.length === 4)
check('recentWeekKeys newest-first from ref week', keys[0] === WEEK && keys[1] === PREV_WEEK)
check('recentWeekKeys consecutive weeks', new Set(keys).size === 4 && keys.every((k) => /^\d{4}-W\d{2}$/.test(k)))
check('recentWeekKeys(0) empty array', recentWeekKeys(MON_NOON, 0).length === 0)
check('recentWeekKeys(negative) clamps to empty', recentWeekKeys(MON_NOON, -3).length === 0)

/* ---- formatWeekKey ---- */
check('formatWeekKey humanizes valid key', formatWeekKey(WEEK) === 'Week 40 · 2026')
check('formatWeekKey strips leading zero', formatWeekKey('2026-W05') === 'Week 5 · 2026')
check('formatWeekKey passes malformed through unchanged', formatWeekKey('garage') === 'garage')
check('formatWeekKey passes wrong-shape through unchanged', formatWeekKey('26-W40') === '26-W40')
check('formatWeekKey never throws on empty string', formatWeekKey('') === '')

/* ---- digestToMarkdown ---- */
const fixture: WeeklyDigest = {
  weekKey: WEEK,
  from: weekStart(MON_NOON),
  to: weekStart(MON_NOON) + 7 * DAY - 1,
  generatedAt: MON_NOON + 1000,
  headline: '3 captures · 2 turned into documents · 1 export',
  captured: 3,
  transformed: 2,
  exported: 1,
  sections: [
    { heading: 'Starred highlights', items: ['★ Ship the demo (Oct 5)', '★ Fix login (Oct 7)'] },
    { heading: 'Top formats', items: ['You leaned on: Email Draft ×2.'] },
  ],
}
const md = digestToMarkdown(fixture)
check('markdown title uses humanized week', md.startsWith('# Weekly Digest — Week 40 · 2026'))
check('markdown carries italic date-range line', /\n_.+ – .+\n/.test(md))
check('markdown embeds headline bold', md.includes('**3 captures · 2 turned into documents · 1 export**'))
check('markdown stats row present', md.includes('- Captured: 3 · Transformed: 2 · Exported: 1'))
check('markdown renders section headings', md.includes('## Starred highlights') && md.includes('## Top formats'))
check('markdown renders all items as bullets', md.includes('- ★ Ship the demo (Oct 5)') && md.includes('- You leaned on: Email Draft ×2.'))
check('markdown footer has ISO generation timestamp', md.includes(new Date(fixture.generatedAt).toISOString()))
check('markdown deterministic (byte-identical on re-render)', digestToMarkdown(fixture) === md)
check('markdown ends without trailing blank line', !md.endsWith('\n\n'))
const quiet = buildWeeklyDigest(MON_NOON, [], [], MON_NOON)
const quietMd = digestToMarkdown(quiet)
check('empty-week digest still renders markdown', quietMd.includes('Quiet week') || quietMd.includes('A quiet week'))

/* ---- downloadDigestMarkdown is inert outside the browser ---- */
let threw = false
try { downloadDigestMarkdown(fixture) } catch { threw = true }
check('download helper does not throw in Node (no document)', !threw)

/* ---- store: generateDigest idempotency + timeline event ---- */
s().resetDemo()
const before = s().timeline.length
const g1 = s().generateDigest(MON_NOON)
check('first generation reports created=true', g1.created === true)
check('digest stored under ISO week key', s().digests[WEEK] !== undefined)
check('stored digest equals returned digest', s().digests[WEEK]?.weekKey === g1.digest.weekKey)
const evCount = s().timeline.length
check('generation appends exactly one timeline event', evCount === before + 1)
const digestEvent = s().timeline[evCount - 1]
check('timeline event kind is "digest"', digestEvent.kind === 'digest')
check('timeline event label carries week key', digestEvent.label === `Weekly digest · ${WEEK}`)
check('toast fired on first generation', s().toasts.some((t) => t.message.includes('Weekly digest ready')))

const g2 = s().generateDigest(MON_NOON)
check('second generation reports created=false', g2.created === false)
check('second generation returns identical stored digest', g2.digest === g1.digest)
check('second generation adds no timeline event', s().timeline.length === evCount)

/* different week → different key */
const gPrev = s().generateDigest(addWeeks(MON_NOON, -1))
check('previous week generates separately', gPrev.created === true && s().digests[PREV_WEEK] !== undefined)

/* ---- getDigest / clearDigest guards ---- */
check('getDigest finds stored week', s().getDigest(WEEK)?.weekKey === WEEK)
check('getDigest unknown key -> undefined', s().getDigest('2026-W99') === undefined)
check('getDigest empty key -> undefined', s().getDigest('') === undefined)
check('clearDigest removes and returns true', s().clearDigest(PREV_WEEK) === true && s().digests[PREV_WEEK] === undefined)
check('clearDigest unknown key -> false', s().clearDigest(PREV_WEEK) === false)

/* regenerate after clear works fresh */
const gRe = s().generateDigest(addWeeks(MON_NOON, -1))
check('cleared week regenerates with created=true', gRe.created === true)

/* ---- persistence round-trip (zustand persist writes synchronously) ---- */
const persistedRaw = kv.get(DOMAIN_KEY)
check('domain payload written to storage', typeof persistedRaw === 'string' && persistedRaw.length > 0)
const parsed = JSON.parse(persistedRaw ?? '{}')
check('persisted envelope contains digests map', parsed.state?.digests?.[WEEK]?.weekKey === WEEK)
const disk = readPersistedDomain()
check('readPersistedDomain surfaces digests', disk?.digests?.[WEEK] !== undefined)

/* ---- sanitizeDigests drops corrupt rows, keeps valid ones ---- */
const good = s().digests[WEEK]
const poisoned = {
  state: {
    thoughts: [],
    timeline: [],
    userCollections: [],
    demoVisits: 0,
    digests: {
      [WEEK]: good,                                        // valid — kept
      '2026-W42': { ...good, weekKey: 'WRONG' },           // key mismatch — dropped
      '2026-W43': { weekKey: '2026-W43', from: 'x' },      // bad field types — dropped
      '2026-W44': null,                                     // non-object — dropped
      '2026-W45': { ...good, sections: [{ heading: 7 }] }, // bad section — dropped
    },
  },
}
kv.set(DOMAIN_KEY, JSON.stringify(poisoned))
check('corrupt-payload read survives parse', readPersistedDomain() !== null)
/* mergeWithSeeds + sanitizeDigests run when a remote/disk payload is applied. */
pullRemoteState()
const applied = s().digests
check('poisoned disk payload applies only the valid row', applied[WEEK]?.weekKey === WEEK)
check('key-mismatch row dropped', applied['2026-W42'] === undefined)
check('bad-field row dropped', applied['2026-W43'] === undefined)
check('null row dropped', applied['2026-W44'] === undefined)
check('bad-section row dropped', applied['2026-W45'] === undefined)

/* fully-invalid digests container (array) -> treated as absent */
kv.set(DOMAIN_KEY, JSON.stringify({ state: { thoughts: [], timeline: [], digests: ['nope'] } }))
check('array-shaped digests survive reader path', readPersistedDomain() !== null)
pullRemoteState()
check('array-shaped digests yield empty map', Object.keys(s().digests).length === 0)

/* ---- resetDemo wipes digests ---- */
s().generateDigest(MON_NOON)
check('digest present before reset', s().digests[WEEK] !== undefined)
s().resetDemo()
check('resetDemo clears digest map', Object.keys(s().digests).length === 0)
check('resetDemo drops digest timeline events', s().timeline.every((e) => e.kind !== 'digest'))

console.log(`\n${pass}/${pass + fail} checks passed` + (fail ? ` — ${fail} FAILED` : ''))
process.exit(fail ? 1 : 0)
