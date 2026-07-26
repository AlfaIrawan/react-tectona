import { startTransition, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Download,
  Filter,
  LayoutGrid,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Target,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { EnterpriseInfoCallout } from '@/components/layout/EnterpriseInfoCallout'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectItem } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
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

type RoleItem = {
  id: string
  name: string
  description: string
  accessScope: string
  assignedUsers: number
  privilege: 'Privileged' | 'Standard' | 'Elevated'
  status: 'Active' | 'Review' | 'Disabled'
  lastUpdated: string
}

type PermissionMatrixRow = {
  entity: string
  states: Array<'Allow' | 'Conditional' | 'Deny'>
}

type ScopedAccessItem = {
  id: string
  subject: string
  role: string
  scopeType: string
  scopeName: string
  accessLevel: string
  assignmentType: 'Inherited' | 'Direct'
  status: 'Active' | 'Pending Review' | 'Exception'
}

type IdentityProviderItem = {
  id: string
  name: string
  protocol: 'SAML' | 'OAuth' | 'OIDC'
  deploymentRole: 'Authentication Provider' | 'Authorization Provider' | 'Directory / SCIM' | 'Hybrid (AuthN + directory)'
  syncStatus: 'Healthy' | 'Lagging' | 'Action Needed'
  securityHealth: 'Healthy' | 'Review' | 'At risk'
  connectedDomains: string[]
  lastSync: string
  status: 'Active' | 'Draft' | 'Review'
  usersSynced: string
  failedMappingCount: number
  mfaAdoption: string
  authDrift: string
  authorizationDrift: string
  syncFailureTrend: 'Stable' | 'Increasing' | 'Decreasing'
}

type AccessReviewItem = {
  id: string
  name: string
  team: string
  roles: string[]
  highestPrivilege: string
  lastLogin: string
  risk: 'Low' | 'Medium' | 'High'
  flags: string[]
}

type MaskingRuleItem = {
  id: string
  category: string
  maskingRule: string
  maskedFields: string[]
  exceptions: number
  overridePolicy: string
}

type ComplianceItem = {
  id: string
  title: string
  score: string
  status: 'Healthy' | 'At Risk' | 'Critical'
  summary: string
  actions: string[]
}

type AuditEventItem = {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  scope: string
  result: 'Success' | 'Warning' | 'Blocked'
}

type TemplateItem = {
  id: string
  name: string
  purpose: string
  defaultScope: string
  permissions: string[]
  usageCount: string
}

type AlertItem = {
  id: string
  title: string
  severity: 'High' | 'Medium' | 'Critical'
  summary: string
  owner: string
}

type DetailDrawer = {
  title: string
  subtitle: string
  badges: string[]
  metrics: Array<{ label: string; value: string }>
  summary: string
  assignedUsers: string[]
  permissions: string[]
  relatedPolicies: string[]
  auditHistory: Array<{ label: string; detail: string }>
  complianceNotes: string[]
}

const roles: RoleItem[] = [
  {
    id: 'role-01',
    name: 'Workspace Admin',
    description: 'Controls workspace settings, member access, and high-trust governance actions.',
    accessScope: 'Workspace',
    assignedUsers: 18,
    privilege: 'Privileged',
    status: 'Active',
    lastUpdated: 'Today, 09:14',
  },
  {
    id: 'role-02',
    name: 'Project Manager',
    description: 'Manages project execution, approvals, delivery plans, and scoped assignments.',
    accessScope: 'Project',
    assignedUsers: 46,
    privilege: 'Elevated',
    status: 'Active',
    lastUpdated: 'Today, 07:56',
  },
  {
    id: 'role-03',
    name: 'Security Reviewer',
    description: 'Reviews privileged access, exceptions, compliance drift, and audit anomalies.',
    accessScope: 'Organization',
    assignedUsers: 7,
    privilege: 'Privileged',
    status: 'Review',
    lastUpdated: 'Yesterday, 18:08',
  },
  {
    id: 'role-04',
    name: 'Integration Admin',
    description: 'Owns identity-linked integrations, service accounts, API scopes, and secrets posture.',
    accessScope: 'Integration',
    assignedUsers: 11,
    privilege: 'Elevated',
    status: 'Active',
    lastUpdated: 'Yesterday, 12:40',
  },
  {
    id: 'role-05',
    name: 'External Reviewer',
    description: 'Temporary project-level read and review access for third-party oversight.',
    accessScope: 'Project',
    assignedUsers: 23,
    privilege: 'Standard',
    status: 'Disabled',
    lastUpdated: '15 Apr 2026',
  },
]

const permissionMatrix: PermissionMatrixRow[] = [
  { entity: 'Organization', states: ['Allow', 'Conditional', 'Conditional', 'Deny', 'Allow', 'Conditional', 'Allow'] },
  { entity: 'Workspace', states: ['Allow', 'Allow', 'Allow', 'Conditional', 'Allow', 'Allow', 'Allow'] },
  { entity: 'Project', states: ['Allow', 'Allow', 'Allow', 'Conditional', 'Allow', 'Allow', 'Allow'] },
  { entity: 'Task', states: ['Allow', 'Allow', 'Allow', 'Conditional', 'Conditional', 'Conditional', 'Conditional'] },
  { entity: 'Document', states: ['Allow', 'Conditional', 'Allow', 'Conditional', 'Allow', 'Allow', 'Conditional'] },
  { entity: 'Integration', states: ['Allow', 'Allow', 'Conditional', 'Deny', 'Conditional', 'Allow', 'Allow'] },
]

const scopedAccessItems: ScopedAccessItem[] = [
  {
    id: 'scope-01',
    subject: 'PMO Delivery Guild',
    role: 'Project Manager',
    scopeType: 'Workspace',
    scopeName: 'Enterprise Delivery Office',
    accessLevel: 'Full control',
    assignmentType: 'Inherited',
    status: 'Active',
  },
  {
    id: 'scope-02',
    subject: 'Rani Adiputra',
    role: 'Workspace Admin',
    scopeType: 'Project',
    scopeName: 'ERP Modernization Wave 2',
    accessLevel: 'Administrative',
    assignmentType: 'Direct',
    status: 'Active',
  },
  {
    id: 'scope-03',
    subject: 'Vendor Collaboration Team',
    role: 'External Reviewer',
    scopeType: 'Document',
    scopeName: 'Cutover Evidence Pack',
    accessLevel: 'Read only',
    assignmentType: 'Direct',
    status: 'Exception',
  },
  {
    id: 'scope-04',
    subject: 'Integration Operations',
    role: 'Integration Admin',
    scopeType: 'Integration',
    scopeName: 'Workday Provisioning Connector',
    accessLevel: 'Manage runtime',
    assignmentType: 'Inherited',
    status: 'Active',
  },
  {
    id: 'scope-05',
    subject: 'Steering Committee',
    role: 'Security Reviewer',
    scopeType: 'Project',
    scopeName: 'Loan Platform Consolidation',
    accessLevel: 'Review and approve',
    assignmentType: 'Direct',
    status: 'Pending Review',
  },
]

const identityProviders: IdentityProviderItem[] = [
  {
    id: 'idp-01',
    name: 'Microsoft Entra ID',
    protocol: 'OIDC',
    deploymentRole: 'Authentication Provider',
    syncStatus: 'Healthy',
    securityHealth: 'Healthy',
    connectedDomains: ['adira.co.id', 'tectona.ops'],
    lastSync: '4 min ago',
    status: 'Active',
    usersSynced: '12,412',
    failedMappingCount: 2,
    mfaAdoption: '96%',
    authDrift: 'None',
    authorizationDrift: 'None',
    syncFailureTrend: 'Stable',
  },
  {
    id: 'idp-02',
    name: 'Okta Workforce Identity',
    protocol: 'SAML',
    deploymentRole: 'Hybrid (AuthN + directory)',
    syncStatus: 'Lagging',
    securityHealth: 'Review',
    connectedDomains: ['partners.delivery'],
    lastSync: '37 min ago',
    status: 'Review',
    usersSynced: '8,903',
    failedMappingCount: 14,
    mfaAdoption: '88%',
    authDrift: 'Minor claim variance',
    authorizationDrift: 'Within tolerance',
    syncFailureTrend: 'Increasing',
  },
  {
    id: 'idp-03',
    name: 'Azure B2B Project Gateway',
    protocol: 'OAuth',
    deploymentRole: 'Authentication Provider',
    syncStatus: 'Action Needed',
    securityHealth: 'At risk',
    connectedDomains: ['external.review'],
    lastSync: 'Yesterday, 21:18',
    status: 'Draft',
    usersSynced: '216',
    failedMappingCount: 9,
    mfaAdoption: '62%',
    authDrift: 'Pending reconciliation',
    authorizationDrift: 'Elevated',
    syncFailureTrend: 'Increasing',
  },
]

const IDENTITY_GOVERNANCE_ACTIONS = [
  'Review Identity Health',
  'Run Sync',
  'Test Authentication',
  'Review Mapping',
  'View Audit Trail',
  'Open Drift Report',
  'Review MFA Coverage',
  'View Failed Authentication',
  'Review Orphan Accounts',
  'Review Access Drift',
  'Open Compliance Report',
] as const

const accessReviews: AccessReviewItem[] = [
  {
    id: 'review-01',
    name: 'Nadia Kusuma',
    team: 'PMO Operations',
    roles: ['Workspace Admin', 'Project Manager'],
    highestPrivilege: 'Privileged',
    lastLogin: 'Today, 08:41',
    risk: 'High',
    flags: ['Over-privileged', 'Missing quarterly review'],
  },
  {
    id: 'review-02',
    name: 'Bima Arta',
    team: 'Integration Operations',
    roles: ['Integration Admin'],
    highestPrivilege: 'Elevated',
    lastLogin: 'Today, 07:10',
    risk: 'Medium',
    flags: ['External connector owner'],
  },
  {
    id: 'review-03',
    name: 'Anisa Hart',
    team: 'Vendor Oversight',
    roles: ['External Reviewer'],
    highestPrivilege: 'Standard',
    lastLogin: '18 days ago',
    risk: 'High',
    flags: ['Dormant user', 'External user'],
  },
  {
    id: 'review-04',
    name: 'Delivery QA Guild',
    team: 'Quality Engineering',
    roles: ['Project Manager'],
    highestPrivilege: 'Elevated',
    lastLogin: 'Yesterday, 14:28',
    risk: 'Low',
    flags: ['Healthy access posture'],
  },
  {
    id: 'review-05',
    name: 'Unknown Service Account',
    team: 'Unmapped',
    roles: ['Integration Admin'],
    highestPrivilege: 'Privileged',
    lastLogin: 'Never interactive',
    risk: 'High',
    flags: ['Orphaned access', 'Privileged token'],
  },
]

const maskingRules: MaskingRuleItem[] = [
  {
    id: 'mask-01',
    category: 'Confidential project notes',
    maskingRule: 'Mask named stakeholders and decision rationale outside privileged roles.',
    maskedFields: ['decision_notes', 'executive_commentary'],
    exceptions: 3,
    overridePolicy: 'Temporary exception with steering approval only',
  },
  {
    id: 'mask-02',
    category: 'Financial fields',
    maskingRule: 'Partial redact budget variance, commercial margin, and payment exposure details.',
    maskedFields: ['budget_delta', 'margin_projection', 'exposure_limit'],
    exceptions: 2,
    overridePolicy: 'Finance approver and audit witness required',
  },
  {
    id: 'mask-03',
    category: 'Personal user information',
    maskingRule: 'Hide direct identifiers in access review grids and exported audit packages.',
    maskedFields: ['email', 'mobile_number', 'employee_id'],
    exceptions: 1,
    overridePolicy: 'SSO-mapped privileged reviewer only',
  },
]

const complianceItems: ComplianceItem[] = [
  {
    id: 'comp-01',
    title: 'Access certification coverage',
    score: '94%',
    status: 'Healthy',
    summary: 'Quarterly access reviews completed for 212 of 226 in-scope privileged and elevated identities.',
    actions: ['Review Violation', 'Trigger Access Review'],
  },
  {
    id: 'comp-02',
    title: 'Policy exceptions aging',
    score: '71%',
    status: 'At Risk',
    summary: 'Seven temporary elevated-access exceptions will expire within five days without owner confirmation.',
    actions: ['Fix Policy Issue', 'Export Compliance Report'],
  },
  {
    id: 'comp-03',
    title: 'Identity sync integrity',
    score: '63%',
    status: 'Critical',
    summary: 'Partner identity sync lag is causing stale group-to-role mappings in two regulated workspaces.',
    actions: ['Review Violation', 'Trigger Access Review'],
  },
]

const auditEvents: AuditEventItem[] = [
  {
    id: 'audit-01',
    timestamp: '2026-04-17 09:26',
    actor: 'Nadia Kusuma',
    action: 'Role created',
    target: 'Reviewer - Finance Transformation',
    scope: 'Workspace / Enterprise Delivery Office',
    result: 'Success',
  },
  {
    id: 'audit-02',
    timestamp: '2026-04-17 08:58',
    actor: 'System Sync',
    action: 'User access granted',
    target: 'Okta Workforce Identity group sync',
    scope: 'Project / Loan Platform Consolidation',
    result: 'Warning',
  },
  {
    id: 'audit-03',
    timestamp: '2026-04-17 08:14',
    actor: 'Bima Arta',
    action: 'Permission changed',
    target: 'Workday Provisioning Connector',
    scope: 'Integration / HR downstream',
    result: 'Success',
  },
  {
    id: 'audit-04',
    timestamp: '2026-04-17 07:37',
    actor: 'Access Review Job',
    action: 'Access revoked',
    target: 'Dormant vendor reviewer account',
    scope: 'Project / ERP Modernization Wave 2',
    result: 'Success',
  },
  {
    id: 'audit-05',
    timestamp: '2026-04-17 07:03',
    actor: 'Security Reviewer',
    action: 'Data masking rule changed',
    target: 'Confidential project notes policy',
    scope: 'Organization / Sensitive fields',
    result: 'Blocked',
  },
  {
    id: 'audit-06',
    timestamp: '2026-04-17 06:49',
    actor: 'Entra Gateway',
    action: 'SSO configuration updated',
    target: 'B2B external reviewer mapping',
    scope: 'Identity / External review access',
    result: 'Warning',
  },
]

const templates: TemplateItem[] = [
  { id: 'tpl-01', name: 'Workspace Admin', purpose: 'Workspace ownership and policy control', defaultScope: 'Workspace', permissions: ['Manage Access', 'Approve', 'Export'], usageCount: '18 active assignments' },
  { id: 'tpl-02', name: 'Project Manager', purpose: 'Project planning and governance execution', defaultScope: 'Project', permissions: ['Create', 'Edit', 'Approve'], usageCount: '46 active assignments' },
  { id: 'tpl-03', name: 'Contributor', purpose: 'Standard task and document collaboration', defaultScope: 'Task', permissions: ['View', 'Create', 'Edit'], usageCount: '138 active assignments' },
  { id: 'tpl-04', name: 'Reviewer', purpose: 'Approval and review workflows without admin control', defaultScope: 'Document', permissions: ['View', 'Approve', 'Export'], usageCount: '29 active assignments' },
  { id: 'tpl-05', name: 'Auditor', purpose: 'Read-only audit-ready visibility', defaultScope: 'Organization', permissions: ['View', 'Export'], usageCount: '8 active assignments' },
  { id: 'tpl-06', name: 'Integration Admin', purpose: 'Connector and API access stewardship', defaultScope: 'Integration', permissions: ['View', 'Edit', 'Manage Access'], usageCount: '11 active assignments' },
]

const alerts: AlertItem[] = [
  {
    id: 'alert-01',
    title: 'Temporary elevated access exceeded 72 hours',
    severity: 'High',
    summary: 'Two project-level emergency grants are still active without steering re-approval.',
    owner: 'PMO Security Control',
  },
  {
    id: 'alert-02',
    title: 'Failed SSO login spike detected',
    severity: 'Critical',
    summary: 'External reviewer federation saw a 3.4x spike in failed logins after mapping drift.',
    owner: 'Identity Operations',
  },
  {
    id: 'alert-03',
    title: 'Expired permission exceptions pending cleanup',
    severity: 'Medium',
    summary: 'Five exceptions expired but still appear on inherited access chains.',
    owner: 'Security Reviewer Guild',
  },
  {
    id: 'alert-04',
    title: 'Privileged role missing review attestation',
    severity: 'High',
    summary: 'Security Reviewer role in one regulated workspace missed its quarterly sign-off.',
    owner: 'Compliance Operations',
  },
]

const accessDistribution = [
  { name: 'Workspace Admin', value: 18, color: '#0f172a' },
  { name: 'Project Manager', value: 46, color: '#2563eb' },
  { name: 'Integration Admin', value: 11, color: '#0f766e' },
  { name: 'Reviewer', value: 29, color: '#d97706' },
  { name: 'Contributor', value: 138, color: '#7c3aed' },
]

const postureSeries = [
  { label: 'Identity hygiene', score: 93 },
  { label: 'Privileged review coverage', score: 88 },
  { label: 'Policy enforcement', score: 91 },
  { label: 'Sensitive access control', score: 84 },
  { label: 'Exception closure', score: 72 },
]

const reviewTrend = [
  { label: 'Mon', reviews: 81, violations: 5 },
  { label: 'Tue', reviews: 84, violations: 4 },
  { label: 'Wed', reviews: 86, violations: 6 },
  { label: 'Thu', reviews: 92, violations: 3 },
  { label: 'Fri', reviews: 95, violations: 2 },
]

const permissionColumns = ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage Access']

function badgeClass(value: string) {
  if (['Active', 'Healthy', 'Low', 'Direct', 'Success', 'Allow'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (['Review', 'Lagging', 'Medium', 'Pending Review', 'Warning', 'Conditional', 'At Risk', 'Elevated'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (['Disabled', 'Action Needed', 'High', 'Exception', 'Blocked', 'Critical', 'Deny', 'Privileged', 'At risk'].includes(value)) {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function metricCardAccent(index: number) {
  const accents = [
    'from-slate-950 via-slate-800 to-slate-700',
    'from-blue-700 via-blue-600 to-cyan-500',
    'from-emerald-700 via-teal-600 to-cyan-500',
    'from-amber-700 via-orange-600 to-yellow-500',
    'from-rose-700 via-red-600 to-orange-500',
    'from-violet-700 via-fuchsia-600 to-pink-500',
  ]

  return accents[index % accents.length]
}

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]'

  if (cardId === 'rbac') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'reviews') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  if (cardId === 'identity') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
  if (cardId === 'compliance') return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-amber-50/70')
  if (cardId === 'audit') return cn(base, 'bg-gradient-to-br from-orange-50/70 via-white/90 to-yellow-50/70')
  return cn(base, 'bg-gradient-to-br from-cyan-50/70 via-white/90 to-blue-50/70')
}

function KpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`tectona-security-kpi-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#tectona-security-kpi-${color.replace('#', '')})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csvContent = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function buildRoleDetail(role: RoleItem): DetailDrawer {
  return {
    title: role.name,
    subtitle: `${role.accessScope} role • ${role.description}`,
    badges: [role.privilege, role.status, role.accessScope],
    metrics: [
      { label: 'Assigned users', value: `${role.assignedUsers}` },
      { label: 'Last updated', value: role.lastUpdated },
      { label: 'Default scope', value: role.accessScope },
      { label: 'Privilege level', value: role.privilege },
    ],
    summary: 'This role anchors privileged access decisions, scoped inheritance, and audit-ready approval chains across workspace, project, task, and integration surfaces.',
    assignedUsers: ['Nadia Kusuma', 'Rani Adiputra', 'PMO Delivery Guild', 'Identity Operations'],
    permissions: ['Manage Access', 'Approve', 'Export', 'Edit policies'],
    relatedPolicies: ['Quarterly privileged review', 'External reviewer boundary policy', 'Sensitive access exception policy'],
    auditHistory: [
      { label: '09:26', detail: 'Role definition updated with export guardrails.' },
      { label: 'Yesterday', detail: 'Privilege attestation completed by governance reviewer.' },
      { label: 'Last week', detail: 'Inheritance chain reconciled after workspace refactor.' },
    ],
    complianceNotes: ['Role remains in-scope for quarterly certification.', 'No unresolved toxic-combination conflict found.'],
  }
}

function buildAccessDetail(item: ScopedAccessItem): DetailDrawer {
  return {
    title: item.subject,
    subtitle: `${item.role} on ${item.scopeName}`,
    badges: [item.status, item.assignmentType, item.scopeType],
    metrics: [
      { label: 'Access level', value: item.accessLevel },
      { label: 'Role', value: item.role },
      { label: 'Scope', value: `${item.scopeType} / ${item.scopeName}` },
      { label: 'Assignment', value: item.assignmentType },
    ],
    summary: 'Scoped access visibility shows whether the subject inherits permissions from parent governance containers or carries a direct exception that requires tighter monitoring.',
    assignedUsers: [item.subject],
    permissions: ['View', 'Approve', 'Manage scoped records'],
    relatedPolicies: ['Inherited access policy', 'Exception aging rule', 'Project access re-certification'],
    auditHistory: [
      { label: 'Today', detail: 'Scope reassessed after project governance checkpoint.' },
      { label: '2 days ago', detail: 'Assignment inheritance revalidated.' },
    ],
    complianceNotes: ['Direct assignments require periodic owner review.', 'Inherited chains remain visible for audit export.'],
  }
}

function buildProviderDetail(provider: IdentityProviderItem): DetailDrawer {
  return {
    title: provider.name,
    subtitle: `${provider.protocol} · ${provider.deploymentRole} · ${provider.connectedDomains.join(', ')}`,
    badges: [provider.syncStatus, provider.securityHealth, provider.protocol],
    metrics: [
      { label: 'Last sync', value: provider.lastSync },
      { label: 'Users synced', value: provider.usersSynced },
      { label: 'Failed mapping count', value: String(provider.failedMappingCount) },
      { label: 'MFA coverage', value: provider.mfaAdoption },
      { label: 'Authentication drift', value: provider.authDrift },
      { label: 'Authorization drift', value: provider.authorizationDrift },
      { label: 'Sync failure trend', value: provider.syncFailureTrend },
      { label: 'Lifecycle state', value: provider.status },
    ],
    summary:
      'Operational identity posture for this provider: monitor synchronization integrity, federation health, and mapping accuracy. Connector endpoints, secrets, and engine configuration belong in Platform Settings & Administration.',
    assignedUsers: ['Identity Operations', 'Security Reviewer Guild', 'PMO Security Control'],
    permissions: [
      'Review identity health',
      'Run sync',
      'Test authentication',
      'Review mapping',
      'View audit trail',
      'Open drift report',
    ],
    relatedPolicies: ['Federated login assurance', 'Partner identity boundary control', 'JIT access mapping rule'],
    auditHistory: [
      { label: 'Today', detail: 'User group sync evaluated for drift.' },
      { label: 'Yesterday', detail: 'Domain mapping verification exported.' },
    ],
    complianceNotes: [
      `Security health: ${provider.securityHealth}.`,
      `MFA adoption across this connection: ${provider.mfaAdoption}.`,
    ],
  }
}

function buildReviewDetail(review: AccessReviewItem): DetailDrawer {
  return {
    title: review.name,
    subtitle: `${review.team} • ${review.roles.join(', ')}`,
    badges: [review.risk, review.highestPrivilege],
    metrics: [
      { label: 'Last login', value: review.lastLogin },
      { label: 'Highest privilege', value: review.highestPrivilege },
      { label: 'Risk level', value: review.risk },
      { label: 'Role count', value: `${review.roles.length}` },
    ],
    summary: 'Access review evidence combines user context, privilege exposure, dormant signals, and remediation actions required for governance sign-off.',
    assignedUsers: [review.name],
    permissions: review.roles,
    relatedPolicies: ['Dormant access cleanup', 'Privileged access review cadence', 'External user restriction policy'],
    auditHistory: [
      { label: 'Today', detail: 'Review queue refreshed with latest sign-in data.' },
      { label: 'This week', detail: 'Risk scoring recalculated against active role map.' },
    ],
    complianceNotes: review.flags,
  }
}

function buildComplianceDetail(item: ComplianceItem): DetailDrawer {
  return {
    title: item.title,
    subtitle: `${item.status} compliance posture • score ${item.score}`,
    badges: [item.status, item.score],
    metrics: [
      { label: 'Compliance score', value: item.score },
      { label: 'Issue status', value: item.status },
      { label: 'Action count', value: `${item.actions.length}` },
      { label: 'Scope', value: 'Security & access governance' },
    ],
    summary: item.summary,
    assignedUsers: ['Compliance Operations', 'Security Reviewer Guild'],
    permissions: ['Review Violation', 'Fix Policy Issue', 'Trigger Access Review'],
    relatedPolicies: ['Quarterly access certification', 'Temporary elevation SLA', 'Identity sync integrity rule'],
    auditHistory: [
      { label: 'Today', detail: 'Compliance benchmark recalculated from active exceptions.' },
      { label: 'Yesterday', detail: 'Export report prepared for audit committee.' },
    ],
    complianceNotes: ['Residual risk remains visible until closure evidence is attached.'],
  }
}

function buildAuditDetail(item: AuditEventItem): DetailDrawer {
  return {
    title: item.action,
    subtitle: `${item.actor} • ${item.target}`,
    badges: [item.result, item.scope],
    metrics: [
      { label: 'Timestamp', value: item.timestamp },
      { label: 'Actor', value: item.actor },
      { label: 'Target', value: item.target },
      { label: 'Scope', value: item.scope },
    ],
    summary: 'Audit trail evidence captures change actor, governed scope, runtime result, and downstream review context needed for incident or compliance follow-up.',
    assignedUsers: [item.actor],
    permissions: ['Open detail', 'Filter events', 'Export audit log'],
    relatedPolicies: ['Audit retention rule', 'Privileged change logging', 'SSO configuration change monitoring'],
    auditHistory: [
      { label: item.timestamp, detail: `${item.action} on ${item.target}` },
      { label: 'Context', detail: `${item.scope} returned ${item.result}.` },
    ],
    complianceNotes: ['This event is export-ready for evidence packaging.'],
  }
}

function buildTemplateDetail(item: TemplateItem): DetailDrawer {
  return {
    title: item.name,
    subtitle: `${item.defaultScope} template • ${item.purpose}`,
    badges: [item.defaultScope, item.usageCount],
    metrics: [
      { label: 'Purpose', value: item.purpose },
      { label: 'Default scope', value: item.defaultScope },
      { label: 'Usage', value: item.usageCount },
      { label: 'Permission bundle', value: `${item.permissions.length} core grants` },
    ],
    summary: 'Reusable templates accelerate role provisioning while keeping enterprise permission boundaries standardized and auditable.',
    assignedUsers: ['Template Catalog Owner', 'Workspace Admins'],
    permissions: item.permissions,
    relatedPolicies: ['Template approval policy', 'Role duplication guardrail', 'Least-privilege standard bundle'],
    auditHistory: [
      { label: 'This week', detail: 'Template adoption expanded into two regulated workspaces.' },
      { label: 'Last month', detail: 'Permission bundle standardized with governance approval.' },
    ],
    complianceNotes: ['Template use lowers variance across similar access profiles.'],
  }
}

function buildAlertDetail(item: AlertItem): DetailDrawer {
  return {
    title: item.title,
    subtitle: `${item.severity} severity • owner ${item.owner}`,
    badges: [item.severity, item.owner],
    metrics: [
      { label: 'Severity', value: item.severity },
      { label: 'Owner', value: item.owner },
      { label: 'Affected control', value: 'Security exceptions and identity governance' },
      { label: 'Action path', value: 'Investigate, revoke, escalate, approve exception' },
    ],
    summary: item.summary,
    assignedUsers: [item.owner],
    permissions: ['Investigate', 'Revoke', 'Approve Exception', 'Escalate'],
    relatedPolicies: ['Emergency elevation policy', 'SSO anomaly response', 'Privileged role review SLA'],
    auditHistory: [
      { label: 'Now', detail: 'Alert remains open and visible in command surface.' },
      { label: 'Recent', detail: 'Escalation path attached for control owner follow-up.' },
    ],
    complianceNotes: ['Alert cannot be cleared without remediation evidence.'],
  }
}

function Panel({
  id,
  title,
  description,
  highlight,
  right,
  children,
}: {
  id: string
  title: string
  description: string
  highlight: boolean
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-3xl border bg-white/90 shadow-[0_16px_50px_rgba(15,23,42,0.08)] transition-all',
        highlight ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/80'
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
          <div className="h-3 w-1/4 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

function ActionPills({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

type PanelItem = {
  id:
    | 'overview'
    | 'rbac'
    | 'permissions'
    | 'scoped-access'
    | 'identity'
    | 'reviews'
    | 'masking'
    | 'compliance'
    | 'audit'
    | 'templates'
    | 'alerts'
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  group: 'Command Center' | 'Control Library' | 'Assurance & Traceability'
}

const PANEL_ITEMS: PanelItem[] = [
  {
    id: 'overview',
    label: 'Security Overview',
    description: 'Executive posture, distribution, and cadence signal.',
    icon: LayoutGrid,
    badge: 'Command',
    group: 'Command Center',
  },
  {
    id: 'rbac',
    label: 'RBAC',
    description: 'Authorization roles with privilege, scope, and lifecycle.',
    icon: BadgeCheck,
    badge: 'Core',
    group: 'Control Library',
  },
  {
    id: 'permissions',
    label: 'Permission Matrix',
    description: 'Entity-level grants across platform domains.',
    icon: ShieldCheck,
    badge: 'Model',
    group: 'Control Library',
  },
  {
    id: 'scoped-access',
    label: 'Scoped Access',
    description: 'Inheritance chains and assignment governance.',
    icon: Target,
    badge: 'Scope',
    group: 'Control Library',
  },
  {
    id: 'identity',
    label: 'Identity Governance & Operational Monitoring',
    description: 'Provider posture, drift, MFA coverage, and sync integrity.',
    icon: Network,
    badge: 'Gov',
    group: 'Assurance & Traceability',
  },
  {
    id: 'reviews',
    label: 'Access Review',
    description: 'Risk-based review queue before certification.',
    icon: Activity,
    badge: 'Review',
    group: 'Assurance & Traceability',
  },
  {
    id: 'masking',
    label: 'Data Masking',
    description: 'Sensitive field visibility and exceptions.',
    icon: BellRing,
    badge: 'Data',
    group: 'Assurance & Traceability',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Scorecards and policy monitoring.',
    icon: ShieldCheck,
    badge: 'Policy',
    group: 'Assurance & Traceability',
  },
  {
    id: 'audit',
    label: 'Audit Log',
    description: 'Audit-ready change history and export.',
    icon: Download,
    badge: 'Audit',
    group: 'Assurance & Traceability',
  },
  {
    id: 'templates',
    label: 'Templates',
    description: 'Reusable role and access templates.',
    icon: LayoutGrid,
    badge: 'Catalog',
    group: 'Control Library',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    description: 'Exceptions and anomaly queue.',
    icon: AlertTriangle,
    badge: 'Risk',
    group: 'Assurance & Traceability',
  },
]

const PANEL_GROUPS: Array<{ group: PanelItem['group']; items: PanelItem[] }> = [
  { group: 'Command Center', items: PANEL_ITEMS.filter((item) => item.group === 'Command Center') },
  { group: 'Control Library', items: PANEL_ITEMS.filter((item) => item.group === 'Control Library') },
  { group: 'Assurance & Traceability', items: PANEL_ITEMS.filter((item) => item.group === 'Assurance & Traceability') },
]

export function SecurityAccessControlPage() {
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [identityFilter, setIdentityFilter] = useState('all')
  const [permissionStatusFilter, setPermissionStatusFilter] = useState('all')
  const [complianceStatusFilter, setComplianceStatusFilter] = useState('all')
  const [workspaceFilter, setWorkspaceFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [userTypeFilter, setUserTypeFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<'Role' | 'Team' | 'Workspace' | 'Project' | 'Compliance'>('Role')
  const [selectedMatrixRole, setSelectedMatrixRole] = useState(roles[0].name)
  const [spotlightSection, setSpotlightSection] = useState<string | null>('overview')
  const [detailDrawer, setDetailDrawer] = useState<DetailDrawer>(buildRoleDetail(roles[0]))
  const [permissionMatrixLoading, setPermissionMatrixLoading] = useState(true)
  const [accessReviewLoading, setAccessReviewLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(true)
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [activePanel, setActivePanel] = useState<(typeof PANEL_ITEMS)[number]['id']>('overview')

  const deferredSearch = useDeferredValue(searchInput)

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
    searchInput,
    showFiltersPanel,
    groupBy,
    roleFilter,
    scopeFilter,
    identityFilter,
    permissionStatusFilter,
    complianceStatusFilter,
    workspaceFilter,
    projectFilter,
    teamFilter,
    userTypeFilter,
    permissionMatrixLoading,
    accessReviewLoading,
    auditLoading,
  ])

  useEffect(() => {
    const permissionTimer = window.setTimeout(() => setPermissionMatrixLoading(false), 650)
    const reviewTimer = window.setTimeout(() => setAccessReviewLoading(false), 900)
    const auditTimer = window.setTimeout(() => setAuditLoading(false), 1200)

    return () => {
      window.clearTimeout(permissionTimer)
      window.clearTimeout(reviewTimer)
      window.clearTimeout(auditTimer)
    }
  }, [])

  const filteredRoles = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return roles.filter((role) => {
      const matchesQuery =
        !query ||
        [role.name, role.description, role.accessScope, role.status, role.privilege]
          .join(' ')
          .toLowerCase()
          .includes(query)

      const matchesRole = roleFilter === 'all' || role.name === roleFilter
      const matchesScope = scopeFilter === 'all' || role.accessScope === scopeFilter
      const matchesPermissionStatus = permissionStatusFilter === 'all' || role.status === permissionStatusFilter

      return matchesQuery && matchesRole && matchesScope && matchesPermissionStatus
    })
  }, [deferredSearch, permissionStatusFilter, roleFilter, scopeFilter])

  const filteredScopedAccess = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return scopedAccessItems.filter((item) => {
      const matchesQuery =
        !query ||
        [item.subject, item.role, item.scopeType, item.scopeName, item.status, item.accessLevel]
          .join(' ')
          .toLowerCase()
          .includes(query)

      const matchesRole = roleFilter === 'all' || item.role === roleFilter
      const matchesScope = scopeFilter === 'all' || item.scopeType === scopeFilter
      const matchesWorkspace = workspaceFilter === 'all' || item.scopeName.includes(workspaceFilter)
      const matchesProject = projectFilter === 'all' || item.scopeName.includes(projectFilter)
      const matchesTeam = teamFilter === 'all' || item.subject.includes(teamFilter)
      const matchesUserType =
        userTypeFilter === 'all' || (userTypeFilter === 'Service Account' ? item.subject.toLowerCase().includes('service') : true)

      return matchesQuery && matchesRole && matchesScope && matchesWorkspace && matchesProject && matchesTeam && matchesUserType
    })
  }, [deferredSearch, projectFilter, roleFilter, scopeFilter, teamFilter, userTypeFilter, workspaceFilter])

  const filteredProviders = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return identityProviders.filter((provider) => {
      const matchesQuery =
        !query ||
        [provider.name, provider.protocol, provider.syncStatus, provider.status, provider.connectedDomains.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(query)

      const matchesIdentity = identityFilter === 'all' || provider.name === identityFilter

      return matchesQuery && matchesIdentity
    })
  }, [deferredSearch, identityFilter])

  const filteredReviews = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return accessReviews.filter((review) => {
      const matchesQuery =
        !query ||
        [review.name, review.team, review.roles.join(' '), review.highestPrivilege, review.flags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(query)

      const matchesRole = roleFilter === 'all' || review.roles.includes(roleFilter)
      const matchesTeam = teamFilter === 'all' || review.team.includes(teamFilter)
      const matchesCompliance =
        complianceStatusFilter === 'all' ||
        (complianceStatusFilter === 'Healthy' && review.risk === 'Low') ||
        (complianceStatusFilter === 'At Risk' && review.risk === 'Medium') ||
        (complianceStatusFilter === 'Critical' && review.risk === 'High')

      return matchesQuery && matchesRole && matchesTeam && matchesCompliance
    })
  }, [complianceStatusFilter, deferredSearch, roleFilter, teamFilter])

  const filteredCompliance = useMemo(() => {
    if (complianceStatusFilter === 'all') {
      return complianceItems
    }

    return complianceItems.filter((item) => item.status === complianceStatusFilter)
  }, [complianceStatusFilter])

  const filteredAudit = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return auditEvents.filter((item) => {
      const matchesQuery =
        !query ||
        [item.timestamp, item.actor, item.action, item.target, item.scope, item.result]
          .join(' ')
          .toLowerCase()
          .includes(query)

      return matchesQuery
    })
  }, [deferredSearch])

  const overviewCards = useMemo(
    () => [
      { label: 'Total Roles', value: `${roles.length}`, detail: 'Reusable access profiles across platform scopes', section: 'rbac' },
      { label: 'Active Users', value: '226', detail: 'Identities with current platform access', section: 'reviews' },
      { label: 'SSO / federated users', value: '187', detail: 'Identities federated via enterprise IdP connections', section: 'identity' },
      { label: 'Privileged Roles', value: `${roles.filter((role) => role.privilege === 'Privileged').length}`, detail: 'Roles with elevated or administrative impact', section: 'rbac' },
      { label: 'Policy Violations', value: '12', detail: 'Open issues across reviews, exceptions, and sync drift', section: 'compliance' },
      { label: 'Audit Events Today', value: `${auditEvents.length}`, detail: 'Security-relevant events visible for export', section: 'audit' },
    ],
    []
  )

  const currentMatrixRole = useMemo(
    () => roles.find((role) => role.name === selectedMatrixRole) ?? roles[0],
    [selectedMatrixRole]
  )

  const accessSummary = useMemo(() => {
    return {
      adoption: '83%',
      privilegedCoverage: '94%',
      exceptionAging: '7 open',
      syncIssues: '2 active',
    }
  }, [])

  const handleSearchChange = (value: string) => {
    startTransition(() => setSearchInput(value))
  }

  const exportAccessReport = () => {
    downloadCsv('tectona-security-access-report.csv', [
      ['Type', 'Name', 'Scope', 'Status'],
      ...roles.map((role) => ['Role', role.name, role.accessScope, role.status]),
      ...scopedAccessItems.map((item) => ['Scoped Access', item.subject, item.scopeName, item.status]),
    ])
  }

  const isOverviewSectionActive = activePanel === 'overview'

  return (
    <div className="space-y-6 pb-10 text-slate-900">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
        <Breadcrumb items={[{ label: 'Security & Access Control' }]} />

        <PageHeader
          title="Security & Access Control"
          description="Operational security governance for the platform—roles, permissions, scoped access, identity posture, data protection, and compliance readiness. Connector infrastructure and IAM engine configuration are maintained in Platform Settings & Administration."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="Export access report"
                  title="Export access report"
                  onClick={exportAccessReport}
                >
                  <Download className="h-5 w-5" strokeWidth={2} />
                </button>
                {!isOverviewSectionActive ? (
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel((current) => !current)}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm',
                      showFiltersPanel && 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    )}
                    aria-label={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                    title={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                  >
                    <Target className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : null}
              </div>

              <Button
                className="h-10 rounded-xl px-4"
                onClick={() => {
                  setSpotlightSection('rbac')
                  setDetailDrawer(buildTemplateDetail(templates[0]))
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Role
              </Button>
              <Link
                to="/platform-settings-administration?section=access"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-10 rounded-xl px-4 no-underline')}
              >
                <span className="inline-flex items-center">
                  <Network className="mr-2 h-4 w-4" />
                  Open IAM control plane
                </span>
              </Link>
              <Button
                variant="outline"
                className="h-10 rounded-xl px-4"
                onClick={() => {
                  setSpotlightSection('compliance')
                  setDetailDrawer(buildComplianceDetail(complianceItems[1]))
                }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Security Policy Settings
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {overviewCards.map((card, index) => (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                setSpotlightSection(card.section)
                if (card.section === 'rbac') setDetailDrawer(buildRoleDetail(roles[0]))
                if (card.section === 'identity') setDetailDrawer(buildProviderDetail(identityProviders[0]))
                if (card.section === 'audit') setDetailDrawer(buildAuditDetail(auditEvents[0]))
                if (card.section === 'compliance') setDetailDrawer(buildComplianceDetail(complianceItems[0]))
                if (card.section === 'reviews') setDetailDrawer(buildReviewDetail(accessReviews[0]))
                setActivePanel(card.section as (typeof PANEL_ITEMS)[number]['id'])
              }}
              className="group text-left"
            >
              <Card className={kpiCardChrome(card.section)}>
                <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.08] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.12]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-slate-700/80 ring-1 ring-white/50 backdrop-blur-sm">
                    <LayoutGrid className="h-7 w-7" />
                  </div>
                </div>

                <div className="text-xs text-slate-500">{card.label}</div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{card.value}</div>
                  <div className="h-10 min-w-0 flex-1">
                    <KpiSparkline data={[10, 12, 11, 13, 12, 14, 14, 15]} color={index % 2 === 0 ? '#2563eb' : '#10b981'} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="min-w-0 truncate">{card.detail}</span>
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r', metricCardAccent(index))} />
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
            aria-label="Security workspace navigation"
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
                  aria-label={isWorkspaceCollapsed ? 'Expand security workspace navigation' : 'Collapse security workspace navigation'}
                  title={isWorkspaceCollapsed ? 'Expand security workspace navigation' : 'Collapse security workspace navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                >
                  {isWorkspaceCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </div>

              {!isWorkspaceCollapsed && !enterpriseNavSimpleList ? (
                <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Security Workspace</div>
                  <div className="mt-2 text-base font-semibold leading-tight">Control tower for access governance and audit-ready assurance</div>
                </div>
              ) : null}
            </div>

            <div className={workspaceNavMenuScrollClass()}>
              <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                {PANEL_GROUPS.map(({ group, items }) => (
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
                          {active ? (
                            <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-600" />
                          ) : null}
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

              <div className={cn('mt-4 space-y-4', isWorkspaceCollapsed && 'hidden')}>
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <ShieldCheck className="h-4 w-4" />
                    Security posture
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900">89%</div>
                  <p className="mt-1 text-xs text-slate-600">
                    Federated identity and privileged review coverage remain healthy with exceptions needing closure.
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-blue-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: '89%' }} />
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">Grouped by {groupBy}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className={cn('min-w-0', workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
          {!isOverviewSectionActive && showFiltersPanel ? (
            <Card className="rounded-2xl p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="search"
                    value={searchInput}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="Search role name, user, team, workspace, project, or policy"
                    className="h-11 rounded-2xl border-slate-200 bg-white pl-9"
                  />
                </div>

                <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <SelectItem value="all">Role: All</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </Select>
                <Select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
                  <SelectItem value="all">Access scope: All</SelectItem>
                  {['Organization', 'Workspace', 'Project', 'Task', 'Document', 'Integration'].map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {scope}
                    </SelectItem>
                  ))}
                </Select>
                <Select value={identityFilter} onChange={(event) => setIdentityFilter(event.target.value)}>
                  <SelectItem value="all">Identity provider: All</SelectItem>
                  {identityProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.name}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </Select>
                <Select value={permissionStatusFilter} onChange={(event) => setPermissionStatusFilter(event.target.value)}>
                  <SelectItem value="all">Permission status: All</SelectItem>
                  {['Active', 'Review', 'Disabled'].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </Select>
                <Select value={complianceStatusFilter} onChange={(event) => setComplianceStatusFilter(event.target.value)}>
                  <SelectItem value="all">Compliance status: All</SelectItem>
                  {['Healthy', 'At Risk', 'Critical'].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </Select>
                <Select value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)}>
                  <SelectItem value="all">Workspace: All</SelectItem>
                  <SelectItem value="Enterprise Delivery Office">Enterprise Delivery Office</SelectItem>
                  <SelectItem value="Loan Platform">Loan Platform</SelectItem>
                </Select>
                <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                  <SelectItem value="all">Project: All</SelectItem>
                  <SelectItem value="ERP Modernization">ERP Modernization</SelectItem>
                  <SelectItem value="Loan Platform Consolidation">Loan Platform Consolidation</SelectItem>
                </Select>
                <Select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                  <SelectItem value="all">Team: All</SelectItem>
                  <SelectItem value="PMO">PMO</SelectItem>
                  <SelectItem value="Integration">Integration</SelectItem>
                  <SelectItem value="Quality">Quality</SelectItem>
                </Select>
                <Select value={userTypeFilter} onChange={(event) => setUserTypeFilter(event.target.value)}>
                  <SelectItem value="all">User type: All</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="External">External</SelectItem>
                  <SelectItem value="Service Account">Service Account</SelectItem>
                </Select>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
            <div className="space-y-6">
              {activePanel === 'overview' ? (
                <Panel
                  id="overview"
                  title="Security Overview"
                  description={`Enterprise control center for role governance, federated identity, and policy clarity. Current view grouped by ${groupBy.toLowerCase()}.`}
                  highlight={activePanel === 'overview'}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
                    <div className="rounded-[22px] border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Security posture widget</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Compact control view across identity, privileged reviews, policy enforcement, and exception closure.
                          </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          Overall posture 89%
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-3">
                        {postureSeries.map((entry) => (
                          <button
                            key={entry.label}
                            type="button"
                            onClick={() => {
                              setSpotlightSection('compliance')
                              setDetailDrawer(buildComplianceDetail(complianceItems[0]))
                              setActivePanel('compliance')
                            }}
                            className="w-full text-left"
                          >
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                              <span>{entry.label}</span>
                              <span className="font-semibold text-slate-900">{entry.score}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400"
                                style={{ width: `${entry.score}%` }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Access distribution</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Distribution by role and scope to surface concentration of elevated access.
                            </p>
                          </div>
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                            Role weighted
                          </Badge>
                        </div>
                        <div className="mt-4 h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={accessDistribution} dataKey="value" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={3}>
                                {accessDistribution.map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">Review cadence</p>
                        <p className="mt-1 text-[11px] text-slate-500">Access review completion versus violations this week.</p>
                        <div className="mt-4 h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={reviewTrend}>
                              <defs>
                                <linearGradient id="reviewArea" x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                              <Tooltip />
                              <Area type="monotone" dataKey="reviews" stroke="#2563eb" fill="url(#reviewArea)" strokeWidth={2.5} />
                              <Bar dataKey="violations" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'rbac' ? (
                <Panel
                  id="rbac"
                  title="Role-Based Access Control"
                  description="Authorization roles with privilege level, scope, status, and inline assignment controls—the system of record for who may do what on the platform."
                  highlight={activePanel === 'rbac'}
                  right={<ActionPills labels={['Open Role', 'Edit Role', 'Duplicate Role', 'Disable Role', 'Assign Users']} />}
                >
                  <EnterpriseInfoCallout className="mb-4" title="Separation of concerns">
                    Role definitions and permission assignments here are the system of record for platform authorization.
                    Workspace membership and participation are managed in{' '}
                    <a href="/workspace-management" className="font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-200">
                      Workspace Management
                    </a>
                    ; operational staffing and allocation live in{' '}
                    <a href="/resource-management" className="font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-200">
                      Resource Management
                    </a>
                    .
                  </EnterpriseInfoCallout>
                  <div className="overflow-hidden rounded-[20px] border border-slate-200/80">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50/90 text-slate-500">
                        <tr>
                          {['Role', 'Scope', 'Assigned Users', 'Privilege', 'Status', 'Last Updated', 'Actions'].map((header) => (
                            <th key={header} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em]">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRoles.map((role) => (
                          <tr key={role.id} className="border-t border-slate-100 bg-white transition-colors hover:bg-blue-50/35">
                            <td className="px-4 py-4 align-top">
                              <button type="button" className="text-left" onClick={() => setDetailDrawer(buildRoleDetail(role))}>
                                <div className="font-semibold text-slate-900">{role.name}</div>
                                <div className="mt-1 text-[11px] leading-5 text-slate-500">{role.description}</div>
                              </button>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <Badge variant="outline" className={badgeClass(role.accessScope)}>
                                {role.accessScope}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 align-top text-slate-700">{role.assignedUsers}</td>
                            <td className="px-4 py-4 align-top">
                              <Badge variant="outline" className={badgeClass(role.privilege)}>
                                {role.privilege}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <Badge variant="outline" className={badgeClass(role.status)}>
                                {role.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 align-top text-slate-700">{role.lastUpdated}</td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="h-8 rounded-xl px-3" onClick={() => setDetailDrawer(buildRoleDetail(role))}>
                                  Open Role
                                </Button>
                                <Button variant="ghost" className="h-8 rounded-xl px-3 text-slate-600">
                                  Assign Users
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'permissions' ? (
                <Panel
                  id="permissions"
                  title="Permission Matrix"
                  description="Fine-grained permission grid across organization, workspace, project, task, document, and integration entities."
                  highlight={activePanel === 'permissions'}
                  right={
                    <div className="flex items-center gap-2">
                      <Select value={selectedMatrixRole} onChange={(event) => setSelectedMatrixRole(event.target.value)} className="min-w-[180px]">
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </Select>
                      <ActionPills labels={['Edit Permissions', 'Apply Template', 'Compare Roles']} />
                    </div>
                  }
                >
                  {permissionMatrixLoading ? (
                    <LoadingSkeleton rows={5} />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-[18px] border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-800">
                        <span>{currentMatrixRole.name} permission profile</span>
                        <span>
                          {currentMatrixRole.privilege} • {currentMatrixRole.accessScope}
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-[20px] border border-slate-200/80">
                        <table className="min-w-full text-center text-xs">
                          <thead className="bg-slate-50/90 text-slate-500">
                            <tr>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em]">Entity</th>
                              {permissionColumns.map((column) => (
                                <th key={column} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em]">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {permissionMatrix.map((row) => (
                              <tr key={row.entity} className="border-t border-slate-100 bg-white hover:bg-blue-50/35">
                                <td className="px-4 py-4 text-left font-semibold text-slate-900">{row.entity}</td>
                                {row.states.map((state, index) => (
                                  <td key={`${row.entity}-${permissionColumns[index]}`} className="px-3 py-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDetailDrawer(buildRoleDetail(currentMatrixRole))
                                        setSpotlightSection('permissions')
                                      }}
                                      className={cn(
                                        'inline-flex min-w-[82px] items-center justify-center rounded-full border px-2.5 py-1.5 text-[11px] font-semibold',
                                        badgeClass(state)
                                      )}
                                    >
                                      {state}
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Panel>
              ) : null}

              {activePanel === 'scoped-access' ? (
                <Panel
                  id="scoped-access"
                  title="Scoped Access Management"
                  description="Assignments by workspace, project, task, document, and integration scope with inheritance visibility."
                  highlight={activePanel === 'scoped-access'}
                  right={<ActionPills labels={['Assign Access', 'Remove Access', 'Change Scope', 'Review Inheritance']} />}
                >
                  <div className="space-y-3">
                    {filteredScopedAccess.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[20px] border border-slate-200/80 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <button type="button" className="text-left" onClick={() => setDetailDrawer(buildAccessDetail(item))}>
                            <div className="font-semibold text-slate-900">{item.subject}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {item.scopeType} / {item.scopeName}
                            </div>
                          </button>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={badgeClass(item.role)}>
                              {item.role}
                            </Badge>
                            <Badge variant="outline" className={badgeClass(item.assignmentType)}>
                              {item.assignmentType}
                            </Badge>
                            <Badge variant="outline" className={badgeClass(item.status)}>
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-[12px] text-slate-600 md:grid-cols-3">
                          <span>
                            <span className="font-semibold text-slate-900">Access level:</span> {item.accessLevel}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Role:</span> {item.role}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Grouping:</span> {groupBy}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'identity' ? (
                <Panel
                  id="identity"
                  title="Identity Governance & Operational Monitoring"
                  description="Monitor operational identity posture, synchronization integrity, MFA adoption, authentication drift, and compliance readiness for connected providers."
                  highlight={activePanel === 'identity'}
                  right={<ActionPills labels={[...IDENTITY_GOVERNANCE_ACTIONS]} />}
                >
                  <EnterpriseInfoCallout title="Governance vs. configuration" className="rounded-[20px] text-[11px]">
                    <span>
                      This workspace monitors operational identity posture, synchronization health, access governance, authentication integrity, and compliance readiness. Connector infrastructure and authorization engine configuration are managed in{' '}
                    </span>
                    <Link to="/platform-settings-administration?section=access" className="font-semibold text-primary hover:underline">
                      Platform Settings &amp; Administration
                    </Link>
                    .
                  </EnterpriseInfoCallout>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    {filteredProviders.map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setDetailDrawer(buildProviderDetail(provider))}
                        className="rounded-[20px] border border-slate-200/80 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{provider.name}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {provider.protocol} · {provider.deploymentRole}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">{provider.connectedDomains.join(', ')}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge variant="outline" className={badgeClass(provider.syncStatus)}>
                              {provider.syncStatus}
                            </Badge>
                            <Badge variant="outline" className={badgeClass(provider.securityHealth)}>
                              {provider.securityHealth}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-[12px] text-slate-600 md:grid-cols-2">
                          <span>
                            <span className="font-semibold text-slate-900">Last sync:</span> {provider.lastSync}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Lifecycle:</span> {provider.status}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Users synced:</span> {provider.usersSynced}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Failed mapping:</span> {provider.failedMappingCount}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">MFA coverage:</span> {provider.mfaAdoption}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Auth drift:</span> {provider.authDrift}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Authorization drift:</span> {provider.authorizationDrift}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-900">Sync failure trend:</span> {provider.syncFailureTrend}
                          </span>
                          <span className="md:col-span-2">
                            <span className="font-semibold text-slate-900">Security health:</span> {provider.securityHealth}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'reviews' ? (
                <Panel
                  id="reviews"
                  title="User Access Review"
                  description="Review risk indicators, dormant identities, orphaned access, and over-privileged assignments before re-certification."
                  highlight={activePanel === 'reviews'}
                  right={<ActionPills labels={['Review Access', 'Revoke Access', 'Downgrade Role', 'Export Review']} />}
                >
                  {accessReviewLoading ? (
                    <LoadingSkeleton rows={4} />
                  ) : (
                    <div className="space-y-3">
                      {filteredReviews.map((review) => (
                        <div
                          key={review.id}
                          className="rounded-[20px] border border-slate-200/80 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <button type="button" className="text-left" onClick={() => setDetailDrawer(buildReviewDetail(review))}>
                              <div className="font-semibold text-slate-900">{review.name}</div>
                              <div className="mt-1 text-[11px] text-slate-500">
                                {review.team} • {review.roles.join(', ')}
                              </div>
                            </button>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className={badgeClass(review.risk)}>
                                {review.risk}
                              </Badge>
                              <Badge variant="outline" className={badgeClass(review.highestPrivilege)}>
                                {review.highestPrivilege}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 text-[12px] text-slate-600">
                            <span className="font-semibold text-slate-900">Last login:</span> {review.lastLogin}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {review.flags.map((flag) => (
                              <Badge key={flag} variant="outline" className={badgeClass(flag.includes('Healthy') ? 'Healthy' : review.risk)}>
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              ) : null}

              {activePanel === 'masking' ? (
                <Panel
                  id="masking"
                  title="Data Masking & Sensitive Access"
                  description="Sensitive data categories, masking rules, exception coverage, and override policies linked to enterprise access controls."
                  highlight={activePanel === 'masking'}
                  right={<ActionPills labels={['Configure Masking', 'Add Rule', 'Test Visibility', 'Review Exceptions']} />}
                >
                  <div className="space-y-3">
                    {maskingRules.map((rule) => (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => {
                          setDetailDrawer({
                            title: rule.category,
                            subtitle: rule.maskingRule,
                            badges: ['Sensitive access', `${rule.exceptions} exceptions`],
                            metrics: [
                              { label: 'Masked fields', value: rule.maskedFields.join(', ') },
                              { label: 'Exceptions', value: `${rule.exceptions}` },
                              { label: 'Override policy', value: rule.overridePolicy },
                              { label: 'Category', value: rule.category },
                            ],
                            summary:
                              'Sensitive-field governance ensures privileged access does not automatically reveal confidential notes, regulated financial figures, or personal identifiers without explicit policy authorization.',
                            assignedUsers: ['Security Reviewer Guild', 'Audit Operations'],
                            permissions: ['Configure Masking', 'Test Visibility', 'Review Exceptions'],
                            relatedPolicies: ['Sensitive field masking baseline', 'Break-glass visibility policy', 'Export sanitization control'],
                            auditHistory: [
                              { label: 'This week', detail: 'Masking rule evaluated against privileged role templates.' },
                              { label: 'Last release', detail: 'Override controls tightened for financial fields.' },
                            ],
                            complianceNotes: ['Overrides require explicit policy evidence.', 'Masked exports stay aligned with audit packaging controls.'],
                          })
                        }}
                        className="w-full rounded-[20px] border border-slate-200/80 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{rule.category}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{rule.maskingRule}</div>
                          </div>
                          <Badge variant="outline" className={badgeClass(rule.exceptions > 2 ? 'High' : 'Medium')}>
                            {rule.exceptions} exceptions
                          </Badge>
                        </div>
                        <div className="mt-3 text-[12px] text-slate-600">
                          <span className="font-semibold text-slate-900">Masked fields:</span> {rule.maskedFields.join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'compliance' ? (
                <Panel
                  id="compliance"
                  title="Compliance & Policy Monitoring"
                  description="Scorecards for policy adherence, missing reviews, expired exceptions, and identity sync integrity."
                  highlight={activePanel === 'compliance'}
                  right={<ActionPills labels={['Review Violation', 'Fix Policy Issue', 'Trigger Access Review', 'Export Compliance Report']} />}
                >
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                    {filteredCompliance.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDetailDrawer(buildComplianceDetail(item))}
                        className="rounded-[20px] border border-slate-200/80 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{item.summary}</div>
                          </div>
                          <Badge variant="outline" className={badgeClass(item.status)}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="font-semibold text-slate-900">Score:</span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">{item.score}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.actions.map((action) => (
                            <span key={action} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                              {action}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'audit' ? (
                <Panel
                  id="audit"
                  title="Audit Log"
                  description="Audit-ready event stream for role creation, permission changes, access grants, revocations, SSO updates, and policy breaches."
                  highlight={activePanel === 'audit'}
                  right={<ActionPills labels={['Filter Events', 'Export Audit Log', 'Open Detail']} />}
                >
                  {auditLoading ? (
                    <LoadingSkeleton rows={5} />
                  ) : (
                    <div className="overflow-hidden rounded-[20px] border border-slate-200/80">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50/90 text-slate-500">
                          <tr>
                            {['Timestamp', 'Actor', 'Action', 'Target Object', 'Scope', 'Result'].map((header) => (
                              <th key={header} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em]">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAudit.map((event) => (
                            <tr key={event.id} className="border-t border-slate-100 bg-white hover:bg-blue-50/35">
                              <td className="px-4 py-4 text-slate-700">{event.timestamp}</td>
                              <td className="px-4 py-4 text-slate-700">{event.actor}</td>
                              <td className="px-4 py-4">
                                <button type="button" className="font-semibold text-slate-900 hover:text-blue-700" onClick={() => setDetailDrawer(buildAuditDetail(event))}>
                                  {event.action}
                                </button>
                              </td>
                              <td className="px-4 py-4 text-slate-700">{event.target}</td>
                              <td className="px-4 py-4 text-slate-700">{event.scope}</td>
                              <td className="px-4 py-4">
                                <Badge variant="outline" className={badgeClass(event.result)}>
                                  {event.result}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              ) : null}

              {activePanel === 'templates' ? (
                <Panel
                  id="templates"
                  title="Role & Access Template"
                  description="Reusable security templates for repeatable onboarding, review, and scoped access patterns."
                  highlight={activePanel === 'templates'}
                  right={<ActionPills labels={['Preview Template', 'Apply Template', 'Duplicate', 'Edit Template']} />}
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setDetailDrawer(buildTemplateDetail(template))}
                        className="rounded-[20px] border border-slate-200/80 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{template.name}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{template.purpose}</div>
                          </div>
                          <Badge variant="outline" className={badgeClass(template.defaultScope)}>
                            {template.defaultScope}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {template.permissions.map((permission) => (
                            <span key={permission} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                              {permission}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-[12px] text-slate-600">{template.usageCount}</div>
                      </button>
                    ))}
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'alerts' ? (
                <Panel
                  id="alerts"
                  title="Security Alerts & Exceptions"
                  description="Temporary elevation, suspicious access attempts, expired exceptions, and unreviewed privileged roles in one queue."
                  highlight={activePanel === 'alerts'}
                  right={<ActionPills labels={['Investigate', 'Revoke', 'Approve Exception', 'Escalate']} />}
                >
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => setDetailDrawer(buildAlertDetail(alert))}
                        className="w-full rounded-[20px] border border-slate-200/80 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{alert.title}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{alert.summary}</div>
                          </div>
                          <Badge variant="outline" className={badgeClass(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <div className="mt-3 text-[12px] text-slate-600">
                          <span className="font-semibold text-slate-900">Owner:</span> {alert.owner}
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              ) : null}
            </div>

            <aside className="space-y-4">
              {activePanel === 'identity' ? (
                <section className="sticky top-20 rounded-[24px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Identity governance summary</p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-950">Cross-provider operational posture</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Consolidated telemetry for identity operations. Adjust connectors and engine defaults in Platform Settings &amp; Administration.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <ShieldCheck className="h-4 w-4 text-slate-600" />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {[
                      { label: 'Total connected providers', value: String(identityProviders.length) },
                      { label: 'IAM deployment mode', value: 'External Authentication Only' },
                      { label: 'MFA coverage', value: '91% (rolling 30 days)' },
                      { label: 'Authentication drift', value: '1 provider pending reconciliation' },
                      { label: 'Authorization drift', value: 'Within tolerance (policy v3.2)' },
                      { label: 'Sync failure trend', value: 'Increasing on partner domain' },
                      { label: 'Identity risk score', value: 'Low–Medium (72/100)' },
                      { label: 'Orphan accounts', value: '14 open' },
                      { label: 'Pending reviews', value: '6 in queue' },
                      { label: 'Compliance status', value: 'Audit-ready — exceptions tracked' },
                    ].map((row) => (
                      <div key={row.label} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{row.label}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{row.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[20px] border border-blue-200 bg-blue-50/70 p-4">
                    <p className="text-sm font-semibold text-blue-900">Governance narrative</p>
                    <p className="mt-2 text-sm leading-6 text-blue-900/90">
                      Federation is healthy for the primary workforce tenant; partner and B2B channels require closer mapping review. Escalate sustained lag through the access review workflow.
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {['Open full report', 'Export evidence pack', 'Notify owners', 'Schedule review'].map((action) => (
                      <Button key={action} variant="outline" className="h-9 rounded-xl px-3" type="button">
                        {action}
                      </Button>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="sticky top-20 rounded-[24px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Authorization Profile</p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-950">{detailDrawer.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{detailDrawer.subtitle}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <LayoutGrid className="h-4 w-4 text-slate-600" />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {detailDrawer.badges.map((badge) => (
                      <Badge key={badge} variant="outline" className={badgeClass(badge)}>
                        {badge}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3">
                    {detailDrawer.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{metric.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[20px] border border-blue-200 bg-blue-50/70 p-4">
                    <p className="text-sm font-semibold text-blue-900">Summary</p>
                    <p className="mt-2 text-sm leading-6 text-blue-900/90">{detailDrawer.summary}</p>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned users</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {detailDrawer.assignedUsers.map((user) => (
                          <span key={user} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                            {user}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Permissions</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {detailDrawer.permissions.map((permission) => (
                          <span key={permission} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Related policies</p>
                      <div className="mt-3 space-y-2">
                        {detailDrawer.relatedPolicies.map((policy) => (
                          <div key={policy} className="rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {policy}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Audit history</p>
                      <div className="mt-3 space-y-2">
                        {detailDrawer.auditHistory.map((entry) => (
                          <div key={`${entry.label}-${entry.detail}`} className="rounded-[16px] border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{entry.label}</div>
                            <div className="mt-1 text-sm text-slate-700">{entry.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Compliance notes</p>
                      <div className="mt-3 space-y-2">
                        {detailDrawer.complianceNotes.map((note) => (
                          <div key={note} className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {['Edit', 'Assign', 'Remove', 'Compare', 'Export Detail'].map((action) => (
                      <Button
                        key={action}
                        variant={action === 'Edit' ? 'default' : 'outline'}
                        className="h-9 rounded-xl px-3"
                        type="button"
                        onClick={() => {
                          if (action === 'Export Detail') {
                            downloadCsv('tectona-security-detail.csv', [
                              ['Title', detailDrawer.title],
                              ['Subtitle', detailDrawer.subtitle],
                              ...detailDrawer.metrics.map((metric) => [metric.label, metric.value]),
                            ])
                          }
                        }}
                      >
                        {action}
                      </Button>
                    ))}
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-emerald-200 bg-emerald-50/80">
        <CardContent className="flex items-center gap-2 py-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Latest security workspace refresh completed successfully. Role governance, policy controls, and audit streams are up to date.
        </CardContent>
      </Card>
    </div>
  )
}