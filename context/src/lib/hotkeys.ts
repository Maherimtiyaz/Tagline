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
export function matchKeyCombo(e: ComboEventLike, spec: string | undefined, mac: boolean): boolean {
  if (!spec) return false
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

/* ============================================================
   Phase 63 — User-customizable keybindings.

   A tiny persisted remap registry layered on top of the pure
   matchers above. Design rules:

   • Defaults are the shipped specs ('Mod+k', 'Escape', '?', …).
     A binding that was never remapped resolves to its default,
     so behavior is byte-identical to Phase 62 with an empty map.
   • Remaps live OUTSIDE the persisted domain envelope (same
     policy as drafts & palette state, Phase 31/34 invariants):
     keybindings are per-device preference, not shared demo data,
     and they must survive `resetDemo`.
   • Validation is strict: specs must be '+'-separated modifiers
     plus one final key, known modifier names only, no duplicates,
     and the resolved combo must not collide with another binding
     (collision ⇒ the whole set falls back to defaults rather than
     half-applying a broken map).
   ============================================================ */

/** Shipped default bindings — the single source of truth for every
 *  global/app-level shortcut spec. UI surfaces format these through
 *  `formatShortcut` so hints stay platform-aware automatically. */
export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  'palette.toggle': 'Mod+k',
  'help.toggle': '?',
  'help.close': 'Escape',
  'editor.save': 'Mod+s',
  'editor.transform': 'Mod+enter',
  'inbox.new': 'n',
  'inbox.search': '/',
  'inbox.clear': 'Escape',
}

const KNOWN_MODS = new Set(['Mod', 'Cmd', 'Ctrl', 'Shift', 'Alt'])

/** Structural check for a key spec: 'Mod+K', '?', 'Escape',
 *  'Shift+Mod+p' … Must end in exactly one non-modifier key, use
 *  only known modifiers, no repeats. Case-insensitive on the final
 *  key (matchKeyCombo compares lower-cased). */
export function isValidKeySpec(spec: unknown): spec is string {
  if (typeof spec !== 'string' || spec.length === 0) return false
  const parts = spec.split('+')
  if (parts.some((p) => p.length === 0)) return false
  const mods = parts.slice(0, -1)
  const key = parts[parts.length - 1]
  if (KNOWN_MODS.has(key)) return false // must end with a real key
  if (new Set(mods).size !== mods.length) return false
  return mods.every((m) => KNOWN_MODS.has(m))
}

/** Resolve a binding id to its effective spec: user remap when
 *  valid & collision-free, otherwise the shipped default. Unknown
 *  ids resolve to undefined so callers can no-op safely. */
export function resolveBinding(
  id: string,
  remaps: Record<string, unknown>,
): string | undefined {
  const def = DEFAULT_KEYBINDINGS[id]
  if (def === undefined) return undefined
  const custom = remaps[id]
  if (typeof custom === 'string' && isValidKeySpec(custom)) return custom
  return def
}

/** Validate a whole remap candidate against the defaults:
 *  every id must exist, every spec must be structurally valid,
 *  and resolved combos must be unique (two bindings firing the
 *  same combo is ambiguous — reject the entire set). Returns the
 *  sanitized map (only changed entries kept) or null on failure. */
export function validateRemapSet(
  candidate: Record<string, unknown>,
): Record<string, string> | null {
  const clean: Record<string, string> = {}
  for (const [id, spec] of Object.entries(candidate)) {
    if (!(id in DEFAULT_KEYBINDINGS)) return null
    if (!isValidKeySpec(spec)) return null
    if (spec === DEFAULT_KEYBINDINGS[id]) continue // unchanged — don't persist noise
    clean[id] = spec
  }
  /* Collision check across resolved specs (case-insensitive, like
     matchKeyCombo's key comparison). */
  const seen = new Map<string, string>()
  for (const id of Object.keys(DEFAULT_KEYBINDINGS)) {
    const resolved = resolveBinding(id, clean).toLowerCase()
    const clash = seen.get(resolved)
    if (clash !== undefined) return null
    seen.set(resolved, id)
  }
  return clean
}
