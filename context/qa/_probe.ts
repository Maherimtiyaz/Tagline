import { useAppStore } from '../src/lib/store'

const s = useAppStore.getState()
s.resetDemo()
console.log('thought count:', s.thoughts.length)
for (const t of s.thoughts) {
  console.log(
    t.id,
    '| status:', t.status,
    '| pinned:', !!t.pinned,
    '| starred:', !!t.starred,
    '| tags:', JSON.stringify(t.tags ?? null),
  )
}
