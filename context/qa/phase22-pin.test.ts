/* Phase 22 — Pin to Top store logic harness. Run: npx tsx qa/phase22-pin.test.ts */
import { useAppStore } from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.error(`  ✗ ${name}`) }
}

const S = () => useAppStore.getState()
const seedIds = S().thoughts.map((t) => t.id)

console.log('Phase 22: pin-to-top')

// 1. togglePin flips flag and returns new state
ok('togglePin(id) pins → returns true', S().togglePin(seedIds[0]) === true)
ok('flag persisted on thought row', S().thoughts.find((t) => t.id === seedIds[0])?.pinned === true)
ok('second call unpins → returns false', S().togglePin(seedIds[0]) === false)
ok('unpin clears flag', S().thoughts.find((t) => t.id === seedIds[0])?.pinned === false)

// 2. unknown id guard
ok('unknown id returns false', S().togglePin('nope-123') === false)
ok('unknown id leaves thoughts untouched', S().thoughts.every((t) => !t.pinned))

// 3. pinning does not mutate other rows / statuses
const before = JSON.stringify(S().thoughts.map((t) => [t.id, t.status, t.text]))
S().togglePin(seedIds[1])
const after = JSON.stringify(S().thoughts.map((t) => [t.id, t.status, t.text]))
ok('other rows unchanged by pin', before === after)
ok('only target pinned', S().thoughts.filter((t) => t.pinned).map((t) => t.id).join() === seedIds[1])

// 4. multiple pins coexist; order within scoped list preserved (store keeps createdAt desc for extras + seeds appended)
S().togglePin(seedIds[3])
ok('two pinned simultaneously', S().thoughts.filter((t) => t.pinned).length === 2)

// 5. inbox grouping simulation mirrors InboxPage logic: pinned float above Today/Earlier
const nonArchived = S().thoughts.filter((t) => t.status !== 'archived')
const scoped = nonArchived // workspace view
const isPinned = (t: { pinned?: boolean }) => !!t.pinned
const pinnedList = scoped.filter(isPinned)
const rest = scoped.filter((t) => !isPinned(t))
const renderedOrder = [...pinnedList, ...rest].map((t) => t.id)
ok('pinned first in render order', renderedOrder[0] === seedIds[1] && renderedOrder[1] === seedIds[3])
ok('no duplicates across groups', new Set(renderedOrder).size === scoped.length)
ok('every thought appears exactly once overall',
  pinnedList.length + rest.length === scoped.length)

// 6. archived thought can be pinned too (pin is orthogonal to status)
const archId = S().thoughts.find((t) => t.status === 'raw')!.id
S().archiveThought(archId)
ok('archived then pinned works', S().togglePin(archId) === true)
S().unarchiveThought(archId)
ok('pin survives unarchive', S().thoughts.find((t) => t.id === archId)?.pinned === true)
S().togglePin(archId) // cleanup

// 7. persistence: pinned flag serializes through localStorage pipeline
const json = JSON.parse(JSON.stringify({ thoughts: S().thoughts }))
ok('pinned round-trips via JSON', json.thoughts.some((t: { pinned?: boolean }) => t.pinned === true))

// 8. new thoughts default to unpinned
const nid = S().addThought('fresh thought for pin test')
ok('new thought starts unpinned', S().thoughts.find((t) => t.id === nid)?.pinned === undefined)
S().togglePin(nid)
ok('new thought pinnable', S().thoughts.find((t) => t.id === nid)?.pinned === true)
S().deleteThought(nid)

// cleanup: unpin remaining
S().togglePin(seedIds[1]); S().togglePin(seedIds[3])
ok('cleanup leaves zero pinned', S().thoughts.every((t) => !t.pinned))

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
