import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Download, Link2, Quote } from 'lucide-react'
import type { GeneratedOutput, OutputType, ToneId } from '../../data/types'
import { OUTPUT_TYPES, TONES } from '../../lib/outputMeta'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Select } from '../ui/Select'

/* ============================================================
   OutputEditor — editable result with the transformation loop
   around it: tone segmented control, format switcher, quick
   commands (shorter / clearer), copy / export / save / share.
   Changes feel instantaneous (spec §28): pure local rewrites.
   ============================================================ */

const FORMAT_OPTIONS = OUTPUT_TYPES.map((t) => ({ value: t.id, label: t.label }))

export function OutputEditor({
  thoughtId,
  output,
}: {
  thoughtId: string
  output: GeneratedOutput
}) {
  const retone = useAppStore((s) => s.retone)
  const reformat = useAppStore((s) => s.reformat)
  const editBody = useAppStore((s) => s.editOutputBody)
  const saveToCollection = useAppStore((s) => s.saveToCollection)
  const pushToast = useAppStore((s) => s.pushToast)
  const [copied, setCopied] = useState(false)
  const [drafting, setDrafting] = useState<string | null>(null)

  const display = drafting ?? output.body

  const onCopy = async () => {
    const full = (output.subject ? `Subject: ${output.subject}\n\n` : '') + display
    try {
      await navigator.clipboard.writeText(full)
    } catch {
      /* clipboard blocked in sandbox — still show feedback */
    }
    setCopied(true)
    pushToast('Copied to clipboard')
    window.setTimeout(() => setCopied(false), 1600)
  }

  const onExport = () => {
    const blob = new Blob([`# ${output.title}\n\n${display}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${output.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    pushToast('Export ready')
  }

  const applyQuick = (kind: 'shorter' | 'clearer') => {
    const lines = display.split('\n')
    let next = display
    if (kind === 'shorter') {
      // deterministic trim: drop filler clauses & merge short paragraphs
      next = lines
        .map((l) => l.replace(/, (?:actually|basically|honestly|just to be clear)[^,]*,/gi, ',').replace(/\s{2,}/g, ' '))
        .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
        .join('\n')
    } else {
      next = lines
        .map((l) => l.replace(/(?:i think|probably|maybe|kind of|sort of)\s+/gi, ''))
        .join('\n')
    }
    editBody(thoughtId, output.id, next)
    setDrafting(null)
    pushToast(kind === 'shorter' ? 'Made shorter' : 'Made clearer', 'info')
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      {/* header */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="label-mono text-accent">Output</span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{output.title}</h3>
        <Select
          ariaLabel="Change output format"
          size="sm"
          options={FORMAT_OPTIONS}
          value={output.type}
          onChange={(v) => reformat(thoughtId, output.id, v as OutputType)}
          className="w-32"
        />
      </header>

      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2">
        <div role="group" aria-label="Formatting" className="flex items-center gap-0.5">
          {(['Bold', 'Italic'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-label={k}
              onClick={() => pushToast(`${k} applies in the full product`, 'info')}
              className={cn(
                'h-7 w-7 rounded-md text-xs italic text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink',
                k === 'Bold' && 'font-bold not-italic',
              )}
            >
              {k[0]}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          {['List', 'Link'].map((k) => (
            <button
              key={k}
              type="button"
              aria-label={k}
              onClick={() => pushToast(`${k} applies in the full product`, 'info')}
              className="h-7 rounded-md px-2 text-2xs text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
            >
              {k}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-3xs text-ink-faint">{display.length} chars</span>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {output.subject && (
          <p className="mb-3 border-l-2 border-accent-line pl-3 text-sm">
            <span className="text-ink-subtle">Subject: </span>
            <span className="font-medium">{output.subject}</span>
          </p>
        )}
        <textarea
          value={display}
          onChange={(e) => setDrafting(e.target.value)}
          onBlur={() => { if (drafting !== null) { editBody(thoughtId, output.id, drafting); setDrafting(null) } }}
          aria-label="Editable output"
          spellCheck={false}
          className="h-full min-h-56 w-full resize-none bg-transparent text-base leading-relaxed text-ink outline-none"
        />
      </div>

      {/* footer actions */}
      <footer className="shrink-0 space-y-3 border-t border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              copied ? 'border-emerald bg-emerald-soft text-emerald' : 'border-line bg-canvas-deep text-ink hover:border-line-strong',
            )}
          >
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={onExport} className="flex items-center gap-1.5 rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-line-strong">
            <Download size={13} aria-hidden /> Export
          </button>
          <button type="button" onClick={() => saveToCollection(thoughtId, output.id, 'Client Work')} className="flex items-center gap-1.5 rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-line-strong">
            Save
          </button>
          <button type="button" onClick={() => pushToast('Share link copied (demo)', 'success')} className="flex items-center gap-1.5 rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-line-strong">
            <Link2 size={13} aria-hidden /> Share
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono">Tone</span>
          <SegmentedControl
            ariaLabel="Tone"
            size="sm"
            options={TONES.map((t) => ({ value: t.id, label: t.label }))}
            value={output.tone}
            onChange={(v) => retone(thoughtId, output.id, v as ToneId)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Quote size={12} className="text-ink-faint" aria-hidden />
          {[
            { k: 'shorter' as const, label: 'Make shorter' },
            { k: 'clearer' as const, label: 'Make clearer' },
          ].map((q) => (
            <button
              key={q.k}
              type="button"
              onClick={() => applyQuick(q.k)}
              className="rounded-full border border-line px-2.5 py-1 text-2xs text-ink-muted transition-colors hover:border-accent-line hover:text-accent"
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => reformat(thoughtId, output.id, 'slack')}
            className="rounded-full border border-line px-2.5 py-1 text-2xs text-ink-muted transition-colors hover:border-accent-line hover:text-accent"
          >
            Turn into Slack message
          </button>
          <button
            type="button"
            onClick={() => reformat(thoughtId, output.id, 'tasks')}
            className="rounded-full border border-line px-2.5 py-1 text-2xs text-ink-muted transition-colors hover:border-accent-line hover:text-accent"
          >
            Turn into task list
          </button>
        </div>
      </footer>
    </div>
  )
}

/** Typewriter-ish reveal used when an output first lands. */
export function OutputReveal({ output }: { output: GeneratedOutput }) {
  const words = useMemo(() => output.body.split(/(\s+)/), [output.body])
  return (
    <motion.p
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.012 } } }}
      className="whitespace-pre-wrap text-sm leading-relaxed text-ink"
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
          className="inline"
        >
          {w}
        </motion.span>
      ))}
    </motion.p>
  )
}

void AnimatePresence
