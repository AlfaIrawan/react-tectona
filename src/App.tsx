import { Suspense, lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './modules/core-shell/components/AppLayout'
import { ToastProvider } from './components/ui/toast'
import { PlatformRouteLoadingFallback } from './components/loading'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppAccessGate } from './auth/AppAccessGate'
import { ModuleRouteGuard } from './auth/ModuleRouteGuard'
import { SessionProvider } from './auth/SessionProvider'
import { TectonaNavigateBridge } from './modules/core-shell/components/TectonaNavigateBridge'
import { LoginPage } from './pages/Login'
import { NoWorkspaceAccessPage } from './pages/NoWorkspaceAccessPage'
import { AccessDeniedPage } from './pages/AccessDeniedPage'

const ProfilePage = lazy(() => import('./pages/Profile').then((m) => ({ default: m.ProfilePage })))
const PlatformSettingsControlPlanePage = lazy(() =>
  import('./modules/core-shell/pages/PlatformSettingsControlPlanePage').then((m) => ({
    default: m.PlatformSettingsControlPlanePage,
  }))
)
const IdeaBacklogManagementPage = lazy(() =>
  import('./modules/project-management/pages/IdeaBacklogManagementPage').then((m) => ({
    default: m.IdeaBacklogManagementPage,
  }))
)
const IdeaDetailPage = lazy(() =>
  import('./modules/project-management/pages/IdeaDetailPage').then((m) => ({ default: m.IdeaDetailPage }))
)
const ProjectManagementPage = lazy(() =>
  import('./modules/project-management/pages/ProjectManagementPage').then((m) => ({
    default: m.ProjectManagementPage,
  }))
)
const TaskWorkManagementPage = lazy(() =>
  import('./modules/task-work-management/pages/TaskWorkManagementPage').then((m) => ({
    default: m.TaskWorkManagementPage,
  }))
)
const PlanningSchedulingPage = lazy(() =>
  import('./modules/planning-scheduling/pages/PlanningSchedulingPage').then((m) => ({
    default: m.PlanningSchedulingPage,
  }))
)
const WorkflowAutomationEnginePage = lazy(() =>
  import('./modules/workflow-automation-engine/pages/WorkflowAutomationEnginePage').then((m) => ({
    default: m.WorkflowAutomationEnginePage,
  }))
)
const ResourceManagementPage = lazy(() =>
  import('./modules/resource-management/pages/ResourceManagementPage').then((m) => ({
    default: m.ResourceManagementPage,
  }))
)
const PortfolioGovernanceManagementPage = lazy(() =>
  import('./modules/portfolio-governance-management/pages/PortfolioGovernanceManagementPage').then((m) => ({
    default: m.PortfolioGovernanceManagementPage,
  }))
)
const ReportingAnalyticsPage = lazy(() =>
  import('./modules/reporting-analytics/pages/ReportingAnalyticsPage').then((m) => ({
    default: m.ReportingAnalyticsPage,
  }))
)
const DocumentKnowledgeManagementPage = lazy(() =>
  import('./modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage').then((m) => ({
    default: m.DocumentKnowledgeManagementPage,
  }))
)
const IntegrationApiPlatformPage = lazy(() =>
  import('./modules/integration-api-platform/pages/IntegrationApiPlatformPage').then((m) => ({
    default: m.IntegrationApiPlatformPage,
  }))
)
const SecurityAccessControlPage = lazy(() =>
  import('./modules/security-access-control/pages/SecurityAccessControlPage').then((m) => ({
    default: m.SecurityAccessControlPage,
  }))
)
const AIProjectIntelligencePage = lazy(() =>
  import('./modules/ai-project-intelligence/pages/AIProjectIntelligencePage').then((m) => ({
    default: m.AIProjectIntelligencePage,
  }))
)
const AIIdeaPrioritizationIntelligencePage = lazy(() =>
  import('./modules/ai-idea-prioritization-intelligence/pages/AIIdeaPrioritizationIntelligencePage').then((m) => ({
    default: m.AIIdeaPrioritizationIntelligencePage,
  }))
)
const ProjectListPage = lazy(() =>
  import('./modules/projects').then((m) => ({ default: m.ProjectListPage }))
)
const ProjectDetailPage = lazy(() =>
  import('./modules/projects').then((m) => ({ default: m.ProjectDetailPage }))
)
const WorkspaceManagementPage = lazy(() =>
  import('./modules/workspace-management/pages/WorkspaceManagementPage').then((m) => ({
    default: m.WorkspaceManagementPage,
  }))
)
const GovernanceConfigurationCenterPage = lazy(() =>
  import('./modules/governance-configuration/pages/GovernanceConfigurationCenterPage').then((m) => ({
    default: m.GovernanceConfigurationCenterPage,
  }))
)
const EnterpriseGovernanceModelLayout = lazy(() =>
  import('./modules/enterprise-governance-model/components/EnterpriseGovernanceModelLayout').then((m) => ({
    default: m.EnterpriseGovernanceModelLayout,
  }))
)
const GovernanceOverviewPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/GovernanceOverviewPage').then((m) => ({
    default: m.GovernanceOverviewPage,
  }))
)
const GovernanceTemplatesPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/GovernanceTemplatesPage').then((m) => ({
    default: m.GovernanceTemplatesPage,
  }))
)
const OperatingModelBuilderPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/OperatingModelBuilderPage').then((m) => ({
    default: m.OperatingModelBuilderPage,
  }))
)
const PolicyCatalogPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/PolicyCatalogPage').then((m) => ({
    default: m.PolicyCatalogPage,
  }))
)
const ComplianceRulesEgmPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/ComplianceRulesEgmPage').then((m) => ({
    default: m.ComplianceRulesEgmPage,
  }))
)
const ScoringModelPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/ScoringModelPage').then((m) => ({
    default: m.ScoringModelPage,
  }))
)
const PolicyCoverageCompliancePage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/PolicyCoverageCompliancePage').then((m) => ({
    default: m.PolicyCoverageCompliancePage,
  }))
)
const UsageAdoptionPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/UsageAdoptionPage').then((m) => ({
    default: m.UsageAdoptionPage,
  }))
)
const ChangeHistoryPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/ChangeHistoryPage').then((m) => ({
    default: m.ChangeHistoryPage,
  }))
)
const AuditTrailPage = lazy(() =>
  import('./modules/enterprise-governance-model/pages/AuditTrailPage').then((m) => ({
    default: m.AuditTrailPage,
  }))
)

const LAST_ROUTE_STORAGE_KEY = 'tectona:last-route'

function resolveDefaultHomePath(): string {
  if (typeof window === 'undefined') return '/workspace-management'
  try {
    const stored = localStorage.getItem(LAST_ROUTE_STORAGE_KEY)?.trim()
    if (stored && stored.startsWith('/') && stored !== '/' && !stored.startsWith('/login')) {
      return stored
    }
  } catch {
    // ignore
  }
  return '/workspace-management'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <SessionProvider>
            <TectonaNavigateBridge />
            <Suspense fallback={<PlatformRouteLoadingFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/no-workspace-access" element={<NoWorkspaceAccessPage />} />
                  <Route path="/access-denied" element={<AccessDeniedPage />} />
                  <Route element={<AppAccessGate />}>
                    <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to={resolveDefaultHomePath()} replace />} />
                  <Route element={<ModuleRouteGuard moduleId="workspace" />}>
                    <Route path="/workspace-management" element={<WorkspaceManagementPage />} />
                  </Route>
                  <Route path="/governance-configuration" element={<GovernanceConfigurationCenterPage />} />
                  <Route path="/enterprise-governance-model" element={<EnterpriseGovernanceModelLayout />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<GovernanceOverviewPage />} />
                    <Route path="templates" element={<GovernanceTemplatesPage />} />
                    <Route path="operating-model-builder" element={<OperatingModelBuilderPage />} />
                    <Route path="policies/:policyType" element={<PolicyCatalogPage />} />
                    <Route path="compliance/rules" element={<ComplianceRulesEgmPage />} />
                    <Route path="compliance/scoring" element={<ScoringModelPage />} />
                    <Route path="compliance/coverage" element={<PolicyCoverageCompliancePage />} />
                    <Route path="traceability/usage" element={<UsageAdoptionPage />} />
                    <Route path="traceability/history" element={<ChangeHistoryPage />} />
                    <Route path="traceability/audit" element={<AuditTrailPage />} />
                  </Route>
                  <Route path="/projects" element={<ProjectListPage />} />
                  <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                  <Route path="/project-management" element={<ProjectManagementPage />} />
                  <Route path="/idea-backlog" element={<IdeaBacklogManagementPage />} />
                  <Route path="/idea-backlog/:ideaId" element={<IdeaDetailPage />} />
                  <Route path="/roadmap" element={<Navigate to="/idea-backlog" replace />} />
                  <Route path="/task-work-management" element={<TaskWorkManagementPage />} />
                  <Route path="/planning-scheduling" element={<PlanningSchedulingPage />} />
                  <Route path="/risks" element={<Navigate to="/planning-scheduling" replace />} />
                  <Route path="/workflow-automation-engine" element={<WorkflowAutomationEnginePage />} />
                  <Route path="/collaboration-communication" element={<Navigate to="/" replace />} />
                  <Route path="/resource-management" element={<ResourceManagementPage />} />
                  <Route path="/portfolio-governance-management" element={<PortfolioGovernanceManagementPage />} />
                  <Route path="/reporting-analytics" element={<ReportingAnalyticsPage />} />
                  <Route element={<ModuleRouteGuard moduleId="document_knowledge" />}>
                    <Route path="/document-knowledge-management" element={<DocumentKnowledgeManagementPage />} />
                  </Route>
                  <Route path="/integration-api-platform" element={<IntegrationApiPlatformPage />} />
                  <Route element={<ModuleRouteGuard moduleId="security_access" />}>
                    <Route path="/security-access-control" element={<SecurityAccessControlPage />} />
                  </Route>
                  <Route path="/ai-project-intelligence" element={<AIProjectIntelligencePage />} />
                  <Route path="/ai-idea-prioritization-intelligence" element={<AIIdeaPrioritizationIntelligencePage />} />
                  <Route path="/resources" element={<Navigate to="/resource-management" replace />} />
                  <Route element={<ModuleRouteGuard moduleId="platform_settings" />}>
                    <Route path="/platform-settings-administration" element={<PlatformSettingsControlPlanePage />} />
                  </Route>
                  <Route
                    path="/knowledge-base-configuration"
                    element={<Navigate to="/platform-settings-administration?section=knowledge-base" replace />}
                  />
                  <Route path="/settings" element={<Navigate to="/platform-settings-administration" replace />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </SessionProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
