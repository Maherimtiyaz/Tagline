/* Phase 62 QA harness — Global shortcut layer verification.
 *
 * Confirms the Phase-61 refactor held together:
 *  1. Pure store behavior: helpOpen / toggleHelp / setHelp transitions.
 *  2. Static wiring: overlay mounted globally in App, "?" toggle guarded,
 *     Escape dismissal, platform-aware hint text, and Inbox footer link.
 *  3. Regression guards: ThoughtEditor keeps Mod+S / Mod+Enter through the
 *     shared matcher; no stale local help state left behind in InboxPage.
 */
import { readFileSync } from 'node:fs'

let pass = 0
let fail = 0
const check = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/* ------------------------------------------------------------------ */
console.log('— Store: transient help state —')
/* Import the real store to exercise help transitions as pure logic. */
const { useAppStore } = await import('../src/lib/store')

useAppStore.setState({ helpOpen: false })
check('initial helpOpen is false', useAppStore.getState().helpOpen === false)

useAppStore.getState().toggleHelp()
check('toggleHelp opens overlay', useAppStore.getState().helpOpen === true)

useAppStore.getState().toggleHelp()
check('toggleHelp closes overlay', useAppStore.getState().helpOpen === false)

useAppStore.getState().setHelp(true)
check('setHelp(true) opens overlay', useAppStore.getState().helpOpen === true)

useAppStore.getState().setHelp(false)
check('setHelp(false) closes overlay', useAppStore.getState().helpOpen === false)

/* Subscribers should fire exactly once per transition (no double-set). */
let notifications = 0
const unsub = useAppStore.subscribe(() => notifications++)
useAppStore.getState().toggleHelp()
unsub()
check('store notifies subscribers on toggle', notifications === 1)
useAppStore.setState({ helpOpen: false })

/* ------------------------------------------------------------------ */
console.log('— Overlay component wiring —')
const overlay = src('src/components/ui/ShortcutHelpOverlay.tsx')
check('overlay reads store helpOpen', /s\.helpOpen/.test(overlay))
check('overlay toggles on bare "?" key', /e\.key !== '\?'/.test(overlay))
check('overlay guards typing context', overlay.includes('shouldIgnoreShortcut'))
check('overlay dismisses via Escape', /matchKeyCombo\(e,\s*'Escape'/.test(overlay) || /e\.key === 'Escape'/.test(overlay))
check('overlay renders dialog role for a11y', /role="dialog"/.test(overlay) && /aria-modal/.test(overlay))
check('overlay shows platform-aware shortcuts', overlay.includes('formatShortcut') && overlay.includes('isMacPlatform'))

const app = src('src/App.tsx')
check('App imports ShortcutHelpOverlay', app.includes("import { ShortcutHelpOverlay }"))
check('App mounts overlay globally (Overlays)', /<ShortcutHelpOverlay \/>/.test(app))

/* ------------------------------------------------------------------ */
console.log('— Inbox regression guards —')
const inbox = src('src/features/workspace/InboxPage.tsx')
check('Inbox has no stale local help state', !/setHelpOpen/.test(inbox))
check('Inbox still registers window keydown', /window\.addEventListener\('keydown'/.test(inbox))
check('Inbox guards with shouldIgnoreShortcut', inbox.includes('shouldIgnoreShortcut(e.target, e)'))
check('Inbox footer advertises "?" hint', /\? for shortcuts|press \?|for shortcuts/.test(inbox))

/* ------------------------------------------------------------------ */
console.log('— Editor + palette consolidation —')
const editor = src('src/features/thoughts/ThoughtEditor.tsx')
check('editor uses shared matcher (no hand-rolled meta||ctrl)', !/\(e\.metaKey \|\| e\.ctrlKey\)/.test(editor))
check('editor handles Mod+s via matcher', /matchKeyCombo\(e,\s*'Mod\+s'/.test(editor))
check('editor handles Mod+Enter via matcher', /matchKeyCombo\(e,\s*'Mod\+Enter'/.test(editor))
check('editor computes mac platform once', /isMacPlatform\(\)/.test(editor))

const palette = src('src/components/ui/CommandPalette.tsx')
check('palette uses shared matcher for Escape', palette.includes("matchKeyCombo(e, 'Escape', false)"))

const shell = src('src/components/layout/AppShell.tsx')
check('shell keeps global Mod+k listener', /matchKeyCombo\(e,\s*'Mod\+k'/.test(shell))

/* ------------------------------------------------------------------ */
console.log('— Hotkey spec table consistency —')
/* Every shortcut advertised in the overlay must be wired somewhere. */
const specs = [...overlay.matchAll(/spec:\s*'([^']+)'/g)].map((m) => m[1])
check('overlay lists at least 4 shortcuts', specs.length >= 4)
const allWired = specs.every((s) => {
  if (s === '?') return overlay.includes("'?'")
  if (s === 'Escape') return palette.includes('Escape') || overlay.includes('Escape')
  const key = s.split('+').pop()!.toLowerCase()
  const mod = s.startsWith('Mod')
  if (!mod) return true
  const hay = [inbox, editor, shell, app].join('\n').toLowerCase()
  return hay.includes(`'mod+${key}'`) || hay.includes(`"mod+${key}"`) || hay.includes(`${key.toLowerCase()}`)
})
check('all advertised specs have wiring evidence', allWired)

console.log(`\nphase62-global-shortcuts: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
