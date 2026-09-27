import { cn } from '../../lib/cn'
import type { Understanding } from '../../data/types'

/* ============================================================
   ContextChip — one extracted concept (intent / person / date /
   topic / tone). Chips animate into place wherever they appear.
   ============================================================ */

export type ChipKind = 'intent' | 'context' | 'tone' | 'person' | 'date' | 'task' | 'topic' | 'action'

const kindStyles: Record<ChipKind, string> = {
  intent: 'border-accent-line bg-accent-soft text-accent',
  context: 'border-blue-25 bg-blue-soft text-blue',
  tone: 'border-line bg-canvas-deep text-ink-muted',
  person: 'border-transparent bg-blue-soft text-blue',
  date: 'border-transparent bg-amber-soft text-amber',
  task: 'border-transparent bg-emerald-soft text-emerald',
  topic: 'border-line bg-surface text-ink-muted',
  action: 'border-accent-line bg-transparent text-accent',
}

export function ContextChip({
  kind,
  label,
  value,
  className,
}: {
  kind: ChipKind
  label?: string
  value: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs leading-4',
        kindStyles[kind],
        className,
      )}
    >
      {label && <span className="label-mono opacity-70">{label}</span>}
      <span className="font-medium">{value}</span>
    </span>
  )
}

/** The full extraction panel (spec §25): intent · people · dates · tasks · topics · tone. */
export function ContextPanelBody({ u, compact = false }: { u: Understanding; compact?: boolean }) {
  const rows: { label: string; chips: { kind: ChipKind; value: string }[] }[] = [
    { label: 'Intent', chips: [{ kind: 'intent', value: u.intent }] },
    { label: 'Context', chips: [{ kind: 'context', value: u.context }] },
    ...(u.people.length ? [{ label: 'People', chips: u.people.map((p) => ({ kind: 'person' as ChipKind, value: p })) }] : []),
    ...(u.dates.length ? [{ label: 'Dates', chips: u.dates.map((p) => ({ kind: 'date' as ChipKind, value: p })) }] : []),
    ...(!compact && u.tasks.length ? [{ label: 'Tasks', chips: u.tasks.map((p) => ({ kind: 'task' as ChipKind, value: p })) }] : []),
    ...(u.topics.length ? [{ label: 'Topics', chips: u.topics.map((p) => ({ kind: 'topic' as ChipKind, value: p })) }] : []),
    { label: 'Tone', chips: [{ kind: 'tone', value: u.tone[0].toUpperCase() + u.tone.slice(1) }] },
  ]
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="animate-fade-up">
          <p className="label-mono mb-1.5">{r.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {r.chips.map((c, i) => (
              <ContextChip key={c.value + i} kind={c.kind} value={c.value} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
