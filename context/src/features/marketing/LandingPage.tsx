import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Logo } from '../brand/Logo'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Kbd } from '../../components/ui/Kbd'
import { cn } from '../../lib/cn'
import { ThemeToggle } from './sections'
import {
  FinalCTA,
  HowItWorksSection,
  MessyToShowcase,
  MobileSection,
  PricingSection,
  Reveal,
  ScreenshotSection,
  TemplatesStrip,
  ToneShowcase,
  UseCasesSection,
  VoiceSection,
} from './sections'
import { HeroDemo } from '../demo/HeroDemo'

/* ============================================================
   Landing page (spec §11–§14): the product demo IS the hero.
   Sticky nav compresses on scroll; sections tell the RAW →
   UNDERSTAND → STRUCTURE → CREATE story in order.
   ============================================================ */

const NAV_LINKS: [string, string][] = [
  ['Product', '/demo'],
  ['How it works', '/#how'],
  ['Templates', '/app/templates'],
  ['Pricing', '/#pricing'],
]

function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-nav border-b border-line bg-canvas/85 backdrop-blur-md transition-[height] duration-[var(--duration-normal)]',
        scrolled ? 'h-14' : 'h-16',
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-full max-w-6xl items-center justify-between px-6"
      >
        <Link to="/" aria-label="Context home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(([label, href]) => (
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
          <Link to="/app" className="hidden sm:inline-block">
            <Button variant="primary" size="sm">Try Context</Button>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover hover:text-ink md:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </nav>

      {/* mobile sheet */}
      {open && (
        <div className="border-t border-line bg-canvas px-4 py-3 md:hidden">
          {NAV_LINKS.map(([label, href]) => (
            <Link
              key={label}
              to={href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-surface-hover hover:text-ink"
            >
              {label}
            </Link>
          ))}
          <Link to="/app" onClick={() => setOpen(false)} className="mt-2 block">
            <Button variant="primary" size="sm" className="w-full">Try Context</Button>
          </Link>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center md:pt-28">
      <Reveal>
        <Badge tone="outline" mono>Frontend portfolio demo · no signup</Badge>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-tighter md:text-7xl">
          Your messy thoughts.
          <br />
          <span className="text-ink-muted">Made useful.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
          Capture whatever is in your head. Context turns it into something you can actually use.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/app"><Button variant="primary" size="lg">Try Context</Button></Link>
          <a href="#hero-demo"><Button variant="secondary" size="lg">Watch it transform</Button></a>
        </div>
        <p className="mt-4 text-xs text-ink-subtle">
          The demo below is live — pick a preset or type something messy.{' '}
          <Kbd keys={['⌘', 'K']} /> opens the command palette in the app.
        </p>
      </Reveal>

      {/* the interactive transformation itself (§12–§13) */}
      <Reveal delay={0.15} y={24}>
        <div id="hero-demo" className="mx-auto mt-14 max-w-4xl scroll-mt-24 text-left">
          <HeroDemo />
        </div>
      </Reveal>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <Logo size={16} />
        <nav aria-label="Footer" className="flex gap-5 text-sm text-ink-muted">
          <Link to="/demo" className="transition-colors hover:text-ink">Demo</Link>
          <Link to="/app/templates" className="transition-colors hover:text-ink">Templates</Link>
          <Link to="/app" className="transition-colors hover:text-ink">Workspace</Link>
          <a href="#" className="transition-colors hover:text-ink">About</a>
          <a href="#" className="transition-colors hover:text-ink">Legal</a>
        </nav>
        <p className="font-mono text-3xs text-ink-subtle">DEMO MODE · FICTIONAL DATA</p>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <MarketingNav />
      <main className="flex-1">
        <Hero />
        <HowItWorksSection />
        <MessyToShowcase />
        <UseCasesSection />
        <VoiceSection />
        <ScreenshotSection />
        <ToneShowcase />
        <MobileSection />
        <TemplatesStrip />
        <PricingSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
