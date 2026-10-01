import { useAppStore, makeVersion } from "../src/lib/store"

const s = () => useAppStore.getState()
let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

// fresh thought + output
const thId = s().addThought('we should probably ship the thing soon maybe')
s().transform(thId, 'email', 'professional')
const out = () => s().thoughts.find((t) => t.id === thId)!.outputs[0]
const oId = out().id
ok('no versions initially', !out().versions || out().versions.length === 0)

// manual save
const v1 = s().saveVersion(thId, oId, 'Before client send')
ok('saveVersion returns snapshot', !!v1 && v1.label === 'Before client send')
ok('version listed', out().versions!.length === 1 && out().versions![0].id === v1!.id)

// tone switch auto-archives
s().retone(thId, oId, 'friendly')
ok('tone switch archives previous', out().versions!.length === 2 && out().versions![0].label === 'Tone: professional')

// format switch auto-archives
const bodyBeforeFormat = out().body
s().reformat(thId, oId, 'slack')
ok('format switch archives previous', out().versions!.some((v) => v.label === 'Format: email' && v.body === bodyBeforeFormat))

// restore is reversible
const target = out().versions!.find((x) => x.label === 'Format: email')!
const bodyAtRestore = out().body
ok('restore returns true', s().restoreVersion(thId, oId, target.id))
ok('restored body applied', out().body === target.body)
ok('pre-restore archived', out().versions!.some((v) => v.body === bodyAtRestore && v.label.startsWith('Before restore')))
ok('used snapshot consumed', !out().versions!.some((v) => v.id === target.id))
ok('undo journal reset', s().editHistory[oId]?.past.length === 0)

// restore unknown id -> false
ok('restore missing version fails', !s().restoreVersion(thId, oId, 'nope'))
ok('delete missing version fails', !s().deleteVersion(thId, oId, 'nope'))

// delete existing
const del = out().versions![0]
ok('delete returns true', s().deleteVersion(thId, oId, del.id))
ok('deleted gone', !out().versions!.some((v) => v.id === del.id))

// cap at 12
for (let i = 0; i < 20; i++) s().saveVersion(thId, oId, `bulk ${i}`)
ok('cap 12 enforced', out().versions!.length === 12)
ok('newest-first', out().versions![0].label === 'bulk 19')

// unique ids
ok('unique version ids', new Set(out().versions!.map((v) => v.id)).size === 12)

// bad thought/output ids are no-ops
ok('saveVersion unknown thought null', s().saveVersion('zz', 'zz') === null)
ok('restore unknown thought false', !s().restoreVersion('zz', 'zz', 'zz'))

// timeline recorded
ok('timeline has version events', s().timeline.some((e) => e.thoughtId === thId && e.label.startsWith('Version saved')))
ok('timeline has restore event', s().timeline.some((e) => e.label.startsWith('Restored')))

// persistence shape: versions ride inside thoughts
const serialized = JSON.stringify(s().thoughts.find((t) => t.id === thId))
ok('versions serialize with thought', JSON.parse(serialized).outputs[0].versions.length > 0)

void makeVersion
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
