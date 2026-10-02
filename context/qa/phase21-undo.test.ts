/* Minimal browser shims — the persisted store touches localStorage and
   setTimeout on import; Node needs just enough to not crash. */
const g = globalThis as unknown as { window?: unknown; localStorage?: unknown }
if (!g.localStorage) {
  const mem = new Map<string, string>()
  g.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  }
}
if (!g.window) g.window = g.localStorage /* safeStorage reads via window */

import { useAppStore } from "../src/lib/store"

const s = () => useAppStore.getState()
let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

/* helper: latest toast with an action */
const lastActionToast = () => [...s().toasts].reverse().find((t) => t.action)

// --- setup: three fresh drafts + one thought with an output -------------
const a = s().addThought('alpha draft')
const b = s().addThought('beta draft')
const c = s().addThought('gamma draft')
const d = s().addThought('delta with output')
s().transform(d, 'email', 'professional')

const pos = (id: string) => s().thoughts.findIndex((t) => t.id === id)
ok('four thoughts present', s().thoughts.length >= 4)

// --- single delete -> undo restores at exact position --------------------
const posA = pos(a)
s().deleteThought(a)
ok('delete removed row', pos(a) === -1)
const t1 = lastActionToast()
ok('delete toast carries Undo action', !!t1 && t1.action?.label === 'Undo')
t1!.action!.run()
ok('undo restored row', pos(a) !== -1)
ok('restored at original index', pos(a) === posA)
ok('restored row is identical object', s().thoughts[pos(a)].text === 'alpha draft')

// double-undo must be idempotent (guard skips existing ids)
t1!.action!.run()
ok('double undo does not duplicate', s().thoughts.filter((x) => x.id === a).length === 1)

// --- bulk delete of multiple scattered drafts ----------------------------
const pB = pos(b), pC = pos(c)
const before = s().thoughts.map((t) => t.id)
const res = s().bulkDelete([b, c, d]) // d has outputs -> refused
ok('bulkDelete deleted only output-free rows', res.deleted === 2 && res.refused === 1)
ok('output-bearing thought kept', pos(d) !== -1)
ok('kept thought still has outputs', s().thoughts[pos(d)].outputs.length === 1)
const t2 = lastActionToast()
ok('bulk delete toast offers Undo', !!t2 && t2.action?.label === 'Undo')
t2!.action!.run()
ok('bulk undo restored both', pos(b) !== -1 && pos(c) !== -1)
ok('bulk undo exact positions', pos(b) === pB && pos(c) === pC)
const after = s().thoughts.map((t) => t.id)
ok('order fully recovered', JSON.stringify(before) === JSON.stringify(after))

// --- archive -> undo restores prior status (Phase 21) --------------------
const posC = pos(c)
s().archiveThought(c)
ok('archive sets status', s().thoughts[pos(c)].status === 'archived')
const t3 = lastActionToast()
ok('archive toast offers Undo', !!t3 && t3.action?.label === 'Undo')
t3!.action!.run()
ok('undo restores raw status', s().thoughts[pos(c)].status === 'raw')

// processed thought keeps its status through archive+undo
s().archiveThought(d)
ok('processed archived', s().thoughts[pos(d)].status === 'archived')
lastActionToast()?.action?.run()
ok('undo restores processed status', s().thoughts[pos(d)].status === 'processed')

// archiving an already-archived row is a no-op (no new toast)
s().archiveThought(d)
const nToasts = s().toasts.length
s().archiveThought(d)
ok('re-archive unknown/archived is no-op', s().toasts.length === nToasts)

// bulk archive undo
s().bulkArchive([a, b])
ok('bulk archived both', s().thoughts[pos(a)].status === 'archived' && s().thoughts[pos(b)].status === 'archived')
const t4 = lastActionToast()
ok('bulk archive toast offers Undo', !!t4 && t4.action?.label === 'Undo')
t4!.action!.run()
ok('bulk undo restores statuses', s().thoughts[pos(a)].status !== 'archived' && s().thoughts[pos(b)].status !== 'archived')
void posC

// --- selection cleared by delete ----------------------------------------
s().setSelection([a, b])
s().bulkDelete([a])
ok('selection cleared after bulk delete', s().selectedIds.length === 0)
lastActionToast()?.action?.run() // restore for tidiness

// --- guards ----------------------------------------------------------------
ok('restoreTrashed empty returns 0', s().restoreTrashed([], []) === 0)
ok('deleteThought unknown id is no-op', (() => { const n = s().thoughts.length; s().deleteThought('nope'); return s().thoughts.length === n })())

// --- persistence: undone rows survive serialize round-trip ---------------
const json = JSON.parse(JSON.stringify(s().thoughts))
ok('undone rows serialize normally', Array.isArray(json) && json.some((t: { id: string }) => t.id === b))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
