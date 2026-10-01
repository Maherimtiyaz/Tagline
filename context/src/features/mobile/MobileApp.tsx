import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Download, Home, Inbox, Settings as SettingsIcon, History as HistoryIcon, Share2, X } from 'lucide-react'
import type { OutputType } from '../../data/types'
import { useAppStore } from '../../lib/store'
import { analyzeThought } from '../../lib/mockAI'
import { OUTPUT_LABEL } from '../../lib/outputMeta'
import { downloadExport } from '../../lib/exporters'
import { shareDocument } from '../../lib/share'
import { VoiceCapture } from '../voice/VoiceCapture'
import { ThoughtCard } from '../../components/ui/ThoughtCard'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/* ============================================================
   Mobile experience (spec §38–§40) — first-class, not a
   collapsed desktop. Capture-first home: greeting, one large
   mic, recent thoughts. After capture a bottom sheet asks
   "What should I make?" and the output opens full-screen.
   Rendered inside a phone frame on wide screens so it reads
   as an intentional product surface.
   ============================================================ */

type Tab = 'home' | 'inbox' | 'history' | 'settings'

const SHEET_OPTIONS: { type: OutputType; label: string }[] = [
  { type: 'email', label: 'Email' },
  { type: 'tasks', label: 'Tasks' },
  { type: 'summary', label: 'Summary' },
  { type: 'plan', label: 'Plan' },
  { type: 'brief', label: 'Brief' },
]

const EASE = [0.21, 0.6, 0.35, 1] as const

export function MobileApp() {
  const reduced = useReducedMotion()
  const thoughts = useAppStore((s) => s.thoughts)
  const transform = useAppStore((s) => s.transform)
  const addThought = useAppStore((s) => s.addThought)
  const pushToast = useAppStore((s) => s.pushToast)
  const timeline = useAppStore((s) => s.timeline)

  const [tab, setTab] = useState<Tab>('home')
  const [captured, setCaptured] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [resultOf, setResultOf] = useState<{ thoughtId: string; outputId: string } | null>(null)

  const active = resultOf ? thoughts.find((t) => t.id === resultOf.thoughtId) : null
  const output = active?.outputs.find((o) => o.id === resultOf?.outputId)

  const suggestions = useMemo(
    () => (captured ? analyzeThought(captured).suggestions : []),
    [captured],
  )

  const captureDone = (text: string) => {
    setCaptured(text)
    setSheet(true)
  }

  const makeIt = (type: OutputType) => {
    if (!captured) return
    const id = addThought(captured, 'voice')
    const out = transform(id, type)
    setResultOf({ thoughtId: id, outputId: out.id })
    setSheet(false)
    pushToast(`${OUTPUT_LABEL[type]} created`, 'success')
  }

  const reset = () => {
    setCaptured(null)
    setResultOf(null)
    setSheet(false)
  }

  const recent = thoughts.filter((t) => t.status !== 'archived').slice(0, 4)

  /* ---------------- screens ---------------- */

  const homeScreen = (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <p className="text-xs text-ink-subtle">Good morning, Mahek.</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">What are you thinking?</h1>

      <div className="mt-8 flex flex-col items-center">
        <VoiceCapture seed={7} compact onComplete={captureDone} />
        <button
          type="button"
          onClick={() => { setCaptured('need to follow up with sarah about the proposal — she said wednesday but i never confirmed'); setSheet(true) }}
          className="mt-4 min-h-11 rounded-full border border-line px-4 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          or type instead
        </button>
      </div>

      {suggestions.length > 0 && !sheet && !resultOf && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <p className="label-mono mb-2 text-ink-faint">Context suggests</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((s) => (
              <button
                key={s.type}
                type="button"
                onClick={() => makeIt(s.type)}
                className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs text-accent"
              >
                {OUTPUT_LABEL[s.type]}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
        <p className="label-mono mb-2 text-ink-faint">Recent thoughts</p>
        <div className="space-y-2 pb-4">
          {recent.map((t) => (
            <div key={t.id}>
              <ThoughtCard
                id={t.id}
                text={t.text}
                source={t.source}
                createdAt={t.createdAt}
                status={t.status}
                outputCount={t.outputs.length}
                onOpen={() => makeIt('email')}
                onTransform={() => makeIt('email')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const inboxScreen = (
    <div className="flex-1 overflow-y-auto px-5 pt-6">
      <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
      <p className="mt-1 text-xs text-ink-subtle">Everything you've captured today.</p>
      <div className="space-y-2 py-4">
        {thoughts.filter((t) => t.status !== 'archived').map((t) => (
          <ThoughtCard
            key={t.id}
            id={t.id}
            text={t.text}
            source={t.source}
            createdAt={t.createdAt}
            status={t.status}
            outputCount={t.outputs.length}
            onOpen={() => setTab('home')}
            onTransform={() => transform(t.id, 'email')}
          />
        ))}
      </div>
    </div>
  )

  const historyScreen = (
    <div className="flex-1 overflow-y-auto px-5 pt-6">
      <h1 className="text-lg font-semibold tracking-tight">History</h1>
      <ol className="relative mt-4 space-y-5 border-l border-line pl-5 pb-6">
        {timeline.slice(0, 8).map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[26px] top-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
            <p className="font-mono text-3xs text-ink-faint">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-sm text-ink">{e.label}</p>
          </li>
        ))}
      </ol>
    </div>
  )

  const settingsScreen = (
    <div className="flex-1 overflow-y-auto px-5 pt-6">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      <div className="mt-4 space-y-2 text-sm">
        {[['Profile', 'Mahek · demo account'], ['Theme', 'Follows system / app toggle'], ['Voice', 'Simulated locally'], ['Data', 'Resets with the demo']].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
            <span className="font-medium">{k}</span>
            <span className="text-xs text-ink-subtle">{v}</span>
          </div>
        ))}
      </div>
      <Link to="/" className="mt-6 block text-center text-xs text-accent">Exit mobile preview</Link>
    </div>
  )

  const NAV: { tab: Tab; label: string; icon: typeof Home }[] = [
    { tab: 'home', label: 'Home', icon: Home },
    { tab: 'inbox', label: 'Inbox', icon: Inbox },
    { tab: 'history', label: 'History', icon: HistoryIcon },
    { tab: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas-deep p-0 md:p-8">
      {/* phone chrome only on md+; full screen on phones */}
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-canvas md:h-[780px] md:max-h-[90vh] md:w-[390px] md:rounded-[2rem] md:border md:border-line-strong md:shadow-xl">
        {/* status bar */}
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="label-mono text-accent">CONTEXT</span>
          <Badge tone="outline" mono>Demo mode</Badge>
        </header>

        {/* output full-screen view */}
        <AnimatePresence mode="wait">
          {resultOf && output ? (
            <motion.section
              key="output"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex flex-1 flex-col overflow-hidden"
              aria-label="Generated output"
            >
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <button type="button" onClick={reset} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover">
                  <ArrowLeft size={16} />
                </button>
                <p className="text-sm font-semibold">{output.title}</p>
                <button type="button" onClick={reset} aria-label="Close output" className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover">
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {output.subject && <p className="mb-2 text-sm font-semibold">Subject: {output.subject}</p>}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{output.body}</pre>
              </div>
              <div className="flex gap-2 border-t border-line px-4 py-3">
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(output.body).catch(() => {}); pushToast('Copied to clipboard', 'success') }}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-medium text-white"
                >
                  <Check size={14} /> Copy
                </button>
                {/* Phase 18 — native share sheet on phones; link-to-clipboard fallback elsewhere */}
                <button
                  type="button"
                  aria-label="Share this output"
                  onClick={() => {
                    void shareDocument({ text: output.body, format: 'text', title: output.title }).then((m) => {
                      if (m === 'native') pushToast('Shared via system sheet', 'success')
                      else if (m === 'clipboard') pushToast('Share link copied', 'success')
                      else pushToast('Sharing was cancelled', 'info')
                    })
                  }}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm text-ink-muted"
                >
                  <Share2 size={14} /> Share
                </button>
                <button
                  type="button"
                  onClick={() => { downloadExport(output, 'text'); pushToast('Downloaded', 'success') }}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm text-ink-muted"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </motion.section>
          ) : (
            <motion.div key={tab} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col">
              {tab === 'home' && homeScreen}
              {tab === 'inbox' && inboxScreen}
              {tab === 'history' && historyScreen}
              {tab === 'settings' && settingsScreen}
            </motion.div>
          )}
        </AnimatePresence>

        {/* bottom sheet — "What should I make?" */}
        <AnimatePresence>
          {sheet && (
            <>
              <motion.button
                type="button"
                aria-label="Dismiss"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSheet(false)}
                className="absolute inset-0 z-modal bg-black/30"
              />
              <motion.div
                role="dialog"
                aria-label="Choose an output"
                initial={reduced ? false : { y: '100%' }}
                animate={{ y: 0 }}
                exit={reduced ? { opacity: 0 } : { y: '100%' }}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-x-0 bottom-0 z-modal rounded-t-2xl border-t border-line bg-surface p-5 pb-8"
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
                <p className="text-sm font-semibold">What should I make?</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-subtle">"{captured}"</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {SHEET_OPTIONS.map((o) => (
                    <button
                      key={o.type}
                      type="button"
                      onClick={() => makeIt(o.type)}
                      className={cn(
                        'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-canvas-deep px-2 py-3 text-xs transition-colors',
                        'hover:border-accent-line hover:bg-accent-soft hover:text-accent active:border-accent-line',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setSheet(false)} className="mt-3 min-h-11 w-full rounded-lg text-xs text-ink-subtle hover:text-ink">
                  Not now
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* tab bar */}
        {!resultOf && (
          <nav aria-label="Mobile primary" className="flex h-14 shrink-0 items-stretch border-t border-line bg-surface">
            {NAV.map((n) => {
              const activeTab = tab === n.tab
              return (
                <button
                  key={n.tab}
                  type="button"
                  onClick={() => { setTab(n.tab); reset() }}
                  aria-current={activeTab ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-0.5 text-3xs',
                    activeTab ? 'text-accent' : 'text-ink-subtle',
                  )}
                >
                  <n.icon size={18} aria-hidden />
                  {n.label}
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
