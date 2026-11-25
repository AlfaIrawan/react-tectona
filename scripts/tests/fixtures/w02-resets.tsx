import { startTransition, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { ProjectInboxPanel } from '@/modules/projects/components/ProjectInboxPanel'
import type { ProjectInboxRouteApiModel, WorkItemApiModel } from '@/lib/api/workApi'
import { useFixtureWorkflowLink, MeetingPeopleMultiSelect, AssistantTypewriterText } from 'virtual:w02-resets'

const items = Array.from({ length: 70 }, (_, index): WorkItemApiModel => ({
  id: 'fixture-' + index, title: 'Fixture request ' + index, type: 'Task', priority: 'Medium',
  project: 'Fixture', workspace: 'fixture', assignee: '', owner: '', role: '', team: '',
  status: 'Backlog', dueDate: '', dependencyStatus: '', progress: 0, estimatedHours: 0,
  actualHours: 0, lastUpdated: '', description: '',
}))
const routes: ProjectInboxRouteApiModel[] = items.map(({ id }) => ({
  businessKey: id, status: 'pending', routedAt: '2026-01-01T00:00:00Z',
  sourceTeam: 'Fixture team', routedBy: 'Fixture owner', sourceChannel: 'team',
}))

function InboxFixture() {
  const [projectId, setProjectId] = useState('project-a')
  const [count, setCount] = useState(70)
  const [loading, setLoading] = useState(false)
  const current = items.slice(0, count)
  return <section aria-label="Inbox fixture">
    <button onClick={() => setCount(40)}>Shrink inbox</button>
    <button onClick={() => setCount(70)}>Restore inbox</button>
    <button onClick={() => setLoading((value) => !value)}>Toggle loading</button>
    <button onClick={() => {
      startTransition(() => setCount(40))
      setProjectId('project-b')
      setCount(70)
    }}>Switch project with stale update</button>
    <ToastProvider><ProjectInboxPanel
      project={{ id: projectId, name: 'Fixture', status: 'active', createdAt: '', updatedAt: '' }}
      workItems={current} loading={loading} inboxRoutes={routes}
      pendingInboxKeys={new Set(current.map(({ id }) => id))}
      onOverlayChange={() => { throw new Error('Unexpected write') }}
      usesOverlayApi={false} usesApiItems={false} ownerName="Fixture owner"
    /></ToastProvider>
  </section>
}

function WorkflowFixture() {
  const [builder, setBuilder] = useFixtureWorkflowLink()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const action = useNavigationType()
  return <section aria-label="Workflow fixture">
    <output aria-label="Workflow URL">{action} {pathname}{search}</output>
    <button onClick={() => navigate('/workflow?workflow=first&view=runs&run=one')}>First workflow</button>
    <button onClick={() => {
      startTransition(() => navigate('/workflow?workflow=stale&run=old'))
      navigate('/workflow?workflow=latest&view=unknown&run=new', { replace: true })
    }}>Competing workflow links</button>
    <button onClick={() => navigate(-1)}>Workflow back</button>
    {builder.open && <div role="dialog" aria-label="Workflow builder">
      <output>{builder.workflowId} {builder.view} {builder.runId}</output>
      <button onClick={() => setBuilder({ open: false, workflowId: null })}>Close workflow builder</button>
    </div>}
  </section>
}

const members = [
  { subjectId: 'alice', displayName: 'Fixture Alice', roleLabel: 'Member' },
  { subjectId: 'taylor', displayName: 'Fixture Taylor', roleLabel: 'Member' },
]
function KnowledgeFixture() {
  const [active, setActive] = useState(true)
  const [selectedIds, setSelectedIds] = useState(['alice'])
  return <section aria-label="Knowledge fixture">
    <button onClick={() => setActive((value) => !value)}>Toggle meeting picker</button>
    <MeetingPeopleMultiSelect active={active} options={members} selectedIds={selectedIds} onChange={setSelectedIds} />
  </section>
}

function ChatFixture() {
  const [messageId, setMessageId] = useState('empty')
  const [completed, setCompleted] = useState<string[]>([])
  return <section aria-label="Chat fixture">
    <button onClick={() => setMessageId('first')}>Start Chat fixture</button>
    <button onClick={() => setMessageId('second')}>Replace with identical Chat text</button>
    <button onClick={() => setMessageId('instant')}>Show instant Chat message</button>
    <button onClick={() => setMessageId('empty')}>Clear Chat message</button>
    <output>Active message: {messageId}</output>
    <output>Completed: {completed.join(',')}</output>
    <AssistantTypewriterText text={messageId === 'empty' ? '' : 'x'} messageId={messageId}
      speed={messageId === 'instant' ? 'instant' : 'fast'} renderMarkdown
      onTypingComplete={(id: string) => setCompleted((current) => [...current, id])}
    />
  </section>
}

createRoot(document.getElementById('root')!).render(<StrictMode>
  <InboxFixture />
  <MemoryRouter initialEntries={['/workflow?view=runs']}><WorkflowFixture /></MemoryRouter>
  <KnowledgeFixture />
  <ChatFixture />
</StrictMode>)
