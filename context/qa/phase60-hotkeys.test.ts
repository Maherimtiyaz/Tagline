/* ============================================================
   Phase 60/61 QA — Keyboard UX layer (lib/hotkeys.ts) + wiring.

   Pure Node harness (no DOM): exercises the four exported helpers
   and statically verifies the app surfaces that consume them
   (AppShell Mod+K, InboxPage help overlay, ThoughtEditor Mod+S).
   Run: npx tsx qa/phase60-hotkeys.test.ts
   ============================================================ */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  formatShortcut,
  isMacPlatform,
  matchKeyCombo,
  shouldIgnoreShortcut,
} from '../src/lib/hotkeys'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = (rel: string) => readFileSync(path.join(here, '..', rel), 'utf8')

let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

console.log('— isMacPlatform —')
check('Mac UA detected', isMacPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)') === true)
check('iPhone UA detected', isMacPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)') === true)
check('Windows UA not Mac', isMacPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)') === false)
check('Linux UA not Mac', isMacPlatform('Mozilla/5.0 (X11; Linux x86_64)') === false)
check('undefined UA inert (Node-safe)', isMacPlatform(undefined) === false || typeof navigator !== 'undefined')

console.log('— formatShortcut —')
check('Mod+K → ⌘K on Mac', formatShortcut('Mod+k', true) === '\u2318K')
check('Mod+K → Ctrl+K elsewhere', formatShortcut('Mod+k', false) === 'Ctrl+K')
check('Mod+S → ⌘S on Mac', formatShortcut('Mod+s', true) === '\u2318S')
check('Cmd literal → Meta word off-Mac', formatShortcut('Cmd+Enter', false) === 'Meta+Enter')
check('Shift symbol on Mac', formatShortcut('Shift+Mod+p', true) === '\u21e7\u2318P')
check('multi-char key passes through', formatShortcut('Mod+Enter', true) === '\u2318Enter')
check('bare key uppercased', formatShortcut('n', false) === 'N')

console.log('— matchKeyCombo —')
const macPalette = { key: 'k', metaKey: true, ctrlKey: false }
check('⌘K fires Mod+k on Mac', matchKeyCombo(macPalette, 'Mod+k', true) === true)
check('⌘K does NOT fire Mod+k off-Mac', matchKeyCombo(macPalette, 'Mod+k', false) === false)
const winPalette = { key: 'k', ctrlKey: true, metaKey: false }
check('Ctrl+K fires Mod+k off-Mac', matchKeyCombo(winPalette, 'Mod+k', false) === true)
check('Ctrl+K does NOT fire Mod+k on Mac', matchKeyCombo(winPalette, 'Mod+k', true) === false)
check('bare K never fires Mod+k', matchKeyCombo({ key: 'k' }, 'Mod+k', true) === false)
check('Ctrl+Alt+K rejected (exact modifiers)', matchKeyCombo({ key: 'k', ctrlKey: true, altKey: true }, 'Mod+k', false) === false)
check('case-insensitive key match', matchKeyCombo({ key: 'K', metaKey: true }, 'Mod+k', true) === true)
check('Escape matches bare spec', matchKeyCombo({ key: 'Escape' }, 'Escape', false) === true)
check('? (Shift+/) matches bare ? spec', matchKeyCombo({ key: '?', shiftKey: true }, '?', false) === true)
check('Shift required when in spec', matchKeyCombo({ key: 'p' }, 'Shift+Mod+p', true) === false)
check('Mod+Enter matches Enter with meta', matchKeyCombo({ key: 'Enter', metaKey: true }, 'Mod+Enter', true) === true)
check('literal Cmd ignores Ctrl on Linux', matchKeyCombo({ key: 'k', ctrlKey: true }, 'Cmd+k', false) === false)

console.log('— shouldIgnoreShortcut —')
const mk = (tagName?: string, ce?: boolean) => ({ tagName: tagName ?? '', isContentEditable: ce ?? false })
check('INPUT target ignored', shouldIgnoreShortcut(mk('input'), {}) === true)
check('TEXTAREA target ignored (lowercase tag too)', shouldIgnoreShortcut(mk('textarea'), {}) === true)
check('contenteditable div ignored', shouldIgnoreShortcut(mk('div', true), {}) === true)
check('plain div allowed', shouldIgnoreShortcut(mk('div'), {}) === false)
check('null target allowed', shouldIgnoreShortcut(null, {}) === false)
check('IME composition ignored', shouldIgnoreShortcut(mk('div'), { getModifierState: (m) => m === 'Process' }) === true)

console.log('— App wiring (static) —')
const shell = src('src/components/layout/AppShell.tsx')
check('AppShell listens for global Mod+k', /matchKeyCombo\(e,\s*'Mod\+k'/.test(shell))
/* Phase 61 refactor: the "?" help dialog moved out of InboxPage into a
   global ShortcutHelpOverlay mounted in App, with open state in the store.
   ThoughtEditor hand-rolled modifier checks were consolidated onto the
   shared matchKeyCombo matcher. Assertions recalibrated to that reality. */
const app = src('src/App.tsx')
check('App mounts global ShortcutHelpOverlay', app.includes('<ShortcutHelpOverlay />'))
const overlay = src('src/components/ui/ShortcutHelpOverlay.tsx')
check('Overlay reads store helpOpen state', /useAppStore\(\(s\) => s\.helpOpen\)/.test(overlay))
const store = src('src/lib/store.ts')
check('Store exposes helpOpen + toggleHelp/setHelp', /helpOpen: boolean/.test(store) && /toggleHelp: \(\) =>/.test(store) && /setHelp: /.test(store))
const inbox = src('src/features/workspace/InboxPage.tsx')
check('InboxPage guards typing via shouldIgnoreShortcut', inbox.includes('shouldIgnoreShortcut(e.target, e)'))
check('InboxPage registers window keydown listener', /window\.addEventListener\('keydown'/.test(inbox))
const editor = src('src/features/thoughts/ThoughtEditor.tsx')
check('ThoughtEditor handles Mod+S save via matcher', /matchKeyCombo\(e,\s*'Mod\+s'/.test(editor))
check('ThoughtEditor still handles Mod+Enter via matcher', /matchKeyCombo\(e,\s*'Mod\+Enter'/.test(editor))
const palette = src('src/components/ui/CommandPalette.tsx')
check('CommandPalette uses shared matcher for Escape', palette.includes("matchKeyCombo(e, 'Escape', false)"))

console.log(`\nphase60-hotkeys: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
