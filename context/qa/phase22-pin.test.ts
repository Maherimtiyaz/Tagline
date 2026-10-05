/* Phase 22 — Pin to Top store logic harness. Run: npx tsx qa/phase22-pin.test.ts */
import { useAppStore } from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.error(`  ✗ ${name}`) }
}

const S = () => useAppStore.getState()
S().resetDemo() // deterministic baseline (Phase 28 seeds ship pre-starred/pre-pinned rows)
const seedIds = S().thoughts.map((t) => t.id)

console.log('Phase 22: pin-to-top')

// 1. togglePin flips flag and returns new state
ok('togglePin(id) pins → returns true', S().togglePin(seedIds[0]) === true)
ok('flag persisted on thought row', S().thoughts.find((t) => t.id === seedIds[0])?.pinned === true)
ok('second call unpins → returns false', S().togglePin(seedIds[0]) === false)
ok('unpin clears flag', S().thoughts.find((t) => t.id === seedIds[0])?.pinned === false)

// 2. unknown id guard (Phase 28 note: seeds now ship a pre-pinned row, so "untouched"
// means the pinned *count* is unchanged, not that zero rows are pinned)
const pinnedBefore = S().thoughts.filter((t) => t.pinned).length
ok('unknown id returns false', S().togglePin('nope-123') === false)
ok('unknown id leaves thoughts untouched', S().thoughts.filter((t) => t.pinned).length === pinnedBefore)

// 3. pinning does not mutate other rows / statuses
const before = JSON.stringify(S().thoughts.map((t) => [t.id, t.status, t.text]))
S().togglePin(seedIds[1])
const after = JSON.stringify(S().thoughts.map((t) => [t.id, t.status, t.text]))
ok('other rows unchanged by pin', before === after)
ok('only target newly pinned', S().thoughts.filter((t) => t.pinned && !seedIds.includes(t.id)).length === 0
  && S().thoughts.find((t) => t.id === seedIds[1])?.pinned === true
  && S().thoughts.filter((t) => t.pinned).length === pinnedBefore + 1)

// 4. multiple pins coexist; order within scoped list preserved (store keeps createdAt desc for extras + seeds appended)
S().togglePin(seedIds[3])
ok('two newly pinned simultaneously', S().thoughts.filter((t) => t.pinned).length === pinnedBefore + 2)

// 5. inbox grouping simulation mirrors InboxPage logic: pinned float above Today/Earlier
const nonArchived = S().thoughts.filter((t) => t.status !== 'archived')
const scoped = nonArchived // workspace view
const isPinned = (t: { pinned?: boolean }) => !!t.pinned
const pinnedList = scoped.filter(isPinned)
const rest = scoped.filter((t) => !isPinned(t))
const renderedOrder = [...pinnedList, ...rest].map((t) => t.id)
/* The seeded pre-pinned row (th-fixes) legitimately sorts into the pinned
   group too; assert our two new pins lead and the seed follows immediately. */
ok('pinned first in render order',
  renderedOrder[0] === seedIds[1] && renderedOrder[1] === seedIds[3]
    && pinnedList.slice(2).every((t) => t.id !== seedIds[1] && t.id !== seedIds[3]))
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

// cleanup: unpin test-pinned rows only (seed-pinned row from Phase 28 stays pinned by design)
S().togglePin(seedIds[1]); S().togglePin(seedIds[3])
ok('cleanup restores baseline pinned count', S().thoughts.filter((t) => t.pinned).length === pinnedBefore)

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
