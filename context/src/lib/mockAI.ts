import type {
  GeneratedOutput,
  OutputType,
  Suggestion,
  ToneId,
  TransformResult,
  Understanding,
} from '../data/types'
import { OUTPUT_LABEL } from './outputMeta'

/* ============================================================
   Simulated AI engine — deterministic, local, no network.

   transformThought(text, outputType?, tone?) returns an
   `Understanding` + ranked suggestions. generateOutput() turns
   an understanding into professionally-written demo output for
   any type/tone combination. Known demo inputs hit curated
   presets; everything else falls back to rule-based extraction
   so the UI never breaks on unexpected text (spec §67).
   ============================================================ */

let seq = 0
export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`

const NAME_RE = /\b(?:to|with|tell|ask|email|cc)\s+([A-Z][a-z]+)\b|\b([A-Z][a-z]+)\s+(?:needs|said|wants|isn'?t|doesn'?t)\b/g
const DATE_RE = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|this week|eod|fr\b|eom)\b/gi
const TASK_RE = /\b(?:need to|have to|must|should|gotta|remember to|don'?t forget to|want to|i'?ll)\s+([^.;,\n]{4,80})/gi

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

/* ---------- Curated demo presets ---------- */

interface Preset {
  match: RegExp
  understanding: Omit<Understanding, 'actions'> & { actions?: string[] }
  outputs: Partial<Record<OutputType, { title: string; subject?: string; body: string }>>
}

const PRESETS: Preset[] = [
  {
    match: /sarah.*(delay|miss|friday)|api isn.?t ready/i,
    understanding: {
      intent: 'Client update',
      context: 'Project delivery',
      tone: 'professional',
      people: ['Sarah'],
      dates: ['Friday', 'Thursday'],
      tasks: ['Confirm revised timeline by Thursday'],
      topics: ['API integration', 'Delivery schedule'],
      actions: ['Communicate revised timeline'],
    },
    outputs: {
      email: {
        title: 'Project timeline update',
        subject: 'Project timeline update',
        body: "Hi Sarah,\n\nQuick update — we're currently working through the remaining API integration and may need to move the Friday delivery.\n\nI'll confirm the revised timeline by Thursday once the remaining work is complete, so you can plan around a early-next-week date for now.\n\nThanks for your patience,\nMahek",
      },
      slack: {
        title: 'Slack message',
        body: "Heads up on the client site — the API integration is taking longer than expected, so Friday's delivery is at risk. I'll have a confirmed new date by Thursday. cc @sarah",
      },
      tasks: {
        title: 'Follow-up tasks',
        body: '☐ Finish remaining API integration work\n☐ Confirm revised delivery date with the team\n☐ Send Sarah the updated timeline by Thursday\n☐ Block Monday as buffer for QA',
      },
      plan: {
        title: 'Recovery plan',
        body: '1. Complete API integration — remaining endpoints + error handling\n2. Internal QA pass against the staging environment\n3. Lock the new delivery date internally by Wednesday\n4. Update Sarah with a firm date on Thursday\n5. Ship early next week with a one-day support buffer',
      },
    },
  },
  {
    match: /launch.*(portfolio|site|product)|portfolio.*launch/i,
    understanding: {
      intent: 'Launch planning',
      context: 'Portfolio launch',
      tone: 'confident',
      people: [],
      dates: ['Next month'],
      tasks: ['Finalise case studies', 'Set up domain', 'Write launch post'],
      topics: ['Portfolio', 'Positioning', 'Launch'],
      actions: ['Plan a four-week launch sequence'],
    },
    outputs: {
      plan: {
        title: 'Four-week launch plan',
        body: 'Week 1 — Content\n· Finalise three case studies (problem → process → result)\n· Record a 90-second walkthrough of the flagship project\n\nWeek 2 — Build\n· Polish the live site, wire analytics, set up the custom domain\n· Proofread on mobile; fix anything that moves at 375px\n\nWeek 3 — Quiet\n· Share privately with five trusted peers, incorporate feedback\n· Draft the launch post and schedule social teasers\n\nWeek 4 — Launch\n· Go live Tuesday morning\n· Post the write-up, reply to every comment for 48 hours\n· Follow up with the three dream clients personally',
      },
      tasks: {
        title: 'Launch checklist',
        body: '☐ Finalise three case studies\n☐ Record project walkthrough video\n☐ Wire analytics + custom domain\n☐ Mobile QA pass at 375px\n☐ Private review with five peers\n☐ Draft launch post\n☐ Schedule teaser posts\n☐ Go live Tuesday\n☐ Personal follow-ups to three target clients',
      },
      post: {
        title: 'Launch post',
        body: "I rebuilt my portfolio from scratch this month.\n\nThe rule I gave myself: no screenshots without outcomes. Every project shows what changed for the client — not just what it looks like.\n\nIt taught me how much of a portfolio is really an editing problem.\n\nLive next Tuesday. Link in the usual place.",
      },
      brief: {
        title: 'Launch brief',
        body: 'Objective\nEstablish Context-quality positioning for freelance work within four weeks.\n\nAudience\nStartup founders and product leads evaluating their next design partner.\n\nMessage\n"Beautifully designed products, built end-to-end."\n\nDeliverables\nThree case studies, one walkthrough video, one launch post, nine teaser assets.\n\nSuccess\n10 qualified conversations in the 30 days after launch.',
      },
    },
  },
  {
    match: /things.*(fix|before friday)|fix before friday/i,
    understanding: {
      intent: 'Pre-launch cleanup',
      context: 'Website redesign',
      tone: 'concise',
      people: ['Alex'],
      dates: ['Friday'],
      tasks: ['Fix mobile nav overlap', 'Compress hero images', 'Audit contrast on pricing table'],
      topics: ['QA', 'Launch blockers'],
      actions: ['Triage and assign fixes before Friday'],
    },
    outputs: {
      tasks: {
        title: 'Friday blockers',
        body: 'P0 — must fix before launch\n☐ Mobile nav overlaps the hero at 375px\n☐ Hero images are 4MB — compress to <200KB\n☐ Pricing table fails contrast on the muted rows\n\nP1 — fix if time allows\n☐ Footer links point at staging URLs\n☐ Form error states have no aria-live region\n\nOwner per item assigned in Linear. Alex reviews the diff list Thursday 4pm.',
      },
      summary: {
        title: 'Cleanup status',
        body: 'Three launch blockers remain against Friday:\n\n1. Layout — mobile navigation overlaps the hero on small screens. Fix scoped, ~half a day.\n2. Performance — hero assets weigh 4MB total. Compression pass scheduled.\n3. Accessibility — pricing table contrast below AA on muted rows.\n\nTwo P1 items (staging links, form announcements) will ship in the following patch if they slip. Decision review with Alex on Thursday.',
      },
      email: {
        title: 'Launch readiness check',
        subject: 'Three blockers between us and Friday',
        body: "Hi Alex,\n\nShort version: we're on track for Friday with three open blockers —\n\n1. Mobile nav overlap at 375px (fix in review)\n2. Hero image weight (compression pass today)\n3. Pricing table contrast (tokens updated, verifying now)\n\nEverything else is P1 and won't hold the launch. I'd like 15 minutes Thursday at 4 to call it go / no-go.\n\nMahek",
      },
    },
  },
  {
    match: /meeting notes|standup|kickoff/i,
    understanding: {
      intent: 'Meeting recap',
      context: 'Weekly sync',
      tone: 'professional',
      people: ['Jordan', 'Priya'],
      dates: ['Tomorrow', 'Friday'],
      tasks: ['Priya sends revised estimates', 'Jordan books UAT session', 'Circulate recap'],
      topics: ['Scope', 'Timeline', 'UAT'],
      actions: ['Distribute summary with owners'],
    },
    outputs: {
      summary: {
        title: 'Weekly sync — summary',
        body: 'Decisions\n· Scope locked: checkout redesign ships without wallet support\n· Launch moves from Wednesday to Friday to absorb UAT\n\nOpen questions\n· Do we A/B test the address form? (Priya to size the effort)\n\nAction items\n· Priya — send revised estimates tomorrow\n· Jordan — book the UAT session for Thursday\n· Mahek — circulate this recap after review\n\nNext sync: same time next week.',
      },
      email: {
        title: 'Recap: weekly sync',
        subject: 'Recap + actions — weekly sync',
        body: "Hi all,\n\nThanks for the quick sync. Key takeaways:\n\n· Checkout scope is locked (no wallet support this round)\n· Launch shifts to Friday to make room for UAT\n· Priya sends revised estimates tomorrow; Jordan books Thursday's UAT session\n\nCorrections welcome by EOD.\n\nMahek",
      },
      tasks: {
        title: 'Meeting actions',
        body: '☐ Priya — revised estimates (tomorrow)\n☐ Jordan — book UAT session (Thursday)\n☐ Mahek — circulate recap (today)\n☐ Everyone — flag scope corrections by EOD',
      },
    },
  },
  {
    match: /postgres|mongodb|database|sql.*nosql|nosql.*sql/i,
    understanding: {
      intent: 'Architecture decision',
      context: 'Database selection',
      tone: 'professional',
      people: [],
      dates: ['This sprint'],
      tasks: ['Prototype query patterns on both', 'Estimate migration cost'],
      topics: ['PostgreSQL', 'MongoDB', 'Schema flexibility'],
      actions: ['Decide with a written trade-off memo'],
    },
    outputs: {
      decision: {
        title: 'PostgreSQL vs MongoDB',
        body: 'Decision needed\nPrimary database for the billing service.\n\nOption A — PostgreSQL\n+ Relational fit: invoices, line items and customers are naturally joined\n+ Transactional integrity for money movement\n− Schema migrations slow iteration early on\n\nOption B — MongoDB\n+ Flexible documents suit rapidly changing webhook payloads\n+ Horizontal scale story\n− Joins become application code; reporting gets expensive\n\nRecommendation\nPostgreSQL. Billing data is relational and correctness beats schema agility; use JSONB columns where payloads stay genuinely variable.\n\nRevisit when\nWebhook volume exceeds ~50k events/day or reporting queries dominate load.',
      },
      summary: {
        title: 'Decision summary',
        body: "Context chose PostgreSQL for the billing service. The data model is relational (customers → invoices → line items) and money requires transactions; MongoDB's schema flexibility doesn't offset the cost of join logic and weaker integrity guarantees. Variable webhook payloads are handled with JSONB. Revisit if event volume passes 50k/day.",
      },
    },
  },
  {
    match: /follow up|proposal.*(alex|send)|send.*proposal/i,
    understanding: {
      intent: 'Client follow-up',
      context: 'Proposal chase',
      tone: 'friendly',
      people: ['Alex'],
      dates: ['This week'],
      tasks: ['Send proposal reminder'],
      topics: ['Proposal', 'Website redesign'],
      actions: ['Nudge politely with a clear ask'],
    },
    outputs: {
      email: {
        title: 'Proposal follow-up',
        subject: 'Redesign proposal — any questions?',
        body: "Hi Alex,\n\nJust floating the proposal back to the top of your inbox — no pressure at all.\n\nIf it's useful, I'm happy to walk you and the team through the phased approach on a 20-minute call this week. And if timing has shifted, tell me and we'll adjust the plan rather than the scope.\n\nBest,\nMahek",
      },
      slack: {
        title: 'Slack nudge',
        body: "Hey Alex — bumping the redesign proposal in case it sank. Happy to jump on a 20-min walkthrough this week if that's easier than reading. If timing moved, no worries, just let me know.",
      },
    },
  },
]

/* ---------- Fallback heuristics ---------- */

function detectIntent(text: string): { intent: string; context: string; type: OutputType } {
  const t = text.toLowerCase()
  if (/(email|tell|write to|let .* know|update)/.test(t)) return { intent: 'Communication', context: 'Message to send', type: 'email' }
  if (/(task|todo|fix|finish|complete|checklist)/.test(t)) return { intent: 'Task planning', context: 'Work to organise', type: 'tasks' }
  if (/(meeting|notes|sync|standup|call)/.test(t)) return { intent: 'Meeting recap', context: 'Discussion notes', type: 'summary' }
  if (/(launch|plan|roadmap|schedule|timeline)/.test(t)) return { intent: 'Planning', context: 'Project plan', type: 'plan' }
  if (/(post|twitter|linkedin|share|announce)/.test(t)) return { intent: 'Content', context: 'Public post', type: 'post' }
  if (/(should we|vs\b|or\b|decide|option)/.test(t)) return { intent: 'Decision', context: 'Trade-off analysis', type: 'decision' }
  if (/(idea|maybe|what if|concept)/.test(t)) return { intent: 'Idea development', context: 'Early concept', type: 'brief' }
  return { intent: 'General note', context: 'Unstructured input', type: 'summary' }
}

function fallbackUnderstanding(text: string): Understanding {
  const people = uniq(
    Array.from(text.matchAll(NAME_RE)).map((m) => m[1] ?? m[2]).filter(Boolean),
  ).slice(0, 3)
  const dates = uniq(Array.from(text.matchAll(DATE_RE)).map((m) => titleCase(m[1])))
  const tasks = uniq(
    Array.from(text.matchAll(TASK_RE)).map((m) => titleCase(m[1].trim())),
  ).slice(0, 5)
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4 && !/^(about|would|could|there|their|because|should|maybe|going|really|thing|stuff|need)$/i.test(w))
  const freq = new Map<string, number>()
  words.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1))
  const topics = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => titleCase(w))
  const det = detectIntent(text)
  return {
    intent: det.intent,
    context: det.context,
    tone: 'professional',
    people,
    dates,
    tasks,
    topics: topics.length ? topics : [det.intent],
    actions: tasks.length ? tasks.slice(0, 2) : [`Act on: ${det.intent.toLowerCase()}`],
  }
}

function findPreset(text: string): Preset | undefined {
  return PRESETS.find((p) => p.match.test(text))
}

/** Understand a raw thought. Deterministic; never throws. */
export function analyzeThought(text: string): TransformResult {
  const preset = findPreset(text)
  const base = preset
    ? { ...preset.understanding, actions: preset.understanding.actions ?? [] }
    : fallbackUnderstanding(text)
  const det = detectIntent(text)
  const order: OutputType[] = preset
    ? (Object.keys(preset.outputs) as OutputType[])
    : [det.type, 'tasks', 'summary']
  const suggestions: Suggestion[] = uniq(order)
    .slice(0, 4)
    .map((type, i) => ({
      type,
      label: `Create ${OUTPUT_LABEL[type].toLowerCase()}`,
      confidence: Math.round((0.95 - i * 0.12) * 100) / 100,
    }))
  return { understanding: base, suggestions }
}

/* ---------- Generation ---------- */

/** Apply a tone rewrite deterministically to generated copy (spec §28). */
export function retune(body: string, tone: ToneId): string {
  switch (tone) {
    case 'concise': {
      const lines = body.split('\n').filter((l) => l.trim() !== '')
      const paras = lines.filter((l) => !/^[·☐\d\-]|^[A-Z][a-z ]+:$/.test(l))
      const trimmed = paras.map((p) => p.replace(/, [^,]*just[^.]*\./g, '.').replace(/\s+/g, ' '))
      const kept = trimmed.slice(0, Math.max(2, Math.ceil(trimmed.length * 0.6)))
      const rest = lines.filter((l) => !kept.includes(l))
      return [...kept, ...rest].join('\n')
    }
    case 'casual':
      return body
        .replace(/Dear /g, 'Hey ')
        .replace(/Hi ([A-Z][a-z]+),/g, "Hey $1 —")
        .replace(/Best regards,|Thanks for your patience,|Best,/g, 'Cheers,')
        .replace(/I would like to/g, "I'd like to")
        .replace(/approximately/g, 'about')
        .replace(/currently/g, 'right now')
    case 'confident':
      return body
        .replace(/may need to/g, "we'll")
        .replace(/probably/g, '')
        .replace(/I think/g, '')
        .replace(/if possible/g, '')
        .replace(/try to/g, '')
        .replace(/at risk/g, 'moving')
        .replace(/I'?ll confirm/g, "You'll get")
    case 'friendly':
      return body
        .replace(/Dear /g, 'Hi ')
        .replace(/Best regards,/g, 'Warmly,')
        .replace(/Important:/g, "Quick note:")
    case 'persuasive':
      return body
        .replace(/recommend/g, 'strongly recommend')
        .replace(/can/g, 'will')
        .replace(/maybe/g, 'certainly')
    case 'professional':
    default:
      return body
        .replace(/Hey ([A-Z][a-z]+) —/g, 'Hi $1,')
        .replace(/Cheers,/g, 'Best regards,')
        .replace(/\bdunno\b/g, 'not sure')
  }
}

export interface GenerateOptions {
  type: OutputType
  tone?: ToneId
  person?: string
}

/** Produce believable output for any thought/type/tone. */
export function generateOutput(
  text: string,
  opts: GenerateOptions,
): GeneratedOutput {
  const { type, tone = 'professional' } = opts
  const preset = findPreset(text)
  const out =
    preset?.outputs[type] ?? genericGenerate(text, type, analyzeThought(text).understanding)

  const body = tone === 'professional' ? out.body : retune(out.body, tone)
  return {
    id: uid('out'),
    type,
    title: out.title,
    subject: out.subject,
    body,
    baseBody: out.body,
    createdAt: Date.now(),
    tone,
  }
}

/* ---------- Generic generators (rule-based fallback) ---------- */

function firstSentence(text: string): string {
  const s = text.trim().split(/[.!?\n]/)[0] ?? text
  return s.length > 140 ? s.slice(0, 137) + '…' : s
}

function bulletList(items: string[]): string {
  return items.map((i) => `· ${i}`).join('\n')
}

function genericGenerate(text: string, type: OutputType, u: Understanding): { title: string; subject?: string; body: string } {
  const person = u.people[0] ?? 'there'
  const topic = u.topics[0] ?? u.intent
  const seed = firstSentence(text)
  const taskLines = u.tasks.length ? u.tasks : [seed.replace(/^(i need to|i want to|should)\s+/i, '')]

  switch (type) {
    case 'email':
      return {
        title: topic,
        subject: titleCase(topic),
        body: `Hi ${person},\n\nFollowing up on one thing: ${seed.replace(/^["']|["']$/g, '').replace(/^(i need to|i want to)\s+/i, '')}.\n\n${u.dates.length ? `Timing-wise, I'll have a concrete answer by ${u.dates[0].toLowerCase()}.` : 'Let me know a good time to align on this.'}\n\nBest regards,\nMahek`,
      }
    case 'slack':
      return {
        title: 'Slack message',
        body: `Hey — quick one: ${seed.replace(/^["']/, '').toLowerCase()}${u.dates.length ? `. Update by ${u.dates[0].toLowerCase()}.` : '.'}`,
      }
    case 'tasks':
      return {
        title: 'Task list',
        body: taskLines.map((t) => `☐ ${titleCase(t.replace(/\.$/, ''))}`).join('\n'),
      }
    case 'plan':
      return {
        title: `${topic} — plan`,
        body: `Goal\n${seed.replace(/^["']/, '')}\n\nSequence\n${bulletList(taskLines.slice(0, 4).map((t, i) => `${i + 1}. ${titleCase(t)}`))}\n\nReview\n${u.dates.length ? `Checkpoint with stakeholders on ${u.dates[0]}.` : 'Weekly checkpoint until the goal is met.'}`,
      }
    case 'summary':
      return {
        title: `${topic} — summary`,
        body: `Headline\n${seed.replace(/^["']/, '')}\n\nKey points\n${bulletList([...(u.people.length ? [`Involves ${u.people.join(', ')}`] : []), ...(u.dates.length ? [`Timeframe: ${u.dates.join(', ')}`] : []), ...taskLines.slice(0, 3)])}\n\nNext step\n${taskLines[0] ? titleCase(taskLines[0]) : 'Clarify scope and owner.'}`,
      }
    case 'brief':
      return {
        title: `${topic} — brief`,
        body: `Objective\n${seed.replace(/^["']/, '')}\n\nContext\n${u.context}. ${u.topics.length ? `Key themes: ${u.topics.join(', ').toLowerCase()}.` : ''}\n\nScope\n${bulletList(taskLines.slice(0, 4))}\n\nSuccess\nClear outcome, documented decisions, no open blockers at handoff.`,
      }
    case 'post':
      return {
        title: 'Social post',
        body: `${titleCase(seed.replace(/^["']|^i (want|need) to\s+/i, ''))}\n\nThat's the kind of thinking I've been doing lately — messy on the way in, useful on the way out.\n\nMore soon.`,
      }
    case 'decision':
      return {
        title: `Decision memo — ${topic}`,
        body: `Decision needed\n${seed.replace(/^["']|\?$/g, '')}\n\nOption A\nFaster to start, lower ceremony, more ambiguity later.\n\nOption B\nMore structure upfront, slower first commit, clearer long-term surface area.\n\nRecommendation\nChoose based on how permanent this decision is. One-way doors deserve the extra day; reversible calls should ship.\n\nRevisit when\nNew constraints appear or the assumption behind the choice changes.`,
      }
    default:
      return { title: topic, body: seed }
  }
}

/* ---------- Word→concept decomposition (signature animation, spec §43) ---------- */

export interface ConceptWord {
  word: string
  bucket: 'intent' | 'person' | 'date' | 'topic' | null
}

/** Split raw text into words tagged with the concept each maps to. */
export function decompose(text: string): ConceptWord[] {
  const u = analyzeThought(text).understanding
  const personSet = new Set(u.people.map((p) => p.toLowerCase()))
  const dateSet = new Set(u.dates.map((d) => d.toLowerCase()))
  const topicSet = new Set(u.topics.map((t) => t.toLowerCase()))
  return text
    .replace(/[""]/g, '"')
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const w = raw.toLowerCase().replace(/[^a-z0-9']/g, '')
      let bucket: ConceptWord['bucket'] = null
      if (personSet.has(w)) bucket = 'person'
      else if (dateSet.has(w)) bucket = 'date'
      else if (topicSet.has(w)) bucket = 'topic'
      else if (u.intent.toLowerCase().includes(w) && w.length > 3) bucket = 'intent'
      return { word: raw, bucket }
    })
}

/* ---------- Voice simulation transcript (spec §22) ---------- */

export const VOICE_TRANSCRIPTS = [
  'Okay, so — I need to tell Sarah the Friday delivery is slipping because the API isn\'t finished, and maybe propose Monday but don\'t promise Monday yet…',
  'Notes from the kickoff: scope locked on checkout redesign, launch moves to Friday, Priya sends estimates tomorrow, Jordan books UAT…',
  'Idea for a post — something about how portfolios are an editing problem, not a design problem. Show outcomes, not screenshots…',
]

export function pickVoiceTranscript(seed: number): string {
  return VOICE_TRANSCRIPTS[Math.abs(seed) % VOICE_TRANSCRIPTS.length]
}

/* ---------- Screenshot analysis simulation (spec §24) ---------- */

export const SCREENSHOT_ANALYSIS = {
  detected: ['Interface', 'Text blocks', 'Buttons', 'Navigation'],
  summary:
    'Landing page screenshot. Above the fold: headline, subhead and one primary CTA. Navigation has five links plus a sign-in. Two feature sections below, each with an image left / text right. Contrast reads well; the secondary CTA competes slightly with the primary. Suggested action: demote the secondary button to a text link and tighten hero copy.',
}
