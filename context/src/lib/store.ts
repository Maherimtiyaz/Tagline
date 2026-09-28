import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  GeneratedOutput,
  OutputType,
  Thought,
  TimelineEvent,
  ToneId,
} from '../data/types'
import { SEED_THOUGHTS, SEED_TIMELINE } from '../data/mock'
import { analyzeThought, generateOutput, uid } from './mockAI'

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
  return {
    thoughts: [...extras].sort((a, b) => b.createdAt - a.createdAt).concat(seeds),
    timeline: [...SEED_TIMELINE, ...extraEvents].sort((a, b) => a.at - b.at),
  }
}

export interface Toast {
  id: string
  message: string
  tone?: 'success' | 'info' | 'error'
}

/** Which inbox view the list screen renders (spec §18 sidebar). */
export type InboxView = 'inbox' | 'workspace' | 'drafts'

interface AppState {
  thoughts: Thought[]
  timeline: TimelineEvent[]
  selectedThoughtId: string | null
  paletteOpen: boolean
  toasts: Toast[]
  inboxView: InboxView

  /* derived helpers */
  select: (id: string | null) => void
  setPalette: (open: boolean) => void
  setInboxView: (view: InboxView) => void

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

  pushToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
  resetDemo: () => void
}

const seedState = () => ({
  thoughts: SEED_THOUGHTS.map((t) => ({ ...t, outputs: [...t.outputs] })),
  timeline: [...SEED_TIMELINE],
})

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedState(),
      selectedThoughtId: null,
      paletteOpen: false,
      toasts: [],
      inboxView: 'inbox',

      select: (id) => set({ selectedThoughtId: id }),
      setPalette: (open) => set({ paletteOpen: open }),
      setInboxView: (view) => set({ inboxView: view }),

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
    const regenerated = generateOutput(thought.text, { type: output.type, tone })
    const merged: GeneratedOutput = {
      ...regenerated,
      id: outputId,
      createdAt: output.createdAt,
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
    set((s) => ({
      thoughts: s.thoughts.map((t) =>
        t.id === thoughtId
          ? { ...t, outputs: t.outputs.map((o) => (o.id === outputId ? { ...o, body } : o)) }
          : t,
      ),
    })),

  saveToCollection: (thoughtId, outputId, collectionName) => {
    void outputId
    set((s) => ({
      thoughts: s.thoughts.map((t) => (t.id === thoughtId ? { ...t, collectionId: collectionName } : t)),
      timeline: [
        ...s.timeline,
        {
          id: uid('ev'),
          thoughtId,
          at: Date.now(),
          kind: 'save',
          label: `Saved to ${collectionName}`,
        },
      ],
    }))
    get().pushToast(`Saved to ${collectionName}`, 'success')
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
    set({ ...seedState(), selectedThoughtId: null, inboxView: 'inbox' as const })
    get().pushToast('Demo reset to its initial state', 'info')
  },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      /* Only domain data persists — toasts/palette/view stay transient. */
      partialize: (s): PersistedShape => ({ thoughts: s.thoughts, timeline: s.timeline }),
      merge: (persisted, current) => ({
        ...current,
        ...mergeWithSeeds(persisted as PersistedShape | null),
      }),
    },
  ),
)
