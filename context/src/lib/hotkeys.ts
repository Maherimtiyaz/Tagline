/* ============================================================
   Phase 60 — Keyboard UX layer.

   Pure, framework-free helpers so the whole shortcut surface is
   unit-testable under plain Node (no DOM, no React):

   • isMacPlatform        — platform sniff with a safe fallback
   • formatShortcut       — renders a key spec for the current
                            platform: 'Mod+K' → '⌘K' on Mac,
                            'Ctrl+K' everywhere else
   • matchKeyCombo        — decides whether a KeyboardEvent-
                            shaped object fires a spec
   • shouldIgnoreShortcut — typing-context guard for single-key
                            shortcuts (bare /, n, ? …)

   Key specs use '+'-separated modifiers + one final key:
     'Mod'  → Cmd on Mac, Ctrl elsewhere
     'Cmd'  → literal Meta only (never hijacks Ctrl+… on Linux/Win)
     'Ctrl' → literal Control
     'Shift'→ literal Shift
   The final key compares case-insensitively against `e.key`.
   ============================================================ */

/** True when the user agent string identifies an Apple platform.
 *  Inert outside the browser (Node/SSR/tests) — defaults to false,
 *  which is also the correct hint for Windows/Linux users. */
export function isMacPlatform(ua?: string): boolean {
  const text = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /mac|iphone|ipad|ipod/i.test(text)
}

const MAC_SYMBOLS: Record<string, string> = {
  Mod: '\u2318', // ⌘
  Cmd: '\u2318',
  Ctrl: '\u2303', // ⌃
  Shift: '\u21e7', // ⇧
  Alt: '\u2325', // ⌥
}
const OTHER_SYMBOLS: Record<string, string> = {
  Mod: 'Ctrl',
  Cmd: 'Meta',
  Ctrl: 'Ctrl',
  Shift: 'Shift',
  Alt: 'Alt',
}

/** Render a '+'-separated key spec for display. Mac gets Apple
 *  symbols; everyone else gets plain modifier words. Single keys
 *  are uppercased ('k' → 'K'), multi-char keys pass through ('esc'). */
export function formatShortcut(spec: string, mac: boolean): string {
  const parts = spec.split('+')
  const symbols = mac ? MAC_SYMBOLS : OTHER_SYMBOLS
  return parts
    .map((p, i) =>
      i < parts.length - 1 ? (symbols[p] ?? p) : p.length === 1 ? p.toUpperCase() : p,
    )
    .join(mac ? '' : '+')
}

export interface ComboEventLike {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}

/** Does `e` fire the combo described by `spec`? Modifier keys must
 *  match EXACTLY — extra Alt/Ctrl never counts as a hit, so a stray
 *  Ctrl+Alt+K can't open the palette while the OS is mid-compose.
 *  Bare specs (no '+') ignore Shift state on purpose: '?' arrives as
 *  Shift+/ and '/' stays available regardless of caps-lock shifts. */
export function matchKeyCombo(e: ComboEventLike, spec: string, mac: boolean): boolean {
  const parts = spec.split('+')
  const key = parts[parts.length - 1]
  if (e.key.toLowerCase() !== key.toLowerCase()) return false
  const mods = parts.slice(0, -1)
  const wantMod = mods.includes('Mod')
  const wantCmd = mods.includes('Cmd') || (wantMod && mac)
  const wantCtrl = mods.includes('Ctrl') || (wantMod && !mac)
  const wantShift = mods.includes('Shift')
  if (wantCmd !== !!e.metaKey) return false
  if (wantCtrl !== !!e.ctrlKey) return false
  if (!!e.altKey) return false
  if (mods.length > 0 && wantShift !== !!e.shiftKey) return false
  return true
}

/** Typing-context guard for bare single-key shortcuts. Returns true
 *  (skip the shortcut) when focus sits in editable content or a
 *  completion popup is open. Escape-style cleanup stays the page's
 *  responsibility — this only protects letter/punctuation keys. */
export function shouldIgnoreShortcut(target: unknown, e: { getModifierState?: (m: string) => boolean }): boolean {
  const el = target as
    | { tagName?: string; isContentEditable?: boolean }
    | null
    | undefined
  const tag = el?.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el?.isContentEditable) return true
  /* IME composition in progress — keystrokes belong to the editor. */
  if (e.getModifierState?.('Process')) return true
  return false
}
