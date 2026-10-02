import type { Collection, Template, Thought, TimelineEvent } from './types'
import { generateOutput } from '../lib/mockAI'

/* ============================================================
   Realistic local demo data. Timestamps are relative to "now"
   so the inbox always reads fresh. Fictional — labelled as
   demo content in the UI (spec §58).
   ============================================================ */

const now = Date.now()
const min = 60_000
const hr = 60 * min

export const SEED_THOUGHTS: Thought[] = [
  {
    id: 'th-sarah',
    text: "i need to tell sarah that we're probably going to miss friday because the api isn't ready and maybe monday but don't promise monday yet...",
    source: 'voice',
    createdAt: now - 12 * min,
    status: 'raw',
    outputs: [],
    collectionId: 'cl-client',
    tags: ['Client comms', 'Deadlines'],
  },
  {
    id: 'th-proposal',
    text: 'Need to follow up with Alex about the proposal — sent it nine days ago, no reply. dont want to be annoying but we need an answer this week.',
    source: 'text',
    createdAt: now - 48 * min,
    status: 'raw',
    outputs: [],
    collectionId: 'cl-client',
    tags: ['Client comms', 'Follow-up'],
  },
  {
    id: 'th-launch',
    text: 'I want to launch my portfolio next month. three case studies max, no screenshots without outcomes, and a short launch post. need a plan that fits around client work.',
    source: 'text',
    starred: true,
    createdAt: now - 3 * hr,
    status: 'processed',
    outputs: [
      generateOutput('launch my portfolio next month', { type: 'plan' }),
    ],
    collectionId: 'cl-startup',
    tags: ['Portfolio', 'Launch'],
  },
  {
    id: 'th-fixes',
    text: 'Things we need to fix before Friday: mobile nav overlaps hero at 375px, hero images are 4MB, pricing table contrast fails AA. also footer links still point at staging.',
    source: 'import',
    pinned: true,
    createdAt: now - 5 * hr,
    status: 'raw',
    outputs: [],
    collectionId: 'cl-startup',
    tags: ['QA', 'Launch blockers'],
  },
  {
    id: 'th-meeting',
    text: 'Meeting notes from standup: scope locked on checkout redesign, no wallet support this round. launch moves wednesday -> friday for UAT. priya sends estimates tomorrow, jordan books uat thursday.',
    source: 'voice',
    createdAt: now - 26 * hr,
    status: 'processed',
    outputs: [
      generateOutput('meeting notes standup kickoff', { type: 'summary' }),
    ],
    collectionId: 'cl-client',
    tags: ['Scope', 'UAT'],
  },
  {
    id: 'th-db',
    text: 'Should we use PostgreSQL or MongoDB for the billing service? invoices are relational but webhook payloads keep changing shape.',
    source: 'text',
    createdAt: now - 30 * hr,
    status: 'raw',
    outputs: [],
    collectionId: 'cl-ideas',
    tags: ['Architecture', 'Billing'],
  },
]

export const SEED_TIMELINE: TimelineEvent[] = [
  { id: 'ev-1', thoughtId: 'th-launch', at: now - 3 * hr - 40 * min, kind: 'capture', label: 'Thought captured', detail: 'Typed' },
  { id: 'ev-2', thoughtId: 'th-launch', at: now - 3 * hr - 12 * min, kind: 'transform', label: 'Project plan created', detail: 'Four-week launch plan' },
  { id: 'ev-3', thoughtId: 'th-launch', at: now - 3 * hr - 8 * min, kind: 'tone', label: 'Tone changed to confident' },
  { id: 'ev-4', thoughtId: 'th-launch', at: now - 2 * hr - 30 * min, kind: 'save', label: 'Saved to Startup' },
  { id: 'ev-5', thoughtId: 'th-meeting', at: now - 26 * hr, kind: 'capture', label: 'Voice note captured', detail: '0:42' },
  { id: 'ev-6', thoughtId: 'th-meeting', at: now - 25 * hr, kind: 'transform', label: 'Meeting summary created' },
  { id: 'ev-7', thoughtId: 'th-meeting', at: now - 25 * hr + 4 * min, kind: 'copy', label: 'Copied to clipboard' },
  { id: 'ev-8', thoughtId: 'th-meeting', at: now - 24 * hr, kind: 'export', label: 'Exported as Markdown' },
  { id: 'ev-9', thoughtId: 'th-sarah', at: now - 12 * min, kind: 'capture', label: 'Voice note captured', detail: '0:18' },
]

export const COLLECTIONS: Collection[] = [
  { id: 'cl-client', name: 'Client Work', description: 'Anything touching active engagements.', color: 'accent' },
  { id: 'cl-startup', name: 'Startup', description: 'Product, launch and growth thinking.', color: 'blue' },
  { id: 'cl-personal', name: 'Personal', description: 'Life admin, health, family.', color: 'emerald' },
  { id: 'cl-ideas', name: 'Ideas', description: 'Half-formed things worth revisiting.', color: 'amber' },
  { id: 'cl-content', name: 'Content', description: 'Posts, essays and talks in progress.', color: 'coral' },
]

export const TEMPLATES: Template[] = [
  {
    id: 'tp-client',
    name: 'Client Update',
    description: 'A calm, specific status email — including when things slip.',
    outputType: 'email',
    fields: [
      { key: 'context', label: 'Context', placeholder: 'Website redesign — checkout flow' },
      { key: 'status', label: 'Current status', placeholder: 'API integration 80% done, two endpoints left', multiline: true },
      { key: 'timeline', label: 'Timeline', placeholder: 'Delivery moves from Friday to early next week' },
      { key: 'tone', label: 'Tone', placeholder: 'Professional' },
    ],
    example: "Hi Sarah,\n\nQuick update — we're working through the remaining API integration and may need to move Friday's delivery. I'll confirm the revised timeline by Thursday.\n\nBest regards,\nMahek",
  },
  {
    id: 'tp-summary',
    name: 'Meeting Summary',
    description: 'Decisions, open questions and actions with owners.',
    outputType: 'summary',
    fields: [
      { key: 'context', label: 'Meeting', placeholder: 'Weekly sync — product + design' },
      { key: 'status', label: 'Raw notes', placeholder: 'Paste messy notes or a transcript…', multiline: true },
      { key: 'timeline', label: 'Next checkpoint', placeholder: 'Same time next week' },
      { key: 'tone', label: 'Audience', placeholder: 'Internal team' },
    ],
    example: 'Decisions\n· Scope locked: checkout ships without wallet support\n\nAction items\n· Priya — revised estimates tomorrow\n· Jordan — book UAT Thursday',
  },
  {
    id: 'tp-brief',
    name: 'Project Brief',
    description: 'Objective, audience, message, deliverables, success.',
    outputType: 'brief',
    fields: [
      { key: 'context', label: 'Project', placeholder: 'Marketing site redesign' },
      { key: 'status', label: 'What & why', placeholder: 'Current site converts poorly on mobile…', multiline: true },
      { key: 'timeline', label: 'Deadline', placeholder: 'Six weeks, launch first week of June' },
      { key: 'tone', label: 'Stakeholders', placeholder: 'Founders + one in-house dev' },
    ],
    example: 'Objective\nRebuild the marketing site to lift mobile trial signups by 20%.\n\nDeliverables\nFive templates, a component library, copy deck.',
  },
  {
    id: 'tp-proposal',
    name: 'Proposal',
    description: 'Scope, approach and phases — priced by outcome.',
    outputType: 'brief',
    fields: [
      { key: 'context', label: 'Client', placeholder: 'Northwind Logistics' },
      { key: 'status', label: 'Problem', placeholder: 'Dispatch is run on spreadsheets…', multiline: true },
      { key: 'timeline', label: 'Phases', placeholder: 'Discovery → MVP → Handover' },
      { key: 'tone', label: 'Commercial tone', placeholder: 'Confident, not salesy' },
    ],
    example: 'Phase 1 — Discovery (2 weeks)\nMap dispatch workflow, define the data model, agree success metrics.\n\nPhase 2 — MVP (6 weeks)\nShippable dispatcher console used by the live team daily.',
  },
  {
    id: 'tp-post',
    name: 'Social Post',
    description: 'A tight, human post from one rough idea.',
    outputType: 'post',
    fields: [
      { key: 'context', label: 'Idea', placeholder: 'Portfolios are an editing problem' },
      { key: 'status', label: 'Supporting thought', placeholder: 'Cutting 12 projects to 3 made it better…', multiline: true },
      { key: 'timeline', label: 'Platform', placeholder: 'LinkedIn' },
      { key: 'tone', label: 'Voice', placeholder: 'Calm, first-person' },
    ],
    example: "I cut my portfolio from twelve projects to three.\n\nEnquiries doubled. It wasn't a design problem — it was an editing problem.\n\nShowing less is a decision. Make it on purpose.",
  },
  {
    id: 'tp-launch',
    name: 'Launch Plan',
    description: 'A week-by-week sequence with a quiet period built in.',
    outputType: 'plan',
    fields: [
      { key: 'context', label: 'What is launching', placeholder: 'Portfolio v3' },
      { key: 'status', label: 'Ready today', placeholder: 'Two case studies drafted, site built', multiline: true },
      { key: 'timeline', label: 'Window', placeholder: 'Four weeks, go-live Tuesday' },
      { key: 'tone', label: 'Constraints', placeholder: 'Around two client projects', multiline: true },
    ],
    example: 'Week 1 — Content\n· Finalise three case studies\n\nWeek 4 — Launch\n· Go live Tuesday morning\n· Reply to every comment for 48 hours',
  },
  {
    id: 'tp-followup',
    name: 'Follow-up',
    description: 'A nudge with a clear ask and zero guilt language.',
    outputType: 'email',
    fields: [
      { key: 'context', label: 'Who / what', placeholder: 'Alex — redesign proposal' },
      { key: 'status', label: 'Last touch', placeholder: 'Sent nine days ago, no reply' },
      { key: 'timeline', label: 'Needed by', placeholder: 'This week' },
      { key: 'tone', label: 'Relationship', placeholder: 'Friendly, low pressure' },
    ],
    example: "Hi Alex,\n\nFloating the proposal back to the top of your inbox — no pressure. A 20-minute walkthrough might be easier than reading; happy to do either.\n\nBest,\nMahek",
  },
  {
    id: 'tp-memo',
    name: 'Decision Memo',
    description: 'Options, trade-offs, recommendation, revisit trigger.',
    outputType: 'decision',
    fields: [
      { key: 'context', label: 'Decision', placeholder: 'PostgreSQL vs MongoDB for billing' },
      { key: 'status', label: 'Constraints', placeholder: 'Relational data, variable webhook payloads', multiline: true },
      { key: 'timeline', label: 'Needed by', placeholder: 'End of sprint' },
      { key: 'tone', label: 'Readers', placeholder: 'Engineering leads' },
    ],
    example: 'Recommendation\nPostgreSQL. Billing data is relational and correctness beats schema agility; JSONB covers variable payloads.\n\nRevisit when\nWebhook volume exceeds ~50k events/day.',
  },
]

/** Four starter thoughts shown in demo mode (spec §56). */
export const DEMO_EXAMPLES: { label: string; text: string; type: 'email' | 'plan' | 'summary' | 'decision' | 'post' }[] = [
  {
    label: 'Email',
    text: "i need to tell sarah that we're probably going to miss friday because the api isn't ready and maybe monday but don't promise monday yet...",
    type: 'email',
  },
  {
    label: 'Project plan',
    text: 'I want to launch my portfolio next month. three case studies max, no screenshots without outcomes, and a short launch post. need a plan that fits around client work.',
    type: 'plan',
  },
  {
    label: 'Meeting summary',
    text: 'Meeting notes from standup: scope locked on checkout redesign, no wallet support this round. launch moves wednesday -> friday for UAT. priya sends estimates tomorrow, jordan books uat thursday.',
    type: 'summary',
  },
  {
    label: 'Decision',
    text: 'Should we use PostgreSQL or MongoDB for the billing service? invoices are relational but webhook payloads keep changing shape.',
    type: 'decision',
  },
  {
    label: 'Social post',
    text: 'post idea: I cut my portfolio from twelve projects to three and enquiries doubled. portfolios are an editing problem not a design problem.',
    type: 'post',
  },
]
