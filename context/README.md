# Context — thought-to-output demo app

A React + TypeScript + Vite demo product: capture rough thoughts, transform them
into structured outputs (emails, briefs, posts), review weekly digests, and share
results — all on seeded mock data with localStorage persistence and cross-tab sync.

## Quick start

```bash
npm install
npm run dev        # vite dev server
npm run build      # tsc -b && vite build
npm run lint       # oxlint
```

## QA harnesses

Pure Node/tsx test files in `qa/` (no browser needed). Run one or all:

```bash
npx tsx qa/phase60-hotkeys.test.ts
for f in qa/phase*.test.ts; do npx tsx "$f"; done   # full sweep (21 harnesses)
```

See `QA_REPORT.md` for per-phase verification results and `PHASES_REPORT.md`
for the implementation history.

## Features by area

- **Inbox / Workspace / Drafts** (`src/features/workspace`) — search, tag filters,
  star/pin priority grouping, multi-select bulk actions, undo toasts.
- **Thought editor** (`src/features/thoughts`) — slash commands, template capture,
  transform pipeline animation, autosave + draft recovery, Mod+S save, Mod+Enter transform.
- **Command palette** (`src/components/ui/CommandPalette.tsx`) — global Mod+K
  (⌘K / Ctrl+K) navigation, tag deep links, actions.
- **Keyboard UX layer** (`src/lib/hotkeys.ts`, Phase 60) — platform-aware shortcut
  matching/formatting helpers shared by every surface; typing-context guards;
  press **?** in the Inbox for the shortcut help overlay.
- **Weekly digest** (`src/features/digest`, `src/lib/mockAI.ts`) — ISO week math
  (DST-safe), markdown/EML/email export, share links, week-over-week compare.
- **Collections, insights, history, settings** (`src/features/*`).

## Architecture notes

- `src/lib/store.ts` — zustand store; persisted domain state (thoughts, timeline,
  collections, digests) via safeStorage; BroadcastChannel cross-tab sync with
  seed re-merge so the demo can't be bricked; transient UI state never crosses tabs.
- `src/lib/hotkeys.ts` — framework-free, unit-testable shortcut primitives
  (`isMacPlatform`, `formatShortcut`, `matchKeyCombo`, `shouldIgnoreShortcut`).
- All storage/DOM-touching helpers are Node-inert (guarded `window`/`globalThis`)
  so QA harnesses run under plain tsx.

## Things left to complete

- [ ] Browser-level E2E coverage for keyboard flows (help overlay focus trap,
      palette open/close cycles) — current P60 harness is pure-Node + static wiring only.
- [ ] Move the ? help overlay from InboxPage into AppShell so shortcuts are
      discoverable on Digest/Collections/History routes too.
- [ ] User-customizable keybindings (store-backed remapping of bare-key specs).
- [ ] Replace remaining hand-rolled `(e.metaKey || e.ctrlKey)` checks in
      ThoughtEditor with `matchKeyCombo` once React KeyboardEvent bridging is added.
- [ ] Real backend/API layer (everything is mock AI + localStorage today).
- [ ] Production a11y audit: screen-reader announcements for palette/toast hotkeys.
- [ ] Clean up the 3 pre-existing react-hooks lint warnings (set-state-in-effect).
