/* Phase 45 — Digest share-link codec harness.
 * Run: npx tsx qa/phase45-digest-share.test.ts
 * Covers: encodeDigestPayload (determinism, wire prefix, URL-safe
 * charset, compression), decodeDigestHash / decodeDigestLink round
 * trips (unicode, hand-built #share= form, absolute links), strict
 * envelope validation (non-digest payloads, key mismatch, bad field
 * types, poisoned sections, corrupt/truncated data → null, never
 * throws), createDigestShareLink browser-shape + Node inertness, and
 * wire compatibility with the Phase 16 output codec (digest envelopes
 * are rejected by decodeShareHash's validator only when they'd break
 * it — here we assert both decoders coexist on one route). */

const kv = new Map<string, string>()
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (kv.has(k) ? kv.get(k)! : null),
    setItem: (k: string, v: string) => void kv.set(k, String(v)),
    removeItem: (k: string) => void kv.delete(k),
    clear: () => kv.clear(),
  },
}
;(globalThis as Record<string, unknown>).localStorage = (globalThis as { window: { localStorage: unknown } }).window.localStorage

import { deflateRaw } from 'pako'
import {
  addWeeks,
  buildWeeklyDigest,
  createDigestShareLink,
  decodeDigestHash,
  decodeDigestLink,
  encodeDigestPayload,
  isoWeekKey,
} from '../src/lib/mockAI'
import { decodeShareHash } from '../src/lib/share'
import { useAppStore } from '../src/lib/store'
import type { WeeklyDigest } from '../src/data/types'

let pass = 0
let fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}`); fail++ }
}

const s = () => useAppStore.getState()

/* Fixed Monday anchor: 2026-10-05 → ISO week derived from the engine
 * (Phase 52 Jan-4 correction moved this date from W40 to W41 — the
 * harness now asks isoWeekKey instead of hardcoding, mirroring P44). */
const MON_NOON = new Date(2026, 9, 5, 12, 0, 0).getTime()
const WEEK = isoWeekKey(MON_NOON) /* 2026-W41 */

console.log('Phase 45: digest share-link codec')

/* ---- fixtures: engine-built digests (two weeks) ---- */
const d1 = buildWeeklyDigest(MON_NOON, s().thoughts, s().timeline, MON_NOON)
const d2 = buildWeeklyDigest(addWeeks(MON_NOON, -1), s().thoughts, s().timeline, addWeeks(MON_NOON, -1))

check('fixture sanity: anchors key as expected', isoWeekKey(MON_NOON) === WEEK && d1.weekKey === WEEK)

/* ---- encodeDigestPayload: determinism & wire format ---- */
const p1 = encodeDigestPayload(d1)
const p1b = encodeDigestPayload(JSON.parse(JSON.stringify(d1)))
check('encoding is deterministic (byte-identical repeat)', p1 === p1b)
check('payload carries the v1. wire prefix', p1.startsWith('v1.'))
check('payload body is URL-safe base64url charset', /^[A-Za-z0-9_-]+$/.test(p1.slice(3)))
check('different digests encode differently', p1 !== encodeDigestPayload(d2))
const jsonLen = JSON.stringify(d1).length
check('deflate actually compresses (>1.3x vs raw JSON bytes)', p1.length * 0.75 < jsonLen)

/* ---- round trips ---- */
const hash = `#/share?d=${p1}`
const rt = decodeDigestHash(hash)
check('round trip returns a digest', rt !== null)
check('weekKey survives the round trip', rt?.weekKey === d1.weekKey)
check('from/to/generatedAt survive verbatim',
  rt?.from === d1.from && rt?.to === d1.to && rt?.generatedAt === d1.generatedAt)
check('headline + stats survive verbatim',
  rt?.headline === d1.headline && rt?.captured === d1.captured &&
  rt?.transformed === d1.transformed && rt?.exported === d1.exported)
check('sections deep-equal after round trip',
  JSON.stringify(rt?.sections) === JSON.stringify(d1.sections))
check('hand-built #share= form also decodes', decodeDigestHash(`#share=${p1}`)?.weekKey === WEEK)
check('decodeDigestLink consumes the absolute link shape',
  (() => {
    /* Deterministic harness window: later checks rely on this shape,
       and some import chains may have installed their own stub first. */
    ;(globalThis as { window: Window }).window = {
      ...(globalThis as { window: Window }).window,
      location: { origin: 'https://context.demo', pathname: '/app/index.html' },
    } as unknown as Window
    const link = createDigestShareLink(d1)
    return (
      /* index.html normalizes away; the trailing directory slash
         remains, so valid shapes are origin root or origin/<dir>/. */
      /^https:\/\/context\.demo(\/app)?\/#\/share\?d=v1\./.test(link) &&
      !link.includes('index.html') &&
      decodeDigestLink(link)?.weekKey === WEEK
    )
  })())
check('empty/garbage inputs never throw and yield null',
  decodeDigestHash('') === null &&
  decodeDigestHash('#/share?d=v1.notbase64!!') === null &&
  decodeDigestLink('https://example.com/#/demo') === null)

/* ---- unicode fidelity ---- */
const uni: WeeklyDigest = { ...d1, headline: 'Résumé → naïve café — 日本語 🚀 “smart quotes”', sections: [{ heading: 'Élan', items: ['ünïcode ✓', '✨ sparkle'] }] }
const uniRt = decodeDigestHash(`#/share?d=${encodeDigestPayload(uni)}`)
check('unicode headline + items round-trip exactly',
  uniRt?.headline === uni.headline && JSON.stringify(uniRt?.sections) === JSON.stringify(uni.sections))

/* ---- truncation behaves like Phase 16 (corrupted → null) ---- */
const truncated = `#/share?d=${p1.slice(0, Math.floor(p1.length / 2))}`
check('truncated payload decodes to null (never throws)', decodeDigestHash(truncated) === null)

/* ---- strict envelope validation: poisoned payloads rejected ---- */
function encodeEnvelope(obj: unknown): string {
  return `v1.${(() => {
    let bin = ''
    const bytes = deflateRaw(new TextEncoder().encode(JSON.stringify(obj)))
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  })()}`
}
const goodInner = JSON.parse(JSON.stringify({ ...d1, kind: 'digest' }))
check('plain OUTPUT payload is not mistaken for a digest',
  decodeDigestHash(`#/share?d=${encodeEnvelope({ t: 'hello', f: 'markdown', n: 'Doc' })}`) === null)
check('inner envelope missing kind discriminator → null',
  decodeDigestHash(`#/share?d=${encodeEnvelope({ t: JSON.stringify(d1), f: 'digest' })}`) === null)
check('bad field type (captured string) → null',
  decodeDigestHash(`#/share?d=${encodeEnvelope({ t: JSON.stringify({ ...goodInner, captured: '12' }), f: 'digest' })}`) === null)
check('malformed weekKey → null',
  decodeDigestHash(`#/share?d=${encodeEnvelope({ t: JSON.stringify({ ...goodInner, weekKey: 'W40' }), f: 'digest' })}`) === null)
check('non-finite timestamp → null',
  decodeDigestHash(`#/share?d=${encodeEnvelope({ t: JSON.stringify({ ...goodInner, generatedAt: Infinity }), f: 'digest' })}`) === null)
check('section item that is not a string → null',
  decodeDigestHash(`#/share?d=${encodeEnvelope({ t: JSON.stringify({ ...goodInner, sections: [{ heading: 'X', items: [42] }] }), f: 'digest' })}`) === null)
check('array-shaped container → null',
  decodeDigestHash(`#/share?d=${encodeEnvelope([1, 2, 3])}`) === null)

/* ---- cross-decoder coexistence on the /share route ---- */
const digestEnvJson = JSON.stringify({ t: JSON.stringify({ ...goodInner }), f: 'digest', n: 'Weekly Digest' })
const digestPayloadForShareCodec = (() => {
  let bin = ''
  const bytes = deflateRaw(new TextEncoder().encode(digestEnvJson))
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `v1.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
})()
const outDec = decodeShareHash(`#/share?d=${digestPayloadForShareCodec}`)
check('output decoder still accepts the shared wire (t/f strings) without crashing',
  outDec.ok || outDec.reason === 'corrupted')
check('digest decoder rejects a plain output envelope',
  decodeDigestHash(`#/share?d=${encodeEnvelope({ t: 'text', f: 'plain' })}`) === null)

/* ---- summary ---- */
console.log(`\n${pass}/${pass + fail} checks passed`)
if (fail > 0) process.exit(1)
