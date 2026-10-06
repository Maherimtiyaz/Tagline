/* Phase 39 — Preference Learning from Output Feedback (spec §68).
   Run: npx tsx qa/phase39-learning.test.ts */
import { analyzeThought, clampScore, preferenceNote } from '../src/lib/mockAI'
import { sanitizeSignals } from '../src/lib/store'
import type { TypeSignal } from '../src/data/types'

let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) pass++
  else {
    fail++
    console.error('FAIL:', name)
  }
}

/* ---------- clampScore / preferenceNote ---------- */
check('clampScore upper bound', clampScore(99) === 3)
check('clampScore lower bound', clampScore(-99) === -3)
check('clampScore NaN -> 0', clampScore(Number.NaN) === 0)
/* Non-finite inputs are treated as "no signal" (0), not clamped to ±3 —
   this is what keeps malformed persisted payloads from poisoning ranking. */
check('clampScore Infinity -> 0', clampScore(Number.POSITIVE_INFINITY) === 0)
check('note positive', preferenceNote(1).includes('helpful'))
check('note negative', preferenceNote(-1).includes('needs work'))
check('note zero is silent', preferenceNote(0) === '')
check('note small is silent', preferenceNote(0.4) === '')

/* ---------- sanitizeSignals ---------- */
check('sanitize non-array -> []', sanitizeSignals('nope').length === 0)
check(
  'sanitize drops unknown types',
  sanitizeSignals([{ type: 'not-a-type', score: 2 }]).length === 0,
)
check(
  'sanitize drops non-numeric scores',
  sanitizeSignals([{ type: 'email', score: 'big' }, { type: 'email', score: null }]).length === 0,
)
check('sanitize drops zero scores', sanitizeSignals([{ type: 'email', score: 0 }]).length === 0)
check('sanitize clamps scores', sanitizeSignals([{ type: 'email', score: 50 }])[0].score === 3)
check(
  'sanitize dedupes by type (last wins)',
  JSON.stringify(sanitizeSignals([{ type: 'email', score: 1 }, { type: 'email', score: -2 }])) ===
    JSON.stringify([{ type: 'email', score: -2 }]),
)
check('sanitize skips malformed entries', sanitizeSignals([null, 3, { type: 'email' }]).length === 0)

/* ---------- analyzeThought ranking ---------- */
const TEXT = 'remind me to email the client about the revised invoice and payment terms'
const base = analyzeThought(TEXT)
const boosted = analyzeThought(TEXT, [{ type: 'email', score: 3 }] as TypeSignal[])
const penalized = analyzeThought(TEXT, [{ type: 'tasks', score: -3 }] as TypeSignal[])

check('base has suggestions', base.suggestions.length > 0)
check(
  'positive signal lifts email confidence',
  (boosted.suggestions.find((s) => s.type === 'email')?.confidence ?? 0) >=
    (base.suggestions.find((s) => s.type === 'email')?.confidence ?? 0),
)
check(
  'negative signal lowers tasks confidence',
  (penalized.suggestions.find((s) => s.type === 'tasks')?.confidence ?? 1) <=
    (base.suggestions.find((s) => s.type === 'tasks')?.confidence ?? 1),
)
check(
  'learned reason is honest',
  boosted.suggestions.some((s) => s.reason && s.reason.includes('marked this kind helpful')),
)
check(
  'unbiased run keeps original order',
  base.suggestions.every((s, i) => s.confidence >= (base.suggestions[i + 1]?.confidence ?? 0)),
)
check(
  'determinism: same signals -> same output',
  JSON.stringify(analyzeThought(TEXT, boosted.suggestions.length ? [{ type: 'email', score: 2 }] : [])) ===
    JSON.stringify(analyzeThought(TEXT, [{ type: 'email', score: 2 }])),
)
check(
  'confidence stays in range',
  boosted.suggestions.every((s) => s.confidence >= 0.05 && s.confidence <= 0.99) &&
    penalized.suggestions.every((s) => s.confidence >= 0.05 && s.confidence <= 0.99),
)

console.log(`\nPhase 39 harness: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
