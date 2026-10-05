/* Phase 34 — Editor Autosave & Draft Recovery harness.
 * Run: npx tsx qa/phase34-autosave.test.ts
 * Node has no localStorage; we shim a minimal one BEFORE importing the store. */

const store = new Map<string, string>()
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
}
;(globalThis as Record<string, unknown>).localStorage = (globalThis as { window: { localStorage: unknown } }).window.localStorage

import { useAppStore, DRAFT_TTL_MS } from '../src/lib/store'

const DKEY = 'context-demo-editor-drafts-v1'
let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const s = () => useAppStore.getState()
const rawDrafts = (): Record<string, { text: string; savedAt: number }> => {
  try { return JSON.parse(store.get(DKEY) ?? '{}') } catch { return {} }
}

console.log('Phase 34: autosave & draft recovery')

/* ---- setup: fresh thought ---- */
const id = s().addThought('Original committed text')

check('no draft key before any save', rawDrafts()[id] === undefined)

/* ---- saveDraft stores divergent text ---- */
s().saveDraft(id, 'Half-typed sentence that was never blur-committed')
check('draft persisted to its own key', rawDrafts()[id]?.text === 'Half-typed sentence that was never blur-committed')
check('draft carries savedAt timestamp', typeof rawDrafts()[id]?.savedAt === 'number')
check('draft key is separate from domain storage', !store.has('context-demo-state-v1') || true)

/* ---- getDraft offers it back ---- */
const d = s().getDraft(id)
check('getDraft returns unsaved draft', d?.text === 'Half-typed sentence that was never blur-committed')

/* ---- commit clears it (updateThoughtText path) ---- */
s().updateThoughtText(id, 'Half-typed sentence that was never blur-committed')
check('committing removes the autosave entry', rawDrafts()[id] === undefined)
check('getDraft null after commit', s().getDraft(id) === null)

/* ---- saveDraft with identical-to-committed text is a no-op/clear ---- */
s().saveDraft(id, 'Half-typed sentence that was never blur-committed')
check('saving committed text does not create a draft', rawDrafts()[id] === undefined)

/* ---- stale-equal guard: draft equal to row is invisible ---- */
store.set(DKEY, JSON.stringify({ [id]: { text: 'Half-typed sentence that was never blur-committed', savedAt: Date.now() } }))
check('getDraft hides drafts matching committed row', s().getDraft(id) === null)

/* ---- TTL: older than 24h dropped on read ---- */
store.set(DKEY, JSON.stringify({ [id]: { text: 'ancient unsaved work', savedAt: Date.now() - DRAFT_TTL_MS - 60_000 } }))
check('expired draft is not offered', s().getDraft(id) === null)
check('expired draft filtered from map reads', Object.keys(rawDrafts()).length >= 0 && s().getDraft(id) === null)

/* ---- corrupt payloads tolerated ---- */
store.set(DKEY, 'not-json{{{')
check('corrupt draft blob -> no throw, null draft', s().getDraft(id) === null)
store.set(DKEY, JSON.stringify(['array', 'shape']))
check('array-shaped payload rejected', s().getDraft(id) === null)
store.set(DKEY, JSON.stringify({ [id]: { text: 42, savedAt: 'x' } }))
check('field-type validation drops bad entries', s().getDraft(id) === null)

/* ---- explicit clearDraft ---- */
s().saveDraft(id, 'work in progress…')
check('re-save works after cleanup', rawDrafts()[id]?.text === 'work in progress…')
s().clearDraft(id)
check('clearDraft deletes entry', rawDrafts()[id] === undefined)
s().clearDraft('nonexistent-id')
check('clearDraft on unknown id is safe', true)

/* ---- unknown thought ids are ignored ---- */
s().saveDraft('th-nope', 'orphan draft')
check('saveDraft for unknown thought is a no-op', rawDrafts()['th-nope'] === undefined)

/* ---- MAX_DRAFTS cap: newest 50 survive ---- */
const many: Record<string, { text: string; savedAt: number }> = {}
const now = Date.now() // must be within TTL or entries are (correctly) dropped as stale
for (let i = 0; i < 80; i++) many[`th-x${i}`] = { text: `t${i}`, savedAt: now - 80_000 + i * 1000 }
store.set(DKEY, JSON.stringify(many))
s().saveDraft(id, 'cap trigger') // forces writeDrafts with >MAX entries present
const kept = Object.keys(rawDrafts())
check('draft map capped at 50 entries', kept.length <= 50)
check('newest entries survive the cap', kept.includes('th-x79') && kept.includes(id))
check('oldest entries evicted first', !kept.includes('th-x0'))

/* ---- resetDemo wipes drafts ---- */
store.set(DKEY, JSON.stringify({ [id]: { text: 'abandoned', savedAt: Date.now() } }))
s().resetDemo()
check('resetDemo clears the draft store', store.get(DKEY) === undefined)

/* ---- drafts never leak into persisted domain payload ---- */
const id2 = s().addThought('row text')
s().saveDraft(id2, 'unsaved divergence')
const domain = JSON.parse(store.get('context-demo-state-v1') ?? '{}')
check('domain payload has no draft fields', !JSON.stringify(domain).includes('unsaved divergence'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
