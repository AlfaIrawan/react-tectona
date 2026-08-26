import { startTransition, useDeferredValue, useLayoutEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Cable,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Filter,
  KeyRound,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  TableProperties,
  TestTube2,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  isWorkspaceNavDocked,
  workspaceAsideClass,
  workspaceDockedContentInsetClass,
  workspaceMainColumnClass,
  workspaceNavInnerClass,
  workspaceNavMenuScrollClass,
  workspaceOuterGridClass,
} from '@/lib/workspaceNavLayout'
import { usePreferencesStore } from '@/stores/preferences-store'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

type OverviewMetric = {
  id: string
  label: string
  value: string
  delta: string
  icon: React.ComponentType<{ className?: string }>
  trend: string
  trendColor: string
  trendSeries: number[]
}

type ApiItem = {
  id: string
  name: string
  protocol: 'REST' | 'GraphQL'
  endpoint: string
  version: string
  auth: string
  owner: string
  status: 'Healthy' | 'Guarded' | 'Warning'
  environment: 'Production' | 'Staging' | 'Sandbox'
  usage: string
  lastUpdated: string
  type: 'Internal' | 'Partner' | 'Public'
  health: 'Healthy' | 'Degraded' | 'Watch'
}

type WebhookItem = {
  id: string
  name: string
  eventType: string
  targetUrl: string
  method: string
  status: 'Active' | 'Paused' | 'Warning'
  retryPolicy: 'Linear' | 'Exponential' | 'Manual'
  environment: 'Production' | 'Staging' | 'Sandbox'
  lastDelivery: string
  deliveryResult: 'Delivered' | 'Retrying' | 'Failed'
  owner: string
}

type ExternalSystemItem = {
  id: string
  systemName: string
  category: 'CRM' | 'ERP' | 'Dev Tools' | 'Email & Calendar' | 'Enterprise Apps'
  integrationType: 'API' | 'Webhook' | 'Event Stream' | 'File Sync'
  direction: 'Inbound' | 'Outbound' | 'Bi-directional'
  connectionStatus: 'Connected' | 'Degraded' | 'Attention'
  authMethod: string
  dataSyncStatus: 'In sync' | 'Lagging' | 'Failed'
  lastSync: string
  environment: 'Production' | 'Staging' | 'Sandbox'
  owner: string
  protocol: 'REST' | 'GraphQL' | 'Kafka' | 'SMTP' | 'SFTP'
  health: 'Healthy' | 'Degraded' | 'Watch'
}

type EmailCalendarItem = {
  id: string
  provider: string
  syncDirection: string
  notificationUsage: string
  calendarStatus: string
  emailAutomationStatus: string
  owner: string
}

type DevToolItem = {
  id: string
  toolName: string
  scope: string
  linkedWorkspace: string
  status: string
  lastActivity: string
  owner: string
}

type EventStreamItem = {
  id: string
  streamName: string
  sourceSystem: string
  destination: string
  eventType: string
  throughput: string
  failureRate: string
  consumerStatus: string
  environment: 'Production' | 'Staging' | 'Sandbox'
}

type SecurityItem = {
  id: string
  asset: string
  authMethod: string
  tokenStatus: string
  rotationStatus: string
  accessScope: string
  environment: string
  permissionModel: string
}

type MappingRow = {
  id: string
  sourceField: string
  targetField: string
  transformationLogic: string
  validationStatus: string
  lastTested: string
}

type AuditItem = {
  id: string
  timestamp: string
  actor: string
  action: string
  relatedIntegration: string
  result: string
}

type DetailRecord = {
  id: string
  title: string
  kind: string
  protocol: string
  endpoint: string
  owner: string
  status: string
  authentication: string
  environment: string
  securityStatus: string
  mappingConfiguration: string
  monitoringSummary: string
  recentExecutions: Array<{ label: string; detail: string; time: string; result: string }>
  errorHistory: Array<{ issue: string; impact: string; time: string }>
}

const overviewMetrics: OverviewMetric[] = [
  {
    id: 'total',
    label: 'Total Integrations',
    value: '184',
    delta: '+12 this quarter',
    icon: Cable,
    trend: '+6%',
    trendColor: '#0ea5e9',
    trendSeries: [162, 168, 171, 173, 176, 178, 181, 184],
  },
  {
    id: 'apis',
    label: 'Active APIs',
    value: '46',
    delta: '8 partner-facing',
    icon: ExternalLink,
    trend: '+2',
    trendColor: '#6366f1',
    trendSeries: [41, 41, 42, 43, 44, 44, 45, 46],
  },
  {
    id: 'webhooks',
    label: 'Active Webhooks',
    value: '28',
    delta: '3 pending validation',
    icon: Send,
    trend: '+1',
    trendColor: '#10b981',
    trendSeries: [24, 25, 26, 26, 27, 27, 27, 28],
  },
  {
    id: 'systems',
    label: 'Connected Systems',
    value: '31',
    delta: '5 cross-suite',
    icon: ArrowRightLeft,
    trend: '+3',
    trendColor: '#2563eb',
    trendSeries: [25, 26, 27, 28, 29, 29, 30, 31],
  },
  {
    id: 'streams',
    label: 'Event Streams',
    value: '17',
    delta: '2 paused',
    icon: Activity,
    trend: '+1',
    trendColor: '#f59e0b',
    trendSeries: [13, 14, 14, 15, 15, 16, 16, 17],
  },
  {
    id: 'failed',
    label: 'Failed Integrations',
    value: '4',
    delta: 'Down from 11',
    icon: AlertTriangle,
    trend: '-7',
    trendColor: '#f97316',
    trendSeries: [11, 10, 9, 8, 7, 6, 5, 4],
  },
]

const connectivityHealth = [
  { label: 'Connectivity health', value: '97.8%', width: 'w-[97.8%]', tone: 'bg-emerald-500' },
  { label: 'Webhook delivery', value: '94.2%', width: 'w-[94.2%]', tone: 'bg-sky-500' },
  { label: 'Token hygiene', value: '89.4%', width: 'w-[89.4%]', tone: 'bg-amber-500' },
  { label: 'Mapping validation', value: '92.1%', width: 'w-[92.1%]', tone: 'bg-violet-500' },
]

const integrationDistribution = [
  { label: 'API integrations', value: 38, width: 'w-[38%]', tone: 'bg-slate-900' },
  { label: 'Webhooks', value: 22, width: 'w-[22%]', tone: 'bg-sky-600' },
  { label: 'Event streams', value: 16, width: 'w-[16%]', tone: 'bg-emerald-500' },
  { label: 'Email & calendar', value: 11, width: 'w-[11%]', tone: 'bg-violet-500' },
  { label: 'Dev tools', value: 13, width: 'w-[13%]', tone: 'bg-amber-500' },
]

const apiCatalog: ApiItem[] = [
  {
    id: 'api-project-sync',
    name: 'Project Sync API',
    protocol: 'REST',
    endpoint: '/api/tectona/v1/projects/sync',
    version: 'v1.8',
    auth: 'OAuth 2.0 + mTLS',
    owner: 'Integration Hub Team',
    status: 'Healthy',
    environment: 'Production',
    usage: '1.8M calls / 30d',
    lastUpdated: 'Today, 09:12',
    type: 'Internal',
    health: 'Healthy',
  },
  {
    id: 'api-portfolio-graphql',
    name: 'Portfolio GraphQL',
    protocol: 'GraphQL',
    endpoint: '/api/tectona/graphql/portfolio',
    version: 'v2.3',
    auth: 'JWT + scope claims',
    owner: 'PMO Data Products',
    status: 'Guarded',
    environment: 'Production',
    usage: '684K calls / 30d',
    lastUpdated: 'Yesterday, 18:40',
    type: 'Partner',
    health: 'Watch',
  },
  {
    id: 'api-delivery-events',
    name: 'Delivery Event API',
    protocol: 'REST',
    endpoint: '/api/tectona/v1/delivery/events',
    version: 'v1.2',
    auth: 'API key + IP allowlist',
    owner: 'Workflow Services',
    status: 'Healthy',
    environment: 'Staging',
    usage: '244K calls / 30d',
    lastUpdated: '16 Apr 2026',
    type: 'Internal',
    health: 'Healthy',
  },
  {
    id: 'api-partner-timesheet',
    name: 'Partner Timesheet Bridge',
    protocol: 'REST',
    endpoint: '/api/tectona/v1/partners/timesheets',
    version: 'v1.0',
    auth: 'Signed token',
    owner: 'Resource Ops',
    status: 'Warning',
    environment: 'Sandbox',
    usage: '71K calls / 30d',
    lastUpdated: '14 Apr 2026',
    type: 'Public',
    health: 'Degraded',
  },
]

const webhookItems: WebhookItem[] = [
  {
    id: 'wh-risk-alert',
    name: 'Risk Escalation Webhook',
    eventType: 'project.risk.raised',
    targetUrl: 'https://ops-gateway.internal/hooks/risk-escalation',
    method: 'POST',
    status: 'Active',
    retryPolicy: 'Exponential',
    environment: 'Production',
    lastDelivery: 'Today, 10:02',
    deliveryResult: 'Delivered',
    owner: 'Governance Office',
  },
  {
    id: 'wh-approval-sync',
    name: 'Approval Sync Hook',
    eventType: 'approval.completed',
    targetUrl: 'https://workflow.enterprise/hooks/approvals',
    method: 'PUT',
    status: 'Warning',
    retryPolicy: 'Linear',
    environment: 'Production',
    lastDelivery: 'Today, 08:47',
    deliveryResult: 'Retrying',
    owner: 'Workflow Services',
  },
  {
    id: 'wh-status-pulse',
    name: 'Status Pulse Subscription',
    eventType: 'milestone.status.changed',
    targetUrl: 'https://pmo-datalake/hooks/status-pulse',
    method: 'POST',
    status: 'Paused',
    retryPolicy: 'Manual',
    environment: 'Staging',
    lastDelivery: '15 Apr 2026',
    deliveryResult: 'Failed',
    owner: 'Data Engineering',
  },
]

const externalSystems: ExternalSystemItem[] = [
  {
    id: 'ext-salesforce',
    systemName: 'Salesforce Revenue Cloud',
    category: 'CRM',
    integrationType: 'API',
    direction: 'Bi-directional',
    connectionStatus: 'Connected',
    authMethod: 'OAuth 2.0',
    dataSyncStatus: 'In sync',
    lastSync: '2 min ago',
    environment: 'Production',
    owner: 'Customer Programs',
    protocol: 'REST',
    health: 'Healthy',
  },
  {
    id: 'ext-sap',
    systemName: 'SAP S/4HANA Finance',
    category: 'ERP',
    integrationType: 'API',
    direction: 'Outbound',
    connectionStatus: 'Degraded',
    authMethod: 'mTLS + service token',
    dataSyncStatus: 'Lagging',
    lastSync: '18 min ago',
    environment: 'Production',
    owner: 'Finance Transformation',
    protocol: 'REST',
    health: 'Degraded',
  },
  {
    id: 'ext-github',
    systemName: 'GitHub Enterprise',
    category: 'Dev Tools',
    integrationType: 'Webhook',
    direction: 'Inbound',
    connectionStatus: 'Connected',
    authMethod: 'App token',
    dataSyncStatus: 'In sync',
    lastSync: '6 min ago',
    environment: 'Production',
    owner: 'Engineering PMO',
    protocol: 'REST',
    health: 'Healthy',
  },
  {
    id: 'ext-m365',
    systemName: 'Microsoft 365 Collaboration',
    category: 'Email & Calendar',
    integrationType: 'API',
    direction: 'Bi-directional',
    connectionStatus: 'Connected',
    authMethod: 'OAuth 2.0',
    dataSyncStatus: 'In sync',
    lastSync: '1 min ago',
    environment: 'Production',
    owner: 'Workplace Technology',
    protocol: 'GraphQL',
    health: 'Healthy',
  },
  {
    id: 'ext-servicebus',
    systemName: 'Enterprise Service Bus',
    category: 'Enterprise Apps',
    integrationType: 'Event Stream',
    direction: 'Bi-directional',
    connectionStatus: 'Attention',
    authMethod: 'SAS + private link',
    dataSyncStatus: 'Failed',
    lastSync: '42 min ago',
    environment: 'Staging',
    owner: 'Integration Reliability',
    protocol: 'Kafka',
    health: 'Watch',
  },
]

const emailCalendarItems: EmailCalendarItem[] = [
  {
    id: 'mail-outlook',
    provider: 'Microsoft Outlook / Exchange',
    syncDirection: 'Bi-directional',
    notificationUsage: 'Project alerts, reminders, and approvals',
    calendarStatus: 'Healthy calendar sync',
    emailAutomationStatus: 'Templates active in 14 workflows',
    owner: 'Workplace Technology',
  },
  {
    id: 'mail-google',
    provider: 'Google Workspace',
    syncDirection: 'Inbound + reminders outbound',
    notificationUsage: 'Meeting invite reconciliation',
    calendarStatus: 'Scoped to APAC delivery programs',
    emailAutomationStatus: 'Automation healthy',
    owner: 'Regional PMO',
  },
  {
    id: 'mail-smtp',
    provider: 'SMTP Notification Relay',
    syncDirection: 'Outbound',
    notificationUsage: 'Critical fallback notifications',
    calendarStatus: 'No calendar sync',
    emailAutomationStatus: 'Fallback only',
    owner: 'Operations Control',
  },
]

const devToolItems: DevToolItem[] = [
  {
    id: 'dev-github',
    toolName: 'GitHub Enterprise',
    scope: 'Source control and pull request traceability',
    linkedWorkspace: 'Delivery Engineering / PMO Integration',
    status: 'Healthy',
    lastActivity: 'PR sync 4 min ago',
    owner: 'Engineering PMO',
  },
  {
    id: 'dev-azure',
    toolName: 'Azure DevOps Pipelines',
    scope: 'CI/CD and deployment evidence',
    linkedWorkspace: 'Enterprise Platforms',
    status: 'Healthy',
    lastActivity: 'Deployment evidence received 11 min ago',
    owner: 'Release Control',
  },
  {
    id: 'dev-jira',
    toolName: 'Jira Work Item Sync',
    scope: 'Epic and delivery ticket alignment',
    linkedWorkspace: 'Transformation Programs',
    status: 'Watch',
    lastActivity: 'Last delta sync 37 min ago',
    owner: 'Planning Operations',
  },
  {
    id: 'dev-argocd',
    toolName: 'Argo CD Tracking',
    scope: 'Deployment status and environment promotion',
    linkedWorkspace: 'Platform Enablement',
    status: 'Healthy',
    lastActivity: 'Promotion event 8 min ago',
    owner: 'SRE Delivery',
  },
]

const eventStreams: EventStreamItem[] = [
  {
    id: 'stream-status',
    streamName: 'Milestone Status Stream',
    sourceSystem: 'Tectona PMO Core',
    destination: 'Enterprise Service Bus',
    eventType: 'milestone.status.changed',
    throughput: '1.9K events/min',
    failureRate: '0.4%',
    consumerStatus: '4 consumers healthy',
    environment: 'Production',
  },
  {
    id: 'stream-risk',
    streamName: 'Risk Escalation Stream',
    sourceSystem: 'Governance Workspace',
    destination: 'Incident Coordination Hub',
    eventType: 'risk.escalated',
    throughput: '180 events/min',
    failureRate: '1.2%',
    consumerStatus: '1 consumer paused',
    environment: 'Production',
  },
  {
    id: 'stream-utilization',
    streamName: 'Resource Utilization Feed',
    sourceSystem: 'Resource Management',
    destination: 'Analytics Warehouse',
    eventType: 'resource.utilization.updated',
    throughput: '420 events/min',
    failureRate: '0.1%',
    consumerStatus: 'Consumers stable',
    environment: 'Staging',
  },
]

const securityItems: SecurityItem[] = [
  {
    id: 'sec-project-sync',
    asset: 'Project Sync API',
    authMethod: 'OAuth 2.0 + mTLS',
    tokenStatus: '14 keys active / 0 expiring this week',
    rotationStatus: 'Rotation policy on track',
    accessScope: 'project.read, project.write, milestone.read',
    environment: 'Production',
    permissionModel: 'Role + scope claims',
  },
  {
    id: 'sec-risk-hook',
    asset: 'Risk Escalation Webhook',
    authMethod: 'HMAC signature',
    tokenStatus: 'Secret valid / next rotation in 21 days',
    rotationStatus: 'Manual approval required',
    accessScope: 'risk.alert.dispatch',
    environment: 'Production',
    permissionModel: 'Policy-bound secret',
  },
  {
    id: 'sec-event-bus',
    asset: 'Enterprise Service Bus Connector',
    authMethod: 'SAS token + network policy',
    tokenStatus: '1 key flagged for review',
    rotationStatus: 'Late by 2 days',
    accessScope: 'event.publish, event.consume',
    environment: 'Staging',
    permissionModel: 'Environment-scoped ACL',
  },
]

const mappingRows: MappingRow[] = [
  {
    id: 'map-1',
    sourceField: 'project_owner.email',
    targetField: 'externalContact.primaryEmail',
    transformationLogic: 'Normalize email + fallback owner alias',
    validationStatus: 'Validated',
    lastTested: 'Today, 09:44',
  },
  {
    id: 'map-2',
    sourceField: 'milestone.baseline_date',
    targetField: 'releasePlan.targetDate',
    transformationLogic: 'UTC conversion + null guard',
    validationStatus: 'Validated',
    lastTested: 'Today, 08:11',
  },
  {
    id: 'map-3',
    sourceField: 'risk.severity_code',
    targetField: 'incident.priority',
    transformationLogic: 'Severity matrix translation v3',
    validationStatus: 'Needs review',
    lastTested: '15 Apr 2026',
  },
  {
    id: 'map-4',
    sourceField: 'resource.utilization_pct',
    targetField: 'capacityTelemetry.utilizationRatio',
    transformationLogic: 'Percentage to decimal precision(4,2)',
    validationStatus: 'Validated',
    lastTested: '14 Apr 2026',
  },
]

const auditItems: AuditItem[] = [
  { id: 'audit-1', timestamp: 'Today, 10:12', actor: 'Integration Hub Team', action: 'API called', relatedIntegration: 'Project Sync API', result: 'Success' },
  { id: 'audit-2', timestamp: 'Today, 09:58', actor: 'Workflow Services', action: 'Webhook delivered', relatedIntegration: 'Approval Sync Hook', result: 'Retry scheduled' },
  { id: 'audit-3', timestamp: 'Today, 09:44', actor: 'Mapping Studio', action: 'Mapping changed', relatedIntegration: 'ERP Release Mapping', result: 'Schema valid' },
  { id: 'audit-4', timestamp: 'Today, 09:02', actor: 'Release Control', action: 'Sync completed', relatedIntegration: 'Azure DevOps Pipelines', result: 'Success' },
  { id: 'audit-5', timestamp: 'Yesterday, 18:42', actor: 'Security Operations', action: 'Token generated', relatedIntegration: 'Portfolio GraphQL', result: 'Scoped token issued' },
  { id: 'audit-6', timestamp: 'Yesterday, 17:05', actor: 'Integration Reliability', action: 'Integration failed', relatedIntegration: 'Enterprise Service Bus Connector', result: 'Escalated' },
]

const detailRecords: Record<string, DetailRecord> = {
  'api-project-sync': {
    id: 'api-project-sync',
    title: 'Project Sync API',
    kind: 'API catalog item',
    protocol: 'REST / JSON',
    endpoint: '/api/tectona/v1/projects/sync',
    owner: 'Integration Hub Team',
    status: 'Healthy',
    authentication: 'OAuth 2.0 + mTLS',
    environment: 'Production',
    securityStatus: 'All client keys valid; no urgent secret rotation.',
    mappingConfiguration: 'Maps project master, milestone status, and owner contact payloads to external orchestration systems.',
    monitoringSummary: '99.2% success rate, 182ms average response, zero SLA breaches in 7 days.',
    recentExecutions: [
      { label: 'Sync batch', detail: 'South region portfolio delta', time: 'Today, 10:08', result: 'Success' },
      { label: 'Schema validation', detail: 'Contract v1.8 payload check', time: 'Today, 09:34', result: 'Success' },
      { label: 'Partner pull', detail: 'Revenue cloud status fetch', time: 'Today, 08:57', result: 'Success' },
    ],
    errorHistory: [
      { issue: 'Temporary upstream timeout', impact: '1 request retried automatically', time: '13 Apr 2026' },
      { issue: 'Token scope mismatch', impact: 'Partner consumer denied until regenerated', time: '09 Apr 2026' },
    ],
  },
  'wh-approval-sync': {
    id: 'wh-approval-sync',
    title: 'Approval Sync Hook',
    kind: 'Webhook subscription',
    protocol: 'HTTPS webhook',
    endpoint: 'https://workflow.enterprise/hooks/approvals',
    owner: 'Workflow Services',
    status: 'Warning',
    authentication: 'HMAC signature',
    environment: 'Production',
    securityStatus: 'Secret valid, retry policy under review due to duplicate suppression issue.',
    mappingConfiguration: 'Transforms approval payload into workflow case status, stage gate metadata, and approver evidence links.',
    monitoringSummary: '94.8% delivery success, 3 retries in last hour, one SLA watch item open.',
    recentExecutions: [
      { label: 'Approval completed', detail: 'ERP cutover stage gate', time: 'Today, 09:58', result: 'Retrying' },
      { label: 'Approval completed', detail: 'Portfolio investment review', time: 'Today, 09:11', result: 'Success' },
      { label: 'Approval revoked', detail: 'Vendor onboarding gate', time: 'Today, 08:22', result: 'Success' },
    ],
    errorHistory: [
      { issue: 'Target system 502 response', impact: 'Retry queue depth increased to 7', time: 'Today, 09:58' },
      { issue: 'Late acknowledgement', impact: 'Consumer health downgraded to watch', time: '16 Apr 2026' },
    ],
  },
  'ext-sap': {
    id: 'ext-sap',
    title: 'SAP S/4HANA Finance',
    kind: 'External system integration',
    protocol: 'REST + mTLS',
    endpoint: 'sap-finance.prod.internal',
    owner: 'Finance Transformation',
    status: 'Degraded',
    authentication: 'mTLS + service token',
    environment: 'Production',
    securityStatus: 'Certificates valid, service token rotates in 6 days.',
    mappingConfiguration: 'Maps budget, release capex, benefit forecast, and vendor milestone settlements into ERP finance objects.',
    monitoringSummary: '92.6% success rate, 420ms response latency, queue backlog 18, one materialized sync lag.',
    recentExecutions: [
      { label: 'Budget export', detail: 'Wave 2 capex alignment', time: 'Today, 09:40', result: 'Delayed' },
      { label: 'Forecast sync', detail: 'Quarterly governance package', time: 'Today, 08:15', result: 'Success' },
      { label: 'Reconciliation', detail: 'Benefit realization ledger', time: 'Yesterday, 17:49', result: 'Success' },
    ],
    errorHistory: [
      { issue: 'ERP gateway throttling', impact: 'Sync lag reached 18 minutes', time: 'Today, 09:40' },
      { issue: 'Payload schema mismatch', impact: 'One staging test failed before promotion', time: '15 Apr 2026' },
    ],
  },
  'stream-risk': {
    id: 'stream-risk',
    title: 'Risk Escalation Stream',
    kind: 'Event stream',
    protocol: 'Kafka event stream',
    endpoint: 'risk-escalation.topic.enterprise',
    owner: 'Integration Reliability',
    status: 'Watch',
    authentication: 'SAS + private link',
    environment: 'Production',
    securityStatus: 'Consumer identities valid; one stale access policy flagged for cleanup.',
    mappingConfiguration: 'Maps risk escalation severity, owner, mitigation action, and affected milestone to incident consumers.',
    monitoringSummary: '98.8% publish success, 1.2% consumer warning rate, replay capability available for 72 hours.',
    recentExecutions: [
      { label: 'Publish', detail: 'Severity 1 vendor delay risk', time: 'Today, 09:28', result: 'Success' },
      { label: 'Consumer replay', detail: 'Incident Coordination Hub catch-up', time: 'Today, 08:52', result: 'Success' },
      { label: 'Consumer lag warning', detail: 'Secondary analytics subscriber', time: 'Today, 08:17', result: 'Warning' },
    ],
    errorHistory: [
      { issue: 'Consumer lag exceeded threshold', impact: 'Monitoring alert triggered', time: 'Today, 08:17' },
      { issue: 'Transient partition rebalance', impact: 'Short-lived throughput dip', time: '14 Apr 2026' },
    ],
  },
}

const defaultFilters = {
  integrationType: 'All types',
  protocol: 'All protocols',
  status: 'All status',
  environment: 'All environments',
  systemCategory: 'All categories',
  owner: 'All owners',
  monitoringHealth: 'All health',
  lastUpdated: 'Any time',
  groupBy: 'System category',
}

const filterOptions = {
  integrationType: ['All types', 'API', 'Webhook', 'Event Stream', 'File Sync', 'Internal', 'Partner', 'Public'],
  protocol: ['All protocols', 'REST', 'GraphQL', 'Kafka', 'SMTP', 'SFTP'],
  status: ['All status', 'Healthy', 'Guarded', 'Warning', 'Active', 'Paused', 'Connected', 'Degraded', 'Attention'],
  environment: ['All environments', 'Production', 'Staging', 'Sandbox'],
  systemCategory: ['All categories', 'CRM', 'ERP', 'Dev Tools', 'Email & Calendar', 'Enterprise Apps'],
  owner: ['All owners', 'Integration Hub Team', 'PMO Data Products', 'Workflow Services', 'Resource Ops', 'Customer Programs', 'Finance Transformation', 'Engineering PMO', 'Workplace Technology', 'Integration Reliability'],
  monitoringHealth: ['All health', 'Healthy', 'Watch', 'Degraded'],
  lastUpdated: ['Any time', 'Today', 'Last 7 days', 'Last 30 days'],
  groupBy: ['System category', 'Protocol', 'Environment', 'Owner', 'Health'],
}

function panelAction(label: string, Icon: typeof MoreHorizontal, onClick?: () => void) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="h-8 rounded-xl border-slate-200 bg-white/90 px-3 text-[11px] font-medium text-slate-700">
      <Icon className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  )
}

function statusBadge(value: string) {
  const tone =
    value.includes('Healthy') || value.includes('Connected') || value.includes('Delivered') || value.includes('Success') || value.includes('Validated') || value.includes('In sync')
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : value.includes('Guarded') || value.includes('Watch') || value.includes('Retrying') || value.includes('Lagging') || value.includes('Paused')
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-rose-200 bg-rose-50 text-rose-700'

  return <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', tone)}>{value}</Badge>
}

function environmentBadge(value: string) {
  const tone = value === 'Production' ? 'border-sky-200 bg-sky-50 text-sky-700' : value === 'Staging' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-slate-50 text-slate-600'
  return <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', tone)}>{value}</Badge>
}

function metricSpark(value: string) {
  return (
    <div className="mt-3 flex items-end gap-1.5">
      {value.split('').slice(0, 6).map((_, index) => (
        <div key={index} className="w-2 rounded-full bg-white/75" style={{ height: `${18 + ((index * 9) % 28)}px` }} />
      ))}
    </div>
  )
}

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]'

  if (cardId === 'total') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'apis') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  if (cardId === 'webhooks') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
  if (cardId === 'systems') return cn(base, 'bg-gradient-to-br from-blue-50/70 via-white/90 to-sky-50/70')
  if (cardId === 'streams') return cn(base, 'bg-gradient-to-br from-amber-50/70 via-white/90 to-orange-50/70')
  return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-red-50/70')
}

function SkeletonRows({ rows = 3, dense = false }: { rows?: number; dense?: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={cn('rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3', dense ? 'space-y-2' : 'space-y-3')}>
          <div className="flex items-center justify-between gap-3">
            <div className="h-2.5 w-32 animate-pulse rounded-full bg-slate-200" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-slate-200" />
          <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-slate-100" />
          {!dense ? <div className="h-9 animate-pulse rounded-xl bg-slate-100" /> : null}
        </div>
      ))}
    </div>
  )
}

function KpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`tectona-int-kpi-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#tectona-int-kpi-${color.replace('#', '')})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function IntegrationApiPlatformPage() {
  const [filters, setFilters] = useState(defaultFilters)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDetailId, setSelectedDetailId] = useState('api-project-sync')
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [monitoringLoading, setMonitoringLoading] = useState(false)
  const [integrationLoading, setIntegrationLoading] = useState(false)
  const [apiStatusOverrides, setApiStatusOverrides] = useState<Record<string, string>>({})
  const [apiEnvironmentOverrides, setApiEnvironmentOverrides] = useState<Record<string, string>>({})
  const [webhookRetryOverrides, setWebhookRetryOverrides] = useState<Record<string, string>>({})
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState('overview')
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'

  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (navDocked) {
      setNavPanelHeightPx(null)
      return
    }

    const compute = () => {
      const el = navPanelRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewportH = window.innerHeight
      const stickyTopPx = 48
      const effectiveTop = Math.max(rect.top, stickyTopPx)
      const extraPadPx = 30
      const next = Math.max(
        240,
        Math.min(Math.floor(viewportH - stickyTopPx - extraPadPx), Math.floor(viewportH - effectiveTop - extraPadPx))
      )
      setNavPanelHeightPx(next)
    }

    compute()
    requestAnimationFrame(compute)
    const t = window.setTimeout(compute, 80)
    const onLoad = () => compute()
    window.addEventListener('load', onLoad, { once: true })
    const ro = new ResizeObserver(() => compute())
    if (navPanelRef.current) ro.observe(navPanelRef.current)
    window.addEventListener('resize', compute, { passive: true })
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('load', onLoad)
      window.clearTimeout(t)
      ro.disconnect()
    }
  }, [
    navDocked,
    activePanel,
    isWorkspaceCollapsed,
    searchQuery,
    filters,
    catalogLoading,
    monitoringLoading,
    integrationLoading,
  ])

  const updateFilter = (key: keyof typeof defaultFilters, value: string) => {
    startTransition(() => {
      setFilters((current) => ({ ...current, [key]: value }))
    })
  }

  const pulseLoading = (type: 'catalog' | 'monitoring' | 'integration') => {
    if (type === 'catalog') {
      setCatalogLoading(true)
      window.setTimeout(() => setCatalogLoading(false), 1000)
      return
    }

    if (type === 'monitoring') {
      setMonitoringLoading(true)
      window.setTimeout(() => setMonitoringLoading(false), 1000)
      return
    }

    setIntegrationLoading(true)
    window.setTimeout(() => setIntegrationLoading(false), 1000)
  }

  const matchesUpdated = (value: string) => {
    if (filters.lastUpdated === 'Any time') return true
    if (filters.lastUpdated === 'Today') return value.toLowerCase().includes('today')
    if (filters.lastUpdated === 'Last 7 days') return !value.includes('Apr 2025')
    return true
  }

  const filteredApis = apiCatalog.filter((item) => {
    const currentStatus = apiStatusOverrides[item.id] ?? item.status
    const currentEnvironment = apiEnvironmentOverrides[item.id] ?? item.environment
    const text = [item.name, item.endpoint, item.owner, item.protocol, item.auth, item.type].join(' ').toLowerCase()
    const statusMatch = filters.status === 'All status' || currentStatus === filters.status
    const protocolMatch = filters.protocol === 'All protocols' || item.protocol === filters.protocol
    const envMatch = filters.environment === 'All environments' || currentEnvironment === filters.environment
    const typeMatch = filters.integrationType === 'All types' || item.type === filters.integrationType || item.protocol === filters.integrationType
    const ownerMatch = filters.owner === 'All owners' || item.owner === filters.owner
    const healthMatch = filters.monitoringHealth === 'All health' || item.health === filters.monitoringHealth || currentStatus === filters.monitoringHealth

    return (deferredQuery.length === 0 || text.includes(deferredQuery)) && statusMatch && protocolMatch && envMatch && typeMatch && ownerMatch && healthMatch && matchesUpdated(item.lastUpdated)
  })

  const filteredWebhooks = webhookItems.filter((item) => {
    const retryPolicy = webhookRetryOverrides[item.id] ?? item.retryPolicy
    const text = [item.name, item.eventType, item.targetUrl, item.owner].join(' ').toLowerCase()
    const statusMatch = filters.status === 'All status' || item.status === filters.status || item.deliveryResult === filters.status
    const envMatch = filters.environment === 'All environments' || item.environment === filters.environment
    const typeMatch = filters.integrationType === 'All types' || filters.integrationType === 'Webhook'
    const ownerMatch = filters.owner === 'All owners' || item.owner === filters.owner

    return (deferredQuery.length === 0 || text.includes(deferredQuery)) && statusMatch && envMatch && typeMatch && ownerMatch && retryPolicy.length > 0
  })

  const filteredExternalSystems = externalSystems.filter((item) => {
    const text = [item.systemName, item.category, item.integrationType, item.owner, item.authMethod, item.protocol].join(' ').toLowerCase()
    const typeMatch = filters.integrationType === 'All types' || item.integrationType === filters.integrationType
    const protocolMatch = filters.protocol === 'All protocols' || item.protocol === filters.protocol
    const statusMatch = filters.status === 'All status' || item.connectionStatus === filters.status || item.dataSyncStatus === filters.status
    const envMatch = filters.environment === 'All environments' || item.environment === filters.environment
    const categoryMatch = filters.systemCategory === 'All categories' || item.category === filters.systemCategory
    const ownerMatch = filters.owner === 'All owners' || item.owner === filters.owner
    const healthMatch = filters.monitoringHealth === 'All health' || item.health === filters.monitoringHealth

    return (deferredQuery.length === 0 || text.includes(deferredQuery)) && typeMatch && protocolMatch && statusMatch && envMatch && categoryMatch && ownerMatch && healthMatch
  })

  const groupValueForSystem = (item: ExternalSystemItem) => {
    switch (filters.groupBy) {
      case 'Protocol':
        return item.protocol
      case 'Environment':
        return item.environment
      case 'Owner':
        return item.owner
      case 'Health':
        return item.health
      default:
        return item.category
    }
  }

  const groupedExternalSystems = filteredExternalSystems.reduce<Record<string, ExternalSystemItem[]>>((acc, item) => {
    const key = groupValueForSystem(item)
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})

  const selectedDetail = detailRecords[selectedDetailId] ?? detailRecords['api-project-sync']
  const workspacePanels = [
    {
      id: 'overview',
      label: 'Integration Overview',
      description: 'Command posture for connectivity health, distribution mix, and integration readiness.',
      icon: Cable,
      badge: 'Command',
      group: 'Command Center',
    },
    {
      id: 'catalog',
      label: 'API Catalog',
      description: 'Catalog governance for REST/GraphQL interfaces, owners, environments, and token posture.',
      icon: ExternalLink,
      badge: 'Core',
      group: 'Control Library',
    },
    {
      id: 'webhooks',
      label: 'Webhook Management',
      description: 'Delivery posture, retry policies, payload checks, and subscription controls.',
      icon: Send,
      badge: 'Flow',
      group: 'Control Library',
    },
    {
      id: 'systems',
      label: 'External Systems',
      description: 'Connected enterprise systems grouped by protocol, owner, environment, and health.',
      icon: ArrowRightLeft,
      badge: 'Map',
      group: 'Control Library',
    },
    {
      id: 'streams',
      label: 'Event Streaming',
      description: 'Event-driven pipelines for publishing, consumers, replay, and resilience monitoring.',
      icon: Activity,
      badge: 'Signal',
      group: 'Assurance & Traceability',
    },
    {
      id: 'monitoring',
      label: 'Integration Monitoring',
      description: 'Runtime monitoring across success rate, failures, response time, and SLA posture.',
      icon: RefreshCcw,
      badge: 'SLO',
      group: 'Assurance & Traceability',
    },
    {
      id: 'security',
      label: 'Security',
      description: 'Token hygiene, secret rotation, scopes, and permission model governance.',
      icon: ShieldCheck,
      badge: 'Guard',
      group: 'Assurance & Traceability',
    },
    {
      id: 'mapping',
      label: 'Mapping & Payload',
      description: 'Field mapping, transformations, validation, and payload configuration controls.',
      icon: TableProperties,
      badge: 'Model',
      group: 'Control Library',
    },
    {
      id: 'audit',
      label: 'Activity & Audit',
      description: 'Audit-ready trail for API calls, webhook delivery, mapping changes, and token actions.',
      icon: FileJson,
      badge: 'Audit',
      group: 'Assurance & Traceability',
    },
    {
      id: 'detail',
      label: 'Integration Detail',
      description: 'Selected integration details, security posture, mapping, monitoring, and quick actions.',
      icon: MoreHorizontal,
      badge: 'Detail',
      group: 'Command Center',
    },
  ] as const

  type WorkspacePanel = (typeof workspacePanels)[number]

  const panelGroups: Array<{ group: WorkspacePanel['group']; items: WorkspacePanel[] }> = [
    { group: 'Command Center', items: workspacePanels.filter((item) => item.group === 'Command Center') },
    { group: 'Control Library', items: workspacePanels.filter((item) => item.group === 'Control Library') },
    { group: 'Assurance & Traceability', items: workspacePanels.filter((item) => item.group === 'Assurance & Traceability') },
  ]

  return (
    <div className="space-y-6 pb-8 text-slate-900">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
        <Breadcrumb items={[{ label: 'Project Management', href: '/project-management' }, { label: 'Integration & API Platform' }]} />

        <PageHeader
          title="Integration & API Platform"
          description="Manage APIs, webhooks, external integrations, event connectivity, and integration monitoring"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Button className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800">
                <Plus className="mr-2 h-4 w-4" />
                Create Integration
              </Button>
              <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white/85 px-3 text-xs font-medium text-slate-700">
                <KeyRound className="mr-2 h-4 w-4" />
                Generate API Key
              </Button>
              <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white/85 px-3 text-xs font-medium text-slate-700">
                <Download className="mr-2 h-4 w-4" />
                Export Config
              </Button>
              <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white/85 px-3 text-xs font-medium text-slate-700">
                <Settings2 className="mr-2 h-4 w-4" />
                Integration Settings
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {overviewMetrics.map((metric) => (
            <button key={metric.id} type="button" className="group text-left">
              <Card className={kpiCardChrome(metric.id)}>
                <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.08] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.12]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-slate-700/80 ring-1 ring-white/50 backdrop-blur-sm">
                    <metric.icon className="h-7 w-7" />
                  </div>
                </div>
                <div className="text-xs text-slate-500">{metric.label}</div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{metric.value}</div>
                  <div className="h-10 min-w-0 flex-1">
                    <KpiSparkline data={metric.trendSeries} color={metric.trendColor} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <metric.icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <span className="truncate">{metric.delta}</span>
                  </span>
                  <span className={cn('shrink-0 font-semibold', metric.trend.startsWith('-') ? 'text-rose-600' : 'text-emerald-600')}>
                    {metric.trend}
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>

      <div className={workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
        <aside className={workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
          <div
            ref={navPanelRef}
            className={cn(workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed), !navDocked && 'overflow-hidden')}
            style={!navDocked && navPanelHeightPx ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx } : undefined}
            aria-label="Integration workspace navigation"
          >
            <div className="shrink-0">
              <div className="mb-3 flex items-center justify-between">
                {!isWorkspaceCollapsed ? (
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Enterprise Navigation</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl border border-slate-200/70 bg-white/75 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
                  aria-label={isWorkspaceCollapsed ? 'Expand integration workspace navigation' : 'Collapse integration workspace navigation'}
                  title={isWorkspaceCollapsed ? 'Expand integration workspace navigation' : 'Collapse integration workspace navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                >
                  {isWorkspaceCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </div>

              {!isWorkspaceCollapsed && !enterpriseNavSimpleList ? (
                <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Integration Workspace</div>
                  <div className="mt-2 text-base font-semibold leading-tight">
                    Control tower for API landscape, webhook runtime, external systems, and governance posture
                  </div>
                </div>
              ) : null}
            </div>

            <div className={workspaceNavMenuScrollClass()}>
              <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                {panelGroups.map(({ group, items }) => (
                  <div key={group} className="space-y-1.5">
                    {!isWorkspaceCollapsed && !enterpriseNavCompact ? (
                      <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div>
                    ) : null}
                    {items.map((panel) => {
                      const Icon = panel.icon
                      const active = activePanel === panel.id
                      return (
                        <button
                          key={panel.id}
                          type="button"
                          onClick={() => {
                            setActivePanel(panel.id)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className={cn(
                            'group relative flex w-full overflow-hidden border text-left transition-all duration-200',
                            isWorkspaceCollapsed
                              ? 'items-center justify-center rounded-2xl px-2 py-3'
                              : enterpriseNavCompact
                                ? cn(
                                    'items-center gap-3 px-3',
                                    enterpriseNavUltra ? 'rounded-[14px] py-1.5' : 'rounded-[18px] py-2.5'
                                  )
                                : 'items-start gap-3 rounded-[20px] px-3.5 py-3',
                            active
                              ? cn(
                                  'border-slate-300/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] text-slate-950',
                                  enterpriseNavUltra
                                    ? 'shadow-[0_1px_0_0_rgba(15,23,42,0.06),0_10px_22px_-18px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/70'
                                    : 'shadow-[0_12px_30px_rgba(15,23,42,0.10)]'
                                )
                              : 'border-transparent bg-white/55 text-slate-600 hover:border-slate-200/80 hover:bg-white/88 hover:text-slate-950'
                          )}
                          aria-label={panel.label}
                          title={panel.label}
                        >
                          {active ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-600" /> : null}
                          <span
                            className={cn(
                              'relative flex shrink-0 items-center justify-center rounded-2xl border transition-colors',
                              enterpriseNavCompact ? 'h-9 w-9' : 'h-11 w-11',
                              active
                                ? 'border-sky-200 bg-sky-50 text-sky-700'
                                : 'border-slate-200/80 bg-slate-50/90 text-slate-600 group-hover:border-slate-300 group-hover:bg-slate-100'
                            )}
                          >
                            <Icon
                              className={cn(
                                'shrink-0',
                                isWorkspaceCollapsed ? 'h-5 w-5' : enterpriseNavCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'
                              )}
                            />
                          </span>
                          {!isWorkspaceCollapsed ? (
                            <span className="min-w-0 flex-1">
                              <span className={cn('flex justify-between gap-2', enterpriseNavCompact ? 'items-center' : 'items-start')}>
                                <span className="block truncate text-sm font-semibold text-slate-900">{panel.label}</span>
                                {!enterpriseNavCompact ? (
                                  <span
                                    className={cn(
                                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                      active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                    )}
                                  >
                                    {panel.badge}
                                  </span>
                                ) : null}
                              </span>
                              {!enterpriseNavCompact ? (
                                <span className="mt-1 block text-[11px] leading-4 text-slate-500">{panel.description}</span>
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className={cn('min-w-0', workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
          <Card className="overflow-hidden rounded-[28px] border-slate-200/80 bg-white/85 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)] backdrop-blur">
          <CardContent className="space-y-4 p-4 pt-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by integration name, API, endpoint, webhook, system, or owner" className="h-11 rounded-2xl border-slate-200 bg-slate-50/80 pl-10 text-sm" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600"><Filter className="mr-1 h-3.5 w-3.5" />Group by {filters.groupBy}</Badge>
                <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">97.8% enterprise connectivity health</Badge>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {(
                [
                  ['integrationType', filterOptions.integrationType],
                  ['protocol', filterOptions.protocol],
                  ['status', filterOptions.status],
                  ['environment', filterOptions.environment],
                  ['systemCategory', filterOptions.systemCategory],
                  ['owner', filterOptions.owner],
                  ['monitoringHealth', filterOptions.monitoringHealth],
                  ['lastUpdated', filterOptions.lastUpdated],
                  ['groupBy', filterOptions.groupBy],
                ] as const
              ).map(([key, options]) => (
                <Select key={key} value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white text-xs">
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </Select>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_420px]">
          <div className="space-y-4">
            {activePanel === 'overview' ? (
            <Card id="overview" className="rounded-[28px] liquid-glass-enterprise-panel">
              <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Integration Overview</CardTitle>
                  <CardDescription className="mt-1 text-xs text-slate-500">High-level control center for enterprise connectivity, governance posture, and operational health.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {panelAction('Refresh overview', RefreshCcw)}
                  {panelAction('Open monitoring', Activity)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {overviewMetrics.map((metric) => (
                    <button key={metric.id} type="button" onClick={() => setSelectedDetailId('api-project-sync')} className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600 p-4 text-left text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-white/75">{metric.label}</p>
                          <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
                          <p className="mt-1 text-[11px] text-white/80">{metric.delta}</p>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">Live</div>
                      </div>
                      {metricSpark(metric.value)}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Connectivity health widget</h3>
                        <p className="text-xs text-slate-500">Compact readiness view for endpoint availability, delivery, and configuration hygiene.</p>
                      </div>
                      {statusBadge('Healthy')}
                    </div>
                    <div className="mt-4 space-y-3">
                      {connectivityHealth.map((item) => (
                        <div key={item.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>{item.label}</span>
                            <span className="font-semibold text-slate-900">{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white"><div className={cn('h-2 rounded-full', item.width, item.tone)} /></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Integration distribution</h3>
                        <p className="text-xs text-slate-500">Current balance of integration patterns across the platform control surface.</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-[11px] text-slate-600">By type</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {integrationDistribution.map((item) => (
                        <div key={item.label} className="grid grid-cols-[150px_minmax(0,1fr)_34px] items-center gap-3 text-[11px]">
                          <span className="text-slate-600">{item.label}</span>
                          <div className="h-3 rounded-full bg-slate-100"><div className={cn('h-3 rounded-full', item.width, item.tone)} /></div>
                          <span className="text-right font-semibold text-slate-900">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            ) : null}

            {activePanel === 'catalog' ? (
            <Card id="catalog" className="rounded-[28px] liquid-glass-enterprise-panel">
              <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">API Catalog</CardTitle>
                  <CardDescription className="mt-1 text-xs text-slate-500">REST and GraphQL interfaces exposed by Tectona for internal, partner, and controlled public connectivity.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {panelAction('Simulate loading', RefreshCcw, () => pulseLoading('catalog'))}
                  {panelAction('View docs', ExternalLink)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-4">
                {catalogLoading ? (
                  <SkeletonRows rows={4} />
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-slate-200">
                    <div className="grid grid-cols-[minmax(0,1.35fr)_0.7fr_1.2fr_0.55fr_0.9fr_0.85fr_0.8fr_0.9fr_0.9fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <span>API</span>
                      <span>Protocol</span>
                      <span>Endpoint</span>
                      <span>Version</span>
                      <span>Auth</span>
                      <span>Owner</span>
                      <span>Status</span>
                      <span>Usage</span>
                      <span>Updated</span>
                    </div>
                    <div className="divide-y divide-slate-200 bg-white">
                      {filteredApis.map((item) => {
                        const currentStatus = apiStatusOverrides[item.id] ?? item.status
                        const currentEnvironment = apiEnvironmentOverrides[item.id] ?? item.environment
                        return (
                          <button key={item.id} type="button" onClick={() => setSelectedDetailId(item.id)} className="grid w-full grid-cols-[minmax(0,1.35fr)_0.7fr_1.2fr_0.55fr_0.9fr_0.85fr_0.8fr_0.9fr_0.9fr] gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/80">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-slate-900">{item.name}</span>
                                {environmentBadge(currentEnvironment)}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Open API Detail</Button>
                                <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]"><Copy className="mr-1.5 h-3 w-3" />Copy Endpoint</Button>
                                <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]"><KeyRound className="mr-1.5 h-3 w-3" />Generate Token</Button>
                              </div>
                            </div>
                            <div className="flex items-center">{statusBadge(item.protocol)}</div>
                            <div className="flex items-center text-xs text-slate-600">{item.endpoint}</div>
                            <div className="flex items-center text-xs font-semibold text-slate-700">{item.version}</div>
                            <div className="flex items-center text-xs text-slate-600">{item.auth}</div>
                            <div className="flex items-center text-xs text-slate-600">{item.owner}</div>
                            <div className="space-y-2">
                              {statusBadge(currentStatus)}
                              <Select value={currentStatus} onChange={(event) => setApiStatusOverrides((current) => ({ ...current, [item.id]: event.target.value }))} className="h-8 rounded-lg border-slate-200 bg-white text-[11px]">
                                {['Healthy', 'Guarded', 'Warning'].map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </Select>
                            </div>
                            <div className="flex items-center text-xs text-slate-600">{item.usage}</div>
                            <div className="space-y-2 text-xs text-slate-600">
                              <div>{item.lastUpdated}</div>
                              <Select value={currentEnvironment} onChange={(event) => setApiEnvironmentOverrides((current) => ({ ...current, [item.id]: event.target.value }))} className="h-8 rounded-lg border-slate-200 bg-white text-[11px]">
                                {['Production', 'Staging', 'Sandbox'].map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </Select>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            ) : null}

            {activePanel === 'webhooks' ? (
              <Card id="webhooks" className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Webhook Management</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Operational webhook subscriptions, delivery posture, and retry governance.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Create Webhook', Plus)}
                    {panelAction('Retry Delivery', RefreshCcw)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-4">
                  {filteredWebhooks.map((item) => {
                    const retryPolicy = webhookRetryOverrides[item.id] ?? item.retryPolicy
                    return (
                      <button key={item.id} type="button" onClick={() => setSelectedDetailId(item.id === 'wh-approval-sync' ? 'wh-approval-sync' : 'api-project-sync')} className="w-full rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                              {statusBadge(item.status)}
                              {environmentBadge(item.environment)}
                            </div>
                            <p className="mt-1 text-xs text-slate-600">{item.eventType}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.targetUrl}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Edit Webhook</Button>
                            <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">View Payload</Button>
                            <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Pause Webhook</Button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Method</p>
                            <p className="mt-1 text-xs text-slate-700">{item.method}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Last delivery</p>
                            <p className="mt-1 text-xs text-slate-700">{item.lastDelivery}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Result</p>
                            <div className="mt-1">{statusBadge(item.deliveryResult)}</div>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Retry policy</p>
                            <Select value={retryPolicy} onChange={(event) => setWebhookRetryOverrides((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 h-8 rounded-lg border-slate-200 bg-white text-[11px]">
                              {['Linear', 'Exponential', 'Manual'].map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            ) : null}

            {activePanel === 'systems' ? (
              <Card id="systems" className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">External System Integration</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Connected enterprise systems grouped by the active dimension: {filters.groupBy}.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Simulate loading', RefreshCcw, () => pulseLoading('integration'))}
                    {panelAction('Test Connection', TestTube2)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-4">
                  {integrationLoading ? (
                    <SkeletonRows rows={3} />
                  ) : (
                    Object.entries(groupedExternalSystems).map(([group, items]) => (
                      <div key={group} className="liquid-glass-enterprise-panel rounded-3xl border p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{filters.groupBy}</p>
                            <h3 className="mt-1 text-sm font-semibold text-slate-900">{group}</h3>
                          </div>
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">{items.length} systems</Badge>
                        </div>
                        <div className="space-y-3">
                          {items.map((item) => (
                            <button key={item.id} type="button" onClick={() => setSelectedDetailId(item.id === 'ext-sap' ? 'ext-sap' : 'api-project-sync')} className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm md:grid-cols-[minmax(0,1.05fr)_0.85fr_0.8fr_0.8fr]">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">{item.systemName}</span>
                                  {statusBadge(item.connectionStatus)}
                                  {environmentBadge(item.environment)}
                                </div>
                                <p className="mt-1 text-xs text-slate-600">{item.integrationType} • {item.direction} • {item.authMethod}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Configure Connection</Button>
                                  <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">View Mapping</Button>
                                  <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Disable Integration</Button>
                                </div>
                              </div>
                              <div className="space-y-1.5 text-xs text-slate-600">
                                <p><span className="font-semibold text-slate-800">Protocol:</span> {item.protocol}</p>
                                <p><span className="font-semibold text-slate-800">Owner:</span> {item.owner}</p>
                                <p><span className="font-semibold text-slate-800">Category:</span> {item.category}</p>
                              </div>
                              <div className="space-y-1.5 text-xs text-slate-600">
                                <p><span className="font-semibold text-slate-800">Sync:</span> {item.dataSyncStatus}</p>
                                <p><span className="font-semibold text-slate-800">Last sync:</span> {item.lastSync}</p>
                                <div>{statusBadge(item.health)}</div>
                              </div>
                              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inline action</p>
                                  <p className="mt-1 text-xs text-slate-700">Test connection</p>
                                </div>
                                <TestTube2 className="h-4 w-4 text-slate-500" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            {activePanel === 'streams' || activePanel === 'monitoring' ? (
            <div className="grid gap-4 2xl:grid-cols-2">
              {activePanel === 'streams' ? (
              <Card id="streams" className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Email & Calendar Integration</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Mail and scheduling connectivity for reminders, approvals, notifications, and meeting synchronization.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Connect Provider', Plus)}
                    {panelAction('Test Notification', Send)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-4">
                  {emailCalendarItems.map((item) => (
                    <div key={item.id} className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{item.provider}</h3>
                          <p className="mt-1 text-xs text-slate-600">{item.syncDirection}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Configure Sync</Button>
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Manage Access</Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs text-slate-600">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Notification usage</p>
                          <p className="mt-1">{item.notificationUsage}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Calendar sync</p>
                          <p className="mt-1">{item.calendarStatus}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Email automation</p>
                          <p className="mt-1">{item.emailAutomationStatus}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              ) : null}

              {activePanel === 'monitoring' ? (
              <Card id="monitoring" className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Dev Tools Integration</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Engineering tool links for source control, CI/CD, work item synchronization, and deployment tracking.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Link Workspace', ArrowRightLeft)}
                    {panelAction('View Activity', Activity)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-4">
                  {devToolItems.map((item) => (
                    <div key={item.id} className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.toolName}</span>
                            {statusBadge(item.status)}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{item.scope}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Configure Mapping</Button>
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Disconnect</Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs text-slate-600">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Linked workspace</p>
                          <p className="mt-1">{item.linkedWorkspace}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Owner</p>
                          <p className="mt-1">{item.owner}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Last activity</p>
                          <p className="mt-1">{item.lastActivity}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              ) : null}
            </div>
            ) : null}

            {activePanel === 'security' || activePanel === 'mapping' ? (
            <div className="grid gap-4 2xl:grid-cols-2">
              {activePanel === 'security' ? (
              <Card id="security" className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Event Streaming</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Event-driven connectivity pipeline for delivery signals, consumer management, replay control, and streaming resilience.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Create Event Stream', Plus)}
                    {panelAction('Replay Event', Play)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-4">
                  {eventStreams.map((stream) => (
                    <button key={stream.id} type="button" onClick={() => setSelectedDetailId(stream.id === 'stream-risk' ? 'stream-risk' : 'api-project-sync')} className="w-full rounded-3xl border border-slate-200 bg-slate-50/75 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{stream.streamName}</span>
                            {environmentBadge(stream.environment)}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{stream.eventType}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Configure Consumer</Button>
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Pause Stream</Button>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Source</p>
                            <p className="mt-1 text-xs text-slate-700">{stream.sourceSystem}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stream</p>
                            <p className="mt-1 text-xs text-slate-700">{stream.streamName}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Destination</p>
                            <p className="mt-1 text-xs text-slate-700">{stream.destination}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs text-slate-600">
                        <p><span className="font-semibold text-slate-800">Throughput:</span> {stream.throughput}</p>
                        <p><span className="font-semibold text-slate-800">Failure rate:</span> {stream.failureRate}</p>
                        <p><span className="font-semibold text-slate-800">Consumers:</span> {stream.consumerStatus}</p>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
              ) : null}

              {activePanel === 'mapping' ? (
              <Card id="mapping" className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Integration Monitoring</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Runtime performance, queue posture, failing integrations, and SLA-focused operational monitoring.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Simulate loading', RefreshCcw, () => pulseLoading('monitoring'))}
                    {panelAction('Export report', Download)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-4">
                  {monitoringLoading ? (
                    <SkeletonRows rows={3} />
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          { label: 'Success rate', value: '98.3%', tone: 'text-emerald-600' },
                          { label: 'Failure count', value: '34', tone: 'text-rose-600' },
                          { label: 'Avg response time', value: '238ms', tone: 'text-slate-900' },
                          { label: 'Queue size', value: '47', tone: 'text-amber-600' },
                          { label: 'Last failure', value: '8 min ago', tone: 'text-slate-900' },
                          { label: 'SLA status', value: 'Within target', tone: 'text-emerald-600' },
                        ].map((item) => (
                          <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
                            <p className={cn('mt-2 text-2xl font-semibold', item.tone)}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Monitoring trend</h3>
                            <p className="text-xs text-slate-500">Synthetic chart placeholder with enterprise health trend and alert inflection points.</p>
                          </div>
                          {statusBadge('Healthy')}
                        </div>
                        <div className="mt-4 flex h-40 items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                          {[48, 56, 52, 62, 70, 78, 82, 88, 80, 91, 94, 97].map((height, index) => (
                            <div key={index} className="flex-1 rounded-t-2xl bg-gradient-to-t from-sky-500 via-cyan-400 to-emerald-300" style={{ height: `${height}%` }} />
                          ))}
                        </div>
                      </div>

                      <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Top failing integrations</h3>
                            <p className="text-xs text-slate-500">Direct drill-down into components requiring retry, escalation, or owner intervention.</p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {[
                            { name: 'SAP S/4HANA Finance', issue: 'Latency spike', impact: '18 min sync lag' },
                            { name: 'Approval Sync Hook', issue: '502 target response', impact: 'Retry queue depth 7' },
                            { name: 'Enterprise Service Bus', issue: 'Consumer lag', impact: 'Replay requested' },
                          ].map((item) => (
                            <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                                <p className="mt-1 text-xs text-slate-600">{item.issue} • {item.impact}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Open Logs</Button>
                                <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Retry</Button>
                                <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Escalate</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              ) : null}
            </div>
            ) : null}

            <div className="grid gap-4 2xl:grid-cols-2">
              <Card className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">API & Integration Security</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Token posture, secret rotation, scope governance, and permission model visibility across integration assets.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Generate API Key', KeyRound)}
                    {panelAction('Rotate Secret', RefreshCcw)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-4">
                  {securityItems.map((item) => (
                    <div key={item.id} className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.asset}</span>
                            {environmentBadge(item.environment)}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{item.authMethod}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Revoke Key</Button>
                          <Button variant="outline" size="sm" className="h-7 rounded-lg border-slate-200 px-2.5 text-[10px]">Review Access Scope</Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-xs text-slate-600">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Token status</p>
                          <p className="mt-1">{item.tokenStatus}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Rotation</p>
                          <p className="mt-1">{item.rotationStatus}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Permission model</p>
                          <p className="mt-1">{item.permissionModel}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><span className="font-semibold text-slate-800">Access scope:</span> {item.accessScope}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-[28px] liquid-glass-enterprise-panel">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Mapping & Payload Configuration</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Data field mapping, transformation logic, validation posture, and low-code payload controls.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panelAction('Test Payload', FileJson)}
                    {panelAction('Validate Schema', BadgeCheck)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-4">
                  <div className="liquid-glass-enterprise-panel overflow-hidden rounded-3xl border">
                    <div className="grid grid-cols-[1fr_1fr_1.15fr_0.8fr_0.75fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <span>Source field</span>
                      <span>Target field</span>
                      <span>Transformation</span>
                      <span>Validation</span>
                      <span>Last tested</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {mappingRows.map((row) => (
                        <div key={row.id} className="grid grid-cols-[1fr_1fr_1.15fr_0.8fr_0.75fr] gap-3 px-4 py-4 text-xs text-slate-600">
                          <span>{row.sourceField}</span>
                          <span>{row.targetField}</span>
                          <span>{row.transformationLogic}</span>
                          <div>{statusBadge(row.validationStatus)}</div>
                          <span>{row.lastTested}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-8 rounded-xl border-slate-200 px-3 text-[11px]">Edit Mapping</Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-xl border-slate-200 px-3 text-[11px]">Save Configuration</Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-xl border-slate-200 px-3 text-[11px]">Test Payload</Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-xl border-slate-200 px-3 text-[11px]">Validate Schema</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {activePanel === 'audit' ? (
            <Card id="audit" className="rounded-[28px] liquid-glass-enterprise-panel">
              <CardHeader className="flex flex-col gap-3 border-b border-slate-100/90 pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Integration Activity & Audit</CardTitle>
                  <CardDescription className="mt-1 text-xs text-slate-500">Audit-friendly operational trail for API calls, webhook delivery, mapping changes, sync events, and token activity.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {panelAction('Open logs', Activity)}
                  {panelAction('Export audit', Download)}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-4">
                <div className="liquid-glass-enterprise-panel overflow-hidden rounded-3xl border">
                  <div className="grid grid-cols-[0.9fr_0.9fr_1.1fr_1fr_0.7fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <span>Timestamp</span>
                    <span>Actor / system</span>
                    <span>Action</span>
                    <span>Related integration</span>
                    <span>Result</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {auditItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-[0.9fr_0.9fr_1.1fr_1fr_0.7fr] gap-3 px-4 py-4 text-xs text-slate-600">
                        <span>{item.timestamp}</span>
                        <span>{item.actor}</span>
                        <span>{item.action}</span>
                        <span className="font-medium text-slate-700">{item.relatedIntegration}</span>
                        <div>{statusBadge(item.result)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card id="detail" className="sticky top-20 rounded-[30px] liquid-glass-enterprise-panel">
              <CardHeader className="border-b border-slate-100/90 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Integration Detail</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">Right-side detail panel for the selected API, webhook, external connection, or event stream.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-500 hover:bg-slate-100"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-4">
                <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] p-4 text-white">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65"><Cable className="h-3.5 w-3.5" />{selectedDetail.kind}</div>
                  <h3 className="mt-3 text-xl font-semibold">{selectedDetail.title}</h3>
                  <p className="mt-2 text-xs text-white/75">{selectedDetail.endpoint}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">{selectedDetail.protocol}</Badge>
                    <Badge className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">{selectedDetail.environment}</Badge>
                    <Badge className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">{selectedDetail.status}</Badge>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Owner</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDetail.owner}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Authentication</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDetail.authentication}</p>
                  </div>
                </div>

                <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                  <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-500" /><h4 className="text-sm font-semibold text-slate-900">Security posture</h4></div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{selectedDetail.securityStatus}</p>
                </div>

                <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                  <div className="flex items-center gap-2"><TableProperties className="h-4 w-4 text-slate-500" /><h4 className="text-sm font-semibold text-slate-900">Mapping configuration</h4></div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{selectedDetail.mappingConfiguration}</p>
                </div>

                <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                  <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-slate-500" /><h4 className="text-sm font-semibold text-slate-900">Monitoring summary</h4></div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{selectedDetail.monitoringSummary}</p>
                </div>

                <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Recent executions</h4>
                  <div className="mt-3 space-y-3">
                    {selectedDetail.recentExecutions.map((item) => (
                      <div key={`${item.label}-${item.time}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                          {statusBadge(item.result)}
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                        <p className="mt-2 text-[11px] text-slate-500">{item.time}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="liquid-glass-enterprise-panel rounded-3xl border p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Error history</h4>
                  <div className="mt-3 space-y-3">
                    {selectedDetail.errorHistory.map((item) => (
                      <div key={`${item.issue}-${item.time}`} className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{item.issue}</p>
                            <p className="mt-1 text-xs text-slate-600">{item.impact}</p>
                            <p className="mt-2 text-[11px] text-slate-500">{item.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button className="h-9 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800">Edit</Button>
                  <Button variant="outline" className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700">Test</Button>
                  <Button variant="outline" className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700">Disable</Button>
                  <Button variant="outline" className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700">Retry</Button>
                  <Button variant="outline" className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700">View Logs</Button>
                  <Button variant="outline" className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700">View Documentation</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] liquid-glass-enterprise-panel">
              <CardHeader className="border-b border-slate-100/90 pb-4">
                <CardTitle className="text-sm font-semibold text-slate-900">Quick actions</CardTitle>
                <CardDescription className="mt-1 text-xs text-slate-500">Inline controls for status, environment, retry, mapping, and token actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                  <Select value={apiStatusOverrides['api-project-sync'] ?? 'Healthy'} onChange={(event) => setApiStatusOverrides((current) => ({ ...current, 'api-project-sync': event.target.value }))} className="mt-2 h-9 rounded-xl border-slate-200 bg-white text-[11px]">
                    {['Healthy', 'Guarded', 'Warning'].map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Environment</p>
                  <Select value={apiEnvironmentOverrides['api-project-sync'] ?? 'Production'} onChange={(event) => setApiEnvironmentOverrides((current) => ({ ...current, 'api-project-sync': event.target.value }))} className="mt-2 h-9 rounded-xl border-slate-200 bg-white text-[11px]">
                    {['Production', 'Staging', 'Sandbox'].map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Retry policy</p>
                  <Select value={webhookRetryOverrides['wh-approval-sync'] ?? 'Exponential'} onChange={(event) => setWebhookRetryOverrides((current) => ({ ...current, 'wh-approval-sync': event.target.value }))} className="mt-2 h-9 rounded-xl border-slate-200 bg-white text-[11px]">
                    {['Linear', 'Exponential', 'Manual'].map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700"><TableProperties className="mr-2 h-4 w-4" />Mapping</Button>
                  <Button variant="outline" className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700"><KeyRound className="mr-2 h-4 w-4" />Token Actions</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}