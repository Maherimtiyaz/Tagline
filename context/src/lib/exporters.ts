import type { GeneratedOutput, ToneId } from '../data/types'
import { OUTPUT_LABEL } from './outputMeta'

/* ============================================================
   Output exporters — Phase 11.

   Pure, deterministic serializers that turn a GeneratedOutput
   into copy-ready text for the real destination of each output
   type (spec §27 "make the output immediately usable"):

     email      → RFC-5322 style block + .eml variant
     slack      → Slack Block Kit JSON payload
     tasks      → Markdown checklist
     plan/brief/summary/decision/post → Markdown

   Everything is frontend-only; no network, no libraries.
   ============================================================ */

export interface ExportFormat {
  id: string
  label: string
  /** File extension used by downloadExport(). */
  ext: string
  mime: string
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'text', label: 'Plain text', ext: 'txt', mime: 'text/plain' },
  { id: 'markdown', label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  { id: 'blockkit', label: 'Slack Block Kit', ext: 'json', mime: 'application/json' },
  { id: 'eml', label: 'Email (.eml)', ext: 'eml', mime: 'message/rfc822' },
]

/** Formats offered for a given output type. */
export function formatsFor(type: GeneratedOutput['type']): ExportFormat[] {
  if (type === 'slack') return EXPORT_FORMATS.filter((f) => f.id !== 'eml')
  if (type === 'email') return EXPORT_FORMATS.filter((f) => f.id !== 'blockkit')
  return EXPORT_FORMATS.filter((f) => f.id === 'text' || f.id === 'markdown')
}

/* ---------- helpers ---------- */

const splitParas = (body: string) => body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

/** Turn checkbox lines (☐ foo) into markdown task syntax; keep others as-is. */
function toChecklist(body: string): string {
  return body
    .split('\n')
    .map((l) => l.replace(/^\s*☐\s*/, '- [ ] ').replace(/^\s*[·•]\s/, '  - '))
    .join('\n')
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'context-output'
}

/* ---------- per-format serializers ---------- */

export function exportAsText(o: GeneratedOutput): string {
  const header = `${OUTPUT_LABEL[o.type].toUpperCase()}\n${'─'.repeat(24)}\n`
  const subject = o.subject ? `Subject: ${o.subject}\n\n` : ''
  return `${header}${subject}${o.body}\n`
}

export function exportAsMarkdown(o: GeneratedOutput): string {
  const title = `# ${o.title}`
  const meta = `_${OUTPUT_LABEL[o.type]} · tone: ${o.tone}_`
  const subject = o.subject ? `\n**Subject:** ${o.subject}\n` : ''
  const body = o.type === 'tasks' ? toChecklist(o.body) : o.body
  return `${title}\n${meta}\n${subject}\n${body}\n`
}

export function exportAsEml(o: GeneratedOutput): string {
  const date = new Date(o.createdAt).toUTCString()
  const boundary = `ctx-${slug(o.title)}-${o.id}`
  return [
    `Date: ${date}`,
    'From: Mahek <mahek@example.com>',
    'To: Sarah <sarah@example.com>',
    `Subject: ${o.subject ?? o.title}`,
    'Message-ID: <' + o.id + '@context.local>',
    'MIME-Version: 1.0',
    `Content-Type: text/plain; charset=utf-8`,
    '',
    o.body,
    '--' + boundary,
  ].join('\r\n')
}

/** Minimal-but-valid Slack Block Kit payload (section blocks + divider). */
export function exportAsBlockKit(o: GeneratedOutput): string {
  const sections = splitParas(o.body).map((para) => ({
    type: 'section',
    text: { type: 'mrkdwn', text: para },
  }))
  const blocks = sections.length
    ? sections.flatMap((b, i) => (i === 0 ? [b] : [{ type: 'divider' as const }, b]))
    : [{ type: 'section', text: { type: 'mrkdwn', text: o.body } }]
  return JSON.stringify({ text: o.subject ?? o.title, blocks }, null, 2)
}

/** Entry point used by the UI. Falls back to plain text for unknown ids. */
export function serializeExport(o: GeneratedOutput, formatId: string): string {
  switch (formatId) {
    case 'markdown':
      return exportAsMarkdown(o)
    case 'eml':
      return exportAsEml(o)
    case 'blockkit':
      return exportAsBlockKit(o)
    default:
      return exportAsText(o)
  }
}

export function downloadFilename(o: GeneratedOutput, formatId: string): string {
  const ext = EXPORT_FORMATS.find((f) => f.id === formatId)?.ext ?? 'txt'
  return `${slug(o.title)}.${ext}`
}

/** Trigger a client-side download of the serialized export. */
export function downloadExport(o: GeneratedOutput, formatId: string): void {
  const format = EXPORT_FORMATS.find((f) => f.id === formatId)
  const blob = new Blob([serializeExport(o, formatId)], {
    type: `${format?.mime ?? 'text/plain'};charset=utf-8`,
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadFilename(o, formatId)
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so Safari has time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Convenience re-export so callers don't need two imports for retune+export. */
export type { ToneId }
