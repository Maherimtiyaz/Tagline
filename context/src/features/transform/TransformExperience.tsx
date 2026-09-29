import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { analyzeThought } from '../../lib/mockAI'
import { OUTPUT_LABEL, STAGE_COPY, STAGE_ORDER } from '../../lib/outputMeta'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { ContextChip } from '../../components/ui/ContextChip'
import { Badge } from '../../components/ui/Badge'
import type { OutputType, Understanding } from '../../data/types'
import { cn } from '../../lib/cn'

/* ============================================================
   Transform experience (spec §10, §26) — the signature staged
   pipeline on its own route: /app/transform?thought=<id>&type=email

   Understanding your thought → Identifying intent →
   Structuring message → Writing draft → Ready.

   Runs once on mount (deterministic, ~1.6s), then hands the user
   straight into the output workspace with the result selected.
   ============================================================ */

const STAGES = STAGE_ORDER.filter((s) => s !== 'ready') // understanding → intent → structuring → writing

export function TransformExperience() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  const thoughts = useAppStore((s) => s.thoughts)
  const transform = useAppStore((s) => s.transform)
  const select = useAppStore((s) => s.select)

  const thoughtId = params.get('thought') ?? ''
  const rawType = params.get('type') ?? 'email'
  const type: OutputType = rawType in OUTPUT_LABEL ? (rawType as OutputType) : 'email'

  const thought = thoughts.find((t) => t.id === thoughtId)
  const analysis: Understanding | null = useMemo(
    () => (thought ? analyzeThought(thought.text).understanding : null),
    [thought],
  )

  const [stage, setStage] = useState(0) // 0..3 running, 4 = ready
  const [outputId, setOutputId] = useState<string | null>(null)

  /* Run the pipeline exactly once per thought+type. */
  useEffect(() => {
    if (!thought) return
    let cancelled = false
    const timers: number[] = []
    const step = reduced ? 220 : 400
    STAGES.forEach((_, i) => {
      timers.push(window.setTimeout(() => !cancelled && setStage(i + 1), step * (i + 1)))
    })
    timers.push(
      window.setTimeout(() => {
        if (cancelled || !thought) return
        const output = transform(thought.id, type, 'professional')
        setOutputId(output.id)
        select(thought.id)
        setStage(STAGES.length + 1) // "Ready."
      }, step * STAGES.length + (reduced ? 200 : 350)),
    )
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought?.id, type])

  if (!thought) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium">There is nothing to transform.</p>
        <p className="text-xs text-ink-subtle">Capture a rough thought first — Context needs something messy to work with.</p>
        <button
          onClick={() => navigate('/app')}
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Go to inbox <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  const ready = stage > STAGES.length
  const outLabel = OUTPUT_LABEL[type]

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight">Transforming a thought</h1>
          <p className="font-mono text-3xs text-ink-faint">
            {outLabel.toLowerCase()} · {ready ? 'ready' : `stage ${Math.min(stage + 1, STAGES.length)} of ${STAGES.length}`}
          </p>
        </div>
        <Badge tone={ready ? 'success' : 'accent'}>{ready ? 'Ready' : 'Working'}</Badge>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {/* source thought */}
        <section aria-label="Source thought">
          <p className="mb-2 font-mono text-3xs uppercase tracking-[0.14em] text-ink-faint">Your thought</p>
          <blockquote className="rounded-lg border border-line bg-canvas-deep p-4 font-mono text-sm leading-relaxed text-ink">
            {thought.text.trim() || '(empty draft)'}
          </blockquote>
        </section>

        {/* extracted context, revealed at stage 2 */}
        <AnimatePresence>
          {analysis && stage >= 2 && (
            <motion.section
              aria-label="Extracted context"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="mt-6"
            >
              <p className="mb-2 font-mono text-3xs uppercase tracking-[0.14em] text-ink-faint">What Context understood</p>
              <div className="flex flex-wrap gap-2">
                <ContextChip kind="intent" value={analysis.intent} />
                {analysis.people.map((p) => (
                  <ContextChip key={`p-${p}`} kind="person" value={p} />
                ))}
                {analysis.dates.map((d) => (
                  <ContextChip key={`d-${d}`} kind="date" value={d} />
                ))}
                {analysis.topics.slice(0, 3).map((t) => (
                  <ContextChip key={`t-${t}`} kind="topic" value={t} />
                ))}
                <ContextChip kind="tone" value={analysis.tone} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* stage list */}
        <section aria-label="Transformation stages" className="mt-8" role="status" aria-live="polite">
          <ul className="space-y-2.5">
            {STAGES.map((key, i) => {
              const label = STAGE_COPY[key]
              const done = stage > i
              const active = stage === i
              return (
                <li key={key} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-200',
                      done
                        ? 'border-emerald bg-emerald text-canvas-deep'
                        : active
                          ? 'border-accent text-accent'
                          : 'border-line text-ink-faint',
                    )}
                  >
                    {done ? <Check size={12} strokeWidth={2.5} /> : active ? <Loader2 size={12} className="animate-spin" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                  </span>
                  <span className={cn(done ? 'text-ink-subtle' : active ? 'font-medium text-ink' : 'text-ink-faint')}>
                    {label}
                  </span>
                </li>
              )
            })}
            <li className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-200',
                  ready ? 'border-accent bg-accent text-white' : 'border-line text-ink-faint',
                )}
              >
                {ready ? <Check size={12} strokeWidth={2.5} /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              <span className={cn(ready ? 'font-semibold text-ink' : 'text-ink-faint')}>Ready.</span>
            </li>
          </ul>

          <AnimatePresence>
            {ready && outputId && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="mt-7 flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent-soft/40 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{outLabel} created.</p>
                  <p className="text-xs text-ink-subtle">Open it in the output workspace to edit, change tone, or copy.</p>
                </div>
                <button
                  autoFocus
                  onClick={() => navigate(`/app/output/${thought.id}/${outputId}`)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Open output <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => navigate(`/app/thought/${thought.id}`)}
                  className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium transition-colors hover:border-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Back to thought
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}
