import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  Calendar,
  ClipboardList,
  FileText,
  FolderGit2,
  GanttChart,
  Inbox,
  Kanban,
  List,
  ListChecks,
  Network,
  Rocket,
  Shield,
  Package,
} from 'lucide-react'

export type ProjectPanelKey =
  | 'summary'
  | 'timeline'
  | 'board'
  | 'calendar'
  | 'list'
  | 'docs'
  | 'archived'
  | 'deployments'
  | 'inbox'
  | 'releases'
  | 'security'
  | 'repositories'
  | 'blueprint'
  | 'scenarios'

export type ProjectPanelCatalogEntry = {
  key: ProjectPanelKey
  label: string
  icon: LucideIcon
  description: string
  /** Optional hero illustration for Views catalog detail pane. */
  illustrationSrc?: string
  /** Summary stays pinned in navigation. */
  pinned?: boolean
}

const PROJECT_SECTION_ILLUSTRATION_BASE = '/images/project-templates-section'

export const PROJECT_PANEL_CATALOG: ProjectPanelCatalogEntry[] = [
  {
    key: 'summary',
    label: 'Summary',
    icon: ClipboardList,
    description: 'Delivery health, milestones, and executive snapshot for this project workspace.',
    pinned: true,
  },
  {
    key: 'timeline',
    label: 'Timeline',
    icon: GanttChart,
    description: 'Schedule-first view for phases, dependencies, and delivery sequencing.',
  },
  {
    key: 'board',
    label: 'Board',
    icon: Kanban,
    description: 'Kanban flow for status transitions, WIP limits, and sprint execution.',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Day-based planning with drag-reschedule and calendar context actions.',
  },
  {
    key: 'list',
    label: 'List',
    icon: List,
    description: 'Flat work-item directory with filters, bulk actions, and quick edits.',
  },
  {
    key: 'docs',
    label: 'Docs',
    icon: FileText,
    description: 'Project knowledge base, BRD links, and delivery documentation hub.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/document.png`,
  },
  {
    key: 'archived',
    label: 'Archived',
    icon: Archive,
    description: 'Closed or archived work items kept for audit without cluttering active views.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/archive.png`,
  },
  {
    key: 'deployments',
    label: 'Deployments',
    icon: Rocket,
    description: 'Release pipeline visibility, environment promotion, and deployment history.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/deployment.png`,
  },
  {
    key: 'inbox',
    label: 'Inbox',
    icon: Inbox,
    description:
      'Let partner teams route work items into this project. The inbox appears as a forwarding destination in workspace tools, so incoming requests and assignments land in one triage queue for your delivery team.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/inbox.png`,
  },
  {
    key: 'releases',
    label: 'Releases',
    icon: Package,
    description: 'Version trains, release notes, and cut-line tracking across milestones.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/release.png`,
  },
  {
    key: 'security',
    label: 'Security',
    icon: Shield,
    description: 'Compliance posture, vulnerability findings, and security gate evidence.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/security.png`,
  },
  {
    key: 'repositories',
    label: 'Repositories',
    icon: FolderGit2,
    description:
      'Connect and manage multiple code repositories linked to this project for integration and traceability.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/repositories.png`,
  },
  {
    key: 'blueprint',
    label: 'Blueprint',
    icon: Network,
    description:
      'Analyze linked repositories and generate UML (Use Case, Sequence, ERD) plus high-level ArchiMate architecture views for integration fit.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/blueprint.png`,
  },
  {
    key: 'scenarios',
    label: 'Scenarios',
    icon: ListChecks,
    description: 'Define, execute, and review scenario-based tests for this project delivery.',
    illustrationSrc: `${PROJECT_SECTION_ILLUSTRATION_BASE}/scenarios.png`,
  },
]

export const DEFAULT_PROJECT_NAV_SECTIONS: ProjectPanelKey[] = [
  'summary',
  'timeline',
  'board',
  'calendar',
  'list',
  'docs',
  'archived',
]

const catalogByKey = new Map(PROJECT_PANEL_CATALOG.map((entry) => [entry.key, entry]))
const catalogKeySet = new Set(PROJECT_PANEL_CATALOG.map((entry) => entry.key))

export function getProjectPanelCatalogEntry(key: ProjectPanelKey): ProjectPanelCatalogEntry {
  const entry = catalogByKey.get(key)
  if (!entry) {
    return {
      key,
      label: key,
      icon: FileText,
      description: 'Project section',
    }
  }
  return entry
}

export function resolveProjectNavSections(saved: ProjectPanelKey[] | undefined): ProjectPanelKey[] {
  if (!saved?.length) {
    return [...DEFAULT_PROJECT_NAV_SECTIONS]
  }

  // Migration: very old persisted state only ever had these four core sections — treat it as
  // "never customized" and upgrade to the current default set instead of preserving it verbatim.
  const legacyCore: ProjectPanelKey[] = ['summary', 'timeline', 'board', 'calendar']
  const isLegacyCoreOnly =
    saved.length === legacyCore.length && legacyCore.every((key) => saved.includes(key))
  if (isLegacyCoreOnly) {
    return [...DEFAULT_PROJECT_NAV_SECTIONS]
  }

  // Otherwise the saved order is authoritative (e.g. user drag-and-drop reordering) — just drop
  // any keys that no longer exist in the catalog and make sure "summary" is always present.
  const base = saved.filter((key) => catalogKeySet.has(key))
  if (!base.includes('summary')) base.unshift('summary')
  return base
}
