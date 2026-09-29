import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { OUTPUT_LABEL } from '../../lib/outputMeta'
import { timeAgo } from '../../hooks/useTransformPipeline'
import { OutputEditor } from '../../components/ui/OutputEditor'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { cn } from '../../lib/cn'
import type { GeneratedOutput } from '../../data/types'

/* ============================================================
   Output workspace (spec §10, §27–§29) — /app/output/:thoughtId/:outputId

   The finished artifact gets its own focused screen: metadata
   header, a switcher between every output generated from the
   same thought, and the full editor (tone, format, copy/export).
   ============================================================ */

export function OutputWorkspace() {
  const { thoughtId = '', outputId = '' } = useParams()
  const navigate = useNavigate()
  const thought = useAppStore((s) => s.thoughts.find((t) => t.id === thoughtId))
  const select = useAppStore((s) => s.select)

  /* Keep the store's "selected thought" in sync so history + toasts
     reference the right context while the user is here. */
  useEffect(() => {
    if (thought) select(thought.id)
  }, [thought, select])

  if (!thought || thought.outputs.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center px-4">
        <EmptyState
          icon={<FileText size={20} />}
          title="No output here yet."
          body="This thought hasn't been transformed. Open it and pick what Context should make — email, plan, tasks…"
          action={
            <button
              onClick={() => navigate(thought ? `/app/thought/${thought.id}` : '/app')}
              className="inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Open the thought
            </button>
          }
        />
      </div>
    )
  }

  const active: GeneratedOutput | undefined =
    thought.outputs.find((o) => o.id === outputId) ?? thought.outputs[0]

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3 md:px-6">
        <button
          onClick={() => navigate(`/app/thought/${thought.id}`)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-ink-subtle transition-colors hover:bg-canvas-deep hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={14} aria-hidden /> Thought
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight">{active.title}</h1>
          <p className="font-mono text-3xs text-ink-faint">
            {OUTPUT_LABEL[active.type].toLowerCase()} · {active.tone} · created {timeAgo(active.createdAt)} ago
          </p>
        </div>
        {thought.outputs.length > 1 && (
          <nav aria-label="Outputs of this thought" className="order-last flex w-full flex-wrap gap-1.5 md:order-none md:w-auto">
            {thought.outputs.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate(`/app/output/${thought.id}/${o.id}`)}
                aria-current={o.id === active.id ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  o.id === active.id
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink-subtle hover:border-ink-faint hover:text-ink',
                )}
              >
                {OUTPUT_LABEL[o.type]}
                {o.id !== thought.outputs[0].id && <Badge tone="neutral">{timeAgo(o.createdAt)}</Badge>}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* remount per output so local edit state never leaks between them */}
        <OutputEditor key={active.id} thoughtId={thought.id} output={active} />
      </div>
    </div>
  )
}
