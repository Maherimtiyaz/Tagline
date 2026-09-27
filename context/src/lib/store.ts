import { create } from 'zustand'
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
   ============================================================ */

export interface Toast {
  id: string
  message: string
  tone?: 'success' | 'info' | 'error'
}

interface AppState {
  thoughts: Thought[]
  timeline: TimelineEvent[]
  selectedThoughtId: string | null
  paletteOpen: boolean
  toasts: Toast[]

  /* derived helpers */
  select: (id: string | null) => void
  setPalette: (open: boolean) => void

  addThought: (text: string, source?: Thought['source']) => string
  updateThoughtText: (id: string, text: string) => void
  archiveThought: (id: string) => void

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

export const useAppStore = create<AppState>((set, get) => ({
  ...seedState(),
  selectedThoughtId: null,
  paletteOpen: false,
  toasts: [],

  select: (id) => set({ selectedThoughtId: id }),
  setPalette: (open) => set({ paletteOpen: open }),

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
    set({ ...seedState(), selectedThoughtId: null })
    get().pushToast('Demo reset to its initial state', 'info')
  },
}))
