/* Phase 28 — collection detail ordering & filter primitives.
   Run: npx tsx qa/phase28-collection-detail.test.ts */
import { groupByPriority, priorityGroups, isPinned, isStarred } from '../src/lib/sort'
import type { Thought } from '../src/data/types'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗', name) }
}

const now = Date.now()
const day = 24 * 3600_000
const t = (id: string, over: Partial<Thought> = {}): Thought => ({
  id, text: 'x', source: 'text', createdAt: now - 2 * day, status: 'raw', outputs: [], ...over,
})

console.log('Phase 28: sort.ts priority primitives')

// --- bucket exclusivity -------------------------------------------------
const mix = [
  t('a', { starred: true, pinned: true }),          // star wins over pin
  t('b', { pinned: true }),
  t('c', { createdAt: now - 1000 }),                // today
  t('d', { createdAt: now - 3 * day }),             // earlier
]
const g = groupByPriority(mix)
ok('starred bucket holds only starred rows', g.starred.map((x) => x.id).join() === 'a')
ok('pinned bucket excludes starred pins', g.pinned.map((x) => x.id).join() === 'b')
ok('today excludes starred+pinned', g.today.map((x) => x.id).join() === 'c')
ok('earlier catches the rest', g.earlier.map((x) => x.id).join() === 'd')
ok('buckets are disjoint and total', g.starred.length + g.pinned.length + g.today.length + g.earlier.length === mix.length)

// --- newest-first within buckets ---------------------------------------
const many = [t('old', { createdAt: now - 5 * day }), t('new', { createdAt: now - 100 })]
const gm = groupByPriority(many)
ok('rest sorted newest-first', gm.today[0]?.id === 'new')
ok('input array not mutated', many[0].id === 'old')

// --- renderable groups --------------------------------------------------
const all = priorityGroups(mix)
ok('full view renders 4 labelled groups in order', all.map((x) => x.label).join('|') === 'Starred|Pinned|Today|Earlier')
// fresh thought (default createdAt = 2 days ago) lands in Earlier; the three empty buckets drop
ok('empty buckets dropped', priorityGroups([t('z')]).map((x) => x.label).join() === 'Earlier')
ok('signal=starred narrows to one bucket', priorityGroups(mix, 'starred').map((x) => x.label).join() === 'Starred')
ok('signal=pinned narrows to one bucket', priorityGroups(mix, 'pinned').map((x) => x.label).join() === 'Pinned')
ok('signal with no members renders nothing', priorityGroups([t('q')], 'starred').length === 0)
ok('null signal behaves like full view', JSON.stringify(priorityGroups(mix, null)) === JSON.stringify(all))

// --- rank map used by collection detail --------------------------------
const flat = all.flatMap((grp) => grp.list)
const rank = new Map(flat.map((x, i) => [x.id, i]))
ok('rank order star > pin > today > earlier', rank.get('a')! < rank.get('b')! && rank.get('b')! < rank.get('c')! && rank.get('c')! < rank.get('d')!)
ok('unknown ids sort last', (rank.get('nope') ?? 1e9) > (rank.get('d') ?? 0))

// --- predicates ---------------------------------------------------------
ok('isStarred/isPinned treat undefined as false', !isStarred(t('u')) && !isPinned(t('u')))
ok('isStarred true only when flagged', isStarred(t('s', { starred: true })) && !isStarred(t('s2', { starred: false })))

// --- tag registry (union, most-used first, alpha tiebreak) --------------
const tagged = [
  t('x', { tags: ['Launch', 'QA'] }),
  t('y', { tags: ['launch'.toLowerCase()] }),        // lowercase stored separately by design
  t('z', { tags: ['Launch', 'Client comms'] }),
]
const counts = new Map<string, number>()
for (const th of tagged) for (const tag of th.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
const registry = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
ok('registry sorts by count desc then alpha', registry[0][0] === 'Launch' && registry[0][1] === 2)
ok('tie broken alphabetically', registry[1][0] === 'Client comms' && registry[2][0] === 'launch')

// --- tag-filter intersection (mirrors groupedOutputs.match) -------------
const filterTag = 'Launch'
const matched = tagged.filter((th) => (th.tags ?? []).includes(filterTag)).map((th) => th.id)
ok('tag filter matches exact entries', matched.join() === 'x,z')
ok('thought without tags never matches', !t('w').tags?.includes(filterTag))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
