import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import type { Template } from '../../data/types'
import { TEMPLATES } from '../../data/mock'
import { generateOutput } from '../../lib/mockAI'
import { OUTPUT_LABEL } from '../../lib/outputMeta'
import { Badge } from '../../components/ui/Badge'
import { Dialog } from '../../components/ui/Dialog'
import { cn } from '../../lib/cn'

/* ============================================================
   Templates (spec §35–§36). Each template declares its input
   requirements; filling them and pressing Generate composes a
   thought, runs it through the engine instantly and shows the
   result. Structured inputs → reliable outputs.
   ============================================================ */

export function TemplatesPage({ inApp = false }: { inApp?: boolean }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState<Template | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null)

  const composed = useMemo(() => {
    if (!open) return ''
    return Object.entries(values)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join('. ')
  }, [open, values])

  const start = () => {
    if (!open) return
    const text = composed || open.example
    const out = generateOutput(text, { type: open.outputType })
    setPreview({ title: out.title, body: out.body })
  }

  return (
    <div className={cn('mx-auto w-full max-w-4xl', inApp ? 'flex h-full flex-col' : 'px-4 py-10 md:px-6')}>
      {!inApp && (
        <header className="mb-8">
          <p className="label-mono mb-2">Templates</p>
          <h1 className="text-display-sm">Structured on purpose.</h1>
          <p className="mt-2 max-w-lg text-base text-ink-muted">
            Every template asks for exactly what it needs — then Context writes the rest.
          </p>
        </header>
      )}
      {inApp && (
        <header className="border-b border-line px-4 py-3 md:px-6">
          <h1 className="text-base font-semibold tracking-tight">Templates</h1>
          <p className="font-mono text-3xs text-ink-faint">structured inputs · dependable outputs</p>
        </header>
      )}

      <div className={cn('grid gap-3', inApp ? 'min-h-0 flex-1 overflow-y-auto p-4 sm:grid-cols-2 md:p-6' : 'sm:grid-cols-2 lg:grid-cols-3')}>
        {TEMPLATES.map((t) => (
          <article
            key={t.id}
            className="group flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors duration-[var(--duration-fast)] hover:border-line-strong"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">{t.name}</h2>
              <Badge tone="outline" className="ml-auto">{OUTPUT_LABEL[t.outputType]}</Badge>
            </div>
            <p className="flex-1 text-xs leading-relaxed text-ink-muted">{t.description}</p>
            <p className="mt-3 line-clamp-2 rounded-md bg-canvas-deep p-2 font-mono text-3xs leading-relaxed text-ink-subtle">
              {t.example.split('\n')[0]}
            </p>
            <button
              type="button"
              onClick={() => { setOpen(t); setValues({}); setPreview(null) }}
              className="mt-3 flex items-center justify-between rounded-md border border-line px-3 py-1.5 text-xs text-ink transition-colors group-hover:border-accent-line group-hover:text-accent"
            >
              Use template <ArrowRight size={12} aria-hidden />
            </button>
          </article>
        ))}
      </div>

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.name} labelledBy="tpl-dialog-title" sheet wide>
        {open && (
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="space-y-4 p-5">
              <p className="text-xs text-ink-muted">Input requirements — fill what you have. Context handles the shape.</p>
              {open.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="label-mono mb-1 block">{f.label}</span>
                  {f.multiline ? (
                    <textarea
                      rows={3}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full resize-none rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
                    />
                  ) : (
                    <input
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="h-9 w-full rounded-md border border-line bg-canvas-deep px-2.5 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
                    />
                  )}
                </label>
              ))}
              <button
                type="button"
                onClick={start}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-accent text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
              >
                <Play size={13} aria-hidden /> Generate
              </button>
            </div>
            <div className="border-t border-line bg-canvas-deep/50 p-5 sm:border-l sm:border-t-0">
              <p className="label-mono mb-2">Example output</p>
              {preview ? (
                <div className="animate-fade-up space-y-2">
                  <p className="text-sm font-semibold">{preview.title}</p>
                  <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">{preview.body}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/app')}
                    className="rounded-md border border-accent-line px-3 py-1.5 text-xs text-accent hover:bg-accent-soft"
                  >
                    Continue in workspace →
                  </button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-subtle">{open.example}</p>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
