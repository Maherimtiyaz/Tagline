import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CommandPalette } from './components/ui/CommandPalette'
import { ToastViewport } from './components/ui/Toast'

/* Code-split: the landing page (and its marketing sections), mobile app,
   demo environment, and routed workspace all load on demand so the initial
   bundle stays lean — framer-motion + lucide only ship when a route needs
   them. */
const LandingLazy = lazy(() => import('./features/marketing/LandingPage').then((m) => ({ default: m.LandingPage })))
const MobileLazy = lazy(() => import('./features/mobile/MobileApp').then((m) => ({ default: m.MobileApp })))
const DemoLazy = lazy(() => import('./features/demo/DemoPage').then((m) => ({ default: m.DemoPage })))
const InboxLazy = lazy(() => import('./features/workspace/InboxPage').then((m) => ({ default: m.InboxPage })))
const HistoryLazy = lazy(() => import('./features/workspace/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const CollectionsLazy = lazy(() => import('./features/collections/CollectionsPage').then((m) => ({ default: m.CollectionsPage })))
const TemplatesLazy = lazy(() => import('./features/templates/TemplatesPage').then((m) => ({ default: m.TemplatesPage })))
const SettingsLazy = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const EditorLazy = lazy(() => import('./features/thoughts/ThoughtEditor').then((m) => ({ default: m.ThoughtEditor })))

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <p className="flex items-center gap-2 font-mono text-xs text-ink-subtle">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
        loading...
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Global overlays + routed app screens                                */
/* ------------------------------------------------------------------ */
function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

function Overlays() {
  const navigate = useNavigate()
  return (
    <>
      <CommandPalette onNavigate={navigate} />
      <ToastViewport />
    </>
  )
}

/** Routed /app screens — inbox views and the focused thought editor. */
function InboxScreen({ view }: { view?: 'inbox' | 'workspace' | 'drafts' }) {
  return <Shell><InboxLazy view={view ?? 'inbox'} /></Shell>
}

function EditorScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const close = () => navigate('/app')
  if (!id) return <InboxScreen />
  return <Shell><EditorLazy thoughtId={id} onClose={close} /></Shell>
}

export default function App() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingLazy />} />
          <Route path="/demo" element={<DemoLazy />} />
          <Route path="/templates" element={<TemplatesLazy inApp={false} />} />
          <Route path="/app" element={<InboxScreen />} />
          <Route path="/app/thought/:id" element={<EditorScreen />} />
          <Route path="/app/workspace" element={<InboxScreen view="workspace" />} />
          <Route path="/app/drafts" element={<InboxScreen view="drafts" />} />
          <Route path="/app/history" element={<Shell><HistoryLazy /></Shell>} />
          <Route path="/app/templates" element={<Shell><TemplatesLazy inApp /></Shell>} />
          <Route path="/app/collections" element={<Shell><CollectionsLazy /></Shell>} />
          <Route path="/app/collections/:id" element={<Shell><CollectionsLazy /></Shell>} />
          <Route path="/app/settings" element={<Shell><SettingsLazy inApp /></Shell>} />
          <Route path="/mobile" element={<MobileLazy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Overlays />
    </>
  )
}
