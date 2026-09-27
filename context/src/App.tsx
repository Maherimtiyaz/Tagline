import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { Logo } from './features/brand/Logo'
import { Button } from './components/ui/Button'
import { IconButton } from './components/ui/IconButton'
import { Kbd } from './components/ui/Kbd'
import { Badge } from './components/ui/Badge'
import { Input } from './components/ui/Input'
import { SkeletonText } from './components/ui/Skeleton'
import { useThemeStore } from './lib/theme'
import { useNavigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CommandPalette } from './components/ui/CommandPalette'
import { ToastViewport } from './components/ui/Toast'
import {
  InboxRoute,
  EditorRoute,
  HistoryRoute,
  TemplatesRoute,
  SettingsRoute,
  CollectionsRoute,
  DemoRoute,
} from './features/app/AppRoutes'

/* ------------------------------------------------------------------ */
/* Placeholder pages — replaced by real screens in later build phases. */
/* ------------------------------------------------------------------ */
function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Badge tone="accent" mono>{phase}</Badge>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-sm text-muted text-ink-muted">
        This screen is part of the build plan and lands in a later pass.
      </p>
      <Link to="/" className="text-sm text-accent hover:underline">Back to landing</Link>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Landing skeleton: sticky nav + hero shell + footer                   */
/* ------------------------------------------------------------------ */
function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()
  return (
    <IconButton
      label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      onClick={toggleTheme}
    />
  )
}

function MarketingNav() {
  return (
    <header className="sticky top-0 z-nav border-b border-line bg-canvas/85 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
      >
        <Link to="/" aria-label="Context home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {[
            ['Product', '/demo'],
            ['How it works', '/#how'],
            ['Templates', '/templates'],
            ['Pricing', '/#pricing'],
          ].map(([label, href]) => (
            <Link
              key={label}
              to={href}
              className="rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors duration-[var(--duration-micro)] hover:bg-surface-hover hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
          <Link to="/app"><Button variant="primary" size="sm">Try Context</Button></Link>
        </div>
      </nav>
    </header>
  )
}

function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1">
        {/* Hero shell — interactive transformation demo lands in Phase 2 */}
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pb-24 pt-24 text-center md:pt-32">
          <Badge tone="outline" mono>Frontend portfolio demo</Badge>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tighter md:text-6xl">
            Your messy thoughts.
            <br />
            <span className="text-ink-muted">Made useful.</span>
          </h1>
          <p className="max-w-md text-lg text-ink-muted">
            Capture whatever is in your head. Context turns it into something you can actually use.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link to="/app"><Button variant="primary" size="lg">Try Context</Button></Link>
            <Link to="/demo"><Button variant="secondary" size="lg">Watch it transform</Button></Link>
          </div>
          <p className="pt-4 text-xs text-ink-subtle">
            No signup. <Kbd keys={['⌘', 'K']} /> opens the command palette in the app.
          </p>

          {/* Transformation preview: raw → understood → structured */}
          <div className="mt-10 w-full rounded-xl border border-line bg-surface p-6 text-left shadow-md">
            <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
              <div>
                <p className="label-mono mb-2">Raw thought</p>
                <p className="font-mono text-sm leading-relaxed text-ink-muted">
                  "i need to tell sarah that we're probably going to miss friday because the api isn't ready and maybe monday but don't promise monday yet..."
                </p>
              </div>
              <div className="hidden flex-col items-center justify-center text-ink-faint md:flex" aria-hidden>
                <span className="label-mono">→</span>
              </div>
              <div>
                <p className="label-mono mb-2 text-accent">Output · Email</p>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="accent">Client update</Badge>
                    <Badge tone="blue">Sarah</Badge>
                    <Badge tone="neutral">Friday</Badge>
                    <Badge tone="outline">Professional</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-ink">
                    Hi Sarah — quick update: we're working through the remaining API integration and may need to move Friday's delivery. I'll confirm the revised timeline by Thursday.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Component gallery proof (design-system smoke test) */}
          <div className="mt-4 w-full rounded-xl border border-line bg-surface p-6 text-left">
            <p className="label-mono mb-3">Design system · states</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
              <Input placeholder="Search thoughts…" className="max-w-48" aria-label="Demo input" />
              <Badge tone="success">✓ Ready</Badge>
              <Badge tone="warning">Processing</Badge>
              <Badge tone="error">Interrupted</Badge>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SkeletonText lines={2} />
              <div className="flex items-center gap-2 font-mono text-3xs text-ink-subtle">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
                understanding...
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <Logo size={16} />
          <nav aria-label="Footer" className="flex gap-5 text-sm text-ink-muted">
            <Link to="/demo" className="hover:text-ink">Demo</Link>
            <Link to="/templates" className="hover:text-ink">Templates</Link>
            <a href="#" className="hover:text-ink">About</a>
            <a href="#" className="hover:text-ink">Legal</a>
          </nav>
          <p className="font-mono text-3xs text-ink-subtle">DEMO MODE · FICTIONAL DATA</p>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Global overlays + routed app screens                                */
/* ------------------------------------------------------------------ */
function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

function Overlays() {
  const navigate = useNavigate()
  return (
    <>
      <CommandPalette onNavigate={navigate} />
      <ToastViewport />
    </>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/demo" element={<DemoRoute />} />
        <Route path="/templates" element={<TemplatesRoute />} />
        <Route path="/app" element={<Shell><InboxRoute /></Shell>} />
        <Route path="/app/new" element={<Shell><EditorRoute /></Shell>} />
        <Route path="/app/thought/:id" element={<Shell><EditorRoute /></Shell>} />
        <Route path="/app/workspace" element={<Shell><InboxRoute /></Shell>} />
        <Route path="/app/drafts" element={<Shell><InboxRoute /></Shell>} />
        <Route path="/app/history" element={<Shell><HistoryRoute /></Shell>} />
        <Route path="/app/templates" element={<Shell><TemplatesRoute /></Shell>} />
        <Route path="/app/collections" element={<Shell><CollectionsRoute /></Shell>} />
        <Route path="/app/collections/:id" element={<Shell><CollectionsRoute /></Shell>} />
        <Route path="/app/settings" element={<Shell><SettingsRoute /></Shell>} />
        <Route path="/mobile" element={<DemoRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Overlays />
    </>
  )
}
