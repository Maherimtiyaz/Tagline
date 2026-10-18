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
import { buildWeeklyDigest, createDigestShareLink, decodeDigestLink, isoWeekKey } from '../src/lib/mockAI'
import { useAppStore } from '../src/lib/store'
const s = () => useAppStore.getState()
const MON_NOON = new Date(2026, 9, 5, 12, 0, 0).getTime()
const d1 = buildWeeklyDigest(MON_NOON, s().thoughts, s().timeline, MON_NOON)
;(globalThis as { window: Window }).window = Object.assign((globalThis as { window: Window }).window, {
  location: { origin: 'https://context.demo', pathname: '/app/index.html' },
}) as unknown as Window
const link = createDigestShareLink(d1)
console.log('link head:', link.slice(0, 80))
console.log('startsWith app/#/share:', link.startsWith('https://context.demo/app/#/share?d=v1.'))
console.log('includes index.html:', link.includes('index.html'))
const dec = decodeDigestLink(link)
console.log('decoded weekKey:', dec?.weekKey, 'expected:', isoWeekKey(MON_NOON))
