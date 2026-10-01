/* Phase 18 — Web Share API: native sheet with clipboard fallback */

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log('PASS', name) }
  else { fail++; console.log('FAIL', name) }
}

/* Minimal DOM/browser stubs before importing the module under test. */
const g = globalThis as any
g.window = { location: { origin: 'https://ctx.test', pathname: '/' }, isSecureContext: true }
g.btoa = (s: string) => Buffer.from(s, 'binary').toString('base64')
g.atob = (s: string) => Buffer.from(s, 'base64').toString('binary')

let clipboardWrites: string[] = []
g.navigator = { clipboard: { writeText: async (t: string) => { clipboardWrites.push(t); return true } } }

const share = await import('../src/lib/share.ts')
const { canNativeShare, shareDocument, decodeShareHash } = share

ok('canNativeShare false without navigator.share', canNativeShare() === false)

/* 1. No native support → clipboard fallback with a decodable link */
{
  clipboardWrites = []
  const m = await shareDocument({ text: 'Hello **world**\nline2', format: 'text', title: 'Doc A' })
  ok('fallback returns clipboard', m === 'clipboard')
  ok('clipboard received one link', clipboardWrites.length === 1)
  const hash = clipboardWrites[0].slice(clipboardWrites[0].indexOf('#'))
  const dec = decodeShareHash(hash)
  ok('link round-trips text', dec.ok && dec.payload.text === 'Hello **world**\nline2')
  ok('link round-trips title', dec.ok && dec.payload.title === 'Doc A')
}

/* 2. Native share available → used, clipboard untouched */
{
  let shared: any = null
  g.navigator.share = async (data: any) => { shared = data; return undefined }
  clipboardWrites = []
  ok('canNativeShare true', canNativeShare() === true)
  const m = await shareDocument({ text: 'Body text here', format: 'markdown', title: 'T' })
  ok('native path returns native', m === 'native')
  ok('share got title', shared?.title === 'T')
  ok('share got text preview', shared?.text === 'Body text here')
  ok('share got url link', typeof shared?.url === 'string' && shared.url.includes('#/share?d=v1.'))
  ok('clipboard NOT used when native succeeds', clipboardWrites.length === 0)
  const dec = decodeShareHash(shared.url.slice(shared.url.indexOf('#')))
  ok('shared url decodes', dec.ok && dec.payload.text === 'Body text here')
}

/* 3. User cancels the sheet (AbortError) → failed, no silent clipboard write */
{
  g.navigator.share = async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e }
  clipboardWrites = []
  const m = await shareDocument({ text: 'x', format: 'text' })
  ok('abort returns failed', m === 'failed')
  ok('abort does not touch clipboard', clipboardWrites.length === 0)
}

/* 4. Native throws a genuine failure (TypeError, unsupported data) → clipboard */
{
  g.navigator.share = async () => { const e = new TypeError('unsupported'); throw e }
  clipboardWrites = []
  const m = await shareDocument({ text: 'fallback body', format: 'text' })
  ok('genuine native failure falls back to clipboard', m === 'clipboard')
  ok('clipboard used after native failure', clipboardWrites.length === 1)
}

/* 5. Default title when none provided */
{
  let shared: any = null
  g.navigator.share = async (d: any) => { shared = d }
  await shareDocument({ text: 'abc', format: 'text' })
  ok('default share title', shared?.title === 'Context output')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
