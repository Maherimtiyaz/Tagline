/* Phase 31 — Cross-tab sync harness. Run: npx tsx qa/phase31-crosstab.test.ts
   Exercises the pure sync primitives (payload reader, seed-merge applier,
   broadcast no-op without a channel) against the real store + a fake
   localStorage. Browser event wiring itself is verified by build + preview. */
import {
  useAppStore,
  readPersistedDomain,
  pullRemoteState,
  startCrossTabSync,
  broadcastDomainChange,
  CROSS_TAB_CHANNEL,
  TAB_ID,
} from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.error(`  ✗ ${name}`) }
}
const S = () => useAppStore.getState()

/* ---- fake browser environment ---------------------------------------- */
const store = new Map<string, string>()
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}
;(globalThis as Record<string, unknown>).document = {
  visibilityState: 'visible',
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}

console.log('Phase 31: cross-tab sync')

S().resetDemo()
const seededCount = S().thoughts.length

/* 1. persist writes land in (fake) localStorage in zustand's envelope */
const id1 = S().addThought('Sync probe one')
const rawKey = [...store.keys()][0]
ok('persist wrote to storage key', rawKey === 'context-demo-state-v1')
const envelope = JSON.parse(store.get(rawKey!)!)
ok('envelope has version+state', envelope.version === 0 && Array.isArray(envelope.state.thoughts))
ok('probe thought persisted', envelope.state.thoughts.some((t: { id: string }) => t.id === id1))

/* 2. readPersistedDomain parses the envelope shape */
const domain = readPersistedDomain()
ok('reader returns domain payload', !!domain && domain.thoughts.some((t) => t.id === id1))

/* 3. corrupted / missing payloads degrade safely */
store.set(rawKey!, '{not json')
ok('corrupt payload -> null', readPersistedDomain() === null)
store.set(rawKey!, JSON.stringify({ version: 0, state: { thoughts: 'nope' } }))
ok('invalid shape -> null', readPersistedDomain() === null)
store.delete(rawKey!)
ok('missing payload -> null', readPersistedDomain() === null)

/* 4. simulated remote tab: it writes a payload with an extra user thought
      and a mutated seed; local tab pulls it in */
const remoteUser = { id: 'th-remote-1', rawText: 'From the other tab', createdAt: Date.now(), status: 'inbox' as const, tags: ['Sync'] }
const mutatedSeed = { ...envelope.state.thoughts[0], starred: true }
store.set(rawKey!, JSON.stringify({
  version: 0,
  state: {
    thoughts: [mutatedSeed, remoteUser],
    timeline: [{ id: 'ev-remote', thoughtId: 'th-remote-1', at: Date.now(), kind: 'capture', label: 'Captured in other tab' }],
    userCollections: [{ id: 'col-remote', name: 'Remote Set', slug: 'remote-set', system: false, thoughtIds: [] }],
    onboardingSeen: true,
    demoVisits: 3,
  },
}))
pullRemoteState()
ok('remote user thought applied', S().thoughts.some((t) => t.id === 'th-remote-1'))
ok('remote mutation applied to seed', S().thoughts.find((t) => t.id === mutatedSeed.id)?.starred === true)
ok('remote collection applied', S().userCollections.some((c) => c.id === 'col-remote'))
ok('remote timeline applied', S().timeline.some((e) => e.id === 'ev-remote'))
ok('demoVisits synced', S().demoVisits === 3)

/* 5. seed re-merge safety: the remote payload kept only ONE user thought; the
      other five pristine seeds must be restored locally, and the remote-mutated
      seed wins its id-collision merge with the mutation applied. */
const shrunk = JSON.parse(store.get(rawKey!)!)
shrunk.state.thoughts = shrunk.state.thoughts.filter(
  (t: { id: string }) => t.id === mutatedSeed.id || t.id === 'th-remote-1',
)
store.set(rawKey!, JSON.stringify(shrunk))
pullRemoteState()
ok('all six seeds present after pull', S().thoughts.filter((t) => /^th-[a-z]+$/.test(t.id)).length === 6)
ok('mutated seed keeps remote value (collision merge)', S().thoughts.find((t) => t.id === mutatedSeed.id)?.starred === true)
ok('remote user thought still present', S().thoughts.some((t) => t.id === 'th-remote-1'))

/* 6. transient UI state never crosses tabs */
S().select(mutatedSeed.id)
pullRemoteState()
ok('selection survives remote apply', S().selectedThoughtId === mutatedSeed.id)
ok('toasts stay local', Array.isArray(S().toasts))

/* 7. node env inertness: startCrossTabSync without window returns noop */
delete (globalThis as Record<string, unknown>).window
delete (globalThis as Record<string, unknown>).document
const cleanup = startCrossTabSync()
ok('inert without window (returns fn)', typeof cleanup === 'function')
cleanup()
ok('broadcast without channel is safe', (() => { try { broadcastDomainChange(); return true } catch { return false } })())

/* 8. constants sanity */
ok('channel name versioned', CROSS_TAB_CHANNEL === 'context-demo-sync-v1')
ok('tab id prefixed', TAB_ID.startsWith('tab-'))

/* 9. resetDemo clears storage even under fake window (safeStorage path) */
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
}
S().resetDemo()
ok('reset restores seed count', S().thoughts.length === seededCount)
/* zustand persist re-writes the (now pristine) payload after removeItem —
   assert the rewrite contains only seeds, i.e. no user data survives reset */
const afterReset = JSON.parse(store.get(rawKey!)!).state.thoughts as { id: string }[]
ok('reset cleared persisted user thought', !afterReset.some((t) => t.id === 'th-remote-1' || t.id === id1))
ok('reset persisted payload is seed-only', afterReset.every((t) => /^th-[a-z]+$/.test(t.id)))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
