/* ============================================================
   CONTEXT — domain types (shared by mock AI engine + UI)
   ============================================================ */

export type SourceType = 'voice' | 'text' | 'screenshot' | 'import' | 'digest'

export type ThoughtStatus = 'raw' | 'processed' | 'archived'

export type OutputType =
  | 'email'
  | 'plan'
  | 'tasks'
  | 'summary'
  | 'brief'
  | 'post'
  | 'decision'
  | 'slack'

export type ToneId =
  | 'professional'
  | 'friendly'
  | 'concise'
  | 'confident'
  | 'casual'
  | 'persuasive'

/** The staged transformation pipeline (spec §26). */
export type TransformStage =
  | 'idle'
  | 'understanding'
  | 'intent'
  | 'structuring'
  | 'writing'
  | 'ready'
  | 'error'

export interface Entity {
  label: string
  value: string
}

/** What the (simulated) engine extracts from a raw thought. */
export interface Understanding {
  intent: string
  context: string
  tone: ToneId
  people: string[]
  dates: string[]
  tasks: string[]
  topics: string[]
  actions: string[]
}

/** One immutable snapshot of an output's body, kept when a versioning
 *  action (tone / format / quick edit) would otherwise overwrite it.
 *  Phase 19 — output version history. */
export interface OutputVersion {
  id: string
  at: number
  label: string
  body: string
  tone: ToneId
}

export interface GeneratedOutput {
  id: string
  type: OutputType
  title: string
  subject?: string
  body: string
  /** Untoned base text the current body was derived from — lets tone
   *  switches re-apply without discarding the document. */
  baseBody?: string
  createdAt: number
  tone: ToneId
  /** Newest-first archived snapshots of this output (max 12). */
  versions?: OutputVersion[]
  /** Phase 29 — lightweight 👍/👎 feedback loop on generated outputs. */
  feedback?: OutputFeedback
}

export interface OutputFeedback {
  rating: 'helpful' | 'needs-work'
  at: number
}

export interface Suggestion {
  type: OutputType
  label: string
  confidence: number /* 0..1 */
  /** Phase 37 — why this suggestion was ranked (spec §25 "explainable"). */
  reason?: string
}

/** Phase 39 — a per-output-type signal learned from user feedback. Positive
 *  when an output of that type was rated helpful (§29), negative when it was
 *  dismissed before generating or rated needs-work. Persisted, capped, and
 *  fed back into analyzeThought's ranking (spec §68 "learns preferences"). */
export interface TypeSignal {
  type: OutputType
  score: number
}

export interface Thought {
  id: string
  text: string
  source: SourceType
  createdAt: number
  status: ThoughtStatus
  /** Phase 38 — the engine's ranked ideas, seeded at capture time so every
   *  surface (cards, mobile chips, palette) can explain "why this?" (§25). */
  suggestions?: Suggestion[]
  understanding?: Understanding
  outputs: GeneratedOutput[]
  collectionId?: string
  /** Phase 22 — pinned thoughts sort to the top of every inbox view. */
  pinned?: boolean
  /** Phase 22b — user tags for filtering. Seeded from extracted topics
   *  on first transform; fully editable (add / rename / remove). */
  tags?: string[]
  /** Phase 25 — starred thoughts float to the very top of inbox views,
   *  above pinned rows. Independent flag so pin/star never fight. */
  starred?: boolean
}

/* ---------- History / timeline ---------- */

export type TimelineKind =
  | 'capture'
  | 'transform'
  | 'tone'
  | 'format'
  | 'copy'
  | 'save'
  | 'export'
  | 'archive'
  /* Phase 35 — thought lifecycle (draft → ready) events render on the
     global History timeline via this kind. */
  | 'lifecycle'
  /* Phase 18/19 link: archived output snapshots render on the
     global History timeline via this kind. */
  | 'version'

export interface TimelineEvent {
  id: string
  thoughtId: string
  at: number
  kind: TimelineKind
  label: string
  detail?: string
}

/* ---------- Templates & collections ---------- */

export interface TemplateField {
  key: string
  label: string
  placeholder: string
  multiline?: boolean
}

export interface Template {
  id: string
  name: string
  description: string
  outputType: OutputType
  fields: TemplateField[]
  example: string
}

export interface Collection {
  id: string
  name: string
  description: string
  color: 'accent' | 'blue' | 'emerald' | 'amber' | 'coral' | 'neutral'
}

/* ---------- Engine result ---------- */

export interface TransformResult {
  understanding: Understanding
  suggestions: Suggestion[]
}
