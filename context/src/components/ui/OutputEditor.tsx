import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Copy, Download, FolderOpen, Link2, Quote } from 'lucide-react'
import type { GeneratedOutput, OutputType, ToneId } from '../../data/types'
import { COLLECTIONS } from '../../data/mock'
import { OUTPUT_TYPES, TONES } from '../../lib/outputMeta'
import { downloadExport, formatsFor, serializeExport } from '../../lib/exporters'
import { copyToClipboard, createShareLink } from '../../lib/share'
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
  const userCollections = useAppStore((s) => s.userCollections)
  const pushToast = useAppStore((s) => s.pushToast)
  const [copied, setCopied] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'done' | 'fail'>('idle')
  const [drafting, setDrafting] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  const display = drafting ?? output.body

  /* Phase 16 — real share links: the current (possibly hand-edited)
     body is encoded into a #share=… fragment so the link renders on
     any device without a backend. */
  const onShare = async () => {
    const link = createShareLink({ text: display, format: 'text', title: output.title })
    const ok = await copyToClipboard(link)
    setShareState(ok ? 'done' : 'fail')
    pushToast(
      ok ? 'Share link copied — opens anywhere' : 'Could not reach clipboard; copy from the URL bar after opening the link',
      ok ? 'success' : 'error',
    )
    window.setTimeout(() => setShareState('idle'), 1800)
  }

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
          <ExportMenu output={output} display={display} onDone={(fmt) => pushToast(`Exported ${fmt}`, 'success')} />
          {/* Save-to-collection menu (spec §37 / §65 "✓ Saved to collection") */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={saveOpen}
              onClick={() => setSaveOpen((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSaveOpen(false) }}
              className="flex items-center gap-1.5 rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-line-strong"
            >
              <FolderOpen size={13} aria-hidden /> Save
              <ChevronDown size={11} aria-hidden className={cn('transition-transform', saveOpen && 'rotate-180')} />
            </button>
            {saveOpen && (
              <div
                role="menu"
                aria-label="Save output to a collection"
                className="absolute left-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
              >
                {[...COLLECTIONS, ...userCollections].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitem"
                    onClick={() => { saveToCollection(thoughtId, output.id, c.id); setSaveOpen(false) }}
                    className="block w-full px-3 py-1.5 text-left text-xs text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onShare}
            aria-label="Copy a shareable link to this output"
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              shareState === 'done'
                ? 'border-accent-line bg-accent-soft text-accent'
                : shareState === 'fail'
                  ? 'border-coral text-coral'
                  : 'border-line bg-canvas-deep text-ink hover:border-line-strong',
            )}
          >
            {shareState === 'done' ? <Check size={13} aria-hidden /> : <Link2 size={13} aria-hidden />}
            {shareState === 'done' ? 'Link copied' : shareState === 'fail' ? 'Copy failed' : 'Share'}
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

/* ============================================================
   ExportMenu — Phase 11. Format-aware export popover: the
   offered formats depend on the output type (Slack → Block Kit
   JSON, email → .eml, everything → text/markdown). Keyboard
   accessible (Esc closes, focus returns to the trigger).
   ============================================================ */

export function ExportMenu({
  output,
  display,
  onDone,
}: {
  output: GeneratedOutput
  /** Body currently shown in the editor (may contain unsaved edits). */
  display: string
  onDone?: (formatLabel: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const formats = useMemo(() => formatsFor(output.type), [output.type])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const pick = (id: string, label: string) => {
    downloadExport({ ...output, body: display }, id)
    setOpen(false)
    onDone?.(label)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-line-strong"
      >
        <Download size={13} aria-hidden /> Export
        <ChevronDown size={12} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Export format"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-44 rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          {formats.map((f) => (
            <button
              key={f.id}
              role="menuitem"
              type="button"
              onClick={() => pick(f.id, f.label)}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-surface-hover"
            >
              {f.label}
              <span className="font-mono text-3xs text-ink-faint">.{f.ext}</span>
            </button>
          ))}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              const full = (output.subject ? `Subject: ${output.subject}\n\n` : '') + display
              navigator.clipboard?.writeText(serializeExport({ ...output, body: full }, 'markdown')).catch(() => {})
              setOpen(false)
              onDone?.('Markdown to clipboard')
            }}
            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-ink-muted transition-colors hover:bg-surface-hover"
          >
            Copy as Markdown
          </button>
        </div>
      )}
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
