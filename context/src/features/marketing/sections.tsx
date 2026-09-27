import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Clipboard,
  MessageSquare,
  Mic,
  Moon,
  ListChecks,
  Smartphone,
  Sun,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Kbd } from '../../components/ui/Kbd'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { VoiceCapture } from '../voice/VoiceCapture'
import { ScreenshotDrop } from '../voice/ScreenshotDrop'
import { HeroDemo } from '../demo/HeroDemo'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useThemeStore } from '../../lib/theme'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/cn'

/* ============================================================
   Marketing sections (spec §11, §15–§16, §22–§24, §28, §35,
   §38–§40, §45, §59). Each section is self-contained and uses
   the real product components wherever possible — the landing
   page demos ARE the product.
   ============================================================ */

const EASE = [0.21, 0.6, 0.35, 1] as const

/** Reveal wrapper — one-shot fade/rise on scroll, disabled for reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 14,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  y?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduced = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  lede,
  id,
}: {
  eyebrow: string
  title: React.ReactNode
  lede?: string
  id?: string
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      {id && <span id={id} className="block h-0" aria-hidden />}
      <p className="label-mono mb-3 text-accent">{eyebrow}</p>
      <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{title}</h2>
      {lede && <p className="mt-4 text-base leading-relaxed text-ink-muted">{lede}</p>}
    </Reveal>
  )
}

/* ------------------------------------------------------------ */
/* How it works — step rail + swapping visual (§15, §45)         */
/* ------------------------------------------------------------ */

const HIW_STEPS = [
  {
    key: 'capture',
    title: 'Capture',
    copy: 'Anything goes. A half-sentence, a voice memo, a screenshot, yesterday’s meeting notes.',
    mono: 'raw',
    render: () => (
      <p className="font-mono text-sm leading-relaxed text-ink-muted">
        "i need to tell sarah that we're probably going to miss friday because the api isn't ready and maybe monday but don't promise monday yet..."
      </p>
    ),
  },
  {
    key: 'understand',
    title: 'Understand',
    copy: 'Context reads intent, people, dates and tone — without you labelling anything.',
    mono: 'intent',
    render: () => (
      <div className="flex flex-wrap gap-2">
        <Badge tone="accent">Intent · Client update</Badge>
        <Badge tone="blue">Sarah</Badge>
        <Badge tone="neutral">Friday → Monday?</Badge>
        <Badge tone="outline">Tone · Professional</Badge>
      </div>
    ),
  },
  {
    key: 'structure',
    title: 'Structure',
    copy: 'The mess gets a shape: subject line, body, next step. Ordered, aligned, calm.',
    mono: 'structure',
    render: () => (
      <ol className="space-y-2 text-sm text-ink">
        {[
          ['Subject', 'Project timeline update'],
          ['Opening', 'Status of API integration'],
          ['Ask', 'Move Friday delivery'],
          ['Commitment', 'Confirm by Thursday'],
        ].map(([k, v]) => (
          <li key={k} className="flex items-baseline gap-3 border-b border-line pb-2 last:border-0">
            <span className="label-mono w-24 shrink-0 text-ink-faint">{k}</span>
            <span>{v}</span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    key: 'create',
    title: 'Create',
    copy: 'A finished draft you can edit, re-tone and send. From rough thought to ready-to-use.',
    mono: 'output',
    render: () => (
      <div className="rounded-lg border border-accent-line bg-canvas-deep p-4">
        <p className="mb-1 text-sm font-semibold">Subject: Project timeline update</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Hi Sarah, quick update — we're working through the remaining API integration and may need
          to move Friday's delivery. I'll confirm the revised timeline by Thursday once the
          remaining work is complete.
        </p>
      </div>
    ),
  },
]

export function HowItWorksSection() {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion()
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          id="how"
          title={<>Don't organize first. Just think.</>}
          lede="Four stages happen every time you press Transform. Here's what your thought goes through."
        />
        <div className="mt-16 grid gap-10 md:grid-cols-[260px_1fr] md:gap-16">
          {/* sticky rail */}
          <div className="md:sticky md:top-28 md:self-start">
            <ol className="flex gap-2 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0">
              {HIW_STEPS.map((s, i) => (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={i === active}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-[var(--duration-micro)]',
                      i === active
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink-subtle hover:bg-surface-hover hover:text-ink',
                    )}
                  >
                    <span className="font-mono text-3xs tabular-nums opacity-60">0{i + 1}</span>
                    <span className="text-sm font-medium">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          {/* swapping visual */}
          <div className="relative min-h-72 rounded-xl border border-line bg-surface p-6 md:p-8">
            {HIW_STEPS.map((s, i) => (
              <motion.div
                key={s.key}
                aria-hidden={i !== active}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={i === active ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
                className={cn(i !== active && 'pointer-events-none absolute inset-6 md:inset-8')}
              >
                <p className="label-mono mb-4 text-ink-faint">{s.mono}</p>
                {s.render()}
                <p className="mt-6 text-sm text-ink-muted">{s.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Messy → clear showcase (§16)                                  */
/* Auto-runs when scrolled into view; replayable.                */
/* ------------------------------------------------------------ */

const MESSY_LINES = [
  'I have three things I need to do today...',
  'the proposal has to go to Alex before lunch',
  'and oh — call the client back, they emailed twice',
  'invoice still not sent?? fix that too',
]

const TASKS = [
  { label: 'Finish proposal', meta: 'before 12:00' },
  { label: 'Call client', meta: 'replied twice' },
  { label: 'Send invoice', meta: 'overdue' },
]

export function MessyToShowcase() {
  const [stage, setStage] = useState<'messy' | 'extracting' | 'clear'>('messy')
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!inView || stage !== 'messy') return
    const t1 = window.setTimeout(() => setStage('extracting'), 700)
    const t2 = window.setTimeout(() => setStage('clear'), reduced ? 900 : 1900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [inView, stage, reduced])

  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Messy to clear"
          title={
            <>
              Three scattered thoughts.<br className="hidden sm:block" /> One honest list.
            </>
          }
          lede="Context doesn't rewrite your meaning — it finds the structure that was already in there."
        />
        <Reveal delay={0.1}>
          <div ref={ref} className="mt-14 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="grid md:grid-cols-[1fr_auto_1fr]">
              {/* messy side */}
              <div
                className={cn(
                  'min-w-0 p-6 transition-opacity duration-300 md:p-8',
                  stage === 'clear' && 'opacity-40',
                )}
              >
                <p className="label-mono mb-4 text-ink-faint">Raw input</p>
                <div className="space-y-3 font-mono text-sm leading-relaxed text-ink-muted">
                  {MESSY_LINES.map((line, i) => (
                    <motion.p
                      key={line}
                      animate={
                        reduced || stage === 'messy'
                          ? {}
                          : stage === 'extracting'
                            ? { opacity: 0.5, x: i % 2 ? 6 : -6 }
                            : { opacity: 0, y: -10 }
                      }
                      transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
                      style={{ rotate: reduced ? 0 : [0.6, -0.8, 0.4, -0.5][i] }}
                    >
                      {line}
                    </motion.p>
                  ))}
                </div>
                {stage === 'extracting' && (
                  <p className="mt-6 flex items-center gap-2 font-mono text-2xs text-accent">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                    extracting tasks...
                  </p>
                )}
              </div>
              <div className="hidden w-px bg-line md:block" aria-hidden />
              {/* clear side */}
              <div className="min-w-0 border-t border-line p-6 md:border-l md:border-t-0 md:p-8">
                <p className={cn('label-mono mb-4', stage === 'clear' ? 'text-accent' : 'text-ink-faint')}>
                  Output · Task list
                </p>
                {stage === 'clear' ? (
                  <ul className="space-y-2">
                    {TASKS.map((t, i) => (
                      <motion.li
                        key={t.label}
                        initial={reduced ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.08 * i, ease: EASE }}
                        className="flex items-center gap-3 rounded-lg border border-line bg-canvas-deep px-3 py-2.5"
                      >
                        <span className="flex h-4 w-4 items-center justify-center rounded border border-line-strong">
                          <Check size={11} className="opacity-0" aria-hidden />
                        </span>
                        <span className="text-sm text-ink">{t.label}</span>
                        <span className="ml-auto font-mono text-3xs text-ink-faint">{t.meta}</span>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-2" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-10 animate-pulse rounded-lg bg-surface-hover"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                )}
                {stage === 'clear' && (
                  <button
                    type="button"
                    onClick={() => setStage('messy')}
                    className="mt-6 min-h-8 text-2xs text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
                  >
                    Replay transformation
                  </button>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Use cases                                                     */
/* ------------------------------------------------------------ */

const USE_CASES = [
  ['Freelancers', 'Client updates, proposals and follow-ups drafted from the voice note you recorded walking home.'],
  ['Founders', 'Meeting chaos in, decisions-with-owners out. Launch plans from "sometime next month".'],
  ['Writers', 'Rough fragments become structured posts and briefs — while keeping your register.'],
  ['Students', 'Lecture fragments into summaries, readings into schedules, ideas into essays.'],
]

export function UseCasesSection() {
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Use cases"
          title="Made for the way people actually think."
          lede="Which is rarely linear, rarely tidy, and rarely in the right order."
        />
        <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {USE_CASES.map(([title, desc], i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="flex gap-4">
                <span className="font-mono text-3xs text-ink-faint">0{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Voice experience (§22–§23)                                    */
/* ------------------------------------------------------------ */

export function VoiceSection() {
  const pushToast = useAppStore((s) => s.pushToast)
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <p className="label-mono mb-3 text-accent">Voice</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Say it badly.<br />Get it written well.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-muted">
              Hold the button and talk the way you'd talk to a colleague — incomplete sentences
              included. The transcript becomes a thought you can transform.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-ink-muted">
              {[
                'Hold to speak, release to stop',
                'Live transcript as you talk',
                'Nothing leaves this tab — the audio never exists',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check size={14} className="shrink-0 text-emerald" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/app/new" className="mt-8 inline-block">
              <Button variant="secondary" size="sm">
                Try it in the editor <ArrowRight size={13} />
              </Button>
            </Link>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="rounded-xl border border-line bg-surface p-8">
              <VoiceCapture
                seed={3}
                onComplete={(t) => pushToast(`Captured ${t.split(' ').length} words`, 'success')}
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Screenshot understanding (§24)                                */
/* ------------------------------------------------------------ */

export function ScreenshotSection() {
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal className="order-2 md:order-1">
            <ScreenshotDrop />
          </Reveal>
          <Reveal delay={0.12} className="order-1 md:order-2">
            <p className="label-mono mb-3 text-accent">Screenshots</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Drop an image.<br />Get a brief.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-muted">
              Screenshots of designs, error dialogs or someone's whiteboard photo all count as
              thoughts. Context detects the interface elements and writes up what it sees.
            </p>
            <p className="mt-6 font-mono text-2xs text-ink-faint">
              simulated locally · drop zone responds to any file
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Output transformations (§28) — interactive re-tone demo       */
/* ------------------------------------------------------------ */

const TONE_EMAILS: Record<string, { subject: string; body: string }> = {
  Professional: {
    subject: 'Project timeline update',
    body: "Hi Sarah,\n\nQuick update — we're currently working through the remaining API integration and may need to move Friday's delivery. I'll confirm the revised timeline by Thursday once the remaining work is complete.\n\nThanks,\nMahek",
  },
  Concise: {
    subject: 'Timeline update',
    body: "Sarah — API integration is taking longer than expected. Friday delivery is at risk; I'll confirm a revised date by Thursday.\n\n— Mahek",
  },
  Confident: {
    subject: 'Delivery plan update',
    body: "Hi Sarah,\n\nWe've identified the remaining API integration work and made a deliberate call: moving the delivery protects quality, so we're rescheduling. You'll have the confirmed date by Thursday.\n\nBest,\nMahek",
  },
  Casual: {
    subject: 'Quick heads-up on timing',
    body: "Hey Sarah!\n\nHeads up — the API bits are taking a little longer than planned, so Friday might slip. I'll have a firm new date for you by Thursday. Talk soon!\n\nMahek",
  },
}

const FORMAT_ACTIONS = [
  { label: 'Slack message', icon: <MessageSquare size={12} aria-hidden /> },
  { label: 'Task list', icon: <ListChecks size={12} aria-hidden /> },
]

export function ToneShowcase() {
  const [tone, setTone] = useState('Professional')
  const pushToast = useAppStore((s) => s.pushToast)
  const email = TONE_EMAILS[tone]
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Output transformations"
          title="One draft. Any register."
          lede="Change tone, shorten, turn it into a Slack message or a task list — instantly, right where you're editing."
        />
        <Reveal delay={0.1}>
          <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <span className="label-mono mr-2 text-ink-faint">Tone</span>
              <SegmentedControl
                ariaLabel="Tone"
                value={tone}
                onChange={setTone}
                size="sm"
                options={Object.keys(TONE_EMAILS).map((t) => ({ label: t, value: t }))}
              />
            </div>
            <div className="p-6">
              <p className="text-sm font-semibold">Subject: {email.subject}</p>
              <motion.pre
                key={tone}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-muted"
              >
                {email.body}
              </motion.pre>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas-deep/60 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`${email.subject}\n\n${email.body}`).catch(() => {})
                  pushToast('Copied to clipboard', 'success')
                }}
                className="flex min-h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <Clipboard size={12} aria-hidden /> Copy
              </button>
              <button
                type="button"
                onClick={() => pushToast('Shortened (demo)', 'info')}
                className="flex min-h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Make shorter
              </button>
              {FORMAT_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => pushToast(`Turned into ${a.label.toLowerCase()} (demo)`, 'info')}
                  className="flex min-h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Web + mobile (§38–§40)                                        */
/* ------------------------------------------------------------ */

export function MobileSection() {
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Anywhere"
          title="The same brain. Two bodies."
          lede="Desktop gives you a three-panel workspace. Mobile is capture-first: hold, speak, choose what to make."
        />
        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1fr_300px]">
          <Reveal>
            <HeroDemo compact />
          </Reveal>
          <Reveal delay={0.12} className="flex justify-center">
            {/* phone frame */}
            <div className="w-[280px] rounded-[2rem] border border-line-strong bg-surface p-3 shadow-lg">
              <div className="overflow-hidden rounded-[1.4rem] border border-line bg-canvas">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="label-mono text-accent">CONTEXT</span>
                  <Smartphone size={12} className="text-ink-faint" aria-hidden />
                </div>
                <div className="px-4 pb-5 pt-4 text-center">
                  <p className="text-xs text-ink-subtle">Good morning.</p>
                  <p className="mt-0.5 text-sm font-medium">What are you thinking?</p>
                  <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white">
                    <Mic size={20} aria-hidden />
                  </div>
                  <p className="mt-2 font-mono text-3xs text-ink-faint">hold to speak</p>
                  <div className="mt-5 space-y-2 text-left">
                    {['Launch post idea…', 'Things to fix before Fri…'].map((t) => (
                      <div key={t} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
                        {t}
                      </div>
                    ))}
                  </div>
                  <nav
                    className="mt-5 flex justify-around border-t border-line pt-3 font-mono text-3xs text-ink-faint"
                    aria-label="Mobile nav preview"
                  >
                    <span className="text-accent">home</span>
                    <span>inbox</span>
                    <span>history</span>
                    <span>settings</span>
                  </nav>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Templates strip (§35)                                         */
/* ------------------------------------------------------------ */

const MARKETING_TEMPLATES: [string, string][] = [
  ['Client update', 'Status, risk, next step — without the apology spiral.'],
  ['Meeting summary', 'Notes in, decisions + owners out.'],
  ['Decision memo', 'Options, trade-offs, recommendation.'],
  ['Launch plan', 'From "sometime next month" to dated phases.'],
]

export function TemplatesStrip() {
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Templates"
          title="Start from a shape, not a blank page."
          lede="Every template asks for the minimum context, then transforms it. Browse the full library inside the app."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MARKETING_TEMPLATES.map(([title, desc], i) => (
            <Reveal key={title} delay={i * 0.06}>
              <Link
                to="/app/templates"
                className="group block h-full rounded-xl border border-line bg-surface p-5 transition-colors duration-[var(--duration-micro)] hover:border-line-strong"
              >
                <p className="text-sm font-semibold transition-colors group-hover:text-accent">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 font-mono text-3xs text-ink-faint transition-colors group-hover:text-accent">
                  open <ArrowRight size={10} aria-hidden />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Pricing — clearly demo content (§59)                          */
/* ------------------------------------------------------------ */

const PLANS = [
  { name: 'Free', price: '$0', note: '/ forever', features: ['50 thoughts / month', 'All output types', 'Local demo data'] },
  {
    name: 'Pro',
    price: '$12',
    note: '/ month · fictional',
    features: ['Unlimited thoughts', 'Voice + screenshot input', 'Collections & templates', 'Export anywhere'],
    featured: true,
  },
  { name: 'Team', price: '$29', note: '/ seat · fictional', features: ['Shared collections', 'Review flow', 'Brand voice controls'] },
]

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing · demo content"
          title="Honest prices for an honest demo."
          lede="No payments exist here. This section shows how pricing would sit secondary to the product."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.07}>
              <div
                className={cn(
                  'flex h-full flex-col rounded-xl border p-6',
                  p.featured ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.name}</p>
                  {p.featured && <Badge tone="accent">Most useful</Badge>}
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {p.price}
                  <span className="ml-1 font-mono text-2xs font-normal text-ink-faint">{p.note}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-muted">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/app" className="mt-6">
                  <Button variant={p.featured ? 'primary' : 'secondary'} size="sm" className="w-full">
                    Try {p.name}
                  </Button>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Final CTA                                                     */
/* ------------------------------------------------------------ */

export function FinalCTA() {
  return (
    <section className="border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <p className="label-mono mb-4 text-accent">Ready when you are</p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tighter md:text-5xl">
            Capture now.<br />Structure later.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-ink-muted">
            No signup, no install, no server. Everything you just saw runs locally in this tab.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/app">
              <Button variant="primary" size="lg">
                Open the workspace <ArrowRight size={14} />
              </Button>
            </Link>
            <Link to="/demo">
              <Button variant="secondary" size="lg">Full product demo</Button>
            </Link>
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-2xs text-ink-faint">
            <span><Kbd keys={['⌘', 'K']} /> command palette</span>
            <span><Kbd keys={['⌘', '↵']} /> transform</span>
            <span><Kbd keys={['N']} /> new thought</span>
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Theme toggle (shared with nav)                                */
/* ------------------------------------------------------------ */

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors duration-[var(--duration-micro)] hover:bg-surface-hover hover:text-ink"
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
