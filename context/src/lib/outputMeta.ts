import type { OutputType, ToneId } from '../data/types'

/* ============================================================
   Shared vocabulary for the output layer.
   ============================================================ */

export const OUTPUT_TYPES: { id: OutputType; label: string; command: string }[] = [
  { id: 'email', label: 'Email', command: '/email' },
  { id: 'plan', label: 'Plan', command: '/plan' },
  { id: 'tasks', label: 'Tasks', command: '/tasks' },
  { id: 'summary', label: 'Summary', command: '/summary' },
  { id: 'brief', label: 'Brief', command: '/brief' },
  { id: 'post', label: 'Post', command: '/post' },
  { id: 'decision', label: 'Decision', command: '/decision' },
]

export const TONES: { id: ToneId; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'concise', label: 'Concise' },
  { id: 'confident', label: 'Confident' },
  { id: 'casual', label: 'Casual' },
  { id: 'persuasive', label: 'Persuasive' },
]

export const OUTPUT_LABEL: Record<OutputType, string> = {
  email: 'Email',
  plan: 'Project plan',
  tasks: 'Task list',
  summary: 'Meeting summary',
  brief: 'Brief',
  post: 'Social post',
  decision: 'Decision memo',
  slack: 'Slack message',
}

/** Stage copy used across every transformation surface (spec §26, §47). */
export const STAGE_COPY: Record<string, string> = {
  understanding: 'Understanding your thought…',
  intent: 'Identifying intent…',
  structuring: 'Structuring the message…',
  writing: 'Writing draft…',
  ready: 'Ready.',
  error: 'Something interrupted the transformation.',
}

export const STAGE_ORDER = ['understanding', 'intent', 'structuring', 'writing', 'ready'] as const
