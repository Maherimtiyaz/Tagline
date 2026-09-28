import { useParams } from 'react-router-dom'
import { InboxPage } from '../workspace/InboxPage'
import { HistoryPage } from '../workspace/HistoryPage'
import { CollectionsPage } from '../collections/CollectionsPage'
import { TemplatesPage } from '../templates/TemplatesPage'
import { SettingsPage } from '../settings/SettingsPage'
import { ThoughtEditor } from '../thoughts/ThoughtEditor'

/* ============================================================
   Routed app screens. The thought editor is rendered inline in
   place of the inbox list so the sidebar context never shifts;
   ESC / back returns to the inbox.
   ============================================================ */

export function InboxRoute() {
  return <InboxPage view="inbox" />
}

export function WorkspaceRoute() {
  return <InboxPage view="workspace" />
}

export function DraftsRoute() {
  return <InboxPage view="drafts" />
}

export function EditorRoute() {
  const { id } = useParams()
  if (!id) return <InboxPage />
  return <ThoughtEditor thoughtId={id} onClose={() => window.history.back()} />
}

export function HistoryRoute() {
  return <HistoryPage />
}

export function TemplatesRoute() {
  return <TemplatesPage inApp />
}

export function SettingsRoute() {
  return <SettingsPage inApp />
}

export function CollectionsRoute() {
  const { id } = useParams()
  return <CollectionsPage collectionId={id} />
}

/* DemoRoute removed — /demo is lazy-loaded directly in App.tsx */
