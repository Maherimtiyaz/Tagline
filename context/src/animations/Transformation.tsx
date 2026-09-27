import { useMemo } from 'react'
import { motion, useReducedMotion as useFMReduced } from 'framer-motion'
import type { Understanding } from '../data/types'
import { decompose } from '../lib/mockAI'
import { cn } from '../lib/cn'

/* ============================================================
   Signature "thought transformation" (spec §43).

   Raw words sit slightly scattered. As stages advance, concept
   words highlight and lift into labelled buckets (Intent ·
   Person · Date · Topic), then the extraction settles into a
   calm chip row. One component, three visual phases — text is
   never instantly replaced.
   ============================================================ */

const BUCKET_LABEL = {
  intent: 'Intent',
  person: 'Person',
  date: 'Date',
  topic: 'Topic',
} as const

export function ThoughtScatter({
  text,
  understanding,
  phase,
  className,
}: {
  text: string
  understanding: Understanding
  phase: 'raw' | 'decompose' | 'structured'
  className?: string
}) {
  const reduced = useFMReduced()
  const words = useMemo(() => decompose(text), [text])

  /* deterministic pseudo-random offsets keep renders stable */
  const jitter = useMemo(
    () =>
      words.map((_, i) => ({
        r: ((i * 37) % 7) - 3,
        y: ((i * 53) % 9) - 4,
      })),
    [words],
  )

  return (
    <div className={cn('relative', className)}>
      <motion.p
        layout
        className="flex flex-wrap gap-x-1.5 gap-y-1 font-mono text-sm leading-relaxed text-ink-muted"
        aria-label={`Raw thought: ${text}`}
      >
        {words.map((w, i) => {
          const isConcept = !!w.bucket
          const lifted = phase !== 'raw' && isConcept
          return (
            <motion.span
              key={i}
              initial={false}
              animate={
                reduced
                  ? { opacity: 1 }
                  : {
                      rotate: phase === 'raw' ? jitter[i].r : lifted ? 0 : jitter[i].r * 0.4,
                      y: phase === 'raw' ? jitter[i].y : lifted ? -4 : 0,
                      opacity: lifted ? 0.4 : 1,
                    }
              }
              transition={{ duration: 0.4, ease: [0.21, 0.6, 0.35, 1], delay: Math.min(i * 0.012, 0.25) }}
              className={cn('inline-block rounded px-0.5', lifted && 'bg-accent-soft')}
            >
              {w.word}
            </motion.span>
          )
        })}
      </motion.p>

      {phase === 'decompose' && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.21, 0.6, 0.35, 1] }}
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {(Object.keys(BUCKET_LABEL) as (keyof typeof BUCKET_LABEL)[]).map((b) => {
            const found = words.find((w) => w.bucket === b)
            if (!found) return null
            return (
              <div key={b} className="rounded-md border border-line bg-surface p-2">
                <p className="label-mono mb-0.5">{BUCKET_LABEL[b]}</p>
                <p className="truncate text-xs font-medium text-ink">
                  {found.word.replace(/[^A-Za-z0-9']/g, '')}
                </p>
              </div>
            )
          })}
        </motion.div>
      )}

      {phase === 'structured' && (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="mt-3 flex flex-wrap gap-1.5"
        >
          <span className="rounded-md border border-accent-line bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent">
            {understanding.intent}
          </span>
          {understanding.people.slice(0, 2).map((p) => (
            <span key={p} className="rounded-md bg-blue-soft px-2 py-0.5 text-2xs font-medium text-blue">
              {p}
            </span>
          ))}
          {understanding.dates.slice(0, 2).map((d) => (
            <span key={d} className="rounded-md bg-amber-soft px-2 py-0.5 text-2xs font-medium text-amber">
              {d}
            </span>
          ))}
          <span className="rounded-md border border-line px-2 py-0.5 text-2xs font-medium capitalize text-ink-muted">
            {understanding.tone}
          </span>
        </motion.div>
      )}
    </div>
  )
}

/* ---------- Stage progress rail (used by every transform surface) ---------- */

export function StageRail({
  stages,
  currentIndex,
  labels,
}: {
  stages: readonly string[]
  currentIndex: number
  labels: Record<string, string>
}) {
  return (
    <ol className="space-y-1.5" aria-label="Transformation progress">
      {stages.map((s, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <li key={s} className="flex items-center gap-2.5">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-[var(--duration-fast)]',
                done ? 'bg-emerald' : active ? 'bg-accent animate-pulse-dot' : 'bg-line-strong',
              )}
              aria-hidden
            />
            <span
              className={cn(
                'font-mono text-2xs transition-colors duration-[var(--duration-fast)]',
                done
                  ? 'text-ink-subtle line-through decoration-line-strong'
                  : active
                    ? 'text-ink'
                    : 'text-ink-faint',
              )}
            >
              {labels[s]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- Waveform for voice capture ---------- */

export function Waveform({ active, bars = 24 }: { active: boolean; bars?: number }) {
  const reduced = useFMReduced()
  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn('w-[3px] rounded-full bg-accent', !active && 'opacity-25')}
          style={{
            height: active && !reduced ? undefined : `${6 + ((i * 13) % 18)}px`,
            animation:
              active && !reduced ? `ctx-wave 1s ease-in-out ${(i % 6) * 0.12}s infinite` : undefined,
          }}
        />
      ))}
    </div>
  )
}
