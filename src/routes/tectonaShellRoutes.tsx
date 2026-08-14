import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { ModuleRouteGuard } from '@/auth/ModuleRouteGuard'
import { GovernanceConfigurationCenterPage } from '@/modules/governance-configuration/pages/GovernanceConfigurationCenterPage'
import { EnterpriseGovernanceModelLayout } from '@/modules/enterprise-governance-model/components/EnterpriseGovernanceModelLayout'
import { GovernanceOverviewPage } from '@/modules/enterprise-governance-model/pages/GovernanceOverviewPage'
import { GovernanceTemplatesPage } from '@/modules/enterprise-governance-model/pages/GovernanceTemplatesPage'
import { OperatingModelBuilderPage } from '@/modules/enterprise-governance-model/pages/OperatingModelBuilderPage'
import { PolicyCatalogPage } from '@/modules/enterprise-governance-model/pages/PolicyCatalogPage'
import { ComplianceRulesEgmPage } from '@/modules/enterprise-governance-model/pages/ComplianceRulesEgmPage'
import { ScoringModelPage } from '@/modules/enterprise-governance-model/pages/ScoringModelPage'
import { PolicyCoverageCompliancePage } from '@/modules/enterprise-governance-model/pages/PolicyCoverageCompliancePage'
import { UsageAdoptionPage } from '@/modules/enterprise-governance-model/pages/UsageAdoptionPage'
import { ChangeHistoryPage } from '@/modules/enterprise-governance-model/pages/ChangeHistoryPage'
import { AuditTrailPage } from '@/modules/enterprise-governance-model/pages/AuditTrailPage'
import { ProjectListPage, ProjectDetailPage } from '@/modules/projects'
import { ProjectManagementPage } from '@/modules/project-management/pages/ProjectManagementPage'
import { IdeaDetailPage } from '@/modules/project-management/pages/IdeaDetailPage'
import { WorkflowAutomationEnginePage } from '@/modules/workflow-automation-engine/pages/WorkflowAutomationEnginePage'
import { ResourceManagementPage } from '@/modules/resource-management/pages/ResourceManagementPage'
import { PortfolioGovernanceManagementPage } from '@/modules/portfolio-governance-management/pages/PortfolioGovernanceManagementPage'
import { ReportingAnalyticsPage } from '@/modules/reporting-analytics/pages/ReportingAnalyticsPage'
import { IntegrationApiPlatformPage } from '@/modules/integration-api-platform/pages/IntegrationApiPlatformPage'
import { SecurityAccessControlPage } from '@/modules/security-access-control/pages/SecurityAccessControlPage'
import { AIProjectIntelligencePage } from '@/modules/ai-project-intelligence/pages/AIProjectIntelligencePage'
import { AIIdeaPrioritizationIntelligencePage } from '@/modules/ai-idea-prioritization-intelligence/pages/AIIdeaPrioritizationIntelligencePage'
import { PlatformSettingsControlPlanePage } from '@/modules/core-shell/pages/PlatformSettingsControlPlanePage'
import { TraceabilityMonitoringLayout } from '@/modules/traceability-monitoring/components/TraceabilityMonitoringLayout'
import { UserActivityAuditPage } from '@/modules/traceability-monitoring/pages/UserActivityAuditPage'
import { EntityLineagePage } from '@/modules/traceability-monitoring/pages/EntityLineagePage'
import { PlatformHealthPage } from '@/modules/traceability-monitoring/pages/PlatformHealthPage'

const WorkspaceManagementPage = lazy(() =>
  import('@/modules/workspace-management/pages/WorkspaceManagementPage').then((m) => ({
    default: m.WorkspaceManagementPage,
  })),
)
const DocumentKnowledgeManagementPage = lazy(() =>
  import('@/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage').then((m) => ({
    default: m.DocumentKnowledgeManagementPage,
  })),
)
const TaskWorkManagementPage = lazy(() =>
  import('@/modules/task-work-management/pages/TaskWorkManagementPage').then((m) => ({
    default: m.TaskWorkManagementPage,
  })),
)
const PlanningSchedulingPage = lazy(() =>
  import('@/modules/planning-scheduling/pages/PlanningSchedulingPage').then((m) => ({
    default: m.PlanningSchedulingPage,
  })),
)
const IdeaBacklogManagementPage = lazy(() =>
  import('@/modules/project-management/pages/IdeaBacklogManagementPage').then((m) => ({
    default: m.IdeaBacklogManagementPage,
  })),
)

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PlatformRouteLoadingFallback title="Loading page…" />}>{children}</Suspense>
}

function routePath(mode: 'absolute' | 'nested', segment: string): string {
  if (mode === 'nested') return segment.replace(/^\//, '')
  return segment.startsWith('/') ? segment : `/${segment}`
}

/** Shared application routes — use as `{renderTectonaShellRoutes('absolute')}` inside `<Route>` (not as a component). */
export function renderTectonaShellRoutes(mode: 'absolute' | 'nested' = 'absolute') {
  const p = (segment: string) => routePath(mode, segment)

  return (
    <>
      <Route element={<ModuleRouteGuard moduleId="workspace" />}>
        <Route
          path={p('/workspace-management')}
          element={
            <LazyPage>
              <WorkspaceManagementPage />
            </LazyPage>
          }
        />
      </Route>
      <Route path={p('/governance-configuration')} element={<GovernanceConfigurationCenterPage />} />
      <Route element={<ModuleRouteGuard moduleId="enterprise_governance_model" />}>
        <Route path={p('/enterprise-governance-model')} element={<EnterpriseGovernanceModelLayout />}>
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
      </Route>
      <Route path={p('/projects')} element={<ProjectListPage />} />
      <Route path={p('/projects/:projectId')} element={<ProjectDetailPage />} />
      <Route path={p('/project-management')} element={<ProjectManagementPage />} />
      <Route
        path={p('/idea-backlog')}
        element={
          <LazyPage>
            <IdeaBacklogManagementPage />
          </LazyPage>
        }
      />
      <Route path={p('/idea-backlog/:ideaId')} element={<IdeaDetailPage />} />
      <Route path={p('/roadmap')} element={<Navigate to={mode === 'nested' ? '../idea-backlog' : '/idea-backlog'} replace />} />
      <Route
        path={p('/task-work-management')}
        element={
          <LazyPage>
            <TaskWorkManagementPage />
          </LazyPage>
        }
      />
      <Route
        path={p('/planning-scheduling')}
        element={
          <LazyPage>
            <PlanningSchedulingPage />
          </LazyPage>
        }
      />
      <Route path={p('/risks')} element={<Navigate to={mode === 'nested' ? '../planning-scheduling' : '/planning-scheduling'} replace />} />
      <Route element={<ModuleRouteGuard moduleId="workflow" />}>
        <Route path={p('/workflow-automation-engine')} element={<WorkflowAutomationEnginePage />} />
      </Route>
      <Route path={p('/collaboration-communication')} element={<Navigate to={mode === 'nested' ? '../projects' : '/projects'} replace />} />
      <Route element={<ModuleRouteGuard moduleId="resource" />}>
        <Route path={p('/resource-management')} element={<ResourceManagementPage />} />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="portfolio_governance" />}>
        <Route path={p('/portfolio-governance-management')} element={<PortfolioGovernanceManagementPage />} />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="reporting" />}>
        <Route path={p('/reporting-analytics')} element={<ReportingAnalyticsPage />} />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="document_knowledge" />}>
        <Route
          path={p('/document-knowledge-management')}
          element={
            <LazyPage>
              <DocumentKnowledgeManagementPage />
            </LazyPage>
          }
        />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="integration_api" />}>
        <Route path={p('/integration-api-platform')} element={<IntegrationApiPlatformPage />} />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="security_access" />}>
        <Route path={p('/security-access-control')} element={<SecurityAccessControlPage />} />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="ai_project" />}>
        <Route path={p('/ai-project-intelligence')} element={<AIProjectIntelligencePage />} />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="ai_idea" />}>
        <Route path={p('/ai-idea-prioritization-intelligence')} element={<AIIdeaPrioritizationIntelligencePage />} />
      </Route>
      <Route element={<ModuleRouteGuard moduleId="traceability_monitoring" />}>
        <Route path={p('/traceability-monitoring')} element={<TraceabilityMonitoringLayout />}>
          <Route index element={<Navigate to="activity" replace />} />
          <Route path="activity" element={<UserActivityAuditPage />} />
          <Route path="lineage" element={<EntityLineagePage />} />
          <Route path="platform-health" element={<PlatformHealthPage />} />
        </Route>
      </Route>
      <Route path={p('/resources')} element={<Navigate to={mode === 'nested' ? '../resource-management' : '/resource-management'} replace />} />
      <Route element={<ModuleRouteGuard moduleId="platform_settings" />}>
        <Route path={p('/platform-settings-administration')} element={<PlatformSettingsControlPlanePage />} />
      </Route>
      <Route
        path={p('/knowledge-base-configuration')}
        element={
          <Navigate
            to={
              mode === 'nested'
                ? '../platform-settings-administration?section=knowledge-base'
                : '/platform-settings-administration?section=knowledge-base'
            }
            replace
          />
        }
      />
      <Route
        path={p('/settings')}
        element={
          <Navigate
            to={mode === 'nested' ? '../platform-settings-administration' : '/platform-settings-administration'}
            replace
          />
        }
      />
    </>
  )
}
