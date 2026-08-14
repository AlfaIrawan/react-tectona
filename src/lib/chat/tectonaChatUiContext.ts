/**
 * Resolve current Tectona UI location + page snapshot for Gen AI assistant.
 */

import { getSession } from '@/auth/authService'
import { useActiveProjectStore } from '@/stores/active-project-store'
import {
  useTectonaPageContextStore,
  type TectonaPageContextSnapshot,
} from '@/stores/tectona-page-context-store'

export type TectonaUiContextPayload = {
  pathname: string
  search?: string | null
  page_title: string
  module_label: string
  view_label?: string | null
  entity_type?: string | null
  entity_id?: string | null
  entity_title?: string | null
  entity_status?: string | null
  workspace_code?: string | null
  workspace_name?: string | null
  project_id?: string | null
  user_display_name?: string | null
  chat_panel_open?: boolean | null
  chat_screen?: string | null
  active_conversation_title?: string | null
  active_conversation_mode?: string | null
  filters_summary?: string | null
  selection_summary?: string | null
  data_summary?: string | null
  extra_notes?: string[]
  preferred_language?: string | null
}

type RouteEntry = {
  prefix: string
  module_label: string
  page_title: string
}

const ROUTE_ENTRIES: RouteEntry[] = [
  { prefix: '/workspace-management', module_label: 'Workspace Management', page_title: 'Workspace Management' },
  { prefix: '/governance-configuration', module_label: 'Governance Configuration', page_title: 'Governance Configuration Center' },
  { prefix: '/enterprise-governance-model', module_label: 'Enterprise Governance Model', page_title: 'Enterprise Governance Model' },
  { prefix: '/projects', module_label: 'Project', page_title: 'Daftar Proyek' },
  { prefix: '/project-management', module_label: 'Project', page_title: 'Project Management' },
  { prefix: '/idea-backlog', module_label: 'Idea & Backlog', page_title: 'Idea & Backlog' },
  { prefix: '/task-work-management', module_label: 'Task & Work Management', page_title: 'Task & Work Management' },
  { prefix: '/planning-scheduling', module_label: 'Planning & Scheduling', page_title: 'Planning & Scheduling' },
  { prefix: '/workflow-automation-engine', module_label: 'Workflow & Automation Engine', page_title: 'Workflow & Automation Engine' },
  { prefix: '/resource-management', module_label: 'Resource Management', page_title: 'Resource Management' },
  { prefix: '/portfolio-governance-management', module_label: 'Execution Portfolio & Delivery Governance', page_title: 'Portfolio Governance' },
  { prefix: '/reporting-analytics', module_label: 'Reporting & Analytics', page_title: 'Reporting & Analytics' },
  { prefix: '/document-knowledge-management', module_label: 'Document & Knowledge Management', page_title: 'Document & Knowledge Management' },
  { prefix: '/integration-api-platform', module_label: 'Integration & API Platform', page_title: 'Integration & API Platform' },
  { prefix: '/security-access-control', module_label: 'Security & Access Control', page_title: 'Security & Access Control' },
  { prefix: '/ai-project-intelligence', module_label: 'AI Project Intelligence', page_title: 'AI Project Intelligence' },
  { prefix: '/ai-idea-prioritization-intelligence', module_label: 'AI Idea & Prioritization Intelligence', page_title: 'AI Idea Prioritization' },
  { prefix: '/platform-settings-administration', module_label: 'Platform Settings & Administration', page_title: 'Platform Settings' },
  { prefix: '/profile', module_label: 'Profil', page_title: 'Profil Pengguna' },
  { prefix: '/login', module_label: 'Login', page_title: 'Halaman Login' },
]

const EGM_SUBPAGES: Record<string, string> = {
  overview: 'Overview',
  templates: 'Templates',
  'operating-model-builder': 'Operating Model Builder',
  policies: 'Policy Catalog',
  compliance: 'Compliance',
  traceability: 'Traceability',
}

const WORKSPACE_PANEL_LABELS: Record<string, string> = {
  overview: 'Overview',
  directory: 'Directory',
  governance: 'Governance Matrix',
  members: 'Members',
}

function normalizePathname(pathname: string): string {
  const base = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '')
  return base || '/'
}

function resolveEnterpriseGovernanceTitle(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length <= 1) return 'Enterprise Governance Model'
  const section = parts[1]
  if (section === 'policies' && parts[2]) return `Policy Catalog — ${parts[2]}`
  if (section === 'compliance' && parts[2]) return `Compliance — ${parts[2]}`
  if (section === 'traceability' && parts[2]) return `Traceability — ${parts[2]}`
  const label = EGM_SUBPAGES[section]
  return label ? `Enterprise Governance Model — ${label}` : 'Enterprise Governance Model'
}

function parseSearchContext(search: string): Pick<TectonaPageContextSnapshot, 'view_label' | 'filters_summary'> {
  if (!search) return {}
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const view =
    params.get('tab') ??
    params.get('panel') ??
    params.get('view') ??
    params.get('section')
  const q = params.get('q') ?? params.get('search')
  return {
    view_label: view ? decodeURIComponent(view) : null,
    filters_summary: q ? `pencarian URL: "${decodeURIComponent(q)}"` : null,
  }
}

function mergePageSnapshot(
  base: TectonaUiContextPayload,
  page: TectonaPageContextSnapshot | null,
): TectonaUiContextPayload {
  if (!page) return base
  const notes = [...(base.extra_notes ?? []), ...(page.notes ?? [])].filter(Boolean).slice(0, 6)
  return {
    ...base,
    module_label: page.module_label ?? base.module_label,
    page_title: page.page_title ?? base.page_title,
    view_label: page.view_label ?? base.view_label,
    entity_type: page.entity_type ?? base.entity_type,
    entity_id: page.entity_id ?? base.entity_id,
    entity_title: page.entity_title ?? base.entity_title,
    entity_status: page.entity_status ?? base.entity_status,
    workspace_code: page.workspace_code ?? base.workspace_code,
    workspace_name: page.workspace_name ?? base.workspace_name,
    project_id: page.project_id ?? base.project_id,
    filters_summary: page.filters_summary ?? base.filters_summary,
    selection_summary: page.selection_summary ?? base.selection_summary,
    data_summary: page.data_summary ?? base.data_summary,
    extra_notes: notes.length > 0 ? notes : undefined,
  }
}

export function resolveTectonaUiContext(
  pathname: string,
  options?: { chatPanelOpen?: boolean },
): TectonaUiContextPayload {
  const normalized = normalizePathname(pathname)

  const ideaDetail = normalized.match(/^\/idea-backlog\/([^/]+)$/)
  if (ideaDetail) {
    return {
      pathname: normalized,
      module_label: 'Idea & Backlog',
      page_title: 'Detail Ide',
      entity_type: 'idea',
      entity_id: ideaDetail[1],
      chat_panel_open: options?.chatPanelOpen ?? null,
    }
  }

  if (normalized.startsWith('/enterprise-governance-model')) {
    return {
      pathname: normalized,
      module_label: 'Enterprise Governance Model',
      page_title: resolveEnterpriseGovernanceTitle(normalized),
      chat_panel_open: options?.chatPanelOpen ?? null,
    }
  }

  const matched = ROUTE_ENTRIES.find(
    (entry) => normalized === entry.prefix || normalized.startsWith(`${entry.prefix}/`),
  )

  if (matched) {
    return {
      pathname: normalized,
      module_label: matched.module_label,
      page_title: matched.page_title,
      chat_panel_open: options?.chatPanelOpen ?? null,
    }
  }

  return {
    pathname: normalized,
    module_label: 'Tectona',
    page_title: normalized === '/' ? 'Beranda' : normalized,
    chat_panel_open: options?.chatPanelOpen ?? null,
  }
}

export function buildTectonaUiContextForChat(options: {
  pathname: string
  search?: string
  chatPanelOpen?: boolean
  chatScreen?: string
  activeConversationTitle?: string | null
  activeConversationMode?: string | null
}): TectonaUiContextPayload {
  const session = getSession()
  const pageSnapshot = useTectonaPageContextStore.getState().snapshot
  const activeProjectId = useActiveProjectStore.getState().activeProjectId
  const searchCtx = parseSearchContext(options.search ?? '')

  let base = resolveTectonaUiContext(options.pathname, {
    chatPanelOpen: options.chatPanelOpen,
  })

  if (options.pathname.startsWith('/workspace-management') && !pageSnapshot?.view_label) {
    base = { ...base, view_label: WORKSPACE_PANEL_LABELS.overview }
  }

  base = mergePageSnapshot(base, {
    ...searchCtx,
    ...pageSnapshot,
    project_id: pageSnapshot?.project_id ?? activeProjectId,
  })

  if (session?.user?.name || session?.user?.email) {
    base.user_display_name = session.user.name ?? session.user.email ?? null
  }

  if (options.chatScreen) {
    base.chat_screen = options.chatScreen
  }
  if (options.activeConversationTitle) {
    base.active_conversation_title = options.activeConversationTitle
  }
  if (options.activeConversationMode) {
    base.active_conversation_mode = options.activeConversationMode
  }

  if (options.search?.trim()) {
    base.search = options.search.trim()
  }

  return base
}
