import { useEffect, useId, useRef, useState } from 'react'
import {
  Archive,
  FileText,
  FolderPlus,
  LayoutTemplate,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../../lib/store'
import { useThemeStore } from '../../lib/theme'
import { cn } from '../../lib/cn'
import { Kbd } from './Kbd'

/* ============================================================
   Command palette (⌘K). Keyboard-first: ↑↓ navigate, Enter run,
   Esc close. Sections: actions, transform targets, navigation.
   ============================================================ */

interface Command {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  group: string
  run: () => void
}

export function CommandPalette({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const open = useAppStore((s) => s.paletteOpen)
  const setOpen = useAppStore((s) => s.setPalette)
  const addThought = useAppStore((s) => s.addThought)
  const select = useAppStore((s) => s.select)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const pushToast = useAppStore((s) => s.pushToast)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  const commands: Command[] = [
    {
      id: 'new',
      label: 'New thought',
      hint: 'N',
      icon: <Plus size={15} />,
      group: 'Actions',
      run: () => {
        const id = addThought('')
        select(id)
        onNavigate?.(`/app/thought/${id}`)
      },
    },
    {
      id: 'search',
      label: 'Search thoughts and outputs',
      hint: '/',
      icon: <Search size={15} />,
      group: 'Actions',
      run: () => onNavigate?.('/app'),
    },
    {
      id: 'history',
      label: 'Open history',
      icon: <Archive size={15} />,
      group: 'Navigate',
      run: () => onNavigate?.('/app/history'),
    },
    {
      id: 'templates',
      label: 'Create from template',
      icon: <LayoutTemplate size={15} />,
      group: 'Navigate',
      run: () => onNavigate?.('/templates'),
    },
    {
      id: 'workspace',
      label: 'Open workspace',
      icon: <FileText size={15} />,
      group: 'Navigate',
      run: () => onNavigate?.('/app'),
    },
    {
      id: 'theme',
      label: 'Toggle theme',
      icon: <Sparkles size={15} />,
      group: 'Settings',
      run: () => toggleTheme(),
    },
    {
      id: 'settings',
      label: 'Open settings',
      icon: <Settings size={15} />,
      group: 'Settings',
      run: () => {
        onNavigate?.('/app/settings')
        pushToast('Settings opened', 'info')
      },
    },
  ]

  const filtered = commands.filter((c) =>
    (c.label + c.group).toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 10)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  let lastGroup = ''

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-fade-up"
      >
        <h2 id={titleId} className="sr-only">Command palette</h2>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={15} className="text-ink-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % Math.max(1, filtered.length)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + filtered.length) % Math.max(1, filtered.length)) }
              else if (e.key === 'Enter') {
                e.preventDefault()
                const cmd = filtered[active]
                if (cmd) { cmd.run(); setOpen(false) }
              }
            }}
            placeholder="Type a command…"
            aria-label="Search commands"
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
          />
          <Kbd keys={['esc']} />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-label="Commands">
          {filtered.map((c, i) => {
            const showGroup = c.group !== lastGroup
            lastGroup = c.group
            return (
              <li key={c.id}>
                {showGroup && (
                  <p className="label-mono px-2 pb-1 pt-3">{c.group}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => { c.run(); setOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm',
                    i === active ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-surface-hover',
                  )}
                >
                  <span className={cn(i === active ? 'text-accent' : 'text-ink-subtle')} aria-hidden>{c.icon}</span>
                  <span className="flex-1 text-left">{c.label}</span>
                  {c.hint && <Kbd keys={[c.hint]} />}
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-ink-subtle">No matching commands.</li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
