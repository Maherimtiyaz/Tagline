import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Copy, Download, FolderOpen, History, Link2, Quote, Save, RotateCcw, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import type { GeneratedOutput, OutputType, ToneId } from '../../data/types'
import { COLLECTIONS } from '../../data/mock'
import { OUTPUT_TYPES, TONES } from '../../lib/outputMeta'
import { downloadExport, formatsFor, serializeExport } from '../../lib/exporters'
import { canNativeShare, shareDocument } from '../../lib/share'
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
  const rateOutput = useAppStore((s) => s.rateOutput)
  const [copied, setCopied] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'done' | 'fail'>('idle')
  const [drafting, setDrafting] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  const display = drafting ?? output.body

  /* Phase 18 — native share sheet (Web Share API) where available;
     otherwise the current (possibly hand-edited) body is encoded into a
     #share=… link (Phase 16) and copied to the clipboard. */
  const onShare = async () => {
    const method = await shareDocument({ text: display, format: 'text', title: output.title })
    if (method === 'failed') {
      setShareState('fail')
      pushToast('Could not reach clipboard; copy from the URL bar after opening the link', 'error')
    } else {
      setShareState('done')
      pushToast(method === 'native' ? 'Shared via system sheet' : 'Share link copied — opens anywhere', 'success')
    }
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
            aria-label={canNativeShare() ? 'Share this output via the system share sheet' : 'Copy a shareable link to this output'}
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
            {shareState === 'done'
              ? canNativeShare() ? 'Shared' : 'Link copied'
              : shareState === 'fail' ? 'Copy failed' : 'Share'}
          </button>
          {/* Phase 19 — version history popover */}
          <VersionHistory thoughtId={thoughtId} output={output} />
        </div>
        {/* Phase 29 — 👍/👎 feedback loop (spec §56 quality signal) */}
        <FeedbackRow thoughtId={thoughtId} output={output} rate={rateOutput} />
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
   FeedbackRow — Phase 29. 👍/👎 quality signal on every output.
   Toggle semantics: tapping the active rating clears it; the
   opposite rating replaces in place. Ratings land in the global
   History timeline (Phase 18 pattern) so §56 conversion tracking
   can count helpful vs rework-flagged drafts.
   ============================================================ */

export function FeedbackRow({
  thoughtId,
  output,
  rate,
}: {
  thoughtId: string
  output: GeneratedOutput
  rate: (thoughtId: string, outputId: string, rating: 'helpful' | 'needs-work') => boolean
}) {
  const current = output.feedback?.rating
  const btn = (rating: 'helpful' | 'needs-work', Icon: typeof ThumbsUp, label: string) => (
    <button
      key={rating}
      type="button"
      aria-pressed={current === rating}
      aria-label={current === rating ? `${label} — tap to clear feedback` : `Mark this draft as ${label}`}
      onClick={() => rate(thoughtId, output.id, rating)}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        current === rating && rating === 'helpful' && 'border-emerald bg-emerald-soft text-emerald',
        current === rating && rating === 'needs-work' && 'border-coral bg-coral-soft text-coral',
        current !== rating && 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
      )}
    >
      <Icon size={12} aria-hidden />
      {label}
    </button>
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-mono">Was this useful?</span>
      {btn('helpful', ThumbsUp, 'Helpful')}
      {btn('needs-work', ThumbsDown, 'Needs work')}
      {current && (
        <span className="text-2xs text-ink-faint tabular-nums" role="status">
          {current === 'helpful' ? 'Noted as helpful' : 'Flagged for rework'} · saved
        </span>
      )}
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

/* ============================================================
   VersionHistory — Phase 19. Every tone/format/quick change is
   auto-archived by the store; this popover lets you also save a
   named snapshot, preview, restore, or delete archived versions.
   Restoring is reversible (the pre-restore body is re-archived).
   Keyboard accessible: Esc closes and returns focus to trigger.
   ============================================================ */

const relTime = (at: number) => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function VersionHistory({ thoughtId, output }: { thoughtId: string; output: GeneratedOutput }) {
  const saveVersion = useAppStore((s) => s.saveVersion)
  const restoreVersion = useAppStore((s) => s.restoreVersion)
  const deleteVersion = useAppStore((s) => s.deleteVersion)
  const pushToast = useAppStore((s) => s.pushToast)
  const [open, setOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  /* Live list from the store — survives format/tone switches that
     replace the output object while keeping its id. */
  const live = useAppStore((s) => s.thoughts.find((t) => t.id === thoughtId)?.outputs.find((o) => o.id === output.id))
  const versions = live?.versions ?? []
  const preview = versions.find((v) => v.id === previewId) ?? null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewId) setPreviewId(null)
        else {
          setOpen(false)
          btnRef.current?.focus()
        }
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setPreviewId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open, previewId])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Version history for this output (${versions.length} saved)`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          open ? 'border-accent-line bg-accent-soft text-accent' : 'border-line bg-canvas-deep text-ink hover:border-line-strong',
        )}
      >
        <History size={13} aria-hidden /> History
        {versions.length > 0 && (
          <span className="rounded-full bg-accent-soft px-1.5 font-mono text-3xs text-accent">{versions.length}</span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Version history"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-72 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          {/* header + manual save */}
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <span className="label-mono text-accent">Versions</span>
            <button
              type="button"
              onClick={() => saveVersion(thoughtId, output.id, 'Manual save')}
              className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-2xs text-ink transition-colors hover:border-accent-line hover:text-accent"
            >
              <Save size={11} aria-hidden /> Save current
            </button>
          </div>

          {preview ? (
            /* read-only preview of one snapshot */
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold">{preview.label}</span>
                <span className="shrink-0 font-mono text-3xs text-ink-faint tabular-nums">{relTime(preview.at)}</span>
              </div>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-canvas-deep p-2 text-2xs leading-relaxed text-ink-muted">
                {preview.body}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    restoreVersion(thoughtId, output.id, preview.id)
                    setPreviewId(null)
                    setOpen(false)
                  }}
                  className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-2xs font-medium text-canvas transition-opacity hover:opacity-90"
                >
                  <RotateCcw size={11} aria-hidden /> Restore this version
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewId(null)}
                  className="rounded-md border border-line px-2.5 py-1.5 text-2xs text-ink-muted transition-colors hover:text-ink"
                >
                  Back
                </button>
              </div>
            </div>
          ) : versions.length === 0 ? (
            <p className="px-3 py-4 text-center text-2xs leading-relaxed text-ink-subtle">
              No saved versions yet. Tone and format changes are archived automatically here — or press
              <span className="mx-1 rounded border border-line bg-canvas-deep px-1 font-mono text-3xs">Save current</span>
              to snapshot this draft.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto p-1" aria-label="Saved versions">
              {versions.map((v) => (
                <li key={v.id} className="group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover">
                  <button
                    type="button"
                    onClick={() => setPreviewId(v.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-label={`Preview version ${v.label}, ${relTime(v.at)}`}
                  >
                    <span className="block truncate text-xs text-ink">{v.label}</span>
                    <span className="block font-mono text-3xs text-ink-faint tabular-nums">
                      {relTime(v.at)} · {v.tone} · {v.body.length} chars
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (restoreVersion(thoughtId, output.id, v.id)) setPreviewId(null)
                      else pushToast('That version no longer exists', 'error')
                    }}
                    aria-label={`Restore ${v.label}`}
                    className="rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <RotateCcw size={12} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteVersion(thoughtId, output.id, v.id)
                      if (previewId === v.id) setPreviewId(null)
                    }}
                    aria-label={`Delete ${v.label}`}
                    className="rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-coral focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
