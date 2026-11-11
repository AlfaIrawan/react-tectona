import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { ALL_WORKSPACES_ID } from '@/lib/tenantWorkspaceScope'
import type { IdeaExtractionCandidate } from '@/lib/api/tectonaAgentRuntimeApi'
import { IdeaBacklogManagementPage } from '../pages/IdeaBacklogManagementPage'
import { useIdeaFolderStore, type IdeaBacklogFolder } from '../store/ideaFolderStore'
import { IdeaUploadReviewPanel } from './IdeaUploadReviewPanel'

const attachSource = vi.hoisted(() => vi.fn())
const pageScope = vi.hoisted(() => ({ workspaceId: '', slug: 'operations', loading: false, selectedWorkspaceIds: [] as string[] }))
const { workspace, otherWorkspace } = vi.hoisted(() => ({
  workspace: '87901e50-a1e5-4fca-9959-78a8ae333dc0',
  otherWorkspace: '7bcbfe85-dd82-4143-93d5-28c036c69744',
}))
vi.mock('@/modules/project-management/lib/attachUploadedFileToIdeaDocs', () => ({
  attachUploadedFileToIdeaDocs: attachSource,
}))
vi.mock('@/auth/authService', () => ({ getSession: () => null }))
vi.mock('@/lib/api/httpClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api/httpClient')>(),
  tectonaServiceHeaders: () => ({ 'Content-Type': 'application/json' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}))
vi.mock('@/auth/TenantContext', () => ({ useTenantContextOptional: () => pageScope }))
vi.mock('@/hooks/useMobileLayout', () => ({ useMobileLayout: () => false }))
vi.mock('@/lib/chat/useTectonaPageContextReporter', () => ({ useTectonaPageContextReporter: () => {} }))
vi.mock('@/modules/core-shell/components/AssistantMermaidBlock', () => ({ AssistantMermaidBlock: () => null }))
vi.mock('@/modules/core-shell/components/AssistantChartBlock', () => ({ AssistantChartBlock: () => null }))
vi.mock('@/modules/core-shell/hooks/useUserWorkspaceOptions', () => {
  const options = [
    { workspaceId: workspace, workspaceName: 'Operations' },
    { workspaceId: otherWorkspace, workspaceName: 'Service Desk' },
  ]
  const result = { options, loading: false, error: null }
  return { useUserWorkspaceOptions: () => result }
})

const existingIdea = '1934b0af-8940-4414-acd9-74a357407df3'
const owner = 'fcce3550-e17a-4661-9642-cc58a38f3929'
const excerpt = 'Operators receive outage notifications by email.'
const fixture = {
  title: 'Outage notification',
  category: 'Improvement',
  description: excerpt,
  confidence: 0.91,
  source_excerpt: excerpt,
  tags: ['Operations'],
  capabilities: [{ name: 'Email alerts', source_excerpt: excerpt, source_pages: [1] }],
} satisfies IdeaExtractionCandidate
const match = {
  source_kind: 'idea',
  source_id: `idea:${existingIdea}`,
  source_title: 'Existing alert dispatch',
  capability: 'Email alerts',
  relation: 'equivalent',
  same_initiative: true,
  uploaded_excerpt: excerpt,
  existing_excerpt: 'The dispatcher emails operators during outages.',
} as const
const candidate = (
  status: NonNullable<IdeaExtractionCandidate['overlap_analysis']>['status'],
  matches: NonNullable<IdeaExtractionCandidate['overlap_analysis']>['matches'] = [],
): IdeaExtractionCandidate => ({
  ...fixture,
  overlap_analysis: { status, matches, checked_sources: 1, coverage_complete: status !== 'unknown', warnings: [] },
})

let root: Root
let container: HTMLDivElement
const onIdeasCreated = vi.fn()
const onClose = vi.fn()
const transport = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', transport)
  transport.mockReset()
  attachSource.mockReset().mockResolvedValue(undefined)
  onIdeasCreated.mockClear()
  onClose.mockClear()
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function stubEndpoints(candidates: IdeaExtractionCandidate[], options: { incomplete?: boolean; pdfError?: string; jobError?: string; jobId?: string } = {}) {
  const warnings = options.incomplete ? ['PDF_IMAGE_TEXT_NOT_ANALYZED'] : []
  const jobId = options.jobId ?? 'd04-fixture'
  transport.mockImplementation(async (url, init) => {
    if (url.endsWith('/extract-idea-pdf') && init?.method === 'POST') {
      if (options.pdfError) return response({ detail: options.pdfError }, 422)
      return response({
        text: excerpt,
        coverage: { complete: !options.incomplete, warnings },
      })
    }
    if (url.endsWith('/idea-extraction-jobs') && init?.method === 'POST') {
      return response({ job_id: jobId, status: 'queued', progress_percent: 0 })
    }
    if (url.endsWith(`/idea-extraction-jobs/${jobId}`) && init?.method === 'GET') {
      return options.jobError
        ? response({ status: 'failed', error_message: options.jobError })
        : response({ status: 'completed', result: { candidates, warnings } })
    }
    if (url.endsWith('/v1/ideas') && init?.method === 'POST') {
      return response({ ...JSON.parse(String(init.body)), id: 'created-idea', created_date: '2026-11-10' })
    }
    throw new Error(`Unexpected fixture request: ${init?.method} ${url}`)
  })
}

async function render(workspaceId = workspace, isOpen = true) {
  await act(async () => root.render(createElement(
    MemoryRouter,
    { initialEntries: ['/w/operations/idea-backlog'] },
    createElement(IdeaUploadReviewPanel, { isOpen, workspaceId, currentUserId: owner, onClose, onIdeasCreated }),
  )))
}

async function renderBacklog(workspaceId: string, entry = '/w/operations/idea-backlog') {
  pageScope.workspaceId = workspaceId
  pageScope.selectedWorkspaceIds = [workspaceId]
  await act(async () => root.render(createElement(
    MemoryRouter,
    { initialEntries: [entry] },
    createElement(ToastProvider, { children: createElement(IdeaBacklogManagementPage) }),
  )))
}

function stubBacklogEndpoints() {
  stubEndpoints([candidate('no_match_in_checked_sources')])
  const uploadRoutes = transport.getMockImplementation()!
  transport.mockImplementation(async (url, init) => {
    if (url.includes('/idea-creation-policy?')) return response({ policy: null })
    if (url.includes('/idea-reviewer-policy?')) return response({ managed_by_workflow: true })
    if (url.includes('/idea-intake-checklist')) return response({ items: [] })
    if (url.includes('/idea-summary-jobs')) return response({ detail: 'Not part of this test' }, 503)
    if ((!init?.method || init.method === 'GET') && /\/(ideas|users|projects|folders)(\?|$)/.test(url)) {
      return response({ items: [], folders: [] })
    }
    return uploadRoutes(url, init)
  })
}

function pdf(name = 'synthetic-outage.pdf') {
  const doc = new jsPDF()
  doc.text(excerpt, 12, 12)
  return new File([doc.output('arraybuffer')], name, { type: 'application/pdf' })
}

async function pick(file = pdf()) {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}

function button(label: string) {
  return [...document.querySelectorAll('button')].find(node =>
    node.textContent?.trim() === label || node.getAttribute('aria-label') === label)
}

function requests(suffix: string) {
  return transport.mock.calls.filter(([url]) => url.endsWith(suffix)).map(([, init]) => init!)
}

describe('Upload Idea review with synthetic PDF and stubbed HTTP', () => {
  it('sends the PDF and evidence to the selected workspace, then creates and attaches only on confirmation', async () => {
    stubEndpoints([candidate('no_match_in_checked_sources')])
    await render()
    const file = pdf()
    await pick(file)

    const [upload] = requests('/extract-idea-pdf')
    expect(upload.body).toBeInstanceOf(FormData)
    expect((upload.body as FormData).get('file')).toEqual(file)
    expect((upload.body as FormData).get('allow_image_ocr')).toBe('false')
    expect(new Headers(upload.headers).has('Content-Type')).toBe(false)
    const [analysis] = requests('/idea-extraction-jobs')
    expect(JSON.parse(String(analysis.body))).toMatchObject({
      context: { workspace_id: workspace, user_id: owner },
      document: { document_text: excerpt, extract_method: 'pdf', extraction_coverage_complete: true },
    })
    expect(document.body.textContent).toContain('No overlap found in the checked sources')
    expect(requests('/v1/ideas')).toHaveLength(0)
    expect(attachSource).not.toHaveBeenCalled()

    await act(async () => button('Create 1 accepted idea')!.click())
    expect(requests('/v1/ideas')).toHaveLength(1)
    expect(JSON.parse(String(requests('/v1/ideas')[0].body))).toMatchObject({
      title: fixture.title, workspace_id: workspace, owner_id: owner,
    })
    expect(attachSource).toHaveBeenCalledOnce()
    expect(attachSource).toHaveBeenCalledWith(expect.objectContaining({ file, ideaId: 'created-idea', workspaceId: workspace }))
    expect(onIdeasCreated).toHaveBeenCalledOnce()
    expect(document.body.textContent).toContain('1 of 1 ideas created')
  })

  it('rejects a possible duplicate by default and links to the evidence in the current workspace', async () => {
    stubEndpoints([candidate('possible_duplicate', [match])])
    await render()
    await pick()

    expect(document.body.textContent).toContain('Possible existing idea')
    expect(document.body.textContent).toContain(match.existing_excerpt)
    expect(document.querySelector('a')?.getAttribute('href')).toBe(`/w/operations/idea-backlog/${existingIdea}`)
    expect(button('Rejected')).toBeDefined()
    expect(button('Create 0 accepted ideas')?.disabled).toBe(true)
    expect(requests('/v1/ideas')).toHaveLength(0)
  })

  it('separates capability overlap from a duplicate and shows excerpts with page references', async () => {
    stubEndpoints([candidate('partial_overlap', [{ ...match, relation: 'partial', same_initiative: false }])])
    await render()
    await pick()

    expect(document.body.textContent).toContain('Feature or capability overlap found')
    expect(document.body.textContent).toContain('Email alerts (partial)')
    expect(document.body.textContent).toContain(`Page 1: ${excerpt}`)
    expect(button('Create 1 accepted idea')?.disabled).toBe(false)
    expect(requests('/v1/ideas')).toHaveLength(0)
  })

  it('propagates incomplete PDF coverage instead of implying novelty', async () => {
    stubEndpoints([candidate('unknown')], { incomplete: true })
    await render()
    await pick()

    const [analysis] = requests('/idea-extraction-jobs')
    expect(JSON.parse(String(analysis.body)).document).toMatchObject({
      extraction_coverage_complete: false,
      extraction_warnings: ['PDF_IMAGE_TEXT_NOT_ANALYZED'],
    })
    expect(document.body.textContent).toContain('Existing-idea comparison is incomplete')
    expect(document.body.textContent).toContain('Text inside PDF images and screenshots has not been read')
    expect(document.body.textContent).not.toContain('No overlap found')
  })

  it.each([
    ['encrypted', 'PDF_ENCRYPTED', 'password-protected'],
    ['image-only without OCR', 'PDF_IMAGE_TEXT_REQUIRES_OCR', 'no readable native text'],
  ])('shows the %s PDF error and does not submit an analysis job', async (_, pdfError, expected) => {
    stubEndpoints([], { pdfError })
    await render()
    await pick()
    expect(document.body.textContent).toContain(expected)
    expect(requests('/idea-extraction-jobs')).toHaveLength(0)
    expect(requests('/v1/ideas')).toHaveLength(0)
  })

  it('rejects unsupported file extensions before any HTTP request', async () => {
    await render()
    await pick(new File(['synthetic content'], 'unsupported.txt', { type: 'text/plain' }))
    expect(document.body.textContent).toContain('Unsupported file type')
    expect(transport).not.toHaveBeenCalled()
  })

  it('explains a malformed PDF, then allows a clean retry without starting a write', async () => {
    stubEndpoints([], { pdfError: 'PDF_PARSE_FAILED' })
    await render()
    await pick(new File(['%PDF-1.7\ninvalid'], 'broken.pdf', { type: 'application/pdf' }))
    expect(document.body.textContent).toContain('The PDF could not be parsed')
    expect(requests('/idea-extraction-jobs')).toHaveLength(0)
    expect(requests('/v1/ideas')).toHaveLength(0)
    expect(attachSource).not.toHaveBeenCalled()

    stubEndpoints([candidate('partial_overlap', [{ ...match, relation: 'partial', same_initiative: false }])])
    await pick()
    expect(document.body.textContent).not.toContain('The PDF could not be parsed')
    expect(document.body.textContent).toContain('Feature or capability overlap found')
    expect(requests('/idea-extraction-jobs')).toHaveLength(1)
    expect(requests('/v1/ideas')).toHaveLength(0)
    expect(attachSource).not.toHaveBeenCalled()
  })

  it('creates and attaches only the accepted feature-overlap candidate in a mixed review', async () => {
    stubEndpoints([
      { ...candidate('possible_duplicate', [match]), title: 'Fixture duplicate' },
      { ...candidate('partial_overlap', [{ ...match, relation: 'partial', same_initiative: false }]), title: 'Fixture partial match' },
    ])
    await render()
    const file = pdf()
    await pick(file)
    expect(requests('/v1/ideas')).toHaveLength(0)
    expect(attachSource).not.toHaveBeenCalled()

    await act(async () => button('Create 1 accepted idea')!.click())
    const creates = requests('/v1/ideas')
    expect(creates).toHaveLength(1)
    expect(JSON.parse(String(creates[0].body))).toMatchObject({ title: 'Fixture partial match', workspace_id: workspace })
    expect(attachSource).toHaveBeenCalledOnce()
    expect(attachSource).toHaveBeenCalledWith(expect.objectContaining({ file, ideaId: 'created-idea', workspaceId: workspace }))
  })

  it('does not create a record when generated evidence is rejected', async () => {
    stubEndpoints([], { jobError: 'IDEA_EXTRACTION_EVIDENCE_REJECTED' })
    await render()
    await pick()
    expect(document.body.textContent).toContain('Tidak ada ide yang dibuat')
    expect(requests('/v1/ideas')).toHaveLength(0)
    expect(attachSource).not.toHaveBeenCalled()
  })

  it('does not offer creation when no candidates were found', async () => {
    stubEndpoints([])
    await render()
    await pick()
    expect(document.body.textContent).toContain('No idea candidates could be identified')
    expect(button('Upload another file')).toBeDefined()
    expect(requests('/v1/ideas')).toHaveLength(0)
  })

  it('clears old comparison results when the workspace changes', async () => {
    stubEndpoints([candidate('possible_duplicate', [match])])
    await render()
    await pick()
    expect(document.body.textContent).toContain(match.source_title)

    await render(otherWorkspace)
    expect(document.body.textContent).not.toContain(match.source_title)
    expect(document.querySelector('input[type=file]')).not.toBeNull()
    expect(requests('/v1/ideas')).toHaveLength(0)
  })

  it('does not allow batch Create to submit a candidate while its Retry is still pending', async () => {
    stubEndpoints([candidate('no_match_in_checked_sources')])
    await render()
    await pick()
    transport.mockResolvedValueOnce(response({ detail: 'Temporary create error' }, 503))
    await act(async () => button('Create 1 accepted idea')!.click())
    expect(button('Retry')).toBeDefined()

    let finishRetry!: (res: Response) => void
    transport.mockImplementationOnce(() => new Promise(resolve => { finishRetry = resolve }))
    await act(async () => button('Retry')!.click())
    const batchButton = button('Create 1 accepted idea')
    if (batchButton) await act(async () => batchButton.click())

    await act(async () => finishRetry(response({ id: 'retried-idea', title: fixture.title, workspace_id: workspace })))
    expect(requests('/v1/ideas')).toHaveLength(2)
  })
})

describe('Upload Idea workspace selection on the backlog page', () => {
  it('refreshes breadcrumbs when the same folder is renamed or reparented', async () => {
    stubBacklogEndpoints()
    const folder = (id: string, name: string, parentId?: string): IdeaBacklogFolder => ({
      id, name, parentId, workspaceId: workspace, ownerId: owner,
      ideaCount: 0, childrenCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    })
    const previous = useIdeaFolderStore.getState().folders
    const first = folder('parent-a', 'Parent A')
    const second = folder('parent-b', 'Parent B')
    const leaf = folder('folder-leaf', 'Folder draft', first.id)
    const labels = () => [...container.querySelectorAll('nav[aria-label="Breadcrumb"] > div')]
      .map((element) => element.textContent?.trim()).filter(Boolean)

    try {
      await renderBacklog(workspace, '/w/operations/idea-backlog?folder=folder-leaf')
      await act(async () => useIdeaFolderStore.setState({ folders: [first, second, leaf] }))
      expect(labels()).toEqual(['Idea & Backlog', 'Parent A', 'Folder draft'])
      await act(async () => useIdeaFolderStore.setState({ folders: [first, second, { ...leaf, name: 'Folder final' }] }))
      expect(labels()).toEqual(['Idea & Backlog', 'Parent A', 'Folder final'])
      await act(async () => useIdeaFolderStore.setState({ folders: [first, second, { ...leaf, name: 'Folder final', parentId: second.id }] }))
      expect(labels()).toEqual(['Idea & Backlog', 'Parent B', 'Folder final'])
    } finally {
      await act(async () => useIdeaFolderStore.setState({ folders: previous }))
    }
  })

  it('ignores a closed Create Idea draft, then reanalyzes and creates in the newly selected workspace', async () => {
    stubBacklogEndpoints()
    await renderBacklog(workspace)
    await act(async () => button('Create Idea')!.click())
    const destination = document.querySelector<HTMLSelectElement>('#idea-workspace')!
    expect(destination.value).toBe(workspace)
    await act(async () => {
      destination.value = otherWorkspace
      destination.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => button('Close create idea')!.click())
    expect(destination.value).toBe(otherWorkspace)

    await act(async () => button('Upload Idea')!.click())
    await pick()
    expect(JSON.parse(String(requests('/idea-extraction-jobs')[0].body)).context.workspace_id).toBe(workspace)
    expect(button('Create 1 accepted idea')).toBeDefined()

    await renderBacklog(otherWorkspace)
    expect(button('Create 1 accepted idea')).toBeUndefined()
    expect(requests('/v1/ideas')).toHaveLength(0)
    await pick()
    expect(JSON.parse(String(requests('/idea-extraction-jobs')[1].body)).context.workspace_id).toBe(otherWorkspace)
    await act(async () => button('Create 1 accepted idea')!.click())
    const [create] = requests('/v1/ideas')
    expect(JSON.parse(String(create.body)).workspace_id).toBe(otherWorkspace)
    expect(attachSource).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: otherWorkspace }))
  })

  it('requires a specific workspace before opening Upload Idea from All Workspaces', async () => {
    stubBacklogEndpoints()
    await renderBacklog(ALL_WORKSPACES_ID)
    await act(async () => button('Upload Idea')!.click())
    expect(document.body.textContent).toContain('Choose a workspace before uploading an idea.')
    expect(requests('/extract-idea-pdf')).toHaveLength(0)
    expect(requests('/idea-extraction-jobs')).toHaveLength(0)
  })

  it('does not send the file if the open panel loses its specific workspace', async () => {
    stubBacklogEndpoints()
    await renderBacklog(workspace)
    await act(async () => button('Upload Idea')!.click())
    await renderBacklog(ALL_WORKSPACES_ID)
    await pick()
    expect(document.body.textContent).toContain('Choose a workspace before uploading an idea.')
    expect(requests('/extract-idea-pdf')).toHaveLength(0)
    expect(requests('/idea-extraction-jobs')).toHaveLength(0)
  })
})

function holdRequest(suffix: string) {
  const fallback = transport.getMockImplementation()!
  let resolve!: (value: Response) => void
  const pending = new Promise<Response>(done => { resolve = done })
  transport.mockImplementation((url, init) => url.endsWith(suffix) ? pending : fallback(url, init))
  return async (value: Response) => act(async () => resolve(value))
}

const extracted = (value: string) => response({ text: value, coverage: { complete: true, warnings: [] } })
const completed = (...candidates: IdeaExtractionCandidate[]) =>
  response({ status: 'completed', result: { candidates, warnings: [] } })
const requestBody = (suffix: string, index = 0) => JSON.parse(String(requests(suffix)[index]?.body))

describe('Upload Idea interruptions', () => {
  it.each(['workspace switch', 'close and reopen'] as const)('ignores late extraction after %s', async action => {
    stubEndpoints([])
    const finish = holdRequest('/extract-idea-pdf')
    await render()
    await pick()
    const [reading] = requests('/extract-idea-pdf')
    expect(reading.signal?.aborted).toBe(false)

    if (action === 'close and reopen') {
      await act(async () => button('Close upload idea')!.click())
      expect(onClose).toHaveBeenCalledOnce()
      await render(workspace, false)
    }
    const nextWorkspace = action === 'workspace switch' ? otherWorkspace : workspace
    await render(nextWorkspace)
    expect(reading.signal?.aborted).toBe(true)
    expect(requests('/idea-extraction-jobs')).toHaveLength(0)

    stubEndpoints([fixture])
    await pick(pdf('new-file.pdf'))
    await finish(extracted('Old extraction must not start a job.'))
    expect(requests('/idea-extraction-jobs')).toHaveLength(1)
    expect(requestBody('/idea-extraction-jobs')).toMatchObject({
      context: { workspace_id: nextWorkspace },
      document: { file_name: 'new-file.pdf', document_text: excerpt },
    })
  })

  it('cancels the old analysis once on workspace switch and ignores late results and cancellation failure', async () => {
    stubEndpoints([])
    const finishPoll = holdRequest('/idea-extraction-jobs/d04-fixture')
    const finishCancel = holdRequest('/idea-extraction-jobs/d04-fixture/cancel')
    await render()
    await pick()
    expect(requests('/idea-extraction-jobs/d04-fixture')).toHaveLength(1)
    await render(otherWorkspace)
    expect(requests('/idea-extraction-jobs/d04-fixture/cancel')).toHaveLength(1)

    stubEndpoints([{ ...fixture, title: 'New workspace candidate' }], { jobId: 'new-job' })
    await pick()
    await finishPoll(completed({ ...fixture, title: 'Old workspace candidate' }))
    await finishCancel(response({ detail: 'Cancellation unavailable' }, 503))
    expect(requests('/idea-extraction-jobs/d04-fixture')).toHaveLength(1)
    expect(requestBody('/idea-extraction-jobs', 1).context.workspace_id).toBe(otherWorkspace)
    expect(document.querySelector<HTMLInputElement>('input[placeholder="Idea title"]')?.value).toBe('New workspace candidate')
    expect(document.body.textContent).not.toContain('Could not confirm stopping the analysis')
  })

  it('keeps the original polling error when cancellation also fails for the current file', async () => {
    stubEndpoints([])
    const finishPoll = holdRequest('/idea-extraction-jobs/d04-fixture')
    const finishCancel = holdRequest('/idea-extraction-jobs/d04-fixture/cancel')
    await render()
    await pick()
    await finishPoll(response({ detail: 'Analysis status unavailable' }, 503))
    await finishCancel(response({ detail: 'Cancellation unavailable' }, 503))
    expect(document.body.textContent).toContain('Analysis status unavailable')
    expect(document.body.textContent).toContain('Could not confirm stopping the analysis')
    expect(requests('/v1/ideas')).toHaveLength(0)
  })

  it('cancels a job whose start response arrives after close and reopen without polling it', async () => {
    stubEndpoints([])
    const finishStart = holdRequest('/idea-extraction-jobs')
    await render()
    await pick()
    await act(async () => button('Close upload idea')!.click())
    await render(workspace, false)
    await render()

    stubEndpoints([fixture])
    const fallback = transport.getMockImplementation()!
    transport.mockImplementation((url, init) => url.endsWith('/late-job/cancel')
      ? Promise.resolve(response({ detail: 'Cancellation unavailable' }, 503))
      : fallback(url, init))
    await pick(pdf('new-file.pdf'))
    await finishStart(response({ job_id: 'late-job', status: 'queued' }))

    expect(requests('/late-job/cancel')).toHaveLength(1)
    expect(requests('/late-job')).toHaveLength(0)
    expect(button('Create 1 accepted idea')).toBeDefined()
    expect(document.body.textContent).not.toContain('Could not confirm stopping the analysis')
  })

  it('stops unsent batch creates after a workspace switch and ignores the response already in flight', async () => {
    stubEndpoints([fixture, { ...fixture, title: 'Unsent old candidate' }])
    const finishCreate = holdRequest('/v1/ideas')
    await render()
    await pick()
    await act(async () => button('Create 2 accepted ideas')!.click())
    expect(requestBody('/v1/ideas').workspace_id).toBe(workspace)

    await render(otherWorkspace)
    stubEndpoints([fixture])
    await pick(pdf('new-workspace.pdf'))
    expect(button('Create 1 accepted idea')?.disabled).toBe(true)
    await finishCreate(response({ id: 'old-idea', workspace_id: workspace, title: fixture.title }))
    expect(requests('/v1/ideas')).toHaveLength(1)
    expect(onIdeasCreated).not.toHaveBeenCalled()
    expect(attachSource).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('ideas created')

    await act(async () => button('Create 1 accepted idea')!.click())
    expect(requestBody('/v1/ideas', 1).workspace_id).toBe(otherWorkspace)
    expect(onIdeasCreated).toHaveBeenCalledOnce()
  })

  it('does not publish a Retry response into the new workspace', async () => {
    stubEndpoints([fixture])
    await render()
    await pick()
    transport.mockResolvedValueOnce(response({ detail: 'Temporary create error' }, 503))
    await act(async () => button('Create 1 accepted idea')!.click())

    const finishRetry = holdRequest('/v1/ideas')
    await act(async () => button('Retry')!.click())
    await render(otherWorkspace)
    await finishRetry(response({ id: 'old-retry', workspace_id: workspace, title: fixture.title }))
    expect(requests('/v1/ideas')).toHaveLength(2)
    expect(onIdeasCreated).not.toHaveBeenCalled()
    expect(attachSource).not.toHaveBeenCalled()
    expect(document.querySelector('input[type=file]')).not.toBeNull()
  })
})
