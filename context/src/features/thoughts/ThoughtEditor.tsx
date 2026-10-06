import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronRight, Loader2, Mic, RotateCcw, Wand2, X } from 'lucide-react'
import type { OutputType } from '../../data/types'
import { TEMPLATES } from '../../data/mock'
import { useAppStore, type EditorDraft } from '../../lib/store'
import { analyzeThought } from '../../lib/mockAI'
import { OUTPUT_TYPES, STAGE_COPY, STAGE_ORDER } from '../../lib/outputMeta'
import { useTransformPipeline } from '../../hooks/useTransformPipeline'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { ContextPanelBody } from '../../components/ui/ContextChip'
import { TagEditor } from '../../components/ui/TagEditor'
import { StageRail, ThoughtScatter, Waveform } from '../../animations/Transformation'
import { OutputEditor } from '../../components/ui/OutputEditor'
import { VoiceCapture } from '../voice/VoiceCapture'
import { cn } from '../../lib/cn'
import { Kbd } from '../../components/ui/Kbd'

/* ============================================================
   ThoughtEditor — the focused workspace flow:
   capture → understand (stages) → choose transformation →
   output. ESC closes; ⌘↵ runs the suggested transform.
   ============================================================ */

export function ThoughtEditor({ thoughtId, onClose, initialType }: { thoughtId: string; onClose: () => void; initialType?: OutputType }) {
  const thought = useAppStore((s) => s.thoughts.find((t) => t.id === thoughtId))
  const updateText = useAppStore((s) => s.updateThoughtText)
  const addThought = useAppStore((s) => s.addThought)
  const transform = useAppStore((s) => s.transform)
  const reduced = useReducedMotion()
  const pipeline = useTransformPipeline(reduced)
  const [phase, setPhase] = useState<'raw' | 'decompose' | 'structured'>('raw')
  const [chosen, setChosen] = useState<OutputType | null>(null)
  const [outputId, setOutputId] = useState<string | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  /* Local draft of the thought text — store only commits on blur /
     transform so typing stays smooth and undoable by the browser. */
  const [draft, setDraft] = useState(thought?.text ?? '')
  /* Phase 34: autosave + recovery banner. A persisted autosave that
     differs from the committed row is offered (never auto-applied). */
  const saveDraft = useAppStore((s) => s.saveDraft)
  const clearDraftKey = useAppStore((s) => s.clearDraft)
  const getDraft = useAppStore((s) => s.getDraft)
  const pushToast = useAppStore((s) => s.pushToast)
  const [recovery, setRecovery] = useState<EditorDraft | null>(null)
  const autosaveTimer = useRef<number | undefined>(undefined)

  /* Offer recovery once per mount (before any keystroke overwrites it). */
  useEffect(() => {
    const stored = getDraft(thoughtId)
    if (stored && stored.text !== (thought?.text ?? '')) setRecovery(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Debounced autosave: mirror unsaved text 800ms after typing stops. */
  useEffect(() => {
    window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => saveDraft(thoughtId, draft), 800)
    return () => window.clearTimeout(autosaveTimer.current)
  }, [draft, thoughtId, saveDraft])

  /* When the draft matches the committed row there is nothing to recover. */
  useEffect(() => {
    if (recovery && recovery.text === thought?.text) setRecovery(null)
  }, [recovery, thought])

  const applyRecovery = () => {
    if (!recovery) return
    setDraft(recovery.text)
    commitDraft(recovery.text)
    setRecovery(null)
    pushToast('Recovered your last edit', 'success')
  }

  const discardRecovery = () => {
    if (!recovery) return
    clearDraftKey(thoughtId)
    setRecovery(null)
  }

  const [slash, setSlash] = useState<string | null>(null)
  const [slashIdx, setSlashIdx] = useState(0)

  /* Template entry point (spec §36): ?template=tp-* seeds a focused
     capture with the template's required fields as prompts. */
  const template = useMemo(() => {
    if (!thought || !thought.text.startsWith('Template:')) return null
    return TEMPLATES.find((t) => thought.text.slice(9).startsWith(t.name)) ?? null
  }, [thought])
  const [tplValues, setTplValues] = useState<Record<string, string>>({})
  const tplFormId = useId()

  const commitDraft = (value: string) => {
    if (value !== thought?.text) updateText(thoughtId, value)
    /* Phase 34: the store row now matches the editor — autosave is moot. */
    clearDraftKey(thoughtId)
  }

  const result = useMemo(() => (draft.trim() ? analyzeThought(draft) : null), [draft])
  const running = pipeline.stage !== 'idle' && pipeline.stage !== 'ready'
  const output = thought?.outputs.find((o) => o.id === outputId) ?? thought?.outputs[0]

  /* Slash commands / template "Use" run the transformation immediately
     on open (spec §31, §36). Guarded by a ref so it fires once per mount. */
  const autoRan = useRef(false)
  useEffect(() => {
    if (initialType && thought && !autoRan.current) {
      autoRan.current = true
      runUnderstand(initialType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slashMatches = useMemo(() => {
    if (slash === null) return []
    const q = slash.toLowerCase()
    return OUTPUT_TYPES.filter(
      (t) => t.command.slice(1).startsWith(q) || t.label.toLowerCase().startsWith(q),
    ).slice(0, 7)
  }, [slash])

  if (!thought) return null

  const runUnderstand = (type?: OutputType, textOverride?: string) => {
    const target = type ?? result?.suggestions[0]?.type ?? 'email'
    setChosen(target)
    setOutputId(null)
    if (textOverride !== undefined && textOverride.trim() !== (thought?.text ?? '')) {
      updateText(thoughtId, textOverride)
    }
    pipeline.run(() => {
      const out = transform(thought.id, target)
      setOutputId(out.id)
    })
    if (!reduced) {
      window.setTimeout(() => setPhase('decompose'), 420)
      window.setTimeout(() => setPhase('structured'), 1080)
    } else {
      setPhase('structured')
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (draft.trim()) { commitDraft(draft); runUnderstand(undefined, draft) }
    }
    if (e.key === 'Escape') {
      /* ESC dismisses the slash-command menu first, then closes. */
      if (slash !== null) { setSlash(null); return }
      if (pipeline.stage === 'ready') { pipeline.reset(); setPhase('raw'); setChosen(null) }
      else onClose()
    }
  }

  /* Slash commands (spec §31): typing "/" at the start of a line opens
     a filterable transform menu; Enter/Tab runs the highlighted one. */
  const applySlash = (type: OutputType) => {
    const stripped = draft.replace(/\/[a-z]*$/i, '')
    commitDraft(stripped.replace(/\s+$/, ''))
    setSlash(null)
    runUnderstand(type)
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    const m = value.match(/(?:^|\n)\/([a-z]*)$/i)
    setSlash(m ? m[1] : null)
  }

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.21, 0.6, 0.35, 1] }}
      onKeyDown={onKeyDown}
      aria-label="Thought editor"
      className="flex h-full min-h-0 flex-col"
    >
      {/* header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Inbox
        </button>
        <span className="h-4 w-px bg-line" aria-hidden />
        <p className="font-mono text-3xs text-ink-faint">
          {thought.source} · {new Date(thought.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {pipeline.stage === 'ready' && (
            <button type="button" onClick={() => { pipeline.reset(); setPhase('raw'); setChosen(null) }} className="rounded-md border border-line px-2 py-1 text-2xs text-ink-muted hover:border-line-strong hover:text-ink">
              Transform again
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close editor" className="rounded-md p-1 text-ink-subtle hover:bg-surface-hover hover:text-ink">
            <X size={15} aria-hidden />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {pipeline.stage === 'idle' && !output && (
          /* ---------- CAPTURE STATE ---------- */
          <div className="mx-auto max-w-2xl space-y-6 p-6">
            {template ? (
              /* Template flow (spec §36): structured fields → Generate. */
              <form
                id={tplFormId}
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const composed = template.fields
                    .filter((f) => (tplValues[f.key] ?? '').trim())
                    .map((f) => `${f.label}: ${tplValues[f.key].trim()}`)
                    .join('\n')
                  runUnderstand(template.outputType, composed || thought.text)
                }}
              >
                <div className="flex items-start gap-3 rounded-xl border border-accent-line bg-accent-soft/50 p-4">
                  <Wand2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{template.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{template.description}</p>
                  </div>
                </div>
                {template.fields.map((f) => (
                  <div key={f.key}>
                    <label htmlFor={`${tplFormId}-${f.key}`} className="label-mono mb-1.5 block">{f.label}</label>
                    {f.multiline ? (
                      <textarea
                        id={`${tplFormId}-${f.key}`}
                        rows={4}
                        value={tplValues[f.key] ?? ''}
                        onChange={(e) => setTplValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full resize-none rounded-lg border border-line bg-canvas-deep p-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                      />
                    ) : (
                      <input
                        id={`${tplFormId}-${f.key}`}
                        type="text"
                        value={tplValues[f.key] ?? ''}
                        onChange={(e) => setTplValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="h-9 w-full rounded-lg border border-line bg-canvas-deep px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                      />
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={!Object.values(tplValues).some((v) => v.trim())}
                    className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-45"
                  >
                    <Wand2 size={14} aria-hidden /> Generate {template.name.toLowerCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateText(thoughtId, '')}
                    className="text-2xs text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
                  >
                    or write a free thought instead
                  </button>
                </div>
              </form>
            ) : (
            <>
            {/* Phase 34: draft-recovery banner — offered, never auto-applied. */}
            <AnimatePresence>
              {recovery && (
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                  role="status"
                >
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-accent-line bg-accent-soft px-3 py-2.5">
                    <RotateCcw size={14} className="shrink-0 text-accent" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-xs text-ink">
                      Unsaved edit from{' '}
                      <span className="font-mono text-2xs text-ink-subtle">
                        {new Date(recovery.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>{' '}
                      was recovered after a refresh.
                    </p>
                    <button
                      type="button"
                      onClick={applyRecovery}
                      className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-2xs font-medium text-canvas transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Restore it
                    </button>
                    <button
                      type="button"
                      onClick={discardRecovery}
                      aria-label="Discard recovered draft"
                      className="shrink-0 rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label htmlFor="thought-input" className="label-mono mb-2 block">Your thought</label>
              {/* Slash-command menu (spec §31): opens when a line starts with "/" */}
              <div className="relative">
                <AnimatePresence>
                  {slash !== null && slashMatches.length > 0 && (
                    <motion.ul
                      role="listbox"
                      aria-label="Transform commands"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: reduced ? 0 : 0.14 }}
                      className="absolute bottom-full left-0 z-30 mb-2 w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
                    >
                      {slashMatches.map((t, i) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={i === slashIdx}
                            onClick={() => applySlash(t.id)}
                            onMouseEnter={() => setSlashIdx(i)}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                              i === slashIdx ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-surface-hover',
                            )}
                          >
                            <span className="font-mono text-2xs text-accent">{t.command}</span>
                            <span>{t.label}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
                <textarea
                  id="thought-input"
                  autoFocus
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onBlur={() => commitDraft(draft)}
                  onKeyDownCapture={(e) => {
                    if (slash === null || slashMatches.length === 0) return
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx((i) => (i + 1) % slashMatches.length) }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIdx((i) => (i - 1 + slashMatches.length) % slashMatches.length) }
                    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySlash(slashMatches[slashIdx].id) }
                  }}
                  rows={7}
                  spellCheck={false}
                  placeholder="Dump it however it comes out. Incomplete sentences are fine. Type / for commands."
                  className="w-full resize-none rounded-xl border border-line bg-canvas-deep p-4 font-mono text-base leading-relaxed text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="font-mono text-3xs text-ink-faint" aria-live="polite">
                  {draft.length} chars · autosaved locally
                </p>
                <button
                  type="button"
                  onClick={() => setVoiceOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-accent-line hover:text-accent"
                  aria-expanded={voiceOpen}
                >
                  <Mic size={12} aria-hidden /> Hold to speak
                </button>
              </div>
              <AnimatePresence>
                {voiceOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }} className="overflow-hidden"
                  >
                    <div className="pt-3">
                      <VoiceCapture
                        compact
                        seed={thought.id.length}
                        onComplete={(t) => { setDraft(t); commitDraft(t); setVoiceOpen(false) }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* contextual transform actions, not a dropdown */}
            <div>
              <p className="label-mono mb-2">Transform into</p>
              {result && result.suggestions.length > 0 && thought.text.trim() ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.suggestions.map((sug, i) => (
                    <button
                      key={sug.type + i}
                      type="button"
                      onClick={() => runUnderstand(sug.type)}
                      disabled={!thought.text.trim()}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-[var(--duration-fast)]',
                        i === 0 ? 'border-accent-line bg-accent-soft hover:bg-accent-soft/70' : 'border-line bg-surface hover:border-line-strong',
                        !thought.text.trim() && 'pointer-events-none opacity-45',
                      )}
                    >
                      <Wand2 size={15} className={i === 0 ? 'text-accent' : 'text-ink-faint'} aria-hidden />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{sug.label}</span>
                        {/* Phase 37 — explainable suggestions (spec §25): the
                            "why" is always visible, not hidden behind a tooltip. */}
                        {sug.reason && (
                          <span className="block text-2xs leading-snug text-ink-muted">{sug.reason}</span>
                        )}
                        <span className="font-mono text-3xs text-ink-faint">
                          confidence {(sug.confidence * 100).toFixed(0)}%
                        </span>
                      </span>
                      <ChevronRight size={14} className="text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {OUTPUT_TYPES.slice(0, 6).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { if (!thought.text.trim()) { const id = addThought(`New ${t.label.toLowerCase()} thought`); transform(id, t.id); onClose() } else runUnderstand(t.id) }}
                      className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {t.label}
                      <span className="ml-2 font-mono text-3xs text-ink-faint">{t.command}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 flex items-center gap-2 text-2xs text-ink-faint">
                or press <Kbd keys={['⌘', '↵']} /> to run the top suggestion
              </p>
            </div>
            </>
            )}
          </div>
        )}

        {(running || pipeline.stage === 'understanding') && (
          /* ---------- UNDERSTANDING STATE ---------- */
          <div className="mx-auto grid max-w-4xl gap-8 p-6 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <p className="label-mono mb-3">Raw thought</p>
              <ThoughtScatter
                text={thought.text}
                understanding={result!.understanding}
                phase={phase}
              />
            </div>
            <div className="hidden w-px bg-line md:block" aria-hidden />
            <div className="space-y-4">
              <p className="label-mono">Context is reading it</p>
              <StageRail stages={STAGE_ORDER} currentIndex={pipeline.stageIndex} labels={STAGE_COPY} />
              {phase !== 'raw' && (
                <>
                  <p className="label-mono pt-2">Extracted</p>
                  <ContextPanelBody u={result!.understanding} />
                </>
              )}
              <div className="flex justify-center pt-2">
                <Waveform active bars={16} />
              </div>
            </div>
          </div>
        )}

        {pipeline.stage === 'ready' && output && chosen && (
          /* ---------- OUTPUT STATE ---------- */
          <div className="grid h-full min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-[60vh] lg:min-h-0">
              <OutputEditor thoughtId={thought.id} output={output} />
            </div>
            <aside className="hidden min-h-0 overflow-y-auto rounded-xl border border-line bg-surface p-4 lg:block" aria-label="Extracted context">
              <div className="mb-3 flex items-center gap-2">
                <Check size={13} className="text-emerald" aria-hidden />
                <p className="label-mono">Understanding</p>
              </div>
              <ContextPanelBody u={analyzeThought(thought.text).understanding} />
              {/* Phase 23 — user tags, seeded from topics on transform */}
              <p className="label-mono mt-6 mb-2">Tags</p>
              <TagEditor thoughtId={thought.id} />
              <p className="label-mono mt-6 mb-2">Original thought</p>
              <p className="font-mono text-2xs leading-relaxed text-ink-subtle">"{thought.text}"</p>
            </aside>
          </div>
        )}

        {pipeline.stage === 'error' && (
          <div className="mx-auto max-w-md p-10 text-center">
            <p className="text-sm text-coral">Something interrupted the transformation.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => runUnderstand(chosen ?? undefined)} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">Try again</button>
              <button type="button" onClick={() => { pipeline.reset(); setPhase('raw') }} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-line-strong">Edit thought</button>
            </div>
          </div>
        )}
      </div>

      {running && (
        <div className="h-0.5 w-full shrink-0 overflow-hidden bg-line" role="progressbar" aria-label={STAGE_COPY[pipeline.stage]}>
          <motion.div
            className="h-full bg-accent"
            initial={{ width: '8%' }}
            animate={{ width: `${20 + pipeline.stageIndex * 20}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}
      {pipeline.stage === 'writing' && (
        <p className="sr-only" aria-live="polite">Writing draft</p>
      )}
      <Loader2 className="hidden" aria-hidden />
    </motion.section>
  )
}
