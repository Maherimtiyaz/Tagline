import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CommandPalette } from './components/ui/CommandPalette'
import { ToastViewport } from './components/ui/Toast'
import { LandingPage } from './features/marketing/LandingPage'
import { MobileApp } from './features/mobile/MobileApp'
import {
  InboxRoute,
  WorkspaceRoute,
  DraftsRoute,
  EditorRoute,
  HistoryRoute,
  TemplatesRoute,
  SettingsRoute,
  CollectionsRoute,
} from './features/app/AppRoutes'

/* Code-split: the three-panel demo environment is a separate chunk. */
const DemoLazy = lazy(() => import('./features/demo/DemoPage').then((m) => ({ default: m.DemoPage })))

function DemoFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <p className="flex items-center gap-2 font-mono text-xs text-ink-subtle">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
        loading demo...
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

export default function App() {
  return (
    <>
      <Suspense fallback={<DemoFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<DemoLazy />} />
          <Route path="/templates" element={<TemplatesRoute />} />
          <Route path="/app" element={<Shell><InboxRoute /></Shell>} />
          <Route path="/app/new" element={<Shell><EditorRoute /></Shell>} />
          <Route path="/app/thought/:id" element={<Shell><EditorRoute /></Shell>} />
          <Route path="/app/workspace" element={<Shell><WorkspaceRoute /></Shell>} />
          <Route path="/app/drafts" element={<Shell><DraftsRoute /></Shell>} />
          <Route path="/app/history" element={<Shell><HistoryRoute /></Shell>} />
          <Route path="/app/templates" element={<Shell><TemplatesRoute /></Shell>} />
          <Route path="/app/collections" element={<Shell><CollectionsRoute /></Shell>} />
          <Route path="/app/collections/:id" element={<Shell><CollectionsRoute /></Shell>} />
          <Route path="/app/settings" element={<Shell><SettingsRoute /></Shell>} />
          <Route path="/mobile" element={<MobileApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Overlays />
    </>
  )
}
