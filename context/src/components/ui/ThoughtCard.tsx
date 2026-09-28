import { useMemo } from 'react'
import { Mic, Image as ImageIcon, Type, FileDown } from 'lucide-react'
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

export const SOURCE_META: Record<SourceType, { label: string; icon: React.ReactNode }> = {
  voice: { label: 'Voice', icon: <Mic size={12} aria-hidden /> },
  text: { label: 'Text', icon: <Type size={12} aria-hidden /> },
  screenshot: { label: 'Screenshot', icon: <ImageIcon size={12} aria-hidden /> },
  import: { label: 'Import', icon: <FileDown size={12} aria-hidden /> },
}

export function ThoughtCard({
  id,
  text,
  source,
  createdAt,
  status,
  outputCount,
  onOpen,
  onTransform,
  onDelete,
}: {
  id: string
  text: string
  source: SourceType
  createdAt: number
  status: string
  outputCount: number
  onOpen: () => void
  onTransform: () => void
  /** When provided (Drafts view), replaces Archive with Delete. */
  onDelete?: () => void
}) {
  const archive = useAppStore((s) => s.archiveThought)
  const preview = useMemo(() => (text.length > 150 ? text.slice(0, 150) + '…' : text), [text])
  const suggestion = useMemo(() => (text.trim() ? analyzeThought(text).suggestions[0] : null), [text])

  return (
    <article
      className={cn(
        'group relative rounded-lg border border-line bg-surface p-4 transition-colors duration-[var(--duration-fast)]',
        'hover:border-line-strong focus-within:border-accent-line',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-pointer text-left focus-visible:outline-none"
        aria-label={`Open thought: ${preview.slice(0, 60)}`}
      >
        <p className={cn('text-sm leading-relaxed', status === 'archived' ? 'text-ink-faint line-through' : 'text-ink')}>
          {text.trim() ? `"${preview}"` : <span className="italic text-ink-faint">Empty draft — open it and start typing.</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-mono text-3xs text-ink-subtle">{timeAgo(createdAt)}</span>
          <Badge tone="outline" className="gap-1">
            {SOURCE_META[source].icon}
            {SOURCE_META[source].label}
          </Badge>
          {status === 'processed' && (
            <Badge tone="success">{outputCount} output{outputCount === 1 ? '' : 's'}</Badge>
          )}
          {status === 'raw' && suggestion && (
            <span className="font-mono text-3xs text-ink-faint opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100">
              suggests: {suggestion.type}
            </span>
          )}
        </div>
      </button>

      {/* hover-revealed actions */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-[var(--duration-micro)] group-hover:opacity-100 group-focus-within:opacity-100">
        {text.trim() && (
          <button
            type="button"
            onClick={onTransform}
            className="rounded-md bg-accent px-2 py-1 text-2xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Transform
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
