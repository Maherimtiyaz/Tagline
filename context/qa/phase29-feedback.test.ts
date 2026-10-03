/* Phase 29 — Output Feedback Loop harness. Run: npx tsx qa/phase29-feedback.test.ts */
import { useAppStore } from '../src/lib/store'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.error(`  ✗ ${name}`) }
}
const S = () => useAppStore.getState()

console.log('Phase 29: output feedback loop')

S().resetDemo()
const tid = S().addThought('need to push the launch date because billing QA is still red')
const out = S().transform(tid, 'email')
const oid = out.id
const row = () => S().thoughts.find((t) => t.id === tid)!.outputs.find((o) => o.id === oid)!

// 1. initial state — no feedback
ok('fresh output has no feedback', row().feedback === undefined)

// 2. rate helpful sets rating + timestamp
ok('rateOutput returns true', S().rateOutput(tid, oid, 'helpful') === true)
ok('feedback stored as helpful', row().feedback?.rating === 'helpful')
ok('feedback carries a timestamp', typeof row().feedback?.at === 'number' && row().feedback!.at > 0)

// 3. timeline event recorded
{
  const ev = S().timeline.filter((e) => e.thoughtId === tid).at(-1)!
  ok('timeline records "Marked helpful"', ev.label === 'Marked helpful' && ev.detail === out.title)
}

// 4. opposite rating replaces in place (no duplicates, still one entry)
S().rateOutput(tid, oid, 'needs-work')
ok('switching rating replaces value', row().feedback?.rating === 'needs-work')
{
  const fbEvents = S().timeline.filter((e) => e.thoughtId === tid && (e.label === 'Flagged for rework')).length
  ok('rework event recorded once per switch', fbEvents === 1)
}

// 5. same rating again clears (toggle semantics)
ok('clearing via repeat tap returns true', S().rateOutput(tid, oid, 'needs-work') === true)
ok('feedback cleared to undefined', row().feedback === undefined)
{
  const clearedToast = S().toasts.some((t) => t.message === 'Feedback cleared')
  ok('clearing emits info toast', clearedToast)
}

// 6. clearFeedback guard — nothing to clear → false, no mutation
ok('clearFeedback with no feedback returns false', S().clearFeedback(tid, oid) === false)
S().rateOutput(tid, oid, 'helpful')
ok('clearFeedback removes existing feedback', S().clearFeedback(tid, oid) === true && row().feedback === undefined)

// 7. unknown-id guards never throw / never mutate
const snapshot = JSON.stringify(S().thoughts)
ok('unknown thought id returns false', S().rateOutput('nope', oid, 'helpful') === false)
ok('unknown output id returns false', S().rateOutput(tid, 'nope', 'helpful') === false)
ok('unknown ids leave thoughts untouched', JSON.stringify(S().thoughts) === snapshot)
ok('clearFeedback unknown thought returns false', S().clearFeedback('nope', oid) === false)

// 8. undo action attached to rating toast actually clears
S().resetDemo()
const tid2 = S().addThought('follow up with sarah about the proposal timing')
const out2 = S().transform(tid2, 'slack')
S().rateOutput(tid2, out2.id, 'helpful')
/* Grab the freshest helpful-toast — earlier ones may have auto-dismissed;
   dismissToast is idempotent so running a stale closure is harmless. */
const toasts = S().toasts.filter((t) => t.message === 'Thanks — noted as helpful')
const toast = toasts[toasts.length - 1]!
ok('rating toast exposes Undo action', !!toast?.action && toast.action.label === 'Undo')
toast.action!.run()
{
  const row2 = S().thoughts.find((t) => t.id === tid2)!.outputs.find((o) => o.id === out2.id)!
  ok('Undo run clears the rating', row2.feedback === undefined)
}

// 9. feedback survives persistence serialization round-trip
S().rateOutput(tid2, out2.id, 'needs-work')
{
  const json = JSON.parse(JSON.stringify(S().thoughts.find((t) => t.id === tid2)))
  const restoredOut = json.outputs.find((o: { id: string }) => o.id === out2)
  ok('feedback serializes through localStorage pipeline', restoredOut.feedback?.rating === 'needs-work' && typeof restoredOut.feedback.at === 'number')
}

// 10. ratings are per-output, not per-thought
const out3 = S().transform(tid2, 'tasks')
{
  const row3a = S().thoughts.find((t) => t.id === tid2)!.outputs.find((o) => o.id === out3.id)!
  ok('new output starts unrated', row3a.feedback === undefined)
  const prev = S().thoughts.find((t) => t.id === tid2)!.outputs.find((o) => o.id === out2.id)!
  ok('out2 still flagged after transforming out3', prev.feedback?.rating === 'needs-work')
  S().rateOutput(tid2, out3.id, 'helpful')
  const prevAfter = S().thoughts.find((t) => t.id === tid2)!.outputs.find((o) => o.id === out2.id)!
  ok('rating out3 does not touch out2', prevAfter.feedback?.rating === 'needs-work')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
