import { useMemo, type ReactNode } from 'react'
import { Check, Mic, Image as ImageIcon, Type, FileDown, Pin, PinOff, Star, CalendarRange } from 'lucide-react'
import type { SourceType } from '../../data/types'
import { timeAgo } from '../../hooks/useTransformPipeline'
import { useAppStore } from '../../lib/store'
import { analyzeThought } from '../../lib/mockAI'
import { cn } from '../../lib/cn'
import { Badge } from './Badge'

/* ============================================================
   ThoughtCard — deliberately quiet. Hover reveals the three
   actions (Transform / Edit handled by click, Archive). No
   borders screaming for attention; emphasis is a hairline.
   ============================================================ */

export const SOURCE_META: Record<SourceType, { label: string; icon: ReactNode }> = {
  voice: { label: 'Voice', icon: <Mic size={12} aria-hidden /> },
  text: { label: 'Text', icon: <Type size={12} aria-hidden /> },
  screenshot: { label: 'Screenshot', icon: <ImageIcon size={12} aria-hidden /> },
  import: { label: 'Import', icon: <FileDown size={12} aria-hidden /> },
  /* Phase 40 — weekly digest rows get their own quiet badge. */
  digest: { label: 'Digest', icon: <CalendarRange size={12} aria-hidden /> },
}

export function ThoughtCard({
  id,
  text,
  source,
  createdAt,
  status,
  outputCount,
  pinned,
  starred,
  tags,
  suggestionReason,
  onOpen,
  onTransform,
  onDelete,
  selection,
}: {
  id: string
  text: string
  source: SourceType
  createdAt: number
  status: string
  outputCount: number
  /** Phase 22 — pinned thoughts float to the top of inbox views. */
  pinned?: boolean
  /** Phase 23 — user tags rendered as quiet chips on the meta row. */
  tags?: string[]
  /** Phase 25 — starred thoughts sort above pinned ones. */
  starred?: boolean
  /** Phase 38 — the engine's "why" for its top suggestion (spec §25). */
  suggestionReason?: string
  onOpen: () => void
  onTransform: () => void
  /** When provided (Drafts view), replaces Archive with Delete. */
  onDelete?: () => void
  /** Phase 20 multi-select — when provided, shows a checkbox affordance. */
  selection?: { checked: boolean; onToggle: () => void }
}) {
  const archive = useAppStore((s) => s.archiveThought)
  const togglePin = useAppStore((s) => s.togglePin)
  const toggleStar = useAppStore((s) => s.toggleStar)
  /* Phase 35 — draft ↔ ready lifecycle (store guards archived rows and
     rows that already carry outputs). */
  const setStatus = useAppStore((s) => s.setStatus)
  const preview = useMemo(() => (text.length > 150 ? text.slice(0, 150) + '…' : text), [text])
  const suggestion = useMemo(() => (text.trim() ? analyzeThought(text).suggestions[0] : null), [text])

  return (
    <article
      className={cn(
        'group relative rounded-lg border border-line bg-surface p-4 transition-colors duration-[var(--duration-fast)]',
        'hover:border-line-strong focus-within:border-accent-line',
        selection?.checked && 'border-accent-line bg-accent-soft/40',
      )}
    >
      {/* Phase 20: multi-select checkbox — always visible when the view
          enables selection, so the affordance never hides on touch. */}
      {selection && (
        <button
          type="button"
          role="checkbox"
          aria-checked={selection.checked}
          aria-label={`Select thought: ${preview.slice(0, 40) || 'empty draft'}`}
          onClick={selection.onToggle}
          className={cn(
            'absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line',
            selection.checked
              ? 'border-accent bg-accent text-accent-ink'
              : 'border-line-strong bg-surface text-transparent hover:border-accent-line',
          )}
        >
          <Check size={12} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        className={cn('block w-full cursor-pointer text-left focus-visible:outline-none', selection && 'pl-7')}
        aria-label={`Open thought: ${preview.slice(0, 60)}`}
      >
        <p className={cn('text-sm leading-relaxed', status === 'archived' ? 'text-ink-faint line-through' : 'text-ink')}>
          {text.trim() ? `"${preview}"` : <span className="italic text-ink-faint">Empty draft — open it and start typing.</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {starred && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 font-mono text-3xs text-accent-ink" aria-label="Starred thought">
              <Star size={9} fill="currentColor" aria-hidden />
              Starred
            </span>
          )}
          {pinned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 font-mono text-3xs text-accent-ink" aria-label="Pinned thought">
              <Pin size={9} aria-hidden />
              Pinned
            </span>
          )}
          {/* Phase 23 — quiet tag chips */}
          {(tags ?? []).slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-md border border-line bg-canvas-deep px-1.5 py-0.5 font-mono text-3xs text-ink-subtle">
              #{tag}
            </span>
          ))}
          <span className="font-mono text-3xs tabular-nums text-ink-subtle">{timeAgo(createdAt)}</span>
          <Badge tone="outline" className="gap-1">
            {SOURCE_META[source].icon}
            {SOURCE_META[source].label}
          </Badge>
          {status === 'processed' && (
            <Badge tone="success">{outputCount} output{outputCount === 1 ? '' : 's'}</Badge>
          )}
          {status === 'raw' && suggestion && (
            <span
              className="font-mono text-3xs text-ink-faint opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100"
              title={suggestionReason}
            >
              suggests: {suggestion.type}
              {/* Phase 38 — the "why" is available on hover/focus, not just in the editor. */}
              {suggestionReason && (
                <span className="ml-2 normal-case tracking-normal italic opacity-75">
                  — {suggestionReason}
                </span>
              )}
            </span>
          )}
        </div>
      </button>

      {/* hover-revealed actions */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-[var(--duration-micro)] group-hover:opacity-100 group-focus-within:opacity-100">
        {/* Phase 25: star toggle — sits left of pin, mirrors pin's quiet style. */}
        <button
          type="button"
          onClick={() => toggleStar(id)}
          aria-label={starred ? 'Unstar thought' : 'Star thought'}
          aria-pressed={!!starred}
          className={cn(
            'flex h-[26px] w-[26px] items-center justify-center rounded-md border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line',
            starred
              ? 'border-accent-line bg-accent-soft text-accent'
              : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
          )}
        >
          <Star size={12} fill={starred ? 'currentColor' : 'none'} aria-hidden />
        </button>
        {/* Phase 22: pin toggle — always available, sits left of Transform. */}
        <button
          type="button"
          onClick={() => togglePin(id)}
          aria-label={pinned ? 'Unpin thought' : 'Pin thought to top'}
          aria-pressed={!!pinned}
          className={cn(
            'flex h-[26px] w-[26px] items-center justify-center rounded-md border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line',
            pinned
              ? 'border-accent-line bg-accent-soft text-accent'
              : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
          )}
        >
          {pinned ? <PinOff size={12} aria-hidden /> : <Pin size={12} aria-hidden />}
        </button>
        {text.trim() && (
          <button
            type="button"
            onClick={onTransform}
            className="rounded-md bg-accent px-2 py-1 text-2xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Transform
          </button>
        )}
        {/* Phase 35: lifecycle toggle — raw drafts can be marked ready so
            they leave the Inbox queue without needing an output yet. */}
        {status === 'raw' && text.trim() && (
          <button
            type="button"
            onClick={() => setStatus(id, 'processed')}
            className="rounded-md border border-line bg-surface px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-emerald hover:text-emerald"
            aria-label="Mark thought as ready"
          >
            Mark ready
          </button>
        )}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-line bg-surface px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-coral hover:text-coral"
            aria-label="Delete draft"
          >
            Delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => archive(id)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            aria-label="Archive thought"
          >
            Archive
          </button>
        )}
      </div>
    </article>
  )
}
