import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  Collection,
  GeneratedOutput,
  OutputType,
  Thought,
  TimelineEvent,
  ToneId,
} from '../data/types'
import { COLLECTIONS, SEED_THOUGHTS, SEED_TIMELINE } from '../data/mock'
import { analyzeThought, generateOutput, retune, uid } from './mockAI'

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
}

/** Which inbox view the list screen renders (spec §18 sidebar). */
export type InboxView = 'inbox' | 'workspace' | 'drafts'

/** Undo/redo journal for the output editor (spec §27). */
export interface EditSnapshot {
  body: string
  tone: ToneId
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

  setSearchQuery: (q: string) => void

  pushToast: (message: string, tone?: Toast['tone']) => void
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
      paletteOpen: false,
      toasts: [],
      inboxView: 'inbox',
      searchQuery: '',
      editHistory: {},
      userCollections: [] as Collection[],
      onboardingSeen: false,
      demoVisits: 0,

      select: (id) => set({ selectedThoughtId: id }),
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

  updateThoughtText: (id, text) =>
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === id ? { ...t, text, understanding: undefined, status: 'raw' as const } : t,
      ),
    })),

  archiveThought: (id) => {
    set((s) => ({
      thoughts: s.thoughts.map((t) => (t.id === id ? { ...t, status: 'archived' as const } : t)),
      timeline: [
        ...s.timeline,
        { id: uid('ev'), thoughtId: id, at: Date.now(), kind: 'archive' as const, label: 'Archived' },
      ],
    }))
    get().pushToast('Archived', 'info')
  },

  unarchiveThought: (id) => {
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === id ? { ...t, status: (t.outputs.length > 0 ? 'processed' : 'raw') as Thought['status'] } : t,
      ),
    }))
    get().pushToast('Restored to inbox', 'success')
  },

  deleteThought: (id) => {
    set((s) => ({ thoughts: s.thoughts.filter((t) => t.id !== id) }))
    get().pushToast('Draft deleted', 'info')
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
      thoughts: s.thoughts.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'processed',
              understanding: t.understanding ?? analyzeThought(t.text).understanding,
              outputs: [output, ...t.outputs],
            }
          : t,
      ),
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
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? merged : o)) }
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
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? merged : o)) }
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

  pushToast: (message, tone = 'success') => {
    const id = uid('toast')
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => get().dismissToast(id), 2600)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetDemo: () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    set({ ...seedState(), selectedThoughtId: null, inboxView: 'inbox' as const, editHistory: {}, userCollections: [], onboardingSeen: true, demoVisits: 0 })
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
