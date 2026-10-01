import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, ExternalLink, FileText, Link2 } from 'lucide-react'
import { Logo } from '../brand/Logo'
import { Badge } from '../../components/ui/Badge'
import { useAppStore } from '../../lib/store'
import { copyToClipboard, decodeShareHash, type SharedPayload } from '../../lib/share'
import { cn } from '../../lib/cn'

/* ============================================================
   SharePage — Phase 16 (/share)

   Receives #share=<deflate+base64url payload> links created in
   the output editor. Everything decodes client-side (fragments
   never hit a server), so a shared link opens as a clean,
   read-only document on any device — even without local data.
   ============================================================ */

type DecodeState =
  | { kind: 'checking' }
  | { kind: 'ok'; payload: SharedPayload }
  | { kind: 'corrupted' }
  | { kind: 'missing' }

export function SharePage() {
  const [state, setState] = useState<DecodeState>({ kind: 'checking' })
  const [copied, setCopied] = useState(false)
  const demoVisits = useAppStore((s) => s.demoVisits)
  const recordDemoVisit = useAppStore((s) => s.recordDemoVisit)

  useEffect(() => {
    const result = decodeShareHash(window.location.hash)
    if (result.ok) setState({ kind: 'ok', payload: result.payload })
    else setState({ kind: result.reason === 'corrupted' ? 'corrupted' : 'missing' })
  }, [])

  /* Conversion tracking (§56): opening a share link is a qualified visit. */
  useEffect(() => {
    if (state.kind === 'ok') recordDemoVisit()
    // record once per decoded document, not on every state churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind])

  const wordCount = useMemo(
    () => (state.kind === 'ok' ? state.payload.text.trim().split(/\s+/).filter(Boolean).length : 0),
    [state],
  )

  const onCopyLink = async () => {
    const ok = await copyToClipboard(window.location.href)
    setCopied(ok)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-8">
        <Logo />
        <Badge tone="neutral">Shared with you</Badge>
        <div className="ml-auto flex items-center gap-2">
          {state.kind === 'ok' && (
            <button
              type="button"
              onClick={onCopyLink}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                copied ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-subtle hover:border-line-strong hover:text-ink',
              )}
            >
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          )}
          <Link
            to="/demo"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try Context <ExternalLink size={12} aria-hidden />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {state.kind === 'checking' && (
            <motion.div
              key="checking"
              role="status"
              aria-label="Loading shared document"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="skeleton h-6 w-48 rounded-md" />
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-64 rounded-xl" />
            </motion.div>
          )}

          {state.kind === 'ok' && (
            <motion.article
              key="doc"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-line bg-surface shadow-sm"
              aria-label={state.payload.title ?? 'Shared document'}
            >
              <div className="border-b border-line px-5 py-4 md:px-7">
                <h1 className="text-lg font-semibold tracking-tight">
                  {state.payload.title ?? 'Shared output'}
                </h1>
                <p className="mt-1 font-mono text-3xs tabular-nums text-ink-faint">
                  context · shared document · {wordCount} words · format: {state.payload.format}
                </p>
              </div>
              <pre className="whitespace-pre-wrap break-words px-5 py-5 font-sans text-sm leading-relaxed text-ink-muted md:px-7">
                {state.payload.text}
              </pre>
            </motion.article>
          )}

          {state.kind === 'corrupted' && (
            <motion.div
              key="corrupt"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="flex flex-col items-start gap-3 rounded-xl border border-amber/40 bg-amber-soft px-5 py-5"
            >
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <AlertTriangle size={16} className="text-amber" aria-hidden /> This link looks broken
              </p>
              <p className="text-sm text-ink-muted">
                The shared content couldn&apos;t be decoded — it may have been truncated when pasted. Ask the
                sender to press <span className="font-mono text-2xs">Share</span> again and resend the full link.
              </p>
            </motion.div>
          )}

          {state.kind === 'missing' && (
            <motion.div
              key="missing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Link2 size={20} aria-hidden />
              </span>
              <div>
                <h1 className="text-base font-semibold tracking-tight">No shared document in this URL</h1>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
                  Share links look like <span className="font-mono text-2xs text-ink-faint">…/#share=v1.…</span> and
                  carry their content inside the link itself. Open one from someone who exported with Context.
                </p>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Link
                  to="/demo"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                >
                  <FileText size={14} aria-hidden /> Create your own share link
                </Link>
                <Link to="/" className="text-sm text-ink-subtle underline-offset-4 hover:underline">
                  About Context
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {state.kind === 'ok' && demoVisits >= 1 && (
          <p className="mt-6 text-center font-mono text-3xs text-ink-faint">
            viewing as guest · nothing was stored on a server
          </p>
        )}
      </main>
    </div>
  )
}
