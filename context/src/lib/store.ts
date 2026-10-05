import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  Collection,
  GeneratedOutput,
  OutputType,
  OutputVersion,
  Thought,
  TimelineEvent,
  ToneId,
} from '../data/types'
import { COLLECTIONS, SEED_THOUGHTS, SEED_TIMELINE } from '../data/mock'
import { analyzeThought, generateOutput, retune, uid } from './mockAI'

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
  /** User-created collections (Phase 12) — now survive refresh. */
  userCollections?: Collection[]
  onboardingSeen?: boolean
  /** Completed demo runs this browser (spec §56 conversion tracking). */
  demoVisits?: number
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

interface AppState {
  thoughts: Thought[]
  timeline: TimelineEvent[]
  /** Collections the user created in this demo (persisted, Phase 12). */
  userCollections: Collection[]
  selectedThoughtId: string | null
  paletteOpen: boolean
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
      toasts: [],
      inboxView: 'inbox',
      searchQuery: '',
      editHistory: {},
      userCollections: [] as Collection[],
      onboardingSeen: false,
      demoVisits: 0,

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
    set({ ...seedState(), selectedThoughtId: null, selectedIds: [], inboxView: 'inbox' as const, editHistory: {}, userCollections: [], onboardingSeen: true, demoVisits: 0 })
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
