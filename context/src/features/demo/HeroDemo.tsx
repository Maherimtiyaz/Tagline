import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { OutputType } from '../../data/types'
import { analyzeThought, generateOutput } from '../../lib/mockAI'
import { STAGE_ORDER, STAGE_COPY } from '../../lib/outputMeta'
import { useTransformPipeline } from '../../hooks/useTransformPipeline'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { ThoughtScatter, StageRail } from '../../animations/Transformation'
import { cn } from '../../lib/cn'

/* ============================================================
   Hero transformation demo (spec §11–§13). The product itself
   is the hero: pick a preset, watch RAW → UNDERSTANDING →
   STRUCTURE → OUTPUT unfold in stages. Fully interactive; also
   accepts free typing.
   ============================================================ */

interface Preset {
  label: string
  text: string
  type: OutputType
}

export const HERO_PRESETS: Preset[] = [
  { label: 'Email', type: 'email', text: "i need to tell sarah that we're probably going to miss friday because the api isn't ready and maybe monday but don't promise monday yet..." },
  { label: 'Project plan', type: 'plan', text: 'I want to launch my portfolio next month. three case studies max, no screenshots without outcomes, and a short launch post. need a plan that fits around client work.' },
  { label: 'Meeting summary', type: 'summary', text: 'Meeting notes from standup: scope locked on checkout redesign, no wallet support this round. launch moves wednesday -> friday for UAT. priya sends estimates tomorrow, jordan books uat thursday.' },
  { label: 'Decision', type: 'decision', text: 'Should we use PostgreSQL or MongoDB for the billing service? invoices are relational but webhook payloads keep changing shape.' },
  { label: 'Social post', type: 'post', text: 'post idea: I cut my portfolio from twelve projects to three and enquiries doubled. portfolios are an editing problem not a design problem.' },
]

type Phase = 'raw' | 'decompose' | 'structured'

const EASE = [0.21, 0.6, 0.35, 1] as const

export function HeroDemo({ compact = false }: { compact?: boolean }) {
  const reduced = useReducedMotion()
  const [presetIdx, setPresetIdx] = useState(0)
  const [customText, setCustomText] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('raw')
  const pipeline = useTransformPipeline(reduced)

  const active = HERO_PRESETS[presetIdx]
  const text = customText ?? active.text
  const result = useMemo(() => analyzeThought(text), [text])
  const output = useMemo(
    () => generateOutput(text, { type: active.type }),
    [text, active.type],
  )

  const playing = pipeline.stage !== 'idle'

  const play = () => {
    setPhase('raw')
    pipeline.run()
    if (!reduced) {
      window.setTimeout(() => setPhase('decompose'), 420)
      window.setTimeout(() => setPhase('structured'), 1080)
    } else {
      setPhase('structured')
    }
  }

  const selectPreset = (i: number) => {
    setPresetIdx(i)
    setCustomText(null)
    window.setTimeout(play, 60)
  }

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-line bg-surface text-left shadow-md',
        compact && 'shadow-sm',
      )}
    >
      {/* preset tabs */}
      <div
        role="tablist"
        aria-label="Demo presets"
        className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-2"
      >
        {HERO_PRESETS.map((p, i) => (
          <button
            key={p.label}
            role="tab"
            aria-selected={i === presetIdx && customText === null}
            onClick={() => selectPreset(i)}
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-[var(--duration-micro)]',
              i === presetIdx && customText === null
                ? 'bg-accent-soft text-accent'
                : 'text-ink-subtle hover:bg-surface-hover hover:text-ink',
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto hidden shrink-0 pl-3 font-mono text-3xs text-ink-faint sm:block">
          try typing something messy ↓
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* LEFT — raw thought */}
        <div className="min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="label-mono">Raw thought</p>
            {!playing && !customText && (
              <button
                type="button"
                onClick={play}
                className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-accent-line hover:text-accent"
              >
                Transform <ArrowRight size={11} aria-hidden />
              </button>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => { setCustomText(e.target.value); pipeline.reset(); setPhase('raw') }}
            rows={compact ? 4 : 5}
            aria-label="Your messy thought"
            spellCheck={false}
            className="w-full resize-none rounded-lg border border-transparent bg-canvas-deep p-3 font-mono text-xs leading-relaxed text-ink-muted transition-colors hover:border-line focus:border-accent focus:outline-none"
          />
          <AnimatePresence mode="wait">
            {playing || phase !== 'raw' ? (
              <motion.div
                key={text.slice(0, 24) + phase}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4"
              >
                <ThoughtScatter text={text} understanding={result.understanding} phase={phase} />
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 font-mono text-2xs text-ink-faint"
              >
                press <span className="text-accent">Transform</span> — or just edit the text above
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* MIDDLE — pipeline rail */}
        <div className="hidden w-px bg-line md:block" aria-hidden />
        <div className="flex min-w-0 flex-col justify-center border-t border-line px-5 py-4 md:border-l md:border-t-0 md:w-44 md:shrink-0">
          <StageRail stages={STAGE_ORDER} currentIndex={pipeline.stageIndex} labels={STAGE_COPY} />
        </div>
      </div>

      {/* BOTTOM — the output reveal */}
      <AnimatePresence>
        {pipeline.stage === 'ready' && (
          <motion.section
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="border-t border-line bg-canvas-deep/60 p-5"
            aria-label="Generated output"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="label-mono text-accent">Output · {output.title}</p>
              <span className="rounded-full border border-line px-2 py-px text-3xs text-ink-subtle">
                {active.label}
              </span>
            </div>
            {output.subject && (
              <p className="mb-1 text-sm font-semibold text-ink">Subject: {output.subject}</p>
            )}
            <div className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {output.body}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={play}
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Run it again
              </button>
              <p className="font-mono text-3xs text-ink-faint">simulated locally · nothing leaves your browser</p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
