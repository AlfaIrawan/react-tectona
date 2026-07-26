import { useNavigate, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  LayoutDashboard,
  FolderOpen,
  CalendarClock,
  CalendarRange,
  ListChecks,
  Network,
  BellRing,
  Users,
  Shield,
  ShieldCheck,
  BarChart3,
  BookOpenText,
  ArrowRightLeft,
  Lock,
  BrainCircuit,
  Lightbulb,
  Settings,
  Grid3x3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useModuleAccess, type ModuleId } from '@/auth/useModuleAccess'

interface AppLauncherItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  path: string
  moduleId: ModuleId
}

const ROWS_PER_COLUMN = 6

// Map existing navigation items to app launcher format
const existingNavItems: AppLauncherItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Workspace',
    description: 'Workspace governance, lifecycle, access, and portfolio control',
    path: '/workspace-management',
    moduleId: 'workspace',
  },
  {
    icon: FolderOpen,
    label: 'Project',
    description: 'Browse projects across your instance',
    path: '/projects',
    moduleId: 'project',
  },
  {
    icon: CalendarRange,
    label: 'Idea & Backlog Management',
    description: 'Demand intake, scoring, prioritization, and conversion to execution',
    path: '/idea-backlog',
    moduleId: 'idea_backlog',
  },
  {
    icon: ListChecks,
    label: 'Task & Work Management',
    description: 'Structured execution control for tasks, dependencies, workflow, workload, and delivery activity',
    path: '/task-work-management',
    moduleId: 'task_work',
  },
  {
    icon: CalendarClock,
    label: 'Planning & Scheduling',
    description: 'Central planning control for timelines, sprints, calendars, capacity, and delivery predictability',
    path: '/planning-scheduling',
    moduleId: 'planning',
  },
  {
    icon: Network,
    label: 'Workflow & Automation Engine',
    description: 'Operational control layer for workflows, approvals, triggers, state transitions, and automation governance',
    path: '/workflow-automation-engine',
    moduleId: 'workflow',
  },
  {
    icon: Users,
    label: 'Resource Management',
    description: 'Operational staffing control for resource allocation, skills matching, capacity planning, workload balancing, and utilization governance',
    path: '/resource-management',
    moduleId: 'resource',
  },
  {
    icon: ShieldCheck,
    label: 'Execution Portfolio & Delivery Governance',
    description: 'PMO delivery governance for execution oversight, initiative coordination, stage gates, operational risk, compliance telemetry, and audit traceability',
    path: '/portfolio-governance-management',
    moduleId: 'portfolio_governance',
  },
  {
    icon: Shield,
    label: 'Enterprise Governance Model',
    description:
      'Define reusable governance templates, workflow standards, SLA policies, approval models, naming conventions, and compliance rules used across enterprise execution',
    path: '/enterprise-governance-model',
    moduleId: 'enterprise_governance_model',
  },
  {
    icon: BarChart3,
    label: 'Reporting & Analytics',
    description: 'Executive and operational reporting for performance visibility, delivery health, resource utilization, SLA compliance, trend analysis, and exportable decision support',
    path: '/reporting-analytics',
    moduleId: 'reporting',
  },
  {
    icon: BookOpenText,
    label: 'Document & Knowledge Management',
    description: 'Controlled documents, templates, notes, reusable content, version lineage, and knowledge assets linked directly to project execution context',
    path: '/document-knowledge-management',
    moduleId: 'document_knowledge',
  },
  {
    icon: ArrowRightLeft,
    label: 'Integration & API Platform',
    description: 'Enterprise connectivity control for APIs, webhooks, external systems, event streams, integration security, payload mapping, and runtime monitoring',
    path: '/integration-api-platform',
    moduleId: 'integration_api',
  },
  {
    icon: Lock,
    label: 'Security & Access Control',
    description: 'Central security control center for RBAC, fine-grained permissions, SSO integration, scoped access reviews, masking policy, compliance posture, and audit traceability',
    path: '/security-access-control',
    moduleId: 'security_access',
  },
  {
    icon: BrainCircuit,
    label: 'AI Project Intelligence',
    description: 'AI-native execution cockpit for task generation, predictive delivery intelligence, next best actions, resource recommendations, explainability, and governed AI approvals',
    path: '/ai-project-intelligence',
    moduleId: 'ai_project',
  },
  {
    icon: Lightbulb,
    label: 'AI Idea & Prioritization Intelligence',
    description: 'AI decision cockpit for idea intake, classification, scoring, prioritization, strategic fit assessment, execution routing, and governed portfolio recommendation',
    path: '/ai-idea-prioritization-intelligence',
    moduleId: 'ai_idea',
  },
  {
    icon: Settings,
    label: 'Platform Settings & Administration',
    description: 'Central administrative control center for organizations, users, teams, workflows, templates, fields, preferences, and environment governance',
    path: '/platform-settings-administration',
    moduleId: 'platform_settings',
  },
]

const launcherColumns = Array.from({ length: 3 }, (_, index) =>
  existingNavItems.slice(index * ROWS_PER_COLUMN, (index + 1) * ROWS_PER_COLUMN)
)

export function AppLauncher() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const access = useModuleAccess()

  const handleItemClick = (path: string) => {
    navigate(path)
    setOpen(false)
  }

  const isItemActive = (path: string) =>
    location.pathname === path ||
    (path === '/projects' && location.pathname.startsWith('/projects')) ||
    (path === '/project-management' && location.pathname.startsWith('/project-management')) ||
    (path === '/idea-backlog' && (location.pathname.startsWith('/idea-backlog') || location.pathname.startsWith('/roadmap'))) ||
    (path === '/task-work-management' && location.pathname.startsWith('/task-work-management')) ||
    (path === '/planning-scheduling' && (location.pathname.startsWith('/planning-scheduling') || location.pathname.startsWith('/risks'))) ||
    (path === '/workflow-automation-engine' && location.pathname.startsWith('/workflow-automation-engine')) ||
    (path === '/resource-management' && (location.pathname.startsWith('/resource-management') || location.pathname.startsWith('/resources'))) ||
    (path === '/portfolio-governance-management' && location.pathname.startsWith('/portfolio-governance-management')) ||
    (path === '/enterprise-governance-model' && location.pathname.startsWith('/enterprise-governance-model')) ||
    (path === '/reporting-analytics' && location.pathname.startsWith('/reporting-analytics')) ||
    (path === '/document-knowledge-management' && location.pathname.startsWith('/document-knowledge-management')) ||
    (path === '/integration-api-platform' && location.pathname.startsWith('/integration-api-platform')) ||
    (path === '/security-access-control' && location.pathname.startsWith('/security-access-control')) ||
    (path === '/ai-project-intelligence' && location.pathname.startsWith('/ai-project-intelligence')) ||
    (path === '/ai-idea-prioritization-intelligence' && location.pathname.startsWith('/ai-idea-prioritization-intelligence')) ||
    (path === '/platform-settings-administration' &&
      (location.pathname.startsWith('/platform-settings-administration') || location.pathname === '/settings'))

  const visibleColumns = useMemo(() => {
    const allowedItems = existingNavItems.filter((i) => access.canAccess(i.moduleId))
    const cols = Array.from({ length: 3 }, (_, index) =>
      allowedItems.slice(index * ROWS_PER_COLUMN, (index + 1) * ROWS_PER_COLUMN)
    )
    return cols
  }, [access, access.maxWorkspaceRole, access.isPlatformAdmin])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="topbar-action-btn hover:bg-gray-100/80 rounded-lg transition-all duration-200"
          aria-label="Open app launcher"
        >
          <Grid3x3 className="h-4 w-4 text-gray-700 topbar-action-icon" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          'w-[960px] max-w-[calc(100vw-2rem)] p-0 !glass-card app-launcher-content',
          '!border border-gray-200/80 !shadow-2xl rounded-xl',
          'mt-2 right-0 overflow-hidden',
          '!backdrop-blur-xl !bg-white'
        )}
        style={{
          backgroundColor: 'rgba(255,255,255,0.98)',
          color: '#0f172a',
          backdropFilter: 'none',
        }}
      >
        <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
          {visibleColumns.map((columnItems, columnIndex) => (
            <div
              key={`column-${columnIndex}`}
              className={cn('flex flex-col', columnIndex < visibleColumns.length - 1 && 'border-r border-gray-200/60')}
            >
              {columnItems.map((item, index) => {
                const Icon = item.icon
                const isActive = isItemActive(item.path)

                return (
                  <button
                    key={`${columnIndex}-${index}-${item.path}`}
                    onClick={() => handleItemClick(item.path)}
                    className={cn(
                      'flex items-start gap-4 p-5 transition-all duration-200',
                      'text-left group relative',
                      'border-b border-gray-100 last:border-b-0',
                      'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent',
                      isActive && 'bg-gradient-to-r from-blue-50 to-transparent'
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                    )}

                    <div
                      className={cn(
                        'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
                        'transition-all duration-200',
                        'bg-gradient-to-br from-gray-100 to-gray-50',
                        'border border-gray-200/60',
                        'group-hover:from-blue-50 group-hover:to-blue-100/50',
                        'group-hover:border-blue-200/60',
                        'group-hover:scale-105',
                        isActive && 'from-blue-100 to-blue-50 border-blue-200'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5 transition-colors duration-200 text-slate-700',
                          'group-hover:text-blue-600',
                          isActive && 'text-blue-600'
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div
                        className={cn(
                          'font-semibold text-sm mb-1 text-slate-900',
                          'group-hover:text-blue-700 transition-colors duration-200',
                          isActive && 'text-blue-700'
                        )}
                      >
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {item.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
