import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Keyboard, Moon, RotateCcw, Sun } from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { useThemeStore, type Theme } from '../../lib/theme'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Kbd } from '../../components/ui/Kbd'
import { cn } from '../../lib/cn'

/* ============================================================
   Settings — theme, shortcut reference, demo reset. Honest
   about what is simulated (spec §57).
   ============================================================ */

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Command palette'],
  [['⌘', '↵'], 'Transform thought'],
  [['N'], 'New thought'],
  [['/'], 'Focus search'],
  [['ESC'], 'Close panel'],
  [['⌘', 'S'], 'Save output'],
]

export function SettingsPage({ inApp = true }: { inApp?: boolean }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const resetDemo = useAppStore((s) => s.resetDemo)
  const pushToast = useAppStore((s) => s.pushToast)
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={cn('mx-auto w-full max-w-2xl', inApp ? 'flex h-full flex-col' : 'px-4 py-10')}>
      {inApp && (
        <header className="border-b border-line px-4 py-3 md:px-6">
          <h1 className="text-base font-semibold tracking-tight">Settings</h1>
          <p className="font-mono text-3xs text-ink-faint">demo environment · nothing is stored remotely</p>
        </header>
      )}
      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-4 md:p-6">
        <section aria-labelledby="set-appearance">
          <h2 id="set-appearance" className="label-mono mb-3">Appearance</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-ink-muted">Light and dark — both tuned by hand.</p>
            </div>
            <SegmentedControl
              ariaLabel="Theme"
              value={theme}
              onChange={(v) => setTheme(v as Theme)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-subtle">
            {theme === 'dark' ? <Moon size={12} aria-hidden /> : <Sun size={12} aria-hidden />}
            Motion automatically reduces when your system asks for it.
          </div>
        </section>

        <section aria-labelledby="set-keys">
          <h2 id="set-keys" className="label-mono mb-3">Keyboard</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <ul>
              {SHORTCUTS.map(([keys, label], i) => (
                <li key={label} className={cn('flex items-center justify-between px-4 py-2.5 text-sm', i > 0 && 'border-t border-line')}>
                  <span className="flex items-center gap-2 text-ink-muted">
                    <Keyboard size={13} className="text-ink-faint" aria-hidden /> {label}
                  </span>
                  <Kbd keys={keys} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="set-demo">
          <h2 id="set-demo" className="label-mono mb-3">Demo data</h2>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-sm font-medium">Your thoughts are kept on refresh</p>
            <p className="mb-4 text-xs text-ink-muted">
              Thoughts you create in this demo persist in your browser's local storage only. The seeded examples
              always come back, so the demo never breaks.
            </p>
            <p className="mb-3 text-sm font-medium">Reset the demo</p>
            <p className="mb-3 text-xs text-ink-muted">
              Restores the original thoughts, outputs and history. Your experiments disappear.
            </p>
            {confirming ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { resetDemo(); setConfirming(false); navigate('/app') }}
                  className="rounded-md bg-coral px-3 py-1.5 text-xs font-medium text-white"
                >
                  Yes, reset everything
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted hover:text-ink">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:border-coral hover:text-coral"
              >
                <RotateCcw size={12} aria-hidden /> Reset demo
              </button>
            )}
            {/* Spec §56/§57: first-run welcome + completed demo runs. */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="font-mono text-3xs text-ink-subtle tabular-nums">
                {demoVisits > 0
                  ? `${demoVisits} demo run${demoVisits === 1 ? '' : 's'} completed in this browser`
                  : 'No demo runs completed yet'}
              </p>
              <button
                type="button"
                onClick={() => { showOnboarding() }}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                Replay welcome tour
              </button>
            </div>
          </div>
        </section>

        <section aria-labelledby="set-about">
          <h2 id="set-about" className="label-mono mb-3">About this build</h2>
          <p className="rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-ink-muted">
            Context is a frontend portfolio demo. The transformation engine is deterministic and runs entirely in
            your browser — no backend, no API keys, no data leaves this page. Voice capture and screenshot analysis
            are honest simulations with realistic states.{' '}
            <button type="button" onClick={() => pushToast('You found the fine print. Nice.', 'info')} className="text-accent hover:underline">
              Built with React, TypeScript, Tailwind &amp; Motion.
            </button>
          </p>
        </section>
      </div>
    </div>
  )
}
