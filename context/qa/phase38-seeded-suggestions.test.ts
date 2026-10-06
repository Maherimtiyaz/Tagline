/* Phase 38 — Seeded suggestions on Thought rows: addThought ranks once at
   capture, transform backfills for legacy rows (seed-once), persistence
   round-trips the data. */
import { useAppStore } from '../src/lib/store'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) }
}

console.log('Phase 38: seeded suggestions')

const S = () => useAppStore.getState()

/* ---------- capture-time seeding ---------- */
{
  const id = S().addThought('email the client about the invoice delay tomorrow')
  const t = S().thoughts.find((x) => x.id === id)!
  ok('addThought seeds suggestions array', Array.isArray(t.suggestions) && t.suggestions.length > 0)
  ok('all seeded suggestions carry a reason', t.suggestions.every((s) => !!s.reason && s.reason.length > 10))
  ok('top suggestion is ranked first (confidence desc)',
    t.suggestions.every((s, i) => i === 0 || t.suggestions[i - 1].confidence >= s.confidence))
}

{
  const id = S().addThought('   ')
  const t = S().thoughts.find((x) => x.id === id)!
  ok('empty text seeds empty array (no crash)', Array.isArray(t.suggestions) && t.suggestions.length === 0)
}

/* ---------- voice source also seeds ---------- */
{
  const id = S().addThought('schedule a review with Sarah before friday', 'voice')
  const t = S().thoughts.find((x) => x.id === id)!
  ok('voice capture seeds suggestions too', (t.suggestions?.length ?? 0) > 0)
}

/* ---------- transform backfill + seed-once ---------- */
{
  /* Simulate a legacy row captured before Phase 38 existed. */
  const id = S().addThought('summarize the meeting notes for the team')
  useAppStore.setState((s) => ({
    thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, suggestions: undefined } : t)),
  }))
  const legacy = S().thoughts.find((t) => t.id === id)!
  ok('legacy row has no suggestions pre-transform', legacy.suggestions === undefined)
  S().transform(id, 'summary')
  const after = S().thoughts.find((t) => t.id === id)!
  ok('transform backfills suggestions', (after.suggestions?.length ?? 0) > 0)
  ok('backfilled rows carry reasons', after.suggestions!.every((s) => !!s.reason))

  /* Seed-once: mutate stored suggestions, re-transform, expect preserved. */
  useAppStore.setState((s) => ({
    thoughts: s.thoughts.map((t) =>
      t.id === id ? { ...t, suggestions: [{ type: 'post' as const, label: 'manual', confidence: 1, reason: 'kept' }] } : t,
    ),
  }))
  S().transform(id, 'email')
  const kept = S().thoughts.find((t) => t.id === id)!
  ok('re-transform never overwrites existing suggestions (seed-once)',
    kept.suggestions!.length === 1 && kept.suggestions![0].label === 'manual')
}

/* ---------- determinism across identical captures ---------- */
{
  const a = S().addThought('draft a launch plan for the mobile release next sprint')
  const b = S().addThought('draft a launch plan for the mobile release next sprint')
  const ta = S().thoughts.find((t) => t.id === a)!
  const tb = S().thoughts.find((t) => t.id === b)!
  ok('identical text → identical rankings',
    JSON.stringify(ta.suggestions) === JSON.stringify(tb.suggestions))
}

/* ---------- persistence round-trip ---------- */
{
  const id = S().addThought('write a post about our new pricing model')
  const t = S().thoughts.find((x) => x.id === id)!
  const json = JSON.parse(JSON.stringify({ suggestions: t.suggestions }))
  ok('survives JSON serialization (localStorage path)',
    Array.isArray(json.suggestions) && json.suggestions[0].reason === t.suggestions![0].reason)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
