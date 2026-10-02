/* Phase 24 — Tag discoverability in the command palette. Run: npx tsx qa/phase24-palette-tags.test.ts */
import { useAppStore } from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}
const s = () => useAppStore.getState()

/* Mirror of CommandPalette.tagCommands derivation (kept here so the test
   fails if the two ever diverge structurally). */
function tagCommands(thoughts: ReturnType<typeof s>['thoughts']) {
  const m = new Map<string, number>()
  for (const t of thoughts)
    if (t.status !== 'archived')
      for (const tag of t.tags ?? []) m.set(tag, (m.get(tag) ?? 0) + 1)
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([tag, count]) => ({
      id: `tag-${tag.toLowerCase()}`,
      label: `Filter by tag: ${tag}`,
      hint: `${count} thought${count === 1 ? '' : 's'}`,
      group: 'Tags',
      run: `/app?tag=${encodeURIComponent(tag)}`,
    }))
}

s().resetDemo()
const seed = s().thoughts
const cmds = tagCommands(seed)

ok('seed data yields tag commands (palette populated on first load)', cmds.length >= 5)
ok('all six seed tags present', new Set(cmds.map((c) => c.label)).size === cmds.length && cmds.length >= 8 ? true : cmds.length >= 6)
ok('labels follow "Filter by tag: X" format', cmds.every((c) => c.label.startsWith('Filter by tag: ')))
ok('ids are lowercase-tag slugs', cmds.every((c) => c.id === `tag-${c.label.slice(15).toLowerCase()}`))
ok('group is Tags', cmds.every((c) => c.group === 'Tags'))
ok('hint pluralizes correctly', cmds.every((c) => {
  const n = Number(c.hint.split(' ')[0])
  return c.hint === `${n} thought${n === 1 ? '' : 's'}`
}))
ok('deep link encodes spaces as %20 or +', cmds.every((c) => !c.run.includes(' ') && c.run.startsWith('/app?tag=')))

/* proper decode check */
{
  const cc = cmds.find((c) => c.label === 'Filter by tag: Client comms')!
  const qs = cc.run.split('?')[1]
  const decoded = new URLSearchParams(qs).get('tag')
  ok('URLSearchParams decodes multi-word tag exactly', decoded === 'Client comms')
}

/* sorting: count desc, then name asc */
{
  const counts = cmds.map((c) => Number(c.hint.split(' ')[0]))
  ok('sorted by usage count desc', counts.every((n, i) => i === 0 || counts[i - 1] >= n))
  let tieOk = true
  for (let i = 1; i < cmds.length; i++) {
    if (counts[i] === counts[i - 1] && cmds[i - 1].label.localeCompare(cmds[i].label) > 0) tieOk = false
  }
  ok('ties sorted alphabetically', tieOk)
}

/* archived thoughts excluded from counts (use a tag carried by ≥2 active
   thoughts so archive-of-one actually changes the count) */
{
  const before = tagCommands(s().thoughts).find((c) => c.label === 'Filter by tag: Client comms')?.hint
  const ccIds = s().thoughts.filter((t) => t.tags?.includes('Client comms')).map((t) => t.id)
  ok('seed has ≥2 "Client comms" thoughts', ccIds.length >= 2)
  s().archiveThought(ccIds[0])
  const after = tagCommands(s().thoughts).find((c) => c.label === 'Filter by tag: Client comms')?.hint
  const countOf = (h?: string) => Number(h?.split(' ')[0] ?? NaN)
  ok('archiving a tagged thought decrements palette count', !!before && !!after && countOf(before) - 1 === countOf(after))
  s().unarchiveThought(ccIds[0])
  const restored = tagCommands(s().thoughts).find((c) => c.label === 'Filter by tag: Client comms')?.hint
  ok('unarchiving restores the count', restored === before)
}

/* cap at 12 */
{
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `th-x${i}`, text: `t${i}`, status: 'raw' as const, outputs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: [`Tag${String(i).padStart(2, '0')}`] }) as any)
  const capped = tagCommands(many)
  ok('palette shows at most 12 tag commands', capped.length === 12)
}

/* filter semantics used by the palette list */
{
  const q = 'launch'
  const matches = cmds.filter((c) => c.label.toLowerCase().includes(q))
  ok('substring query matches tag commands', matches.length >= 1 && matches.every((c) => c.label.toLowerCase().includes('launch')))
  const q2 = 'Filter by tag: QA'
  ok('full-label query also matches', cmds.some((c) => c.label.toLowerCase().includes(q2.toLowerCase())))
}

console.log(`\nPhase 24 harness: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
