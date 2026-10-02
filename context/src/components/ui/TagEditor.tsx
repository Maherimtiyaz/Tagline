import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'

/* ============================================================
   TagEditor — Phase 23. User-editable tags for one thought.
   Chips with remove buttons, an inline "add" input (Enter /
   comma commits, Esc cancels), and duplicate/empty guarding.
   Tags seeded from extracted topics on first transform; fully
   editable afterwards.
   ============================================================ */

export function TagEditor({ thoughtId, className }: { thoughtId: string; className?: string }) {
  const tags = useAppStore((s) => s.thoughts.find((t) => t.id === thoughtId)?.tags ?? [])
  const addTag = useAppStore((s) => s.addTag)
  const removeTag = useAppStore((s) => s.removeTag)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const commit = () => {
    const ok = draft.trim() ? addTag(thoughtId, draft) : false
    setDraft('')
    if (!ok) setAdding(false)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-label="Tags">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas-deep py-0.5 pl-2 pr-1 text-xs text-ink-muted"
        >
          <span className="font-mono text-3xs text-ink-faint" aria-hidden>#</span>
          {tag}
          <button
            type="button"
            onClick={() => removeTag(thoughtId, tag)}
            aria-label={`Remove tag ${tag}`}
            className="rounded-sm p-0.5 text-ink-faint transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
          >
            <X size={11} aria-hidden />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') { setDraft(''); setAdding(false) }
          }}
          onBlur={commit}
          placeholder="tag name…"
          maxLength={24}
          aria-label="New tag name"
          className="h-6 w-28 rounded-md border border-accent-line bg-canvas-deep px-2 font-mono text-2xs placeholder:text-ink-subtle focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-ink-subtle transition-colors hover:border-accent-line hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
        >
          <Plus size={11} aria-hidden /> Add tag
        </button>
      )}
    </div>
  )
}
