/**
 * Phase 16 — Shareable output links (spec §27 "share" extension).
 *
 * Frontend-only concept: the full output text is encoded into a URL fragment
 * (#share=…). Fragments are never sent to servers, so this behaves like a
 * client-side "shared document". Compression via pako's deflateRaw keeps
 * long outputs link-friendly; encoding is base64url for URL safety.
 */
import { deflateRaw, inflateRaw } from 'pako'

export interface SharedPayload {
  /** The transformed/cleaned text being shared. */
  text: string
  /** Output format id from exporters (e.g. 'markdown', 'plain'). */
  format: string
  /** Optional title / provenance line shown on the share page. */
  title?: string
}

const PREFIX = 'v1.'

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Encode a payload into a shareable absolute URL.
 *
 *  The app runs on HashRouter, so the document itself lives in the
 *  fragment: `#/share?d=v1.<deflate+base64url>` — a single hash, no
 *  double-# ambiguity, works from any deployment path. */
export function createShareLink(payload: SharedPayload): string {
  const json = JSON.stringify({
    t: payload.text,
    f: payload.format,
    ...(payload.title ? { n: payload.title } : {}),
  })
  const encoded = toBase64Url(deflateRaw(new TextEncoder().encode(json)))
  const origin = window.location.origin + window.location.pathname.replace(/index\.html$/, '')
  return `${origin}#/share?d=${PREFIX}${encoded}`
}

export type DecodeResult =
  | { ok: true; payload: SharedPayload }
  | { ok: false; reason: 'not-share-url' | 'corrupted' }

/** Decode a share payload from the full location hash (e.g. `#/share?d=v1.…`).
 *  Also tolerates hand-built `#share=v1.…` fragments. */
export function decodeShareHash(hash: string): DecodeResult {
  const match = /(?:[?&/#])share=([^&]+)|[?&]d=([^&]+)/.exec(hash)
  const raw0 = match?.[1] ?? match?.[2]
  if (!raw0) return { ok: false, reason: 'not-share-url' }
  try {
    const raw = raw0.startsWith(PREFIX) ? raw0.slice(PREFIX.length) : raw0
    const json = new TextDecoder().decode(inflateRaw(fromBase64Url(raw)))
    const parsed = JSON.parse(json) as { t?: unknown; f?: unknown; n?: unknown }
    if (typeof parsed.t !== 'string' || typeof parsed.f !== 'string') {
      return { ok: false, reason: 'corrupted' }
    }
    return {
      ok: true,
      payload: {
        text: parsed.t,
        format: parsed.f,
        title: typeof parsed.n === 'string' ? parsed.n : undefined,
      },
    }
  } catch {
    return { ok: false, reason: 'corrupted' }
  }
}

/* ---------- Phase 18 — native share sheet with graceful fallback ---------- */

export type ShareMethod = 'native' | 'clipboard' | 'failed'

/** True when the browser exposes a working native share target.
 *  Feature-detection only — canShare is intentionally not consulted,
 *  since long text shares are handled by most sheets or fall back. */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** Share a document the way the platform intends:
 *  - devices with a native share sheet (mobile, some desktops) get
 *    navigator.share() with title / text / link in one gesture;
 *  - everything else falls back to copying the share link;
 *  - if both fail (e.g. user dismissed the sheet → AbortError, which we
 *    treat as "not shared" without surfacing an error), returns 'failed'. */
export async function shareDocument(
  payload: SharedPayload & { summary?: string },
): Promise<ShareMethod> {
  const link = createShareLink({ text: payload.text, format: payload.format, title: payload.title })
  if (canNativeShare()) {
    try {
      await navigator.share({
        title: payload.title ?? 'Context output',
        text: payload.summary ?? payload.text.slice(0, 240),
        url: link,
      })
      return 'native'
    } catch (err) {
      /* User dismissed the sheet — browsers report this as AbortError or
         NotAllowedError depending on engine. Treat both as "cancelled":
         don't fight them with a clipboard write. */
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        return 'failed'
      }
      /* Anything else (unsupported data…) → fall through to clipboard. */
    }
  }
  return (await copyToClipboard(link)) ? 'clipboard' : 'failed'
}

/** Copy helper with an execCommand fallback for non-secure contexts. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
