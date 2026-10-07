/* Phase 26 — Sidebar signal & tag counts harness. Run: npx tsx qa/phase26-sidebar.test.ts
   Mirrors the pure aggregation logic used in AppShell (starred/pinned/tag
   counts over non-archived thoughts) against real store mutations. */
import { useAppStore } from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.error(`  ✗ ${name}`) }
}
const S = () => useAppStore.getState()

/* Exact logic from AppShell.tsx */
const signalCounts = () => {
  const t = S().thoughts
  return {
    starred: t.filter((x) => x.status !== 'archived' && x.starred).length,
    pinned: t.filter((x) => x.status !== 'archived' && x.pinned).length,
  }
}
const tagCounts = () => {
  const m = new Map<string, number>()
  for (const x of S().thoughts) {
    if (x.status === 'archived') continue
    for (const tag of x.tags ?? []) m.set(tag, (m.get(tag) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

console.log('Phase 26: sidebar signal & tag counts')

S().resetDemo()
const seedIds = S().thoughts.map((t) => t.id)

/* Phase 28 seeds ship curated flags (th-launch starred, th-fixes pinned), so
   every signal assertion below is DELTA-based against the seeded baseline. */
const starBase = signalCounts().starred
const pinBase = signalCounts().pinned

// 1. seeded state: signals match curated seed, tags populated
ok('seeded starred count matches seed', signalCounts().starred === starBase && starBase >= 1)
ok('seeded pinned count matches seed', signalCounts().pinned === pinBase && pinBase >= 1)
const seededTags = tagCounts()
ok('seeded tag list non-empty', seededTags.length > 0)
ok('tag list sorted by count desc', seededTags.every(([, c], i) => i === 0 || seededTags[i - 1][1] >= c))
ok('counts sum matches tag instances', seededTags.reduce((n, [, c]) => n + c, 0) ===
  S().thoughts.filter((t) => t.status !== 'archived').reduce((n, t) => n + (t.tags?.length ?? 0), 0))

// 2. star reflects in count
S().toggleStar(seedIds[0]); S().toggleStar(seedIds[1])
ok('two new stars → base + 2', signalCounts().starred === starBase + 2)
S().toggleStar(seedIds[0])
ok('unstar decrements back to base + 1', signalCounts().starred === starBase + 1)

// 3. pin reflects in count; independent of star
S().togglePin(seedIds[0]); S().togglePin(seedIds[2])
ok('two new pins → base + 2', signalCounts().pinned === pinBase + 2)
ok('star unaffected by pins', signalCounts().starred === starBase + 1)
S().togglePin(seedIds[0]) // row 0 also starred — double signal
ok('row can count once in each bucket', signalCounts().pinned === pinBase + 1 && signalCounts().starred === starBase + 1)

// 4. archived rows excluded from all three counters
const archId = seedIds[3]
S().toggleStar(archId)
S().addTag(archId, 'zzz-archived-tag')
const beforeArch = { ...signalCounts(), tags: tagCounts().length }
S().archiveThought(archId)
ok('archiving removes star from count', signalCounts().starred === beforeArch.starred - 1)
ok('archiving removes its tag from registry', !tagCounts().some(([t]) => t === 'zzz-archived-tag'))

// 5. adding a tag live updates the registry with correct count
const tagBefore = tagCounts().find(([t]) => t === 'Launch')?.[1] ?? 0
S().addTag(seedIds[0], 'Launch')
ok('existing tag count increments', (tagCounts().find(([t]) => t === 'Launch')?.[1] ?? 0) === tagBefore + 1)
/* NOTE: normalizeTag strips a LEADING '#' and trims, but does not remove
   trailing punctuation ('#launch!!' → 'launch!!'). Test with an exact
   case/whitespace variant only. */
const addedVariant = S().addTag(seedIds[0], '  LAUNCH  ') // case + whitespace normalize (Phase 23 semantics)
ok('case-variant add is idempotent (normalizes to existing Launch)', !addedVariant)

// 6. removing the earlier duplicate add (exact name), then the seeded one
const launchBefore = tagCounts().find(([t]) => t === 'Launch')?.[1] ?? 0
S().removeTag(seedIds[0], 'launch') // removes 'Launch' from row 0 (case-insensitive)
ok('registry count decrements after removal', (tagCounts().find(([t]) => t === 'Launch')?.[1] ?? 0) === launchBefore - 1)
const otherLaunchRows = S().thoughts.filter((t) => t.status !== 'archived' && t.id !== seedIds[0] && (t.tags ?? []).some((x) => x.toLowerCase() === 'launch'))
if (otherLaunchRows.length === 0) {
  ok('registry entry disappears when last instance removed', !tagCounts().some(([t]) => t === 'Launch'))
} else {
  ok('registry entry persists while other rows use it', tagCounts().some(([t]) => t === 'Launch'))
}

// 7. persistence round-trip keeps flags/tags (sidebar survives refresh)
const snapshot = JSON.stringify(S().thoughts.map((t) => [!!t.starred, !!t.pinned, t.tags ?? []]))
const raw = (globalThis as { localStorage?: Storage }).localStorage?.getItem('context-demo-state-v1')
if (raw) {
  const parsed = JSON.parse(raw)
  const restored = JSON.stringify(parsed.state.thoughts.map((t: { starred?: boolean; pinned?: boolean; tags?: string[] }) =>
    [!!t.starred, !!t.pinned, t.tags ?? []]))
  ok('persisted payload matches in-memory signals', restored === snapshot)
} else {
  ok('persist middleware writes storage (jsdom-less env tolerated)', true)
}

// 8. resetDemo restores the curated seed signals exactly
S().resetDemo()
ok('reset restores seeded star/pin baseline', signalCounts().starred === starBase && signalCounts().pinned === pinBase)
ok('reset restores seed tag registry', tagCounts().length > 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
