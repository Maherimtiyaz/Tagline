import type { Thought } from '../data/types'

/* ------------------------------------------------------------------ *
 * Phase 28 — shared inbox ordering primitives.
 *
 * The Starred → Pinned → Today → Earlier priority grouping (Phases
 * 22 + 25) previously lived inline in InboxPage. It now lives here so
 * every thought-list view (inbox, drafts, all, and the collection
 * detail page) orders rows identically.
 * ------------------------------------------------------------------ */

export const isPinned = (t: { pinned?: boolean }) => !!t.pinned
export const isStarred = (t: { starred?: boolean }) => !!t.starred

/** Newest-first by creation time. */
const byNewest = (a: Thought, b: Thought) => b.createdAt - a.createdAt

export interface PriorityGroups {
  starred: Thought[]
  pinned: Thought[]
  today: Thought[]
  earlier: Thought[]
}

/** Four mutually-exclusive buckets; each excludes members above it. */
export function groupByPriority(thoughts: Thought[]): PriorityGroups {
  const sorted = [...thoughts].sort(byNewest)
  const starred = sorted.filter(isStarred)
  const pinned = sorted.filter((t) => !isStarred(t) && isPinned(t))
  const rest = sorted.filter((t) => !isStarred(t) && !isPinned(t))
  const dayMs = 24 * 3600_000
  return {
    starred,
    pinned,
    today: rest.filter((t) => Date.now() - t.createdAt < dayMs),
    earlier: rest.filter((t) => Date.now() - t.createdAt >= dayMs),
  }
}

export interface SignalGroup {
  label: string
  list: Thought[]
}

/**
 * Renderable groups for a view. When a sidebar deep-link narrows the
 * list to one signal ("starred" / "pinned"), only that bucket shows;
 * otherwise all four non-empty buckets render in priority order.
 */
export function priorityGroups(
  thoughts: Thought[],
  signal?: 'starred' | 'pinned' | null,
): SignalGroup[] {
  const g = groupByPriority(thoughts)
  if (signal === 'starred') return [{ label: 'Starred', list: g.starred }]
  if (signal === 'pinned') return [{ label: 'Pinned', list: g.pinned }]
  return [
    { label: 'Starred', list: g.starred },
    { label: 'Pinned', list: g.pinned },
    { label: 'Today', list: g.today },
    { label: 'Earlier', list: g.earlier },
  ].filter((grp) => grp.list.length > 0)
}
