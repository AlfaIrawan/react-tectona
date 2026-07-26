import { 
  LayoutDashboard, 
  Settings, 
  FolderOpen,
  Shield,
  ChevronLeft, 
  ChevronRight,
  Zap,
  CalendarClock,
  CalendarRange,
  ListChecks,
  Network,
  BellRing,
  Users,
  ShieldCheck,
  BarChart3,
  BookOpenText,
  ArrowRightLeft,
  Lock,
  BrainCircuit,
  Lightbulb,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocation, useNavigate } from 'react-router-dom'
import { useModuleAccess, type ModuleId } from '@/auth/useModuleAccess'

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  path: string
  /** Short capability caption shown under the label when the sidebar is expanded. */
  caption?: string
  moduleId: ModuleId
}

// HYBRID INFORMATION ARCHITECTURE
// Sidebar contains ONLY enterprise-level and global oversight views
// All operational objects (Connectors, Runs, Deployments) are Project-scoped
// Models and Feedback have dual views: global (read-only) and project (operational)
const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Workspace Management', path: '/workspace-management', caption: 'Workspace membership & participation', moduleId: 'workspace' },
  { icon: Shield, label: 'Enterprise Governance Model', path: '/enterprise-governance-model', moduleId: 'enterprise_governance_model' },
  { icon: FolderOpen, label: 'Project', path: '/projects', moduleId: 'project' },
  { icon: CalendarRange, label: 'Idea & Backlog', path: '/idea-backlog', moduleId: 'idea_backlog' },
  { icon: ListChecks, label: 'Task & Work Management', path: '/task-work-management', moduleId: 'task_work' },
  { icon: CalendarClock, label: 'Planning & Scheduling', path: '/planning-scheduling', moduleId: 'planning' },
  { icon: Network, label: 'Workflow & Automation Engine', path: '/workflow-automation-engine', moduleId: 'workflow' },
  { icon: Users, label: 'Resource Management', path: '/resource-management', caption: 'Resource capacity & delivery allocation', moduleId: 'resource' },
  { icon: ShieldCheck, label: 'Execution Portfolio & Delivery Governance', path: '/portfolio-governance-management', moduleId: 'portfolio_governance' },
  { icon: BarChart3, label: 'Reporting & Analytics', path: '/reporting-analytics', moduleId: 'reporting' },
  { icon: BookOpenText, label: 'Document & Knowledge Management', path: '/document-knowledge-management', moduleId: 'document_knowledge' },
  { icon: ArrowRightLeft, label: 'Integration & API Platform', path: '/integration-api-platform', moduleId: 'integration_api' },
  { icon: Lock, label: 'Security & Access Control', path: '/security-access-control', caption: 'Operational governance', moduleId: 'security_access' },
  { icon: BrainCircuit, label: 'AI Project Intelligence', path: '/ai-project-intelligence', moduleId: 'ai_project' },
  { icon: Lightbulb, label: 'AI Idea & Prioritization Intelligence', path: '/ai-idea-prioritization-intelligence', moduleId: 'ai_idea' },
  { icon: Settings, label: 'Platform Settings & Administration', path: '/platform-settings-administration', caption: 'Foundation configuration', moduleId: 'platform_settings' },
]

// FUTURE MODULES (commented - not visible in UI):
// These will be implemented in future modules:
// - Delivery module (project execution details)
// - System/Cross-cutting Module enhancements
// - Analytics (Module 3)
// - Reports (Module 4)
// - Engines Management (Module 5)
// - Data Sources (Module 6)
// - Models (Module 7)
// - History (Module 8)
//
// const futureNavItems: NavItem[] = [
//   { icon: BarChart3, label: 'Analytics', path: '/analytics' },
//   { icon: FileText, label: 'Reports', path: '/reports' },
//   { icon: Cpu, label: 'Engines', path: '/engines' },
//   { icon: Database, label: 'Data Sources', path: '/data' },
//   { icon: FolderOpen, label: 'Projects', path: '/projects' },
//   { icon: History, label: 'History', path: '/history' },
// ]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const access = useModuleAccess()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen glass-sidebar transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-12 px-2 border-b border-gray-200">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Zap className="h-4 w-4 text-blue-500" />
              </div>
              <h1 className="text-sm font-semibold text-gray-900">Tectona</h1>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {navItems.filter((i) => access.canAccess(i.moduleId)).map((item) => {
            const Icon = item.icon

            let isActive = false
            if (item.path === '/enterprise-governance-model' && location.pathname.startsWith('/enterprise-governance-model')) {
              isActive = true
            } else if (item.path === '/platform-settings-administration') {
              isActive = location.pathname.startsWith('/platform-settings-administration') || location.pathname === '/settings'
            } else if (location.pathname === item.path) {
              isActive = true
            } else if (item.path === '/workspace-management' && location.pathname.startsWith('/workspace-management')) {
              isActive = true
            } else if (item.path === '/projects' && location.pathname.startsWith('/projects') && !location.pathname.match(/^\/projects\/[^/]+\//)) {
              isActive = true
            } else if (item.path === '/project-management' && location.pathname.startsWith('/project-management')) {
              isActive = true
            } else if (item.path === '/idea-backlog' && (location.pathname.startsWith('/idea-backlog') || location.pathname.startsWith('/roadmap'))) {
              isActive = true
            } else if (item.path === '/task-work-management' && location.pathname.startsWith('/task-work-management')) {
              isActive = true
            } else if (
              item.path === '/planning-scheduling' &&
              (location.pathname.startsWith('/planning-scheduling') || location.pathname.startsWith('/risks'))
            ) {
              isActive = true
            } else if (item.path === '/workflow-automation-engine' && location.pathname.startsWith('/workflow-automation-engine')) {
              isActive = true
            } else if (
              item.path === '/resource-management' &&
              (location.pathname.startsWith('/resource-management') || location.pathname.startsWith('/resources'))
            ) {
              isActive = true
            } else if (item.path === '/portfolio-governance-management' && location.pathname.startsWith('/portfolio-governance-management')) {
              isActive = true
            } else if (item.path === '/reporting-analytics' && location.pathname.startsWith('/reporting-analytics')) {
              isActive = true
            } else if (item.path === '/document-knowledge-management' && location.pathname.startsWith('/document-knowledge-management')) {
              isActive = true
            } else if (item.path === '/integration-api-platform' && location.pathname.startsWith('/integration-api-platform')) {
              isActive = true
            } else if (item.path === '/security-access-control' && location.pathname.startsWith('/security-access-control')) {
              isActive = true
            } else if (item.path === '/ai-project-intelligence' && location.pathname.startsWith('/ai-project-intelligence')) {
              isActive = true
            } else if (item.path === '/ai-idea-prioritization-intelligence' && location.pathname.startsWith('/ai-idea-prioritization-intelligence')) {
              isActive = true
            }

            return (
              <button
                key={`${item.path}-${item.label}`}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full transition-all',
                  collapsed
                    ? 'flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-md'
                    : 'flex items-center gap-2 p-1.5 rounded-md',
                  'text-xs font-medium hover:bg-gray-50',
                  isActive
                    ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {collapsed ? (
                  <span className="text-[10px] leading-none text-gray-600">
                    {item.label}
                  </span>
                ) : (
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block leading-snug">{item.label}</span>
                    {item.caption ? (
                      <span className="mt-0.5 block text-[10px] font-normal leading-snug text-gray-500">{item.caption}</span>
                    ) : null}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-2 border-t border-border/20">
          {!collapsed && (
            <div className="text-[10px] text-muted-foreground">
              <div className="font-medium text-foreground text-xs">v1.0.0</div>
              <div className="text-[10px] mt-0.5 opacity-70">Module 1: Core Shell</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
