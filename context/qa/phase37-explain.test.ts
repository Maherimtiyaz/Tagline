/* Phase 37 — Explainable suggestions (spec §25): every ranked suggestion
   carries a human-readable "why", deterministic across runs. */
import { analyzeThought } from '../src/lib/mockAI'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}`)
  }
}

console.log('Phase 37: explainable suggestions')

/* ---------- preset path (Sarah/API preset match) ---------- */
{
  const r = analyzeThought('Sarah missed the deadline again, she promised the API Friday')
  ok('preset: suggestions produced', r.suggestions.length > 0)
  ok('preset: all have reasons', r.suggestions.every((s) => typeof s.reason === 'string' && s.reason.length > 10))
  ok(
    'preset: reason is the pattern sentence',
    r.suggestions.every((s) => s.reason === 'Matches a pattern seen in similar notes.'),
  )
}

/* ---------- intent-detected email (no preset match) ---------- */
{
  const r = analyzeThought('email the client about the invoice delay tomorrow')
  ok('intent: suggestions produced', r.suggestions.length >= 2)
  ok('intent: all have non-empty reasons', r.suggestions.every((s) => !!s.reason && s.reason.length > 10))
  const email = r.suggestions.find((s) => s.type === 'email')
  if (email) ok('intent: email reason mentions writing to someone', email.reason!.includes('writing to someone'))
}

/* ---------- fallback/intent path ---------- */
{
  const r = analyzeThought('we need to finish the migration and review it before friday')
  ok('fallback: suggestions produced', r.suggestions.length >= 2)
  ok('fallback: all have non-empty reasons', r.suggestions.every((s) => !!s.reason && s.reason.length > 10))
  ok('fallback: reasons are unique per type', new Set(r.suggestions.map((s) => s.reason)).size === r.suggestions.length)
  const email = r.suggestions.find((s) => s.type === 'email')
  if (email) ok('fallback: email reason mentions writing to someone', email.reason!.includes('writing to someone'))
  const tasks = r.suggestions.find((s) => s.type === 'tasks')
  if (tasks) ok('fallback: tasks reason mentions checklist', tasks.reason!.includes('checklist'))
}

/* ---------- determinism ---------- */
{
  const a = analyzeThought('summarize the meeting notes for the team')
  const b = analyzeThought('summarize the meeting notes for the team')
  ok(
    'deterministic: identical reasons across calls',
    JSON.stringify(a.suggestions) === JSON.stringify(b.suggestions),
  )
}

/* ---------- shape integrity (unchanged fields) ---------- */
{
  const r = analyzeThought('plan the launch with dates and owners')
  ok(
    'shape: confidence still descending',
    r.suggestions.every((s, i) => i === 0 || r.suggestions[i - 1].confidence >= s.confidence),
  )
  ok('shape: at most 4 suggestions', r.suggestions.length <= 4)
  ok('shape: labels intact', r.suggestions.every((s) => s.label.startsWith('Create ')))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
