import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  Collection,
  DigestRule,
  GeneratedOutput,
  OutputType,
  OutputVersion,
  Thought,
  ThoughtStatus,
  TimelineEvent,
  ToneId,
  WeeklyDigest,
} from '../data/types'
import { COLLECTIONS, SEED_THOUGHTS, SEED_TIMELINE } from '../data/mock'
import type { DigestComparison } from './analytics'
import { compareDigestWeeks } from './analytics'
import { DEFAULT_KEYBINDINGS, validateRemapSet } from './hotkeys'
import {
  addWeeks,
  analyzeThought,
  buildWeeklyDigest,
  digestRuleMatches,
  digestToEmail,
  downloadDigestEmail,
  generateOutput,
  isoWeekKey,
  retune,
  uid,
  weekBounds,
} from './mockAI'

/* Phase 23 — tag normalization: trim, collapse inner whitespace, drop
   leading '#', cap length. Returns '' for unusable input. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, 24)
}

/* ============================================================
   Global app store — thoughts, timeline, editor selection,
   command palette, toasts. All local; reset restores seeds.

   Persistence: user-created thoughts + their outputs survive a
   page refresh (localStorage). The seed demo content is always
   re-merged on load so the demo never breaks; "Reset demo"
   clears storage and restores the pristine state. Transient UI
   state (toasts, palette, view) is never persisted.
   ============================================================ */

const STORAGE_KEY = 'context-demo-state-v1'

/** localStorage can be unavailable (private mode / embedded webviews). */
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      /* ignore quota / access errors — demo still works in-memory */
    }
  },
  removeItem: (name: string): void => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

interface PersistedShape {
  thoughts: Thought[]
  timeline: TimelineEvent[]
  /** Collections the user created in this demo (Phase 12) — now survive refresh. */
  userCollections?: Collection[]
  onboardingSeen?: boolean
  /** Completed demo runs recorded in this browser (spec §56, persisted). */
  demoVisits?: number
  /** Phase 40/41 — generated weekly digests keyed by ISO week (`YYYY-Www`). */
  digests?: Record<string, WeeklyDigest>
  /** Phase 45 — digest personalization rules (ordered, newest last). */
  digestRules?: DigestRule[]
}

const RULE_SOURCES = new Set(['voice', 'text', 'screenshot', 'import'])

/** Phase 45 — runtime validation of one persisted/broadcast rule row.
 *  A rule must carry a valid id/label and at least one real criterion;
 *  unknown fields are dropped, malformed rows rejected (never throws). */
function sanitizeDigestRule(raw: unknown): DigestRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Partial<DigestRule>
  if (typeof r.id !== 'string' || !r.id || typeof r.label !== 'string') return null
  const out: DigestRule = {
    id: r.id.slice(0, 64),
    label: r.label.trim().slice(0, 60) || 'Untitled rule',
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : 0,
    enabled: r.enabled === true,
  }
  if (Array.isArray(r.requireTags)) {
    const tags = r.requireTags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => normalizeTag(t))
      .filter(Boolean)
      .slice(0, 8)
    if (tags.length > 0) out.requireTags = [...new Set(tags)]
  }
  if (Array.isArray(r.sources)) {
    const srcs = (r.sources as unknown[]).filter((s) => typeof s === 'string' && RULE_SOURCES.has(s))
    if (srcs.length > 0) out.sources = [...new Set(srcs)] as DigestRule['sources']
  }
  if (typeof r.minConfidence === 'number' && Number.isFinite(r.minConfidence) && r.minConfidence > 0) {
    out.minConfidence = Math.min(1, r.minConfidence)
  }
  if (r.starredOnly === true) out.starredOnly = true
  if (r.onlyTransformed === true) out.onlyTransformed = true
  if (r.excludeArchived === true) out.excludeArchived = true
  /* Rows with zero criteria would silently empty every recap — drop them. */
  const hasCriterion =
    out.requireTags !== undefined ||
    out.sources !== undefined ||
    out.minConfidence !== undefined ||
    out.starredOnly === true ||
    out.onlyTransformed === true ||
    out.excludeArchived === true
  return hasCriterion ? out : null
}

/** Phase 45 — validate a persisted/broadcast rule list; dedupes ids,
 *  caps at 12 rules (creation order preserved). */
function sanitizeDigestRules(raw: unknown): DigestRule[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: DigestRule[] = []
  for (const row of raw) {
    const r = sanitizeDigestRule(row)
    if (!r || seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
    if (out.length >= 12) break
  }
  return out
}

/** Phase 41 — runtime validation of a persisted/broadcast digest map.
 *  Keeps the demo brick-proof: bad rows are dropped, valid ones kept. */
function sanitizeDigests(raw: unknown): Record<string, WeeklyDigest> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, WeeklyDigest> = {}
  for (const [key, d] of Object.entries(raw as Record<string, unknown>)) {
    if (!d || typeof d !== 'object') continue
    const x = d as Partial<WeeklyDigest>
    if (
      x.weekKey === key &&
      typeof x.from === 'number' &&
      typeof x.to === 'number' &&
      typeof x.generatedAt === 'number' &&
      typeof x.headline === 'string' &&
      Array.isArray(x.sections) &&
      x.sections.every(
        (sec) =>
          !!sec &&
          typeof sec.heading === 'string' &&
          Array.isArray(sec.items) &&
          sec.items.every((i) => typeof i === 'string'),
      )
    ) {
      out[key] = x as WeeklyDigest
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Merge persisted thoughts with seeds: seeds win on id collisions,
 *  non-seed (user/demo-created) thoughts are kept and sorted newest-first. */
function mergeWithSeeds(persisted?: PersistedShape | null): PersistedShape {
  if (!persisted || !Array.isArray(persisted.thoughts)) return seedState()
  const seeds = SEED_THOUGHTS.map((t) => ({ ...t, outputs: [...t.outputs] }))
  const seedIds = new Set(seeds.map((t) => t.id))
  const extras = persisted.thoughts.filter((t) => t && typeof t.id === 'string' && !seedIds.has(t.id))
  const seedTimelineIds = new Set(SEED_TIMELINE.map((e) => e.id))
  const extraEvents = (Array.isArray(persisted.timeline) ? persisted.timeline : []).filter(
    (e) => e && typeof e.id === 'string' && !seedTimelineIds.has(e.id),
  )
  const seedCollectionIds = new Set(COLLECTIONS.map((c) => c.id))
  const extraCollections = (Array.isArray(persisted.userCollections) ? persisted.userCollections : []).filter(
    (c) => c && typeof c.id === 'string' && !seedCollectionIds.has(c.id),
  )
  return {
    thoughts: [...extras].sort((a, b) => b.createdAt - a.createdAt).concat(seeds),
    timeline: [...SEED_TIMELINE, ...extraEvents].sort((a, b) => a.at - b.at),
    userCollections: extraCollections,
    onboardingSeen: persisted.onboardingSeen === true,
    demoVisits:
      typeof persisted.demoVisits === 'number' && Number.isFinite(persisted.demoVisits)
        ? Math.max(0, Math.floor(persisted.demoVisits))
        : 0,
    /* Phase 41: digests ride the same envelope; validated row-by-row.
       `|| {}` keeps the merged state's map always defined (never
       undefined shadowing the store default). */
    digests: sanitizeDigests(persisted.digests) || {},
    /* Phase 45: personalization rules — validated list, deduped by id. */
    digestRules: sanitizeDigestRules(persisted.digestRules),
  }
}

export interface Toast {
  id: string
  message: string
  tone?: 'success' | 'info' | 'error'
  /** Optional inline action (Phase 21 — "Undo" on destructive toasts). */
  action?: { label: string; run: () => void }
}

/** How long a plain toast stays on screen. */
const TOAST_MS = 2600
/** Undo-actionable toasts linger longer so the button is reachable. */
const TOAST_ACTION_MS = 6000

/* ---- Phase 31: cross-tab sync -------------------------------------------
   The persisted store already shares one localStorage key, but a second
   browser tab never learns about the first tab's writes until reload.
   This module broadcasts domain-data changes over BroadcastChannel when
   available and falls back to `storage` events (which fire only in *other*
   tabs — exactly what we need) on older engines. Transient UI state is
   deliberately excluded: tabs keep independent palettes, toasts, drafts. */

export const CROSS_TAB_CHANNEL = 'context-demo-sync-v1'

type SyncMessage = { kind: 'domain'; senderId: string } | { kind: 'reset'; senderId: string }

/** Per-tab identity so we can ignore our own echoes. */
export const TAB_ID = uid('tab')

let channel: BroadcastChannel | null = null
let applyingRemote = false

/** Domain slice currently applied from another tab (for storage-event dedup). */
let lastAppliedRaw: string | null = null

/** Pure read of the persisted domain payload; null when unavailable/invalid. */
export function readPersistedDomain(): PersistedShape | null {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: PersistedShape }
    return parsed && parsed.state && Array.isArray(parsed.state.thoughts) ? parsed.state : null
  } catch {
    return null
  }
}

/** Apply another tab's persisted payload locally (seeds re-merged as always). */
function applyRemoteState(remote: PersistedShape | null): void {
  applyingRemote = true
  try {
    useAppStore.setState({ ...mergeWithSeeds(remote) })
  } finally {
    applyingRemote = false
  }
}

/** Which inbox view the list screen renders (spec §18 sidebar). */
export type InboxView = 'inbox' | 'workspace' | 'drafts'

/** Undo/redo journal for the output editor (spec §27). */
export interface EditSnapshot {
  body: string
  tone: ToneId
}

/* ---- Phase 19: output version history ----------------------------------
   Versioning actions (tone switch, format switch, quick rewrite) archive
   the pre-change snapshot so nothing is silently lost. Snapshots live on
   the output itself, so they persist with thoughts automatically. */

const MAX_VERSIONS = 12

let versionSeq = 0
export const makeVersion = (label: string, snap: EditSnapshot): OutputVersion => ({
  id: `v${Date.now().toString(36)}-${(versionSeq++).toString(36)}`,
  at: Date.now(),
  label,
  body: snap.body,
  tone: snap.tone,
})

/** Archive a snapshot onto an output (newest-first, capped). Pure helper
 *  used inside set() updaters. */
const archiveOnto = (o: GeneratedOutput, v: OutputVersion): GeneratedOutput => ({
  ...o,
  versions: [v, ...(o.versions ?? [])].slice(0, MAX_VERSIONS),
})

/* ---- Phase 34: editor autosave & draft recovery ------------------------
   The thought editor keeps typing in component state and only commits to
   the store on blur / transform — so a refresh or tab crash between edits
   silently loses work. Autosave mirrors every keystroke (debounced by the
   editor) into its own small localStorage key; on the next open the stored
   text is offered as a recoverable draft instead of being applied behind
   the user's back. Kept OUT of the main persisted domain payload (partialize
   below) so it never syncs across tabs or inflates demo resets. */

const DRAFT_KEY = 'context-demo-editor-drafts-v1'
/** Autosaves older than this are considered stale and dropped. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
/** Soft cap so abandoned drafts can't grow storage unbounded. */
export const MAX_DRAFTS = 50

export interface EditorDraft {
  text: string
  savedAt: number
}

type DraftMap = Record<string, EditorDraft>

function readDrafts(): DraftMap {
  try {
    const raw = safeStorage.getItem(DRAFT_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const cutoff = Date.now() - DRAFT_TTL_MS
    const out: DraftMap = {}
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const d = v as Partial<EditorDraft> | null
      if (d && typeof d.text === 'string' && typeof d.savedAt === 'number' && d.savedAt >= cutoff) {
        out[id] = { text: d.text, savedAt: d.savedAt }
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeDrafts(map: DraftMap): void {
  try {
    /* Cap: keep the newest MAX_DRAFTS entries by savedAt. */
    const entries = Object.entries(map)
    const kept =
      entries.length <= MAX_DRAFTS
        ? entries
        : entries.sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, MAX_DRAFTS)
    safeStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    /* quota / private mode — autosave degrades silently, app still works */
  }
}

/* ---- Phase 63: user-customizable keybindings ---------------------------
   Remaps live in their own localStorage key, deliberately OUTSIDE the
   persisted domain envelope (same policy as Phase-34 drafts): keybindings
   are a per-device preference — they never cross-tab sync and they survive
   `resetDemo`. Corrupt payloads and structurally-invalid/colliding sets
   degrade to shipped defaults. */

const KEYMAP_KEY = 'context-demo-keybindings-v1'

export type Keymap = Record<string, string>

/** Read + sanitize the persisted remap map. Only entries that exist in
 *  DEFAULT_KEYBINDINGS, pass isValidKeySpec, and differ from the default
 *  are kept; anything else drops the WHOLE set (defaults win). */
function readKeymap(): Keymap {
  try {
    const raw = safeStorage.getItem(KEYMAP_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const validated = validateRemapSet(parsed as Record<string, unknown>)
    return validated ?? {}
  } catch {
    return {}
  }
}

function writeKeymap(map: Keymap): void {
  try {
    if (Object.keys(map).length === 0) safeStorage.removeItem(KEYMAP_KEY)
    else safeStorage.setItem(KEYMAP_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode — remap degrades silently, defaults still work */
  }
}

interface AppState {
  thoughts: Thought[]
  timeline: TimelineEvent[]
  /** Collections the user created in this demo (persisted, Phase 12). */
  userCollections: Collection[]
  selectedThoughtId: string | null
  paletteOpen: boolean
  /** Phase 61: global "?" shortcut-help overlay (transient UI state). */
  helpOpen: boolean
  /** Phase 63: user remaps only — empty means pure shipped defaults. */
  keybindings: Keymap
  toasts: Toast[]
  inboxView: InboxView
  /** Global search query — empty means no active search (spec §33). */
  searchQuery: string
  /** Per-output undo history; cleared when an output is regenerated. */
  editHistory: Record<string, { past: EditSnapshot[]; future: EditSnapshot[] }>
  /** First-run onboarding overlay dismissed flag (persisted). */
  onboardingSeen: boolean
  /** Completed demo runs recorded in this browser (spec §56, persisted). */
  demoVisits: number

  /* derived helpers */
  select: (id: string | null) => void
  setPalette: (open: boolean) => void
  /** Phase 60: flip for the global Mod+K palette listener. */
  togglePalette: () => void
  /** Phase 61: open/close the global shortcut help overlay. */
  setHelp: (open: boolean) => void
  toggleHelp: () => void
  /** Phase 63: remap a binding id to a new key spec. Returns false when
   *  the resulting set is invalid or collides (state untouched). */
  setKeybinding: (id: string, spec: string) => boolean
  /** Phase 63: restore one binding to its shipped default. */
  resetKeybinding: (id: string) => void
  /** Phase 63: restore every binding to shipped defaults. */
  resetAllKeybindings: () => void
  setInboxView: (view: InboxView) => void
  dismissOnboarding: () => void
  /** Re-show the first-run welcome card (Settings → Replay welcome tour). */
  showOnboarding: () => void
  /** Record one completed /demo transformation. */
  recordDemoVisit: () => void

  addThought: (text: string, source?: Thought['source']) => string
  updateThoughtText: (id: string, text: string) => void
  deleteThought: (id: string) => void
  archiveThought: (id: string) => void
  unarchiveThought: (id: string) => void
  /** Phase 22 — pin/unpin; pinned thoughts float to the top of inbox views. */
  togglePin: (id: string) => boolean
  /** Phase 25 — star/unstar; starred rows sort above pinned rows. */
  toggleStar: (id: string) => boolean

  /* ---- Phase 35: thought lifecycle — draft vs ready ---- */
  /** Flip raw ↔ processed. Returns the new status, or null for unknown ids.
   *  Rows that already carry outputs are locked as "ready" (data safety). */
  setStatus: (id: string, status: Extract<ThoughtStatus, 'raw' | 'processed'>) => ThoughtStatus | null
  /** Convenience toggle used by card shortcuts / palette actions. */
  toggleStatus: (id: string) => ThoughtStatus | null
  /** Count thoughts in a given status (used by tests + Insights chips). */
  countByStatus: (status: ThoughtStatus) => number

  /* ---- Phase 23: tags — user-editable labels for inbox filtering ---- */
  /** Add a normalized tag to one thought. False when empty/dupe/unknown. */
  addTag: (id: string, tag: string) => boolean
  /** Remove a tag (case-insensitive). Returns whether anything changed. */
  removeTag: (id: string, tag: string) => boolean
  /** Rename a tag across every thought carrying it. Returns thoughts touched. */
  renameTag: (from: string, to: string) => number

  /** Run understanding for a thought (stage-2 data only; UI animates stages). */
  understand: (id: string) => void

  /** Generate + attach an output; records history. Returns the output. */
  transform: (id: string, type: OutputType, tone?: ToneId) => GeneratedOutput

  retone: (thoughtId: string, outputId: string, tone: ToneId) => void
  reformat: (thoughtId: string, outputId: string, type: OutputType) => void
  editOutputBody: (thoughtId: string, outputId: string, body: string) => void
  saveToCollection: (thoughtId: string, outputId: string, collectionName: string) => void

  /** Create a user collection (idempotent on slug). Returns the collection. */
  addCollection: (name: string) => Collection
  /** Rename a user collection (seed collections are immutable). */
  renameCollection: (collectionId: string, name: string) => boolean
  /** Delete a user collection; its filed thoughts become unfiled. */
  removeCollection: (collectionId: string) => boolean
  /** Move an already-filed thought to another collection (or unfile with ''). */
  moveToCollection: (thoughtId: string, collectionId: string) => void

  /** Undo/redo over body edits + tone changes for one output. */
  undoEdit: (outputId: string) => void
  redoEdit: (outputId: string) => void

  /* ---- Phase 20: multi-select & bulk actions (spec §35) ---- */
  selectedIds: string[]
  toggleSelected: (id: string) => void
  setSelection: (ids: string[]) => void
  clearSelection: () => void
  /** Bulk-archive active thoughts. Returns how many were archived. */
  bulkArchive: (ids: string[]) => number
  /** Bulk-restore archived thoughts back to their pre-archive status. */
  bulkRestore: (ids: string[]) => number
  /** Bulk-delete; refuses when any selection still has outputs (data safety). */
  bulkDelete: (ids: string[]) => { deleted: number; refused: number }
  /** Phase 21 — re-insert trashed thoughts at their original positions.
   *  Ids already present are skipped, so double-undo is harmless.
   *  Returns how many were actually restored. */
  restoreTrashed: (trashed: Thought[], indices: number[]) => number
  /** File every selected thought into a collection (by id or name). */
  bulkSaveToCollection: (ids: string[], collectionName: string) => number

  /** Phase 19 — archive the current body as a named version snapshot. */
  saveVersion: (thoughtId: string, outputId: string, label?: string) => OutputVersion | null
  /** Restore an archived snapshot (the current body is re-archived first). */
  restoreVersion: (thoughtId: string, outputId: string, versionId: string) => boolean
  /** Drop one archived snapshot. Returns whether it existed. */
  deleteVersion: (thoughtId: string, outputId: string, versionId: string) => boolean

  /** Phase 29 — 👍/👎 on an output. Same rating again clears it (toggle). */
  rateOutput: (thoughtId: string, outputId: string, rating: 'helpful' | 'needs-work') => boolean
  /** Phase 29 — remove any feedback from an output. */
  clearFeedback: (thoughtId: string, outputId: string) => boolean

  /* ---- Phase 34: editor autosave & draft recovery ---- */
  /** Debounced mirror of unsaved editor text into localStorage. */
  saveDraft: (thoughtId: string, text: string) => void
  /** Read a still-unsaved autosave (null when absent/stale/committed). */
  getDraft: (thoughtId: string) => EditorDraft | null
  /** Drop one autosave (after commit, explicit discard, or restore). */
  clearDraft: (thoughtId: string) => void

  /** Phase 40/41 — weekly digests keyed by ISO week; one recap per week,
   *  generation is idempotent (asking twice returns the stored digest). */
  digests: Record<string, WeeklyDigest>

  /* ---- Phase 41: digest actions ---- */
  /** Generate (or return the existing) digest for the ISO week containing
   *  `refTs`. First generation records a 'digest' timeline event + toast;
   *  repeat calls are pure no-ops. Returns { digest, created }. */
  generateDigest: (refTs?: number) => { digest: WeeklyDigest; created: boolean }
  /** Stored digest for a specific ISO week key ('' / unknown → undefined). */
  getDigest: (weekKey: string) => WeeklyDigest | undefined
  /** Drop one stored digest so the week can be regenerated fresh. */
  clearDigest: (weekKey: string) => boolean
  /** Phase 43 — backfill digests for the `count` most recent ISO weeks
   *  ending at `refTs`'s week (newest first, capped at 12). Idempotent per
   *  week; a single summary toast reports how many were newly created. */
  generateDigestBatch: (count: number, refTs?: number) => { created: number; total: number }
  /** Phase 43 — deterministic email rendering of a STORED digest ('' or
   *  unknown week → null). Never generates as a side effect. */
  getDigestEmail: (weekKey: string) => { subject: string; body: string } | null
  /** Phase 50 — download a STORED digest as an `.eml` file carrying the
   *  exact rendered email (Subject header + plain-text body). Returns
   *  false for ''/unknown keys (nothing generated, nothing downloaded);
   *  true once the browser download is triggered. Browser-only side
   *  effect lives in mockAI.downloadDigestEmail (inert under Node). */
  downloadDigestEmailFile: (weekKey: string) => boolean
  /** Phase 44 — week-over-week diff of two stored digests. Compares the
   *  given week against `prevKey` when provided, otherwise the closest
   *  earlier stored week. Null when either side is missing/invalid —
   *  pure read, never generates or toasts. */
  compareDigest: (weekKey: string, prevKey?: string) => DigestComparison | null

  /* ---- Phase 45: digest personalization rules ---- */
  /** Ordered list of user rules shaping future digest generations. */
  digestRules: DigestRule[]
  /** Add a rule from partial input. Requires a non-empty label AND at
   *  least one real criterion; invalid additions toast an error and
   *  return null. New rules start enabled; cap 12 (oldest dropped). */
  addDigestRule: (input: {
    label: string
    requireTags?: string[]
    sources?: DigestRule['sources']
    minConfidence?: number
    starredOnly?: boolean
    onlyTransformed?: boolean
    excludeArchived?: boolean
  }) => DigestRule | null
  /** Flip a rule's enabled flag (unknown id → false, silent). */
  toggleDigestRule: (id: string) => boolean
  /** Remove one rule (unknown id → false). Stored digests are frozen
   *  snapshots and stay untouched — only FUTURE generations change. */
  removeDigestRule: (id: string) => boolean
  /** How many of this week's captures the currently-enabled rules keep
   *  (0 enabled → all). Pure preview count, no state writes. */
  matchCountForWeek: (refTs?: number) => { matched: number; total: number }

  setSearchQuery: (q: string) => void

  pushToast: (
    message: string,
    tone?: Toast['tone'],
    action?: { label: string; run: () => void },
  ) => void
  dismissToast: (id: string) => void
  resetDemo: () => void
}

const seedState = () => ({
  thoughts: SEED_THOUGHTS.map((t) => ({ ...t, outputs: [...t.outputs] })),
  timeline: [...SEED_TIMELINE],
  userCollections: [] as Collection[],
  /* Phase 41: digests start empty — they are generated on demand. */
  digests: {} as Record<string, WeeklyDigest>,
  /* Phase 45: personalization rules start empty — everything matches. */
  digestRules: [] as DigestRule[],
})

/** Deterministic palette rotation for user-created collections. */
const COLLECTION_COLORS: Collection['color'][] = ['accent', 'blue', 'emerald', 'amber', 'coral']

export const collectionSlug = (name: string) =>
  'cl-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedState(),
      selectedThoughtId: null,
      selectedIds: [],
      paletteOpen: false,
      helpOpen: false,
      /* Phase 63: hydrate remaps from their own storage key (outside the
         persisted envelope) so they survive refresh AND resetDemo. */
      keybindings: readKeymap(),
      toasts: [],
      inboxView: 'inbox',
      searchQuery: '',
      editHistory: {},
      userCollections: [] as Collection[],
      onboardingSeen: false,
      demoVisits: 0,
      digests: {},
      digestRules: [],

      /* ---- Phase 41: digest actions (builds on the Phase 40 engine) ---- */
      /** Generate (or return the existing) digest for the ISO week containing
       *  `refTs`. Toast + timeline event fire only on first generation —
       *  repeat calls are pure no-ops returning the stored digest.
       *  Phase 45: enabled personalization rules filter this week's captures
       *  before aggregation; the frozen digest records which rule ids shaped
       *  it (`appliedRuleIds`) so old snapshots never silently change. */
      generateDigest: (refTs?: number) => {
        const now = Date.now()
        const weekKey = isoWeekKey(refTs ?? now)
        const existing = get().digests[weekKey]
        if (existing) return { digest: existing, created: false }
        const digest = buildWeeklyDigest(
          refTs ?? now,
          get().thoughts,
          get().timeline,
          now,
          get().digestRules,
        )
        set((s) => ({
          digests: { ...s.digests, [weekKey]: digest },
          timeline: [
            ...s.timeline,
            {
              id: uid('ev'),
              thoughtId: 'digest',
              at: now,
              kind: 'digest' as const,
              label: `Weekly digest · ${weekKey}`,
              detail: digest.headline,
            },
          ],
        }))
        broadcastDomainChange()
        get().pushToast(`Weekly digest ready · ${weekKey}`, 'success')
        return { digest, created: true }
      },

      getDigest: (weekKey) => (weekKey ? get().digests[weekKey] : undefined),

      clearDigest: (weekKey) => {
        if (!get().digests[weekKey]) return false
        set((s) => {
          const next = { ...s.digests }
          delete next[weekKey]
          return { digests: next }
        })
        broadcastDomainChange()
        return true
      },

      /* ---- Phase 43: batch backfill + email rendering ---- */
      /** Backfill the `count` most recent ISO weeks ending at `refTs`'s
       *  week (newest first, hard cap 12). Reuses generateDigest per week,
       *  so existing weeks are untouched no-ops. One summary toast only —
       *  and none at all when nothing new was created. */
      generateDigestBatch: (count, refTs) => {
        const base = refTs ?? Date.now()
        const n = Math.max(0, Math.min(Math.floor(count) || 0, 12))
        let created = 0
        for (let i = 0; i < n; i++) {
          if (get().generateDigest(addWeeks(base, -i)).created) created++
        }
        const total = Object.keys(get().digests).length
        if (created > 0) {
          get().pushToast(
            `Backfilled ${created} digest${created === 1 ? '' : 's'} · ${total} stored`,
            'success',
          )
        }
        return { created, total }
      },

      /** Email view of a STORED digest; null for unknown/empty keys.
       *  Never generates as a side effect — previews stay local-only. */
      getDigestEmail: (weekKey) => {
        const d = weekKey ? get().digests[weekKey] : undefined
        return d ? digestToEmail(d) : null
      },

      /** Phase 50 — `.eml` download of a STORED digest. Same read-only
       *  guard as getDigestEmail (no generation side effect); the actual
       *  blob/anchor work stays inside mockAI so the store remains free
       *  of DOM code and Node harnesses can count invocations via spy. */
      downloadDigestEmailFile: (weekKey) => {
        const d = weekKey ? get().digests[weekKey] : undefined
        if (!d) return false
        downloadDigestEmail(d)
        return true
      },

      /** Phase 44 — pure week-over-week diff over the stored digest map.
       *  Delegates all logic to analytics.compareDigestWeeks so the fold
       *  stays UI-free and unit-testable; no generation, no toast. */
      compareDigest: (weekKey, prevKey) =>
        compareDigestWeeks(get().digests, weekKey, prevKey),

      /* ---- Phase 45: digest personalization rule actions ---- */
      addDigestRule: (input) => {
        const label = (input?.label ?? '').trim().slice(0, 60)
        if (!label) {
          get().pushToast('Rule needs a name', 'error')
          return null
        }
        const requireTags = [
          ...new Set((Array.isArray(input.requireTags) ? input.requireTags : []).map(normalizeTag).filter(Boolean)),
        ].slice(0, 8)
        const sources = (Array.isArray(input.sources) ? input.sources : []).filter(
          (s): s is NonNullable<DigestRule['sources']>[number] =>
            s === 'voice' || s === 'text' || s === 'screenshot' || s === 'import',
        )
        const minConfidence =
          typeof input.minConfidence === 'number' && Number.isFinite(input.minConfidence) && input.minConfidence > 0
            ? Math.min(1, input.minConfidence)
            : undefined
        const draft: DigestRule = {
          id: uid('dr'),
          label,
          createdAt: Date.now(),
          enabled: true,
          ...(requireTags.length > 0 ? { requireTags } : {}),
          ...(sources.length > 0 ? { sources: [...new Set(sources)] } : {}),
          ...(minConfidence !== undefined ? { minConfidence } : {}),
          ...(input.starredOnly === true ? { starredOnly: true } : {}),
          ...(input.onlyTransformed === true ? { onlyTransformed: true } : {}),
          ...(input.excludeArchived === true ? { excludeArchived: true } : {}),
        }
        /* A criterion-less rule would filter EVERYTHING out of future
           recaps — refuse it loudly instead of silently bricking digests. */
        const hasCriterion =
          requireTags.length > 0 ||
          sources.length > 0 ||
          minConfidence !== undefined ||
          draft.starredOnly === true ||
          draft.onlyTransformed === true ||
          draft.excludeArchived === true
        if (!hasCriterion) {
          get().pushToast('Rule needs at least one criterion', 'error')
          return null
        }
        set((s) => ({ digestRules: [...s.digestRules, draft].slice(-12) }))
        broadcastDomainChange()
        get().pushToast(`Digest rule added · ${label}`, 'success')
        return draft
      },

      toggleDigestRule: (id) => {
        const rule = get().digestRules.find((r) => r.id === id)
        if (!rule) return false
        set((s) => ({
          digestRules: s.digestRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
        }))
        broadcastDomainChange()
        return true
      },

      removeDigestRule: (id) => {
        if (!get().digestRules.some((r) => r.id === id)) return false
        set((s) => ({ digestRules: s.digestRules.filter((r) => r.id !== id) }))
        broadcastDomainChange()
        return true
      },

      matchCountForWeek: (refTs) => {
        const now = refTs ?? Date.now()
        const { from, to } = weekBounds(now)
        const wk = get().thoughts.filter((t) => t && t.createdAt >= from && t.createdAt <= to)
        const active = get().digestRules.filter((r) => r.enabled)
        if (active.length === 0) return { matched: wk.length, total: wk.length }
        return { matched: wk.filter((t) => active.some((r) => digestRuleMatches(r, t))).length, total: wk.length }
      },

      select: (id) => set({ selectedThoughtId: id }),

      /* ---- Phase 20: multi-select & bulk actions (spec §35) ---- */
      toggleSelected: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        })),
      setSelection: (ids) => set({ selectedIds: ids }),
      clearSelection: () => set({ selectedIds: [] }),

      bulkArchive: (ids) => {
        const targets = get().thoughts.filter(
          (t) => ids.includes(t.id) && t.status !== 'archived',
        )
        if (targets.length === 0) return 0
        const now = Date.now()
        set((s) => ({
          thoughts: s.thoughts.map((t) =>
            targets.some((x) => x.id === t.id) ? { ...t, status: 'archived' as const } : t,
          ),
          timeline: [
            ...s.timeline,
            ...targets.map((t): TimelineEvent => ({
              id: uid('ev'), thoughtId: t.id, at: now, kind: 'archive', label: 'Archived in bulk',
            })),
          ],
          selectedIds: [],
        }))
        /* Phase 21: bulk archive gets an Undo that restores prior statuses. */
        const prev = new Map(targets.map((t) => [t.id, t.status]))
        get().pushToast(
          `Archived ${targets.length} thought${targets.length === 1 ? '' : 's'}`,
          'info',
          {
            label: 'Undo',
            run: () => {
              set((s) => ({
                thoughts: s.thoughts.map((t) =>
                  prev.has(t.id) ? { ...t, status: prev.get(t.id)! } : t,
                ),
              }))
              get().pushToast(
                `Restored ${prev.size} thought${prev.size === 1 ? '' : 's'}`,
                'success',
              )
            },
          },
        )
        return targets.length
      },

      bulkRestore: (ids) => {
        const targets = get().thoughts.filter((t) => ids.includes(t.id) && t.status === 'archived')
        if (targets.length === 0) return 0
        set((s) => ({
          thoughts: s.thoughts.map((t) =>
            targets.some((x) => x.id === t.id)
              ? { ...t, status: (t.outputs.length > 0 ? 'processed' : 'raw') as Thought['status'] }
              : t,
          ),
          selectedIds: [],
        }))
        get().pushToast(`Restored ${targets.length} thought${targets.length === 1 ? '' : 's'}`, 'success')
        return targets.length
      },

      bulkDelete: (ids) => {
        const all = get().thoughts
        const doomed = all.filter((t) => ids.includes(t.id) && t.outputs.length === 0)
        const refused = ids.length - doomed.length
        if (doomed.length > 0) {
          /* Phase 21: capture full rows + original indices BEFORE the
             splice so "Undo" can re-insert at the exact positions. */
          const doomedIds = new Set(doomed.map((t) => t.id))
          const trashed: Thought[] = []
          const indices: number[] = []
          all.forEach((t, i) => {
            if (doomedIds.has(t.id)) {
              trashed.push(t)
              indices.push(i)
            }
          })
          set((s) => ({
            thoughts: s.thoughts.filter((t) => !doomedIds.has(t.id)),
            selectedIds: [],
          }))
          get().pushToast(`Deleted ${doomed.length} draft${doomed.length === 1 ? '' : 's'}`, 'info', {
            label: 'Undo',
            run: () => {
              const n = get().restoreTrashed(trashed, indices)
              if (n > 0) get().pushToast(`Restored ${n} draft${n === 1 ? '' : 's'}`, 'success')
            },
          })
        }
        if (refused > 0) {
          /* Data safety: never silently destroy generated outputs. */
          get().pushToast(
            `Deleted ${doomed.length} · kept ${refused} with outputs (archive instead)`,
            'info',
          )
        }
        return { deleted: doomed.length, refused }
      },

      restoreTrashed: (trashed, indices) => {
        if (trashed.length === 0) return 0
        let restored = 0
        set((s) => {
          const next = [...s.thoughts]
          /* Ascending order: each earlier insertion shifts later
             targets right by exactly the number already inserted —
             which equals their own index offset, so positions hold. */
          trashed.forEach((t, k) => {
            if (next.some((x) => x.id === t.id)) return /* idempotent guard */
            next.splice(Math.min(indices[k] ?? next.length, next.length), 0, t)
            restored += 1
          })
          return { thoughts: next }
        })
        return restored
      },

      bulkSaveToCollection: (ids, collectionName) => {
        const targets = get().thoughts.filter((t) => ids.includes(t.id))
        if (targets.length === 0) return 0
        /* Delegate per-thought so collection auto-creation, timeline
           events and toasts reuse the exact Phase 12 semantics. */
        targets.forEach((t) => get().saveToCollection(t.id, '', collectionName))
        set({ selectedIds: [] })
        return targets.length
      },

      setPalette: (open) => set({ paletteOpen: open }),
      /* Phase 60: single flip so the global keydown listener and the
         sidebar button share one action; idempotent w.r.t. toasts. */
      togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
      /* Phase 61: help overlay open/close — transient, never persisted
         or cross-tab synced (same policy as paletteOpen). */
      setHelp: (open) => set({ helpOpen: open }),
      toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
      /* Phase 63 — keybinding remaps. Validation happens against the
         candidate merged set; an invalid or colliding remap is rejected
         wholesale (returns false, state untouched). Successful writes
         persist to the standalone KEYMAP_KEY (never the domain envelope). */
      setKeybinding: (id, spec) => {
        if (!(id in DEFAULT_KEYBINDINGS)) return false
        const next = { ...get().keybindings, [id]: spec }
        const validated = validateRemapSet(next)
        if (validated === null) return false
        set({ keybindings: validated })
        writeKeymap(validated)
        return true
      },
      resetKeybinding: (id) => {
        if (!(id in DEFAULT_KEYBINDINGS)) return
        const next = { ...get().keybindings }
        delete next[id]
        set({ keybindings: next })
        writeKeymap(next)
      },
      resetAllKeybindings: () => {
        set({ keybindings: {} })
        writeKeymap({})
      },
      setInboxView: (view) => set({ inboxView: view }),
      dismissOnboarding: () => set({ onboardingSeen: true }),
      showOnboarding: () => set({ onboardingSeen: false }),
      recordDemoVisit: () => set((s) => ({ demoVisits: s.demoVisits + 1 })),
      setSearchQuery: (q) => set({ searchQuery: q }),

      addThought: (text, source = 'text') => {
    const id = uid('th')
    const thought: Thought = {
      id,
      text,
      source,
      createdAt: Date.now(),
      status: 'raw',
      outputs: [],
    }
    const ev: TimelineEvent = {
      id: uid('ev'),
      thoughtId: id,
      at: Date.now(),
      kind: 'capture',
      label: source === 'voice' ? 'Voice note captured' : 'Thought captured',
    }
    set((s) => ({ thoughts: [thought, ...s.thoughts], timeline: [...s.timeline, ev] }))
    return id
  },

  updateThoughtText: (id, text) => {
    /* Phase 34: committing the store row makes any autosave redundant. */
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === id ? { ...t, text, understanding: undefined, status: 'raw' as const } : t,
      ),
    }))
    get().clearDraft(id)
  },

  /* ---- Phase 34: editor autosave & draft recovery ---- */

  saveDraft: (thoughtId, text) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    if (!thought) return
    /* Nothing to recover while it matches the committed row. */
    if (text === thought.text) {
      get().clearDraft(thoughtId)
      return
    }
    const map = readDrafts()
    map[thoughtId] = { text, savedAt: Date.now() }
    writeDrafts(map)
  },

  getDraft: (thoughtId) => {
    const draft = readDrafts()[thoughtId]
    if (!draft) return null
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    /* Committed or deleted meanwhile — the autosave is stale. */
    if (!thought || thought.text === draft.text) return null
    return draft
  },

  clearDraft: (thoughtId) => {
    const map = readDrafts()
    if (!(thoughtId in map)) return
    delete map[thoughtId]
    writeDrafts(map)
  },

  archiveThought: (id) => {
    /* Phase 21: single archive gets an Undo restoring the prior status. */
    const target = get().thoughts.find((t) => t.id === id)
    if (!target || target.status === 'archived') return
    const prevStatus = target.status
    set((s) => ({
      thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status: 'archived' as const } : t)),
      timeline: [
        ...s.timeline,
        { id: uid('ev'), thoughtId: id, at: Date.now(), kind: 'archive' as const, label: 'Archived' },
      ],
    }))
    get().pushToast('Archived', 'info', {
      label: 'Undo',
      run: () => {
        set((s) => ({
          thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status: prevStatus } : t)),
        }))
        get().pushToast('Restored to inbox', 'success')
      },
    })
  },

  unarchiveThought: (id) => {
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === id ? { ...t, status: (t.outputs.length > 0 ? 'processed' : 'raw') as Thought['status'] } : t,
      ),
    }))
    get().pushToast('Restored to inbox', 'success')
  },

  togglePin: (id) => {
    /* Phase 22 — flip the flag; false for unknown ids. No toast: the card
       itself animates, and pinning is reversible/repeatable UI noise-free. */
    const target = get().thoughts.find((t) => t.id === id)
    if (!target) return false
    const next = !target.pinned
    set((s) => ({ thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, pinned: next } : t)) }))
    return next
  },

  toggleStar: (id) => {
    /* Phase 25 — mirror of togglePin: silent, reversible, false on unknown ids. */
    const target = get().thoughts.find((t) => t.id === id)
    if (!target) return false
    const next = !target.starred
    set((s) => ({ thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, starred: next } : t)) }))
    return next
  },

  /* ---- Phase 35: thought lifecycle — draft vs ready ---- */

  setStatus: (id, status) => {
    const target = get().thoughts.find((t) => t.id === id)
    if (!target || target.status === 'archived') return null
    /* Data safety: rows that already carry generated outputs are locked as
       "ready" — flipping them to draft would hide work behind the filter. */
    if (status === 'raw' && target.outputs.length > 0) {
      get().pushToast('Still a draft — it has outputs', 'info')
      return target.status
    }
    if (target.status === status) return status
    const label = status === 'processed' ? 'Marked ready' : 'Moved to drafts'
    set((s) => ({
      thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status } : t)),
      timeline: [
        {
          id: uid('ev'),
          thoughtId: id,
          at: Date.now(),
          kind: 'lifecycle' as const,
          label,
          detail: target.text.slice(0, 80),
        },
        ...s.timeline,
      ],
    }))
    get().pushToast(label, 'success', {
      label: 'Undo',
      run: () => {
        const cur = get().thoughts.find((t) => t.id === id)
        if (!cur || cur.status === target.status) return
        set((s) => ({
          thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status: target.status } : t)),
        }))
        get().pushToast('Reverted', 'info')
      },
    })
    return status
  },

  toggleStatus: (id) => {
    const target = get().thoughts.find((t) => t.id === id)
    if (!target || target.status === 'archived') return null
    return get().setStatus(id, target.status === 'raw' ? 'processed' : 'raw')
  },

  countByStatus: (status) => get().thoughts.filter((t) => t.status === status).length,

  /* ---- Phase 23: tags — user-editable labels for inbox filtering ---- */

  addTag: (id, rawTag) => {
    const tag = normalizeTag(rawTag)
    if (!tag) return false
    const target = get().thoughts.find((t) => t.id === id)
    if (!target) return false
    const tags = target.tags ?? []
    /* Idempotent on case-insensitive match — "Email" and "email" are one tag. */
    if (tags.some((x) => x.toLowerCase() === tag.toLowerCase())) return false
    set((s) => ({
      thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, tags: [...(t.tags ?? []), tag] } : t)),
    }))
    return true
  },

  removeTag: (id, tag) => {
    const target = get().thoughts.find((t) => t.id === id)
    if (!target?.tags) return false
    const kept = target.tags.filter((x) => x.toLowerCase() !== tag.toLowerCase())
    if (kept.length === target.tags.length) return false
    set((s) => ({
      thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, tags: kept.length ? kept : undefined } : t)),
    }))
    return true
  },

  renameTag: (from, to) => {
    const oldT = normalizeTag(from)
    const newT = normalizeTag(to)
    if (!oldT || !newT || oldT.toLowerCase() === newT.toLowerCase()) return 0
    let touched = 0
    set((s) => ({
      thoughts: s.thoughts.map((t) => {
        if (!t.tags?.some((x) => x.toLowerCase() === oldT.toLowerCase())) return t
        touched++
        /* Collide-safe: if the thought already carries the new tag, merge. */
        const merged = t.tags.some((x) => x.toLowerCase() === newT.toLowerCase())
          ? t.tags.filter((x) => x.toLowerCase() !== oldT.toLowerCase())
          : t.tags.map((x) => (x.toLowerCase() === oldT.toLowerCase() ? newT : x))
        return { ...t, tags: merged.length ? merged : undefined }
      }),
    }))
    return touched
  },

  deleteThought: (id) => {
    /* Phase 21: capture the row + index so the toast can offer Undo. */
    const idx = get().thoughts.findIndex((t) => t.id === id)
    if (idx < 0) return
    const removed = get().thoughts[idx]
    set((s) => ({ thoughts: s.thoughts.filter((t) => t.id !== id) }))
    get().pushToast('Draft deleted', 'info', {
      label: 'Undo',
      run: () => {
        if (get().restoreTrashed([removed], [idx]) > 0) get().pushToast('Draft restored', 'success')
      },
    })
  },

  understand: (id) =>
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === id ? { ...t, understanding: analyzeThought(t.text).understanding } : t,
      ),
    })),

  transform: (id, type, tone = 'professional') => {
    const thought = get().thoughts.find((t) => t.id === id)
    const text = thought?.text ?? ''
    const output = generateOutput(text, { type, tone })
    set((s) => ({
      thoughts: s.thoughts.map((t) => {
        if (t.id !== id) return t
        const understanding = t.understanding ?? analyzeThought(t.text).understanding
        /* Phase 23: seed user tags from extracted topics on first
           transform — only when the thought has no tags yet, so later
           manual edits (incl. deliberate removals) are never overwritten. */
        const tags = t.tags?.length ? t.tags : (understanding.topics.slice(0, 4) || undefined)
        return { ...t, status: 'processed' as const, understanding, outputs: [output, ...t.outputs], tags }
      }),
      timeline: [
        ...s.timeline,
        {
          id: uid('ev'),
          thoughtId: id,
          at: Date.now(),
          kind: 'transform',
          label: `${type[0].toUpperCase()}${type.slice(1)} created`,
          detail: output.title,
        },
      ],
    }))
    return output
  },

  retone: (thoughtId, outputId, tone) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    const output = thought?.outputs.find((o) => o.id === outputId)
    if (!thought || !output) return
    /* Preserve the user's own edits: re-derive from the base body and
       apply the new tone on top, instead of discarding edits with a
       fresh generation. Falls back to full regeneration for legacy
       outputs without a stored base. */
    const base = output.baseBody ?? generateOutput(thought.text, { type: output.type, tone: 'professional' }).body
    const merged: GeneratedOutput = {
      ...output,
      baseBody: base,
      body: tone === 'professional' ? base : retune(base, tone),
      tone,
    }
    /* Phase 19: keep the pre-switch text as an archived version. */
    const archived = archiveOnto(merged, makeVersion(`Tone: ${output.tone}`, { body: output.body, tone: output.tone }))
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? archived : o)) }
          : t,
      ),
      timeline: [
        ...s.timeline,
        {
          id: uid('ev'),
          thoughtId,
          at: Date.now(),
          kind: 'tone',
          label: `Tone changed to ${tone}`,
        },
      ],
    }))
  },

  reformat: (thoughtId, outputId, type) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    const output = thought?.outputs.find((o) => o.id === outputId)
    if (!thought || !output) return
    const regenerated = generateOutput(thought.text, { type, tone: output.tone })
    const merged: GeneratedOutput = { ...regenerated, id: outputId, createdAt: output.createdAt }
    /* Phase 19: the old-format text is archived, never silently dropped. */
    const archived = archiveOnto(merged, makeVersion(`Format: ${output.type}`, { body: output.body, tone: output.tone }))
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? archived : o)) }
          : t,
      ),
      /* Regenerating replaces the document — its undo journal resets. */
      editHistory: { ...s.editHistory, [outputId]: { past: [], future: [] } },
      timeline: [
        ...s.timeline,
        {
          id: uid('ev'),
          thoughtId,
          at: Date.now(),
          kind: 'format',
          label: `Turned into ${type}`,
        },
      ],
    }))
  },

  editOutputBody: (thoughtId, outputId, body) =>
    set((s) => {
      const thought = s.thoughts.find((t) => t.id === thoughtId)
      const prev = thought?.outputs.find((o) => o.id === outputId)
      const hist = s.editHistory[outputId] ?? { past: [], future: [] }
      const nextHist = prev
        ? {
            past: [...hist.past, { body: prev.body, tone: prev.tone }].slice(-40),
            future: [],
          }
        : hist
      return {
        thoughts: s.thoughts.map((t) =>
          t.id === thoughtId
            ? {
                ...t,
                outputs: t.outputs.map((o) =>
                  o.id === outputId
                    ? { ...o, body, baseBody: o.baseBody ?? o.body }
                    : o,
                ),
              }
            : t,
        ),
        editHistory: { ...s.editHistory, [outputId]: nextHist },
      }
    }),

  undoEdit: (outputId) => {
    const s = get()
    const hist = s.editHistory[outputId]
    if (!hist || hist.past.length === 0) return
    const prev = hist.past[hist.past.length - 1]
    let current: EditSnapshot | null = null
    for (const t of s.thoughts) {
      const o = t.outputs.find((x) => x.id === outputId)
      if (o) {
        current = { body: o.body, tone: o.tone }
        break
      }
    }
    if (!current) return
    set({
      thoughts: s.thoughts.map((t) => ({
        ...t,
        outputs: t.outputs.map((o) =>
          o.id === outputId ? { ...o, body: prev.body, tone: prev.tone } : o,
        ),
      })),
      editHistory: {
        ...s.editHistory,
        [outputId]: { past: hist.past.slice(0, -1), future: [current, ...hist.future] },
      },
    })
  },

  redoEdit: (outputId) => {
    const s = get()
    const hist = s.editHistory[outputId]
    if (!hist || hist.future.length === 0) return
    const next = hist.future[0]
    let current: EditSnapshot | null = null
    for (const t of s.thoughts) {
      const o = t.outputs.find((x) => x.id === outputId)
      if (o) {
        current = { body: o.body, tone: o.tone }
        break
      }
    }
    if (!current) return
    set({
      thoughts: s.thoughts.map((t) => ({
        ...t,
        outputs: t.outputs.map((o) =>
          o.id === outputId ? { ...o, body: next.body, tone: next.tone } : o,
        ),
      })),
      editHistory: {
        ...s.editHistory,
        [outputId]: { past: [...hist.past, current], future: hist.future.slice(1) },
      },
    })
  },

  /* ---- Phase 19: output version history ---- */

  saveVersion: (thoughtId, outputId, label) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    const output = thought?.outputs.find((o) => o.id === outputId)
    if (!thought || !output) return null
    const v = makeVersion(label ?? 'Manual save', { body: output.body, tone: output.tone })
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? archiveOnto(o, v) : o)) }
          : t,
      ),
      timeline: [
        ...s.timeline,
        { id: uid('ev'), thoughtId, at: Date.now(), kind: 'save' as const, label: `Version saved · ${v.label}` },
      ],
    }))
    get().pushToast('Version saved — restore it any time from History', 'success')
    return v
  },

  restoreVersion: (thoughtId, outputId, versionId) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    const output = thought?.outputs.find((o) => o.id === outputId)
    const v = output?.versions?.find((x) => x.id === versionId)
    if (!thought || !output || !v) return false
    /* Restoring is itself reversible: the pre-restore body is archived
       first, then the snapshot's text/tone become current and the used
       snapshot leaves the list (it can always be re-saved). */
    const preRestore = makeVersion(`Before restore (${output.tone})`, { body: output.body, tone: output.tone })
    const restored: GeneratedOutput = {
      ...output,
      body: v.body,
      tone: v.tone,
      versions: [preRestore, ...(output.versions ?? []).filter((x) => x.id !== versionId)].slice(0, MAX_VERSIONS),
    }
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? restored : o)) }
          : t,
      ),
      /* The undo journal refers to superseded text — start clean. */
      editHistory: { ...s.editHistory, [outputId]: { past: [], future: [] } },
      timeline: [
        ...s.timeline,
        { id: uid('ev'), thoughtId, at: Date.now(), kind: 'transform' as const, label: `Restored ${v.label}`, detail: output.title },
      ],
    }))
    get().pushToast(`Restored "${v.label}"`, 'success')
    return true
  },

  deleteVersion: (thoughtId, outputId, versionId) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    const output = thought?.outputs.find((o) => o.id === outputId)
    if (!thought || !output || !output.versions?.some((x) => x.id === versionId)) return false
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? {
              ...t,
              outputs: t.outputs.map((o) =>
                o.id === outputId ? { ...o, versions: (o.versions ?? []).filter((x) => x.id !== versionId) } : o,
              ),
            }
          : t,
      ),
    }))
    get().pushToast('Version deleted', 'info')
    return true
  },

  /* ---- Phase 29: output feedback loop ---- */

  rateOutput: (thoughtId, outputId, rating) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    const output = thought?.outputs.find((o) => o.id === outputId)
    if (!thought || !output) return false
    /* Tapping the active rating again clears it — feedback is a toggle,
       never a forced opinion. Opposite rating replaces in place. */
    const clearing = output.feedback?.rating === rating
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? {
              ...t,
              outputs: t.outputs.map((o) =>
                o.id === outputId
                  ? { ...o, feedback: clearing ? undefined : { rating, at: Date.now() } }
                  : o,
              ),
            }
          : t,
      ),
    }))
    if (clearing) {
      get().pushToast('Feedback cleared', 'info')
    } else {
      set((s) => ({
        timeline: [
          ...s.timeline,
          {
            id: uid('ev'),
            thoughtId,
            at: Date.now(),
            kind: 'save' as const,
            label: rating === 'helpful' ? 'Marked helpful' : 'Flagged for rework',
            detail: output.title,
          },
        ],
      }))
      get().pushToast(
        rating === 'helpful' ? 'Thanks — noted as helpful' : 'Noted — this draft needs work',
        'success',
        { label: 'Undo', run: () => get().clearFeedback(thoughtId, outputId) },
      )
    }
    return true
  },

  clearFeedback: (thoughtId, outputId) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    const output = thought?.outputs.find((o) => o.id === outputId)
    if (!thought || !output || !output.feedback) return false
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? { ...o, feedback: undefined } : o)) }
          : t,
      ),
    }))
    return true
  },

  saveToCollection: (thoughtId, outputId, collectionName) => {
    void outputId
    /* Resolve by id first, then by display name — callers pass either
       (CollectionsPage sends ids, OutputEditor historically sent names). */
    const known = [...COLLECTIONS, ...get().userCollections].find(
      (c) => c.id === collectionName || c.name === collectionName,
    )
    const resolved = known?.id ?? collectionSlug(collectionName)
    if (!known) {
      set((s) => ({
        userCollections: [
          ...s.userCollections,
          {
            id: resolved,
            name: collectionName,
            description: 'Created from the output editor · demo data',
            color: COLLECTION_COLORS[s.userCollections.length % COLLECTION_COLORS.length],
          },
        ],
      }))
    }
    set((s) => ({
      thoughts: s.thoughts.map((t) => (t.id === thoughtId ? { ...t, collectionId: resolved } : t)),
      timeline: [
        ...s.timeline,
        {
          id: uid('ev'),
          thoughtId,
          at: Date.now(),
          kind: 'save',
          label: `Saved to ${known?.name ?? collectionName}`,
        },
      ],
    }))
    get().pushToast(`Saved to ${known?.name ?? collectionName}`, 'success')
  },

  addCollection: (name) => {
    const trimmed = name.trim()
    const id = collectionSlug(trimmed)
    const existing = [...COLLECTIONS, ...get().userCollections].find((c) => c.id === id)
    if (existing) return existing
    const collection: Collection = {
      id,
      name: trimmed,
      description: 'Created in this demo · saved locally',
      color: COLLECTION_COLORS[get().userCollections.length % COLLECTION_COLORS.length],
    }
    set((s) => ({ userCollections: [...s.userCollections, collection] }))
    get().pushToast(`Collection "${trimmed}" created`, 'success')
    return collection
  },

  renameCollection: (collectionId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    /* Seed collections are immutable in the demo. */
    if (COLLECTIONS.some((c) => c.id === collectionId)) return false
    const target = get().userCollections.find((c) => c.id === collectionId)
    if (!target || target.name === trimmed) return false
    set((s) => ({
      userCollections: s.userCollections.map((c) =>
        c.id === collectionId ? { ...c, name: trimmed } : c,
      ),
    }))
    get().pushToast(`Renamed to "${trimmed}"`, 'success')
    return true
  },

  removeCollection: (collectionId) => {
    /* Seed collections are immutable in the demo. */
    if (COLLECTIONS.some((c) => c.id === collectionId)) return false
    const target = get().userCollections.find((c) => c.id === collectionId)
    if (!target) return false
    /* Unfile every thought that lived in it — outputs are never deleted. */
    set((s) => ({
      userCollections: s.userCollections.filter((c) => c.id !== collectionId),
      thoughts: s.thoughts.map((t) =>
        t.collectionId === collectionId ? { ...t, collectionId: undefined } : t,
      ),
    }))
    get().pushToast(`Deleted "${target.name}" · its outputs moved to Unfiled`, 'info')
    return true
  },

  moveToCollection: (thoughtId, collectionId) => {
    const thought = get().thoughts.find((t) => t.id === thoughtId)
    if (!thought || thought.collectionId === collectionId) return
    const label = collectionId
      ? ([...COLLECTIONS, ...get().userCollections].find((c) => c.id === collectionId)?.name ?? collectionId)
      : null
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId ? { ...t, collectionId: collectionId || undefined } : t,
      ),
      ...(label
        ? {
            timeline: [
              ...s.timeline,
              { id: uid('ev'), thoughtId, at: Date.now(), kind: 'save' as const, label: `Moved to ${label}` },
            ],
          }
        : {}),
    }))
    get().pushToast(label ? `Moved to ${label}` : 'Removed from collection', 'info')
  },

  pushToast: (message, tone = 'success', action) => {
    const id = uid('toast')
    set((s) => ({ toasts: [...s.toasts, { id, message, tone, action }] }))
    /* Undo-actionable toasts linger longer so the button is reachable. */
    setTimeout(() => get().dismissToast(id), action ? TOAST_ACTION_MS : TOAST_MS)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetDemo: () => {
    try {
      safeStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    set({ ...seedState(), selectedThoughtId: null, selectedIds: [], inboxView: 'inbox' as const, editHistory: {}, userCollections: [], onboardingSeen: true, demoVisits: 0, digests: {} })
    /* Phase 34: abandoned autosave drafts belong to rows that no longer exist. */
    safeStorage.removeItem(DRAFT_KEY)
    /* Phase 31: notify sibling tabs so they re-seed too. */
    broadcastDomainChange('reset')
    get().pushToast('Demo reset to its initial state', 'info')
  },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      /* Only domain data persists — toasts/palette/view/edit-history stay transient. */
      partialize: (s): PersistedShape => ({
        thoughts: s.thoughts,
        timeline: s.timeline,
        userCollections: s.userCollections,
        onboardingSeen: s.onboardingSeen,
        demoVisits: s.demoVisits,
        /* Phase 41: digests survive refresh + cross-tab sync. */
        digests: s.digests,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...mergeWithSeeds(persisted as PersistedShape | null),
      }),
    },
  ),
)

/* ---- Phase 31 wiring ---------------------------------------------------- */

/** True while we are mid-apply of a remote payload — suppresses rebroadcast. */

/** Broadcast that this tab's domain data changed (no-op during remote apply). */
export function broadcastDomainChange(kind: 'domain' | 'reset' = 'domain'): void {
  if (applyingRemote) return
  try {
    channel?.postMessage({ kind, senderId: TAB_ID } satisfies SyncMessage)
  } catch {
    /* channel closed / serialization failure — storage-event fallback covers it */
  }
}

/** Pull the latest persisted payload from disk into memory (manual resync). */
export function pullRemoteState(): boolean {
  const raw = safeStorage.getItem(STORAGE_KEY)
  lastAppliedRaw = raw
  applyRemoteState(readPersistedDomain())
  return true
}

let syncStarted = false

/**
 * Start cross-tab synchronization. Idempotent; safe on the server and in
 * Node test harnesses (both lack window — everything stays inert).
 * Returns a cleanup function for hot-reload / unmount scenarios.
 */
export function startCrossTabSync(): () => void {
  if (syncStarted) return () => undefined
  if (typeof window === 'undefined') return () => undefined
  syncStarted = true

  /* Re-pull whenever this tab regains focus — catches up after sleep/throttle
     without spamming updates while the user isn't looking. */
  const onVisibility = () => {
    if (document.visibilityState === 'visible') pullRemoteState()
  }
  document.addEventListener('visibilitychange', onVisibility)

  /* Storage-event fallback: fires in OTHER tabs only when our key changes.
     Dedup against payloads we applied ourselves via the channel. */
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    if (e.newValue === lastAppliedRaw) return
    if (e.newValue === null) {
      /* resetDemo cleared storage in another tab */
      lastAppliedRaw = null
      useAppStore.getState().resetDemo()
      return
    }
    pullRemoteState()
  }
  window.addEventListener('storage', onStorage)

  /* BroadcastChannel fast path: react to sibling-tab notifications. */
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CROSS_TAB_CHANNEL)
      channel.onmessage = (ev: MessageEvent<Partial<SyncMessage>>) => {
        const msg = ev.data
        if (!msg || msg.senderId === TAB_ID) return
        if (msg.kind === 'reset') {
          lastAppliedRaw = null
          useAppStore.getState().resetDemo()
        } else if (msg.kind === 'domain') {
          pullRemoteState()
        }
      }
    }
  } catch {
    channel = null
  }

  /* Every local domain write notifies siblings (zustand persist already
     wrote localStorage synchronously before subscribers run). */
  const stopSubscribe = useAppStore.subscribe((state, prev) => {
    if (applyingRemote) return
    if (
      state.thoughts !== prev.thoughts ||
      state.timeline !== prev.timeline ||
      state.userCollections !== prev.userCollections
    ) {
      broadcastDomainChange('domain')
    }
  })

  return () => {
    syncStarted = false
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('storage', onStorage)
    stopSubscribe()
    try {
      channel?.close()
    } finally {
      channel = null
    }
  }
}

/* Auto-start in real browsers (module is imported once by the app entry). */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startCrossTabSync()
}
