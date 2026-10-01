import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, PanelLeftClose, PanelLeftOpen, Play, RotateCcw } from 'lucide-react'
import type { OutputType } from '../../data/types'
import { analyzeThought, generateOutput } from '../../lib/mockAI'
import { OUTPUT_TYPES, STAGE_COPY, STAGE_ORDER } from '../../lib/outputMeta'
import { useTransformPipeline } from '../../hooks/useTransformPipeline'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { ContextPanelBody } from '../../components/ui/ContextChip'
import { StageRail, ThoughtScatter } from '../../animations/Transformation'
import { DEMO_EXAMPLES } from '../../data/mock'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'

/* ============================================================
   /demo — the three-panel product tour (spec §17):
   YOUR THOUGHT | CONTEXT | RESULT, each collapsible. Runs the
   same staged pipeline as the real workspace on any input.
   ============================================================ */

export function DemoPage() {
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const [text, setText] = useState(DEMO_EXAMPLES[0].text)
  const [type, setType] = useState<OutputType>('email')
  const [phase, setPhase] = useState<'raw' | 'decompose' | 'structured'>('raw')
  const [panels, setPanels] = useState({ left: true, right: true })
  const pipeline = useTransformPipeline(reduced)

  const result = useMemo(() => analyzeThought(text), [text])
  const output = useMemo(() => generateOutput(text, { type }), [text, type])
  const played = pipeline.stage === 'ready'

  /* Spec §56 conversion tracking: one record per completed run. */
  const recordDemoVisit = useAppStore((s) => s.recordDemoVisit)
  const demoVisits = useAppStore((s) => s.demoVisits)
  const resetDemo = useAppStore((s) => s.resetDemo)

  const play = () => {
    if (!text.trim()) return
    setPhase('raw')
    pipeline.run(() => recordDemoVisit())
    if (!reduced) {
      window.setTimeout(() => setPhase('decompose'), 420)
      window.setTimeout(() => setPhase('structured'), 1080)
    } else setPhase('structured')
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-5 md:px-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Product demo</h1>
          <p className="text-sm text-ink-muted">No signup. Type anything messy and press Transform.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Spec §56: quiet, persisted record of completed demo runs. */}
          {demoVisits > 0 && (
            <span className="hidden items-center rounded-full border border-line px-2.5 py-1 font-mono text-3xs text-ink-subtle sm:flex" role="status">
              {demoVisits} run{demoVisits === 1 ? '' : 's'} completed in this browser
            </span>
          )}
          <button type="button" onClick={() => { pipeline.reset(); setPhase('raw') }} className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-muted hover:border-line-strong hover:text-ink">
            <RotateCcw size={12} aria-hidden /> Reset
          </button>
          <button type="button" onClick={play} disabled={!text.trim()} className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-45">
            <span className="flex items-center gap-1.5"><Play size={12} aria-hidden /> Transform ⌘↵</span>
          </button>
          {/* Spec §57: allow resetting the demo from anywhere in it. */}
          <button
            type="button"
            onClick={() => { resetDemo(); navigate('/app') }}
            aria-label="Reset demo to its initial state"
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            Reset demo
          </button>
        </div>
      </header>

      {/* example chips */}
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Example thoughts">
        {DEMO_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => { setText(ex.text); setType(ex.type); pipeline.reset(); setPhase('raw') }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors duration-[var(--duration-micro)]',
              text === ex.text ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-3',
          panels.left && panels.right ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]'
            : panels.left || panels.right ? 'lg:grid-cols-2' : '',
        )}
      >
        {/* PANEL 1 — your thought */}
        {panels.left && (
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" aria-label="Your thought panel">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="label-mono">Your thought</p>
              <button type="button" aria-label="Collapse thought panel" onClick={() => setPanels((p) => ({ ...p, left: false }))} className="rounded p-1 text-ink-faint hover:bg-surface-hover hover:text-ink">
                <PanelLeftClose size={13} aria-hidden />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); pipeline.reset(); setPhase('raw') }}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); play() } }}
                rows={6}
                spellCheck={false}
                aria-label="Raw thought input"
                className="w-full resize-none rounded-lg border border-line bg-canvas-deep p-3 font-mono text-xs leading-relaxed text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                placeholder="i need to tell sarah something about friday but also…"
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ThoughtScatter text={text} understanding={result.understanding} phase={pipeline.stage !== 'idle' ? phase : 'raw'} />
              </div>
            </div>
          </section>
        )}
        {!panels.left && (
          <button type="button" onClick={() => setPanels((p) => ({ ...p, left: true }))} aria-label="Expand thought panel" className="hidden w-10 place-items-center rounded-xl border border-line bg-surface text-ink-subtle hover:text-ink lg:grid">
            <PanelLeftOpen size={14} />
          </button>
        )}

        {/* PANEL 2 — context (understanding) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" aria-label="Understanding panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="label-mono text-accent">Context</p>
            <span className="font-mono text-3xs text-ink-faint">{STAGE_COPY[pipeline.stage] ?? 'waiting'}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <StageRail stages={STAGE_ORDER} currentIndex={pipeline.stageIndex} labels={STAGE_COPY} />
            <ArrowDown size={12} className="mx-auto text-ink-faint" aria-hidden />
            {pipeline.stage !== 'idle' ? (
              <ContextPanelBody u={result.understanding} />
            ) : (
              <p className="pt-6 text-center text-xs text-ink-faint">
                Press Transform — Context will read the thought and surface what it finds inside.
              </p>
            )}
          </div>
          <div className="border-t border-line p-3">
            <p className="label-mono mb-1.5">Make it a</p>
            <div className="flex flex-wrap gap-1">
              {OUTPUT_TYPES.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-2xs transition-colors',
                    type === t.id ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-muted hover:border-line-strong',
                  )}
                >
                  {t.command}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* PANEL 3 — result */}
        {panels.right && (
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" aria-label="Result panel">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="label-mono">Result</p>
              <button type="button" aria-label="Collapse result panel" onClick={() => setPanels((p) => ({ ...p, right: false }))} className="rounded p-1 text-ink-faint hover:bg-surface-hover hover:text-ink">
                <PanelLeftOpen size={13} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {played ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{output.title}</p>
                  {output.subject && <p className="text-xs text-ink-muted">Subject: {output.subject}</p>}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{output.body}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/app')}
                    className="mt-3 rounded-md border border-accent-line px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent-soft"
                  >
                    Open in the full workspace →
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2" aria-hidden>
                  {[90, 70, 80, 60, 75].map((w, i) => (
                    <div key={i} className="h-3 rounded bg-canvas-deep animate-shimmer" style={{ width: `${w}%` }} />
                  ))}
                  <p className="pt-4 text-center text-xs text-ink-faint">Result appears here when the pipeline finishes.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
