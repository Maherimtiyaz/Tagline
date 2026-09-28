import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Archive,
  Command,
  FileText,
  Inbox as InboxIcon,
  LayoutTemplate,
  Layers,
  Library,
  Plus,
  RotateCcw,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useAppStore } from '../../lib/store'
import { useThemeStore } from '../../lib/theme'
import { COLLECTIONS } from '../../data/mock'
import { Kbd } from '../ui/Kbd'
import { cn } from '../../lib/cn'

/* ============================================================
   App shell — collapsible sidebar + routed content. Mobile
   (<768px) swaps the sidebar for a bottom tab bar; this same
   layout wraps /app/* routes. A quiet DEMO MODE pill with a
   one-click reset lives at the top of the main column (§57).
   ============================================================ */

const NAV = [
  { to: '/app', label: 'Inbox', icon: InboxIcon, end: true },
  { to: '/app/workspace', label: 'Workspace', icon: Layers, end: false },
  { to: '/app/drafts', label: 'Drafts', icon: FileText, end: false },
  { to: '/app/history', label: 'History', icon: Archive, end: false },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate, end: false },
  { to: '/app/collections', label: 'Collections', icon: Library, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
]

const MOBILE_NAV = [
  { to: '/app', label: 'Inbox', icon: InboxIcon, end: true },
  { to: '/app/new', label: 'Create', icon: Plus, end: false, create: true },
  { to: '/app/history', label: 'History', icon: Archive, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
]

/** Which nav entry a pathname belongs to (thought editor → Inbox). */
function navActive(pathname: string, to: string, end: boolean) {
  const effective = pathname.startsWith('/app/thought/') || pathname === '/app/new' ? '/app' : pathname
  return end ? effective === to : effective === to || effective.startsWith(to + '/')
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const thoughts = useAppStore((s) => s.thoughts)
  const setPalette = useAppStore((s) => s.setPalette)
  const resetDemo = useAppStore((s) => s.resetDemo)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const navigate = useNavigate()
  const location = useLocation()

  const rawCount = thoughts.filter((t) => t.status === 'raw').length
  const draftCount = thoughts.filter((t) => t.status !== 'archived' && (t.text.trim() === '' || (t.status === 'raw' && t.outputs.length === 0))).length

  /** Create a blank thought and open the editor for it. */
  const onNewThought = () => {
    const id = useAppStore.getState().addThought('')
    useAppStore.getState().select(id)
    navigate(`/app/thought/${id}`)
  }

  const isActive = (to: string, end: boolean) => navActive(location.pathname, to, end)

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside
        aria-label="Primary"
        className={cn(
          'hidden shrink-0 flex-col border-r border-line bg-canvas-deep transition-[width] duration-[var(--duration-base)] md:flex',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <div className={cn('flex h-12 items-center gap-2 border-b border-line px-3', collapsed && 'justify-center px-0')}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-md p-1 hover:bg-surface-hover"
            aria-label="Context home"
          >
            <Mark />
            {!collapsed && <span className="text-sm font-semibold tracking-tight">Context</span>}
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="ml-auto rounded-md p-1 text-ink-subtle hover:bg-surface-hover hover:text-ink"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-auto mt-2 rounded-md p-1.5 text-ink-subtle hover:bg-surface-hover hover:text-ink"
          >
            <PanelLeftOpen size={15} />
          </button>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((n) => (
            <button
              key={n.to}
              type="button"
              onClick={() => navigate(n.to)}
              aria-current={isActive(n.to, n.end) ? 'page' : undefined}
              title={collapsed ? n.label : undefined}
              className={cn(
                'relative flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors duration-[var(--duration-micro)]',
                collapsed && 'justify-center px-0',
                isActive(n.to, n.end)
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
              )}
            >
              {isActive(n.to, n.end) && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-accent" aria-hidden />
              )}
              <n.icon size={15} className={isActive(n.to, n.end) ? 'text-accent' : ''} aria-hidden />
              {!collapsed && <span className="flex-1 text-left">{n.label}</span>}
              {!collapsed && n.label === 'Inbox' && rawCount > 0 && (
                <span className="rounded-full bg-accent-soft px-1.5 py-px font-mono text-3xs text-accent">{rawCount}</span>
              )}
              {!collapsed && n.label === 'Drafts' && draftCount > 0 && (
                <span className="font-mono text-3xs text-ink-faint">{draftCount}</span>
              )}
            </button>
          ))}

          {!collapsed && (
            <>
              <p className="label-mono px-2 pb-1 pt-5">Collections</p>
              {COLLECTIONS.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/app/collections/${c.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  <Dot color={c.color} />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-3xs text-ink-faint">
                    {thoughts.filter((t) => t.collectionId === c.id || t.collectionId === c.name).length}
                  </span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div className={cn('space-y-1 border-t border-line p-2', collapsed && 'flex flex-col items-center')}>
          <button
            type="button"
            onClick={() => setPalette(true)}
            title="Command palette"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink',
              collapsed && 'justify-center px-0',
            )}
          >
            <Command size={15} aria-hidden />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Commands</span>
                <Kbd keys={['⌘', 'K']} />
              </>
            )}
          </button>
          {!collapsed && (
            <div className="flex items-center justify-between px-2 pb-1 pt-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="text-2xs text-ink-subtle hover:text-ink"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <Avatar />
            </div>
          )}
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <main className="flex min-w-0 flex-1 flex-col pb-14 md:pb-0">
        {/* Portfolio-mode indicator — quiet, one line, one action (spec §57) */}
        <div className="flex h-7 shrink-0 items-center gap-2 border-b border-line bg-canvas-deep px-3 md:px-6" role="status">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
          <span className="font-mono text-3xs uppercase tracking-[0.14em] text-ink-subtle">Demo mode</span>
          <span className="hidden font-mono text-3xs text-ink-faint sm:inline">all data is local · nothing is sent anywhere</span>
          <button
            type="button"
            onClick={resetDemo}
            className="ml-auto flex h-5 items-center gap-1 rounded border border-line px-1.5 font-mono text-3xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            aria-label="Reset demo to its initial state"
          >
            <RotateCcw size={9} aria-hidden /> Reset demo
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </main>

      {/* ---------- Bottom nav (mobile) ---------- */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-sticky flex h-14 items-stretch border-t border-line bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_NAV.map((n) => {
          const active = isActive(n.to, n.end)
          return (
            <button
              key={n.to}
              type="button"
              onClick={() => ('create' in n && n.create ? onNewThought() : navigate(n.to))}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-3xs',
                active ? 'text-accent' : 'text-ink-subtle',
              )}
            >
              <n.icon size={18} aria-hidden />
              {n.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/** Brand mark — two nodes joined through a bracket of context. */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path d="M9 4.5A7.5 7.5 0 0 0 9 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent" />
      <path d="M15 4.5a7.5 7.5 0 0 1 0 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <circle cx="12" cy="12" r="2" fill="currentColor" className="text-accent" />
    </svg>
  )
}

function Dot({ color }: { color: string }) {
  const map: Record<string, string> = {
    accent: 'bg-accent', blue: 'bg-blue', emerald: 'bg-emerald',
    amber: 'bg-amber', coral: 'bg-coral', neutral: 'bg-ink-faint',
  }
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', map[color])} aria-hidden />
}

function Avatar() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft font-mono text-3xs text-accent" aria-label="Profile: Mahek">
      M
    </span>
  )
}
