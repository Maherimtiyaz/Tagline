/* Phase 23 — Tags & tag filtering. Run: npx tsx qa/phase23-tags.test.ts */
import { useAppStore, normalizeTag } from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

const s = () => useAppStore.getState()

/* ---- normalizeTag ---- */
ok('normalize strips leading #', normalizeTag('#launch') === 'launch')
ok('normalize trims + collapses whitespace', normalizeTag('  client   comms ') === 'client comms')
ok('normalize caps at 24 chars', normalizeTag('a'.repeat(40)).length === 24)
ok('normalize empty stays empty', normalizeTag('   ') === '')

/* ---- addTag ---- */
s().resetDemo?.() // restore seeds if available
const id1 = s().addThought('tag test thought one')
ok('addTag adds normalized tag', s().addTag(id1, '#Alpha') && s().thoughts.find((t) => t.id === id1)?.tags?.[0] === 'Alpha')
ok('addTag rejects duplicate (case-insensitive)', !s().addTag(id1, 'alpha') && s().thoughts.find((t) => t.id === id1)!.tags!.length === 1)
ok('addTag rejects empty', !s().addTag(id1, '   ') )
ok('addTag rejects unknown id', !s().addTag('th-nope', 'Beta'))
ok('addTag second distinct tag appends', s().addTag(id1, 'Beta') && s().thoughts.find((t) => t.id === id1)!.tags!.join(',') === 'Alpha,Beta')

/* ---- removeTag ---- */
ok('removeTag case-insensitive', s().removeTag(id1, 'beta') && s().thoughts.find((t) => t.id === id1)?.tags?.join(',') === 'Alpha')
ok('removeTag no-op on missing tag', !s().removeTag(id1, 'Gamma'))
ok('removeTag last tag clears field to undefined', s().removeTag(id1, 'Alpha') && s().thoughts.find((t) => t.id === id1)?.tags === undefined)
ok('removeTag unknown id → false', !s().removeTag('th-nope', 'x'))

/* ---- renameTag ---- */
const id2 = s().addThought('tag test thought two')
s().addTag(id2, 'Launch'); s().addTag(id1, 'Launch'); s().addTag(id1, 'Keep')
const touched = s().renameTag('launch', 'Big launch')
ok('renameTag touches every carrier (case-insensitive match)', touched === 3)
ok('renameTag replaces in-place preserving order', s().thoughts.find((t) => t.id === id1)?.tags?.join(',') === 'Big launch,Keep')
ok('renameTag normalizes target (# stripped)', s().renameTag('Big launch', '#Rebrand') === 3 && s().thoughts.find((t) => t.id === id2)?.tags?.[0] === 'Rebrand')
ok('renameTag no-op when old missing', s().renameTag('Nonexistent', 'X') === 0)
ok('renameTag empty new name rejected', s().renameTag('Rebrand', '  ') === 0 && s().thoughts.find((t) => t.id === id2)?.tags?.[0] === 'Rebrand')

/* ---- seed transform auto-tagging ---- */
const id3 = s().addThought("i need to tell sarah that we're probably going to miss friday because the api isn't ready")
s().transform(id3, 'email')
const seeded = s().thoughts.find((t) => t.id === id3)?.tags ?? []
ok('transform seeds tags from extracted topics', seeded.length > 0 && seeded.length <= 4)
s().addTag(id3, 'Manual'); s().removeTag(id3, seeded[0])
s().transform(id3, 'summary')
const after = s().thoughts.find((t) => t.id === id3)?.tags ?? []
ok('re-transform does not overwrite manual edits', after.includes('Manual') && !after.includes(seeded[0]))

/* ---- persistence serialization keeps tags ---- */
const raw = JSON.parse(JSON.stringify(s().thoughts.find((t) => t.id === id3)))
ok('tags survive JSON round-trip (localStorage path)', Array.isArray(raw.tags) && raw.tags.includes('Manual'))

console.log(`\nPhase 23 tags: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
