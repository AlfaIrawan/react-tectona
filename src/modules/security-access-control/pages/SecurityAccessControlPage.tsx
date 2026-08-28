import {
  Fragment,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeftToLine,
  ArrowRightToLine,
  BadgeCheck,
  Ban,
  BarChart3,
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileText,
  Filter,
  History,
  KeyRound,
  LayoutGrid,
  MoreVertical,
  Network,
  PanelLeft,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Ruler,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  UnfoldHorizontal,
  User,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { EnterpriseNavIconRail } from '@/components/enterprise/EnterpriseNavIconRail'
import { useEnterpriseSortableColumns } from '@/components/enterprise/useEnterpriseSortableColumns'
import { EnterpriseSortableHeaderCell } from '@/components/enterprise/EnterpriseSortableHeaderCell'
import { EnterpriseColumnFilterDropdown } from '@/components/enterprise/EnterpriseColumnFilterDropdown'
import { EnterpriseGroupByControl } from '@/components/enterprise/EnterpriseGroupByControl'
import { EnterpriseSelectionToggle } from '@/components/enterprise/EnterpriseSelectionToggle'
import { EnterpriseColumnVisibilityControl } from '@/components/enterprise/EnterpriseColumnVisibilityControl'
import { EnterpriseColumnWidthModal } from '@/components/enterprise/EnterpriseColumnWidthModal'
import { getEnterpriseGroupTint } from '@/components/enterprise/enterpriseTableGroupTint'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { useToast } from '@/components/ui/toast'
import {
  createAuthzAssignment,
  deleteAuthzAssignment,
  createAuthzRole,
  deleteAuthzRole,
  getAuthzEffectivePermissions,
  getAuthzSecurityMatrix,
  listAuthzAssignments,
  listAuthzPermissions,
  listAuthzRoles,
  putAuthzRolePermissions,
  updateAuthzRole,
  type AuthzEffectivePermissionRow,
  type AuthzAssignmentDto,
  type AuthzPermissionDto,
  type AuthzRoleDto,
  type AuthzSecurityMatrixCell,
} from '@/lib/api/authzApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  createWorkspaceMembership,
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import { fetchAllWorkspaceOrgWorkspaces, ensureWorkspaceDirectoryMembership, type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { PARTICIPATION_SCOPE_CODE } from '@/lib/participationScopeRules'
import { Tooltip as UiTooltip } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/layout/PageHeader'
import { EnterpriseInfoCallout } from '@/components/layout/EnterpriseInfoCallout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectItem } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseIndigoGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import {
  computeWorkspaceMainPanelViewportHeightPx,
  isWorkspaceNavDocked,
  workspaceAsideClass,
  workspaceDockedContentInsetClass,
  workspaceMainColumnClass,
  workspaceMainPanelViewportHeightStyle,
  workspaceNavInnerClass,
  workspaceNavMenuScrollClass,
  workspaceOuterGridClass,
} from '@/lib/workspaceNavLayout'
import { usePreferencesStore } from '@/stores/preferences-store'
import { getSession } from '@/auth/authService'
import { hasOrganizationAdminAccess, hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { readStoredTenantSelection } from '@/lib/tenantWorkspaceScope'
import { MeasuredResponsiveContainer } from '@/components/charts/MeasuredResponsiveContainer'

type RoleItem = {
  id: string
  roleCode: string
  name: string
  description: string
  accessScope: string
  assignedUsers: number
  privilege: 'Privileged' | 'Standard' | 'Elevated'
  status: 'Active' | 'Review' | 'Disabled'
  lastUpdated: string
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

/** Shown immediately and kept as a fallback if the authorization-policy backend is unreachable. */
const FALLBACK_ROLES: RoleItem[] = [
  {
    id: 'role-01',
    roleCode: 'tectona.workspace_admin',
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
    roleCode: 'tectona.project_manager',
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
    roleCode: 'tectona.security_reviewer',
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
    roleCode: 'tectona.integration_operator',
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
    roleCode: 'tectona.external_reviewer',
    name: 'External Reviewer',
    description: 'Temporary project-level read and review access for third-party oversight.',
    accessScope: 'Project',
    assignedUsers: 23,
    privilege: 'Standard',
    status: 'Disabled',
    lastUpdated: '15 Apr 2026',
  },
]

function formatRoleLastUpdated(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) return isoTimestamp
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapAuthzRoleDtoToRoleItem(dto: AuthzRoleDto): RoleItem {
  const privilege: RoleItem['privilege'] =
    dto.privilege === 'Privileged' || dto.privilege === 'Elevated' ? dto.privilege : 'Standard'
  const status: RoleItem['status'] = dto.status === 'Review' || dto.status === 'Disabled' ? dto.status : 'Active'
  return {
    id: dto.id,
    roleCode: dto.role_code,
    name: dto.role_code === 'tectona.personal_workspace_admin' ? 'Platform Admin Personal' : dto.display_name,
    description: dto.description ?? '',
    accessScope: dto.access_scope,
    assignedUsers: dto.assigned_users,
    privilege,
    status,
    lastUpdated: formatRoleLastUpdated(dto.last_updated),
  }
}

// Role directory enterprise data-table (mirrors the Workflow & Automation Directory table): drag
// reorder / resize / freeze columns, 3-state sort, per-column filters, group-by, selection, paging.
type RoleTableColumnKey = 'name' | 'accessScope' | 'assignedUsers' | 'privilege' | 'status' | 'lastUpdated'

const ROLE_TABLE_PINNED_FIRST_COLUMN: RoleTableColumnKey = 'name'
const ROLE_TABLE_DEFAULT_COLUMN_ORDER: RoleTableColumnKey[] = [
  'name',
  'accessScope',
  'assignedUsers',
  'privilege',
  'status',
  'lastUpdated',
]

function roleTableColumnLabel(key: RoleTableColumnKey): string {
  switch (key) {
    case 'name': return 'Role'
    case 'accessScope': return 'Scope'
    case 'assignedUsers': return 'Assigned Users'
    case 'privilege': return 'Privilege'
    case 'status': return 'Status'
    case 'lastUpdated': return 'Last Updated'
  }
}

function roleTableColumnHeaderIcon(key: RoleTableColumnKey): LucideIcon {
  switch (key) {
    case 'name': return ShieldCheck
    case 'accessScope': return Target
    case 'assignedUsers': return Users
    case 'privilege': return BadgeCheck
    case 'status': return Activity
    case 'lastUpdated': return Clock3
  }
}

const ROLE_TABLE_COLUMN_VISIBILITY_OPTIONS: readonly { key: RoleTableColumnKey; label: string }[] =
  ROLE_TABLE_DEFAULT_COLUMN_ORDER.map((key) => ({ key, label: roleTableColumnLabel(key) }))

type RoleTableGroupByKey = 'accessScope' | 'privilege' | 'status'
const ROLE_TABLE_GROUP_BY_OPTIONS: readonly { key: RoleTableGroupByKey; label: string }[] = [
  { key: 'accessScope', label: 'Scope' },
  { key: 'privilege', label: 'Privilege' },
  { key: 'status', label: 'Status' },
]

function roleTableGroupLabel(item: RoleItem, groupBy: RoleTableGroupByKey): string {
  if (groupBy === 'accessScope') return item.accessScope
  if (groupBy === 'privilege') return item.privilege
  return item.status
}

function roleStatusAccentColor(status: RoleItem['status']): string {
  if (status === 'Active') return '#10b981'
  if (status === 'Review') return '#f59e0b'
  return '#e11d48'
}

function resourceTypeIcon(resourceType: string): LucideIcon {
  switch (resourceType) {
    case 'workspace': return LayoutGrid
    case 'organization': return Network
    case 'governance': return ShieldCheck
    case 'security_matrix': return KeyRound
    case 'project': return Target
    case 'idea_backlog': return FileText
    case 'knowledge_base': return BadgeCheck
    case 'portfolio': return BarChart3
    default: return LayoutGrid
  }
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic per-user avatar color — mirrors the Workflow Directory table's owner chips.
const USER_AVATAR_TONES = [
  'bg-orange-500',
  'bg-pink-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-cyan-500',
] as const

function userAvatarTone(seed: string): string {
  const sum = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return USER_AVATAR_TONES[sum % USER_AVATAR_TONES.length]
}

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

const ALL_ROLE_PRIVILEGES: RoleItem['privilege'][] = ['Privileged', 'Elevated', 'Standard']

function privilegeTagChrome(privilege: RoleItem['privilege'], active: boolean): string {
  const base = 'inline-flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition-all'
  const on = 'ring-2 ring-offset-1 ring-offset-background hover:brightness-95'
  const off = 'border-slate-200 bg-white/65 text-slate-500 hover:bg-white hover:text-slate-900'
  if (!active) return cn(base, off)
  if (privilege === 'Privileged') {
    return cn(base, on, 'border-rose-300/60 bg-gradient-to-r from-rose-500/15 to-red-500/15 text-rose-900 ring-rose-500/25')
  }
  if (privilege === 'Elevated') {
    return cn(base, on, 'border-amber-300/60 bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-900 ring-amber-500/25')
  }
  return cn(base, on, 'border-slate-300/60 bg-gradient-to-r from-slate-400/15 to-slate-500/15 text-slate-900 ring-slate-500/25')
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
    <MeasuredResponsiveContainer>
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
    </MeasuredResponsiveContainer>
  )
}

// Matches Resource Execution Overview's chart-panel design system (Resource Management page):
// glass card with a colored top accent bar + icon chip next to the title.
const OVERVIEW_PANEL_TONES = {
  emerald: { accent: 'from-emerald-300 via-emerald-400 to-teal-400', iconBg: 'bg-emerald-50 ring-1 ring-emerald-100', iconColor: 'text-emerald-500' },
  sky: { accent: 'from-sky-300 via-blue-400 to-indigo-400', iconBg: 'bg-sky-50 ring-1 ring-sky-100', iconColor: 'text-sky-500' },
  violet: { accent: 'from-indigo-300 via-violet-400 to-fuchsia-400', iconBg: 'bg-violet-50 ring-1 ring-violet-100', iconColor: 'text-violet-500' },
} as const
type OverviewTone = keyof typeof OVERVIEW_PANEL_TONES

function OverviewChartPanel({
  title,
  description,
  icon: Icon,
  tone,
  right,
  children,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  tone: OverviewTone
  right?: React.ReactNode
  children: React.ReactNode
}) {
  const t = OVERVIEW_PANEL_TONES[tone]
  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]',
        'bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(248,250,252,0.90))]'
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r opacity-85', t.accent)} />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
              <Icon className={cn('h-4 w-4', t.iconColor)} />
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{description}</p>
        </div>
        {right}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

/** Right-anchored slide-over drawer — mirrors Document & Knowledge Management's "Add Knowledge Base
 * reference" drawer chrome (backdrop + sliding panel + icon/title/description header + scrollable
 * body + sticky footer) so create/edit flows read as one system across the app. */
function SecurityDrawer({
  open,
  onClose,
  icon: Icon,
  title,
  description,
  children,
  footer,
  showOverlay = true,
}: {
  open: boolean
  onClose: () => void
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
  footer: React.ReactNode
  showOverlay?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {showOverlay ? (
        <div
          className={cn(
            'fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm transition-opacity',
            open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={cn(
          'fixed top-0 right-0 z-[1100] flex h-screen w-[460px] max-w-[92vw] transform flex-col transition-all duration-300',
          'border-l border-border bg-background/95 backdrop-blur-xl shadow-2xl',
          open ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        )}
        style={{ boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
          <div className="pr-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Icon className="h-5 w-5 text-primary" />
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={`Close ${title}`}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div
          className={cn(
            'min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-5',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {children}
        </div>
        <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">{footer}</div>
      </div>
    </>,
    document.body
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

function buildRoleDetail(role: RoleItem, assignedUsers: string[] = []): DetailDrawer {
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
    assignedUsers,
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
  outerRef,
  style,
  className,
  scrollBody = false,
  headerIcon,
  showDivider = true,
  children,
}: {
  id: string
  title: string
  description: string
  highlight: boolean
  right?: React.ReactNode
  outerRef?: Ref<HTMLElement>
  style?: CSSProperties
  className?: string
  scrollBody?: boolean
  headerIcon?: React.ReactNode
  showDivider?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      ref={outerRef}
      style={style}
      className={cn(
        'rounded-3xl border liquid-glass-enterprise-panel transition-all',
        highlight ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/80',
        scrollBody && 'flex min-h-0 w-full flex-col overflow-hidden',
        className
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-start justify-between gap-4',
          headerIcon ? 'p-4 pb-0 lg:p-5 lg:pb-0' : 'px-5 py-4',
          showDivider && 'border-b border-slate-200/80'
        )}
      >
        <div className="min-w-0 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {headerIcon ? <span className="shrink-0 text-slate-900">{headerIcon}</span> : null}
            <h2 className={cn('min-w-0 truncate font-semibold text-slate-900', headerIcon ? 'text-lg' : 'text-sm')}>{title}</h2>
          </div>
          <p className={cn('text-slate-600', headerIcon ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>{description}</p>
        </div>
        {right}
      </div>
      <div
        className={cn(
          headerIcon ? 'px-4 pb-4 pt-3 lg:px-5 lg:pb-5' : 'p-5',
          scrollBody &&
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {children}
      </div>
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
  const { addToast } = useToast()
  const sessionUser = getSession()?.user
  const activeTenant = readStoredTenantSelection()
  const isPersonalWorkspaceContext = activeTenant?.tenantMode === 'personal'
  const isOrganizationAdminContext = activeTenant?.tenantMode === 'organization'
    && hasOrganizationAdminAccess(sessionUser?.roles)
  const canEditPermissionMatrix = hasPlatformAdminAccess(sessionUser?.roles, sessionUser?.role)
    || isPersonalWorkspaceContext
    || isOrganizationAdminContext
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
  const [privilegeChipFilter, setPrivilegeChipFilter] = useState<Set<RoleItem['privilege']>>(new Set(ALL_ROLE_PRIVILEGES))
  const [groupBy, setGroupBy] = useState<'Role' | 'Team' | 'Workspace' | 'Project' | 'Compliance'>('Role')
  const [roles, setRoles] = useState<RoleItem[]>(FALLBACK_ROLES)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [selectedMatrixRole, setSelectedMatrixRole] = useState(roles[0].name)
  const [spotlightSection, setSpotlightSection] = useState<string | null>('overview')
  const [detailDrawer, setDetailDrawer] = useState<DetailDrawer>(buildRoleDetail(roles[0]))
  const [permissionMatrixLoading, setPermissionMatrixLoading] = useState(true)
  const [accessReviewLoading, setAccessReviewLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(true)
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [showKpiCards, setShowKpiCards] = useState(true)
  const [showEnterpriseNavPanel, setShowEnterpriseNavPanel] = useState(true)
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
  const enterpriseNavLayoutVariant = enterpriseNavWidthVariant === 'default' ? 'compact' : enterpriseNavWidthVariant

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
    showKpiCards,
    showEnterpriseNavPanel,
  ])

  const activeMainPanelRef = useRef<HTMLElement | null>(null)
  const [mainPanelViewportHeightPx, setMainPanelViewportHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (activePanel !== 'overview' && activePanel !== 'rbac' && activePanel !== 'permissions') {
      setMainPanelViewportHeightPx(null)
      return
    }

    const compute = () => {
      const el = activeMainPanelRef.current
      if (!el) return
      setMainPanelViewportHeightPx(computeWorkspaceMainPanelViewportHeightPx(el.getBoundingClientRect().top))
    }

    compute()
    const raf = window.requestAnimationFrame(() => {
      compute()
      window.requestAnimationFrame(compute)
    })
    const t1 = window.setTimeout(compute, 80)
    const t2 = window.setTimeout(compute, 360)
    window.addEventListener('resize', compute, { passive: true })

    const ro = new ResizeObserver(compute)
    if (activeMainPanelRef.current) ro.observe(activeMainPanelRef.current)
    if (navPanelRef.current) ro.observe(navPanelRef.current)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [activePanel, isWorkspaceCollapsed, showFiltersPanel, sidebarFixed, showKpiCards, showEnterpriseNavPanel])

  useEffect(() => {
    const reviewTimer = window.setTimeout(() => setAccessReviewLoading(false), 900)
    const auditTimer = window.setTimeout(() => setAuditLoading(false), 1200)

    return () => {
      window.clearTimeout(reviewTimer)
      window.clearTimeout(auditTimer)
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true)
    try {
      const items = await listAuthzRoles()
      if (items.length > 0) setRoles(items.map(mapAuthzRoleDtoToRoleItem))
      return true
    } catch {
      addToast({
        variant: 'warning',
        title: 'Showing sample roles',
        description: 'Could not reach the authorization-policy backend — displaying local sample data.',
      })
      return false
    } finally {
      setRolesLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles])

  useEffect(() => {
    const preferredRoleCode = isPersonalWorkspaceContext
      ? 'tectona.personal_workspace_admin'
      : isOrganizationAdminContext
        ? 'tectona.organization_admin'
        : null
    if (!preferredRoleCode) return
    const preferredRole = roles.find((role) => role.roleCode === preferredRoleCode)
    if (preferredRole && selectedMatrixRole !== preferredRole.name) {
      setSelectedMatrixRole(preferredRole.name)
    }
  }, [isOrganizationAdminContext, isPersonalWorkspaceContext, roles, selectedMatrixRole])

  // --- Permission Matrix (backed by authorization-policy's permission catalog + security matrix) ---
  const [authzPermissions, setAuthzPermissions] = useState<AuthzPermissionDto[]>([])
  const [securityMatrixCells, setSecurityMatrixCells] = useState<AuthzSecurityMatrixCell[]>([])
  const [permissionMatrixError, setPermissionMatrixError] = useState(false)
  const [matrixCellSubmitting, setMatrixCellSubmitting] = useState<string | null>(null)

  const fetchPermissionMatrix = useCallback(async () => {
    setPermissionMatrixLoading(true)
    try {
      const [permissionsResult, cells] = await Promise.all([listAuthzPermissions(), getAuthzSecurityMatrix()])
      setAuthzPermissions(permissionsResult)
      setSecurityMatrixCells(cells)
      setPermissionMatrixError(false)
    } catch {
      setPermissionMatrixError(true)
      addToast({
        variant: 'warning',
        title: 'Permission matrix unavailable',
        description: 'Could not reach the authorization-policy backend.',
      })
    } finally {
      setPermissionMatrixLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void fetchPermissionMatrix()
  }, [fetchPermissionMatrix])

  const matrixResourceTypes = useMemo(
    () => Array.from(new Set(authzPermissions.map((p) => p.resource_type))).sort(),
    [authzPermissions]
  )
  const matrixActions = useMemo(
    () => Array.from(new Set(authzPermissions.map((p) => p.action))).sort(),
    [authzPermissions]
  )
  const permissionIdByCell = useMemo(() => {
    const map = new Map<string, string>()
    for (const permission of authzPermissions) map.set(`${permission.resource_type}:${permission.action}`, permission.id)
    return map
  }, [authzPermissions])

  const grantedCellsForRoleCode = useCallback(
    (roleCode: string) => {
      const set = new Set<string>()
      for (const cell of securityMatrixCells) {
        if (cell.role_code === roleCode) set.add(`${cell.resource_type}:${cell.action}`)
      }
      return set
    },
    [securityMatrixCells]
  )

  const matrixRows = useMemo(() => authzPermissions.map(permissionMatrixHierarchy), [authzPermissions])
  const matrixModules = useMemo(
    () => Array.from(new Set(matrixRows.map((row) => row.module))).sort(),
    [matrixRows]
  )

  // --- Permission Matrix tree state (Module > Section > Resource) -----------
  const matrixAugmentedRows = useMemo(() => {
    const matrixRole = roles.find((role) => role.name === selectedMatrixRole) ?? roles[0]
    const granted = matrixRole ? grantedCellsForRoleCode(matrixRole.roleCode) : new Set<string>()
    return matrixRows.map((row) => {
      const isGranted = granted.has(`${row.resource_type}:${row.action}`)
      return { ...row, granted: isGranted, statusLabel: isGranted ? 'Granted' : 'Not granted', sourceLabel: isGranted ? 'Role grant' : '—' }
    })
  }, [grantedCellsForRoleCode, matrixRows, roles, selectedMatrixRole])

  const matrixColumnFilteredRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return matrixAugmentedRows
    return matrixAugmentedRows.filter((row) =>
      [row.module, row.section, row.resourceLabel, row.resource_type, row.action, row.permission_code, row.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [deferredSearch, matrixAugmentedRows])

  type MatrixTreeAction = { action: string; permission_code: string; description: string | null; granted: boolean; sourceRoles?: string[] }
  type MatrixTreeResource = { key: string; resource_type: string; resourceLabel: string; actions: MatrixTreeAction[] }
  type MatrixTreeSection = { key: string; section: string; resources: MatrixTreeResource[] }
  type MatrixTreeModule = { key: string; module: string; sections: MatrixTreeSection[]; resourceCount: number }

  const matrixTree = useMemo<MatrixTreeModule[]>(() => {
    const byModule = new Map<string, Map<string, Map<string, MatrixTreeResource>>>()
    for (const row of matrixColumnFilteredRows) {
      const bySection = byModule.get(row.module) ?? new Map<string, Map<string, MatrixTreeResource>>()
      byModule.set(row.module, bySection)
      const byResource = bySection.get(row.section) ?? new Map<string, MatrixTreeResource>()
      bySection.set(row.section, byResource)
      const resource = byResource.get(row.resource_type) ?? {
        key: `${row.module}::${row.section}::${row.resource_type}`,
        resource_type: row.resource_type,
        resourceLabel: row.resourceLabel,
        actions: [],
      }
      resource.actions.push({ action: row.action, permission_code: row.permission_code, description: row.description, granted: row.granted })
      byResource.set(row.resource_type, resource)
    }
    return Array.from(byModule.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([module, bySection]) => {
        const sections = Array.from(bySection.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([section, byResource]) => ({
            key: `${module}::${section}`,
            section,
            resources: Array.from(byResource.values()).sort((a, b) => a.resourceLabel.localeCompare(b.resourceLabel)),
          }))
        const resourceCount = sections.reduce((sum, s) => sum + s.resources.length, 0)
        return { key: module, module, sections, resourceCount }
      })
  }, [matrixColumnFilteredRows])

  const [expandedMatrixModules, setExpandedMatrixModules] = useState<Set<string>>(new Set())
  const [expandedMatrixSections, setExpandedMatrixSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!deferredSearch.trim()) return
    setExpandedMatrixModules(new Set(matrixTree.map((m) => m.key)))
    setExpandedMatrixSections(new Set(matrixTree.flatMap((m) => m.sections.map((s) => s.key))))
  }, [deferredSearch, matrixTree])

  const toggleMatrixModuleExpanded = useCallback((key: string) => {
    setExpandedMatrixModules((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleMatrixSectionExpanded = useCallback((key: string) => {
    setExpandedMatrixSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleMatrixCell = useCallback(
    async (role: RoleItem, resourceType: string, action: string) => {
      if (!canEditPermissionMatrix) {
        addToast({
          variant: 'warning',
          title: 'Read-only permission matrix',
          description: isPersonalWorkspaceContext
            ? 'Only the Personal Workspace owner can change role permission grants in this workspace.'
            : 'Only a Platform Admin Global can change role permission grants.',
        })
        return
      }
      const cellKey = `${resourceType}:${action}`
      const permissionId = permissionIdByCell.get(cellKey)
      if (!permissionId) return

      const grantedCodes = new Set(
        securityMatrixCells.filter((cell) => cell.role_code === role.roleCode).map((cell) => cell.permission_code)
      )
      const currentIds = authzPermissions.filter((p) => grantedCodes.has(p.permission_code)).map((p) => p.id)
      const isGranted = grantedCellsForRoleCode(role.roleCode).has(cellKey)
      const nextIds = isGranted ? currentIds.filter((id) => id !== permissionId) : [...currentIds, permissionId]

      setMatrixCellSubmitting(`${role.id}:${cellKey}`)
      try {
        await putAuthzRolePermissions(role.id, nextIds)
        await fetchPermissionMatrix()
      } catch (error) {
        addToast({
          variant: 'error',
          title: 'Failed to update permission',
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setMatrixCellSubmitting(null)
      }
    },
    [addToast, authzPermissions, canEditPermissionMatrix, fetchPermissionMatrix, grantedCellsForRoleCode, isPersonalWorkspaceContext, permissionIdByCell, securityMatrixCells]
  )

  // Shared identity-lite user directory (used by both the Assign User drawer and the
  // Permission Matrix "By User" effective-permissions view).
  const [identityUsers, setIdentityUsers] = useState<IdentityUserDto[]>([])
  const [identityUsersLoading, setIdentityUsersLoading] = useState(false)
  const [authzAssignments, setAuthzAssignments] = useState<AuthzAssignmentDto[]>([])
  const [wacMemberships, setWacMemberships] = useState<Array<{ workspaceId: string; workspaceName: string; membership: WacMembershipDto }>>([])
  const [scopedWorkspaceDirectory, setScopedWorkspaceDirectory] = useState<WorkspaceOrgWorkspaceDto[]>([])
  const [scopedAccessLoading, setScopedAccessLoading] = useState(false)
  const [scopedAccessRefreshKey, setScopedAccessRefreshKey] = useState(0)

  const identityBySubject = useMemo(
    () => new Map(identityUsers.map((user) => [user.id, user])),
    [identityUsers]
  )
  const currentSessionUser = getSession()?.user

  const assignedUserNamesForRole = useCallback(
    (role: RoleItem) =>
      authzAssignments
        .filter((assignment) => assignment.role_id === role.id || assignment.role_code === role.roleCode)
        .map((assignment) => {
          const identity = identityBySubject.get(assignment.principal_sub)
          return identity?.display_name?.trim() || identity?.email?.trim() ||
            (assignment.principal_sub === currentSessionUser?.id ? currentSessionUser.name : null) ||
            assignment.principal_sub
        })
        .filter((name, index, names) => names.indexOf(name) === index),
    [authzAssignments, currentSessionUser?.id, currentSessionUser?.name, identityBySubject]
  )

  const assignedAssignmentsForRole = useCallback(
    (role: RoleItem) =>
      authzAssignments
        .filter((assignment) => assignment.role_id === role.id || assignment.role_code === role.roleCode)
        .map((assignment) => {
          const identity = identityBySubject.get(assignment.principal_sub)
          const name = identity?.display_name?.trim() || identity?.email?.trim() ||
            (assignment.principal_sub === currentSessionUser?.id ? currentSessionUser.name : null) ||
            assignment.principal_sub
          return { id: assignment.id, name }
        }),
    [authzAssignments, currentSessionUser?.id, currentSessionUser?.name, identityBySubject]
  )

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([listAuthzAssignments(), fetchIdentityUsers({ limit: 200 })]).then(([assignmentsResult, usersResult]) => {
      if (cancelled) return
      if (assignmentsResult.status === 'fulfilled') setAuthzAssignments(assignmentsResult.value)
      if (usersResult.status === 'fulfilled') setIdentityUsers(usersResult.value.items)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Scoped Access is a read model composed from the two authoritative sources:
  // AuthZ assignments (what a role can do) and WAC memberships (where the user
  // can enter and participate). Keep the current panel backed by live data.
  useEffect(() => {
    let cancelled = false
    setScopedAccessLoading(true)
    void fetchAllWorkspaceOrgWorkspaces()
      .then(async (workspaces) => {
        if (!cancelled) setScopedWorkspaceDirectory(workspaces)
        const results = await Promise.allSettled(
          workspaces.map(async (workspace) => {
            const response = await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, workspace.id)
            return response.items.map((membership) => ({ workspaceId: workspace.id, workspaceName: workspace.name, membership }))
          }),
        )
        if (cancelled) return
        setWacMemberships(results.flatMap((result) => result.status === 'fulfilled' ? result.value : []))
      })
      .catch(() => {
        if (!cancelled) setWacMemberships([])
      })
      .finally(() => {
        if (!cancelled) setScopedAccessLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTenant?.workspaceId, scopedAccessRefreshKey])

  const liveScopedAccessItems = useMemo<ScopedAccessItem[]>(() => {
    const workspaceNames = new Map<string, string>()
    for (const membership of wacMemberships) {
      if (!workspaceNames.has(membership.workspaceId)) workspaceNames.set(membership.workspaceId, membership.workspaceName)
    }

    const rows: ScopedAccessItem[] = authzAssignments.map((assignment) => {
      const role = roles.find((item) => item.id === assignment.role_id || item.roleCode === assignment.role_code)
      const scopeType = assignment.scope_type_code === 'global'
        ? 'Global'
        : assignment.scope_type_code.charAt(0).toUpperCase() + assignment.scope_type_code.slice(1)
      const scopeName = assignment.scope_id
        ? workspaceNames.get(assignment.scope_id) ?? assignment.scope_id
        : 'All authorized workspaces'
      return {
        id: `authz:${assignment.id}`,
        subject: identityBySubject.get(assignment.principal_sub)?.display_name
          || identityBySubject.get(assignment.principal_sub)?.email
          || assignment.principal_sub,
        role: role?.name ?? assignment.role_name,
        scopeType,
        scopeName,
        accessLevel: role?.privilege ?? 'Assigned role access',
        assignmentType: 'Direct',
        status: role?.status === 'Review' ? 'Pending Review' : role?.status === 'Disabled' ? 'Exception' : 'Active',
      }
    })

    for (const { workspaceId, membership } of wacMemberships) {
      const key = `wac:${membership.id}`
      rows.push({
        id: key,
        subject: identityBySubject.get(membership.subject_id)?.display_name
          || identityBySubject.get(membership.subject_id)?.email
          || membership.subject_id,
        role: membership.role_display_name ?? membership.role_code,
        scopeType: 'Workspace',
        scopeName: workspaceNames.get(workspaceId) ?? workspaceId,
        accessLevel: membership.participation_scope_display_name ?? membership.participation_scope_code ?? 'Workspace access',
        assignmentType: 'Direct',
        status: membership.status_code === 'active' ? 'Active' : 'Exception',
      })
    }

    return rows
  }, [authzAssignments, identityBySubject, roles, wacMemberships])

  const [scopedAccessOpen, setScopedAccessOpen] = useState(false)
  const [scopedAccessSubmitting, setScopedAccessSubmitting] = useState(false)
  const [scopedAccessPrincipal, setScopedAccessPrincipal] = useState('')
  const [scopedAccessRoleId, setScopedAccessRoleId] = useState('')
  const [scopedAccessScopeType, setScopedAccessScopeType] = useState<'global' | 'workspace' | 'project'>('workspace')
  const [scopedAccessScopeId, setScopedAccessScopeId] = useState('')

  const openScopedAccessDrawer = useCallback(() => {
    setScopedAccessPrincipal('')
    setScopedAccessRoleId(roles[0]?.id ?? '')
    setScopedAccessScopeType('workspace')
    setScopedAccessScopeId(activeTenant?.tenantMode === 'organization' ? activeTenant.workspaceId : scopedWorkspaceDirectory[0]?.id ?? '')
    setScopedAccessOpen(true)
    if (identityUsers.length === 0 && !identityUsersLoading) {
      setIdentityUsersLoading(true)
      fetchIdentityUsers({ limit: 200 })
        .then((response) => setIdentityUsers(response.items))
        .catch(() => addToast({ variant: 'warning', title: 'Could not load user directory', description: 'identity-lite is unreachable.' }))
        .finally(() => setIdentityUsersLoading(false))
    }
  }, [activeTenant?.tenantMode, activeTenant?.workspaceId, addToast, identityUsers.length, identityUsersLoading, roles, scopedWorkspaceDirectory])

  const handleCreateScopedAccess = useCallback(async () => {
    if (!scopedAccessPrincipal || !scopedAccessRoleId || (scopedAccessScopeType !== 'global' && !scopedAccessScopeId)) return
    setScopedAccessSubmitting(true)
    const role = roles.find((item) => item.id === scopedAccessRoleId)
    const scope = scopedAccessScopeType === 'global' ? 'global' : `${scopedAccessScopeType}:${scopedAccessScopeId}`
    try {
      await createAuthzAssignment({ principal_sub: scopedAccessPrincipal, role_id: scopedAccessRoleId, scope })
      let wacFailed = false
      if (scopedAccessScopeType === 'workspace') {
        try {
          await createWorkspaceMembership(
            TECTONA_WAC_APP_ID,
            scopedAccessScopeId,
            {
              subject_id: scopedAccessPrincipal,
              role_code: role?.name.toLowerCase().includes('admin') ? 'admin' : 'member',
              status_code: 'active',
              participation_scope_code: PARTICIPATION_SCOPE_CODE.ALL,
              participation_duration_code: 'permanent',
            },
            { actorId: getSession()?.user.id },
          )
        } catch {
          wacFailed = true
        }
      }
      addToast({
        variant: wacFailed ? 'warning' : 'success',
        title: wacFailed ? 'Scoped role assigned with workspace warning' : 'Scoped access assigned',
        description: wacFailed
          ? 'The AuthZ assignment was created, but Workspace membership could not be synchronized.'
          : `${role?.name ?? 'Role'} assigned at ${scopedAccessScopeType} scope.`,
      })
      setScopedAccessOpen(false)
      setScopedAccessRefreshKey((value) => value + 1)
      const assignments = await listAuthzAssignments()
      setAuthzAssignments(assignments)
    } catch (error) {
      addToast({ variant: 'error', title: 'Failed to assign scoped access', description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setScopedAccessSubmitting(false)
    }
  }, [addToast, roles, scopedAccessPrincipal, scopedAccessRoleId, scopedAccessScopeId, scopedAccessScopeType])

  const permissionDescriptionByCell = useMemo(() => {
    const map = new Map<string, string>()
    for (const permission of authzPermissions) {
      map.set(`${permission.resource_type}:${permission.action}`, permission.description || permission.permission_code)
    }
    return map
  }, [authzPermissions])

  // --- Permission Matrix: "By Role" vs "By User" (effective permissions) view -----
  const [matrixViewMode, setMatrixViewMode] = useState<'role' | 'user'>('role')
  const [effectiveUserSearch, setEffectiveUserSearch] = useState('')
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null)
  const [effectiveUserPickerOpen, setEffectiveUserPickerOpen] = useState(false)
  const [effectivePermissions, setEffectivePermissions] = useState<AuthzEffectivePermissionRow[]>([])
  const [effectivePermissionsLoading, setEffectivePermissionsLoading] = useState(false)

  const switchToUserMatrixView = useCallback(() => {
    setMatrixViewMode('user')
    if (identityUsers.length === 0 && !identityUsersLoading) {
      setIdentityUsersLoading(true)
      fetchIdentityUsers({ limit: 200 })
        .then((res) => setIdentityUsers(res.items))
        .catch(() => {
          addToast({
            variant: 'warning',
            title: 'Could not load user directory',
            description: 'identity-lite is unreachable.',
          })
        })
        .finally(() => setIdentityUsersLoading(false))
    }
  }, [addToast, identityUsers.length, identityUsersLoading])

  const filteredEffectiveUsers = useMemo(() => {
    const query = effectiveUserSearch.trim().toLowerCase()
    if (!query) return identityUsers
    return identityUsers.filter(
      (user) => user.display_name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    )
  }, [identityUsers, effectiveUserSearch])

  const selectEffectiveUser = useCallback((user: IdentityUserDto) => {
    setEffectiveUserId(user.id)
    setEffectiveUserSearch(user.display_name)
    setEffectiveUserPickerOpen(false)
    setEffectivePermissionsLoading(true)
    const scope = activeTenant?.workspaceId && activeTenant.workspaceId !== '__all__'
      ? `workspace:${activeTenant.workspaceId}`
      : 'global'
    getAuthzEffectivePermissions(user.id, scope)
      .then((rows) => setEffectivePermissions(rows))
      .catch(() => {
        setEffectivePermissions([])
        addToast({
          variant: 'error',
          title: 'Failed to load effective permissions',
          description: `Could not compute access for "${user.display_name}".`,
        })
      })
      .finally(() => setEffectivePermissionsLoading(false))
  }, [activeTenant?.workspaceId, addToast])

  const selectedEffectiveUser = useMemo(
    () => identityUsers.find((user) => user.id === effectiveUserId) ?? null,
    [effectiveUserId, identityUsers],
  )

  const effectiveUserAssignments = useMemo(() => {
    if (!effectiveUserId) return []
    return authzAssignments
      .filter((assignment) => assignment.principal_sub === effectiveUserId)
      .map((assignment) => ({
        ...assignment,
        role: roles.find((role) => role.id === assignment.role_id),
      }))
  }, [authzAssignments, effectiveUserId, roles])

  const userAssignmentSummary = useMemo(() => {
    const summary = new Map<string, { roles: number; permissions: number }>()
    for (const assignment of authzAssignments) {
      const current = summary.get(assignment.principal_sub) ?? { roles: 0, permissions: 0 }
      current.roles += 1
      summary.set(assignment.principal_sub, current)
    }
    return summary
  }, [authzAssignments])

  const effectiveUserRoles = useMemo(() => {
    const codes = new Set(effectivePermissions.map((row) => row.role_code))
    return roles.filter((role) => codes.has(role.roleCode))
  }, [effectivePermissions, roles])

  const effectivePermissionsByResource = useMemo(() => {
    const map = new Map<string, Map<string, Array<{ resourceType: string; action: string; permissionCode: string; roleCodes: string[] }>>>()
    for (const row of effectivePermissions) {
      const catalog = authzPermissions.find((permission) => permission.permission_code === row.permission_code)
      const moduleName = catalog?.ui_module || 'Other permissions'
      const sectionName = catalog?.ui_section || 'General'
      const sections = map.get(moduleName) ?? new Map<string, Array<{ resourceType: string; action: string; permissionCode: string; roleCodes: string[] }>>()
      const list = sections.get(sectionName) ?? []
      const existing = list.find((entry) => entry.resourceType === row.resource_type && entry.action === row.action)
      if (existing) {
        if (!existing.roleCodes.includes(row.role_code)) existing.roleCodes.push(row.role_code)
      } else {
        list.push({ resourceType: row.resource_type, action: row.action, permissionCode: row.permission_code, roleCodes: [row.role_code] })
      }
      sections.set(sectionName, list)
      map.set(moduleName, sections)
    }
    return map
  }, [authzPermissions, effectivePermissions])

  const effectiveMatrixTree = useMemo<MatrixTreeModule[]>(() => {
    const granted = new Set(effectivePermissions.map((row) => `${row.resource_type}:${row.action}`))
    const sourceRoles = new Map<string, string[]>()
    for (const row of effectivePermissions) {
      const key = `${row.resource_type}:${row.action}`
      const sources = sourceRoles.get(key) ?? []
      if (!sources.includes(row.role_code)) sources.push(row.role_code)
      sourceRoles.set(key, sources)
    }
    const byModule = new Map<string, Map<string, Map<string, MatrixTreeResource & { actions: Array<MatrixTreeAction & { sourceRoles: string[] }> }>>>()
    for (const row of matrixRows) {
      const bySection = byModule.get(row.module) ?? new Map()
      byModule.set(row.module, bySection)
      const byResource = bySection.get(row.section) ?? new Map()
      bySection.set(row.section, byResource)
      const resource = byResource.get(row.resource_type) ?? {
        key: `${row.module}::${row.section}::${row.resource_type}`,
        resource_type: row.resource_type,
        resourceLabel: row.resourceLabel,
        actions: [],
      }
      const cellKey = `${row.resource_type}:${row.action}`
      resource.actions.push({
        action: row.action,
        permission_code: row.permission_code,
        description: row.description,
        granted: granted.has(cellKey),
        sourceRoles: sourceRoles.get(cellKey) ?? [],
      })
      byResource.set(row.resource_type, resource)
    }
    return Array.from(byModule.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([module, bySection]) => {
      const sections = Array.from(bySection.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([section, byResource]) => ({
        key: `${module}::${section}`,
        section,
        resources: Array.from(byResource.values()).sort((a, b) => a.resourceLabel.localeCompare(b.resourceLabel)),
      }))
      return { key: module, module, sections, resourceCount: sections.reduce((sum, section) => sum + section.resources.length, 0) }
    })
  }, [effectivePermissions, matrixRows])

  // --- Add / Edit Role drawer --------------------------------------------------
  const [addRoleOpen, setAddRoleOpen] = useState(false)
  const [addRoleSubmitting, setAddRoleSubmitting] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [addRoleForm, setAddRoleForm] = useState({
    displayName: '',
    description: '',
    accessScope: 'Workspace',
    privilege: 'Standard' as RoleItem['privilege'],
  })

  const resetAddRoleForm = useCallback(() => {
    setAddRoleForm({ displayName: '', description: '', accessScope: 'Workspace', privilege: 'Standard' })
  }, [])

  const openAddRoleDrawer = useCallback(() => {
    setEditingRole(null)
    resetAddRoleForm()
    setAddRoleOpen(true)
  }, [resetAddRoleForm])

  const openEditRoleDrawer = useCallback((role: RoleItem) => {
    if (!role.roleCode.startsWith('tectona.custom_')) {
      addToast({
        variant: 'warning',
        title: 'System role is locked',
        description: 'Access scope and privilege are managed by the platform policy.',
      })
      return
    }
    setEditingRole(role)
    setAddRoleForm({
      displayName: role.name,
      description: role.description,
      accessScope: role.accessScope,
      privilege: role.privilege,
    })
    setRoleDetailOpen(false)
    setAddRoleOpen(true)
  }, [addToast])

  const handleCreateRole = useCallback(async () => {
    const displayName = addRoleForm.displayName.trim()
    if (!displayName) return
    setAddRoleSubmitting(true)
    try {
      if (editingRole) {
        await updateAuthzRole(editingRole.id, {
          display_name: displayName,
          description: addRoleForm.description.trim() || undefined,
          access_scope: addRoleForm.accessScope,
          privilege: addRoleForm.privilege,
          status: editingRole.status,
        })
        addToast({ variant: 'success', title: 'Role updated', description: `"${displayName}" was saved.` })
      } else {
        const slug = displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
        await createAuthzRole({
          role_code: `tectona.custom_${slug || 'role'}_${Date.now().toString(36)}`,
          display_name: displayName,
          description: addRoleForm.description.trim() || undefined,
          access_scope: addRoleForm.accessScope,
          privilege: addRoleForm.privilege,
          status: addRoleForm.privilege === 'Standard' ? 'Active' : 'Review',
        })
        addToast({ variant: 'success', title: 'Role created', description: `"${displayName}" was added to the role directory.` })
      }
      setAddRoleOpen(false)
      setEditingRole(null)
      resetAddRoleForm()
      await fetchRoles()
    } catch (error) {
      addToast({
        variant: 'error',
        title: editingRole ? 'Failed to update role' : 'Failed to create role',
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setAddRoleSubmitting(false)
    }
  }, [addRoleForm, addToast, editingRole, fetchRoles, resetAddRoleForm])

  const handleDuplicateRole = useCallback(
    async (role: RoleItem) => {
      try {
        const slug = role.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
        await createAuthzRole({
          role_code: `tectona.custom_${slug || 'role'}_${Date.now().toString(36)}`,
          display_name: `${role.name} (Copy)`,
          description: role.description,
          access_scope: role.accessScope,
          privilege: role.privilege,
        })
        addToast({ variant: 'success', title: 'Role duplicated', description: `Created "${role.name} (Copy)".` })
        await fetchRoles()
      } catch (error) {
        addToast({
          variant: 'error',
          title: 'Failed to duplicate role',
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
    [addToast, fetchRoles]
  )

  const handleToggleRoleStatus = useCallback(
    async (role: RoleItem) => {
      const nextStatus: RoleItem['status'] = role.status === 'Disabled' ? 'Active' : 'Disabled'
      try {
        await updateAuthzRole(role.id, {
          display_name: role.name,
          description: role.description,
          access_scope: role.accessScope,
          privilege: role.privilege,
          status: nextStatus,
        })
        addToast({
          variant: 'success',
          title: nextStatus === 'Disabled' ? 'Role disabled' : 'Role enabled',
          description: `"${role.name}" is now ${nextStatus.toLowerCase()}.`,
        })
        await fetchRoles()
      } catch (error) {
        addToast({
          variant: 'error',
          title: 'Failed to update role status',
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
    [addToast, fetchRoles]
  )

  // --- Inline rename (row context menu) ---------------------------------------
  const [renamingRoleId, setRenamingRoleId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSubmitting, setRenameSubmitting] = useState(false)

  const startRenameRole = useCallback((role: RoleItem) => {
    setRenamingRoleId(role.id)
    setRenameValue(role.name)
  }, [])

  const cancelRenameRole = useCallback(() => {
    setRenamingRoleId(null)
    setRenameValue('')
  }, [])

  const commitRenameRole = useCallback(
    async (role: RoleItem) => {
      const nextName = renameValue.trim()
      if (!nextName || nextName === role.name) {
        cancelRenameRole()
        return
      }
      setRenameSubmitting(true)
      try {
        await updateAuthzRole(role.id, {
          display_name: nextName,
          description: role.description,
          access_scope: role.accessScope,
          privilege: role.privilege,
          status: role.status,
        })
        addToast({ variant: 'success', title: 'Role renamed', description: `"${role.name}" is now "${nextName}".` })
        cancelRenameRole()
        await fetchRoles()
      } catch (error) {
        addToast({
          variant: 'error',
          title: 'Failed to rename role',
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setRenameSubmitting(false)
      }
    },
    [addToast, cancelRenameRole, fetchRoles, renameValue]
  )

  // --- Role detail drawer ------------------------------------------------------
  const [roleDetailOpen, setRoleDetailOpen] = useState(false)
  const [roleDetailRoleId, setRoleDetailRoleId] = useState<string | null>(null)

  const openRoleDetail = useCallback((role: RoleItem) => {
    setDetailDrawer(buildRoleDetail(role, assignedUserNamesForRole(role)))
    setRoleDetailRoleId(role.id)
    setRoleDetailOpen(true)
  }, [assignedUserNamesForRole])

  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null)

  const handleRemoveAssignment = useCallback(
    async (assignmentId: string, userName: string) => {
      setRemovingAssignmentId(assignmentId)
      try {
        await deleteAuthzAssignment(assignmentId)
        const refreshed = await listAuthzAssignments()
        setAuthzAssignments(refreshed)
        const role = roles.find((r) => r.id === roleDetailRoleId)
        if (role) {
          const names = refreshed
            .filter((assignment) => assignment.role_id === role.id || assignment.role_code === role.roleCode)
            .map((assignment) => {
              const identity = identityBySubject.get(assignment.principal_sub)
              return identity?.display_name?.trim() || identity?.email?.trim() ||
                (assignment.principal_sub === currentSessionUser?.id ? currentSessionUser.name : null) ||
                assignment.principal_sub
            })
            .filter((name, index, list) => list.indexOf(name) === index)
          setDetailDrawer(buildRoleDetail(role, names))
        }
        addToast({ variant: 'success', title: 'User removed', description: `${userName} no longer holds this role.` })
      } catch (error) {
        addToast({ variant: 'error', title: 'Failed to remove user', description: error instanceof Error ? error.message : 'Please try again.' })
      } finally {
        setRemovingAssignmentId(null)
      }
    },
    [addToast, currentSessionUser?.id, currentSessionUser?.name, identityBySubject, roleDetailRoleId, roles]
  )

  // --- Delete Role confirmation ----------------------------------------------
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleItem | null>(null)
  const [deleteRoleSubmitting, setDeleteRoleSubmitting] = useState(false)

  const handleDeleteRole = useCallback(async () => {
    if (!deleteRoleTarget) return
    setDeleteRoleSubmitting(true)
    try {
      await deleteAuthzRole(deleteRoleTarget.id)
      addToast({ variant: 'success', title: 'Role deleted', description: `"${deleteRoleTarget.name}" was removed.` })
      setDeleteRoleTarget(null)
      await fetchRoles()
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Failed to delete role',
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setDeleteRoleSubmitting(false)
    }
  }, [addToast, deleteRoleTarget, fetchRoles])

  // --- Assign User modal ------------------------------------------------------
  const [assignUserOpen, setAssignUserOpen] = useState(false)
  const [assignUserSubmitting, setAssignUserSubmitting] = useState(false)
  const [assignUserRoleId, setAssignUserRoleId] = useState('')
  const [assignUserPrincipals, setAssignUserPrincipals] = useState<Set<string>>(new Set())
  const [assignUserSearch, setAssignUserSearch] = useState('')
  const [assignUserManualId, setAssignUserManualId] = useState('')

  const openAssignUserModal = useCallback(
    (roleId?: string) => {
      setAssignUserRoleId(roleId ?? roles[0]?.id ?? '')
      setAssignUserPrincipals(new Set())
      setAssignUserSearch('')
      setAssignUserManualId('')
      setAssignUserOpen(true)
      if (identityUsers.length === 0 && !identityUsersLoading) {
        setIdentityUsersLoading(true)
        fetchIdentityUsers({ limit: 200 })
          .then((res) => setIdentityUsers(res.items))
          .catch(() => {
            addToast({
              variant: 'warning',
              title: 'Could not load user directory',
              description: 'identity-lite is unreachable — enter a principal ID manually instead.',
            })
          })
          .finally(() => setIdentityUsersLoading(false))
      }
    },
    [addToast, identityUsers.length, identityUsersLoading, roles]
  )

  const toggleAssignUserPrincipal = useCallback((id: string) => {
    setAssignUserPrincipals((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const addManualAssignUserPrincipal = useCallback(() => {
    const id = assignUserManualId.trim()
    if (!id) return
    setAssignUserPrincipals((prev) => new Set(prev).add(id))
    setAssignUserManualId('')
  }, [assignUserManualId])

  const filteredAssignUsers = useMemo(() => {
    const query = assignUserSearch.trim().toLowerCase()
    if (!query) return identityUsers
    return identityUsers.filter(
      (user) => user.display_name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    )
  }, [identityUsers, assignUserSearch])

  const handleCreateAssignment = useCallback(async () => {
    if (!assignUserRoleId || assignUserPrincipals.size === 0) return
    setAssignUserSubmitting(true)
    const role = roles.find((r) => r.id === assignUserRoleId)
    const principals = Array.from(assignUserPrincipals)
    const isOrganizationAdminRole = role?.roleCode === 'tectona.organization_admin'
    const isPersonalAdminRole = role?.roleCode === 'tectona.personal_workspace_admin'
    let organizationWorkspaceId = activeTenant?.tenantMode === 'organization'
      ? activeTenant.workspaceId
      : undefined

    // Organization Admin is an organization-level role. Resolve the organization
    // home workspace instead of accidentally scoping it to the administrator's
    // currently selected personal workspace.
    if (isOrganizationAdminRole && activeTenant?.orgId) {
      try {
        const workspaces = await fetchAllWorkspaceOrgWorkspaces()
        const isRoot = (workspace: (typeof workspaces)[number]) => {
          const metadata = workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}
          const parentId = metadata.parent_workspace_id
          return workspace.organization_id === activeTenant.orgId
            && workspace.tenant_mode !== 'personal'
            && !(typeof parentId === 'string' && parentId.trim())
        }
        organizationWorkspaceId = workspaces.find(isRoot)?.id ?? organizationWorkspaceId
      } catch {
        // The authorization assignment remains useful even if the directory is
        // temporarily unavailable; WAC membership is attempted below when possible.
      }
    }

    const scopedRole = isPersonalAdminRole || isOrganizationAdminRole
    const assignmentScope = scopedRole && (isOrganizationAdminRole ? organizationWorkspaceId : activeTenant?.workspaceId)
      ? `workspace:${isOrganizationAdminRole ? organizationWorkspaceId : activeTenant?.workspaceId}`
      : 'global'
    const actorId = getSession()?.user.id
    const results = await Promise.allSettled(
      principals.map((principalSub) =>
        createAuthzAssignment({ principal_sub: principalSub, role_id: assignUserRoleId, scope: assignmentScope })
      )
    )
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded
    let wacFailed = 0
    const authzAssignmentsAlreadyExist = results.length > 0 && results.every((result) =>
      result.status === 'rejected'
      && /already exists|already assigned|duplicate|conflict|409/i.test(
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
    )

    // The workspace switcher is backed by WAC memberships, not AuthZ role
    // assignments. Keep both sources in sync for Organization Admin grants.
    if (isOrganizationAdminRole && organizationWorkspaceId && (succeeded > 0 || authzAssignmentsAlreadyExist)) {
      const wacResults = await Promise.allSettled(
        principals.map(async (principalSub) => {
          await createWorkspaceMembership(
            TECTONA_WAC_APP_ID,
            organizationWorkspaceId,
            {
              subject_id: principalSub,
              role_code: 'admin',
              status_code: 'active',
              participation_scope_code: PARTICIPATION_SCOPE_CODE.ALL,
              participation_duration_code: 'permanent',
            },
            { actorId },
          )
          try {
            await ensureWorkspaceDirectoryMembership(
              organizationWorkspaceId,
              { identity_ref: principalSub, role_code: 'admin', status_code: 'active' },
              { actorId },
            )
          } catch {
            // WAC is authoritative; directory enrichment is best effort.
          }
        }),
      )
      wacFailed = wacResults.filter((r) => r.status === 'rejected').length
    }
    if (succeeded > 0) {
      addToast({
        variant: failed > 0 || wacFailed > 0 ? 'warning' : 'success',
        title: failed > 0 || wacFailed > 0 ? 'Assignment partially completed' : 'User(s) assigned',
        description:
          failed > 0 || wacFailed > 0
            ? `${succeeded} AuthZ assignment(s) created${wacFailed > 0 ? `, ${wacFailed} Workspace access grant(s) failed` : ''}.`
            : `${succeeded} user${succeeded === 1 ? '' : 's'} assigned to "${role?.name ?? 'role'}".`,
      })
      setAssignUserOpen(false)
      await fetchRoles()
    } else {
      addToast({ variant: 'error', title: 'Failed to assign user(s)', description: 'No assignments were created.' })
    }
    setAssignUserSubmitting(false)
  }, [activeTenant?.orgId, activeTenant?.tenantMode, activeTenant?.workspaceId, assignUserPrincipals, assignUserRoleId, addToast, fetchRoles, roles])

  const normalizedPrivilegeFilter = useMemo(() => {
    return privilegeChipFilter.size > 0 ? privilegeChipFilter : new Set(ALL_ROLE_PRIVILEGES)
  }, [privilegeChipFilter])

  const rolePrivilegeCounts = useMemo(() => {
    const map = new Map<RoleItem['privilege'], number>()
    for (const privilege of ALL_ROLE_PRIVILEGES) map.set(privilege, 0)
    for (const role of roles) map.set(role.privilege, (map.get(role.privilege) ?? 0) + 1)
    return map
  }, [roles])

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
      const matchesPrivilege = normalizedPrivilegeFilter.has(role.privilege)

      return matchesQuery && matchesRole && matchesScope && matchesPermissionStatus && matchesPrivilege
    })
  }, [deferredSearch, normalizedPrivilegeFilter, permissionStatusFilter, roleFilter, roles, scopeFilter])

  // --- Role directory enterprise table state --------------------------------
  const [roleTableSort, setRoleTableSort] = useState<{ key: RoleTableColumnKey; dir: 'asc' | 'desc' } | null>(null)
  const [roleTableGroupBy, setRoleTableGroupBy] = useState<RoleTableGroupByKey | null>(null)
  const [showRoleTableSelection, setShowRoleTableSelection] = useState(false)
  const [roleTableSelectedIds, setRoleTableSelectedIds] = useState<string[]>([])
  const [rolePage, setRolePage] = useState(1)
  const [rolePageSize, setRolePageSize] = useState(10)
  const [roleColumnFilterScope, setRoleColumnFilterScope] = useState<Set<string>>(new Set())
  const [roleColumnFilterStatus, setRoleColumnFilterStatus] = useState<Set<string>>(new Set())
  const [roleRowMenu, setRoleRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  const [showSeparationOfConcernsNotice, setShowSeparationOfConcernsNotice] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSeparationOfConcernsNotice(false), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  const toggleRoleFilterValue = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
      setter((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
    },
    []
  )

  const buildRoleFilterOptions = useCallback(
    (accessor: (item: RoleItem) => string) => {
      const counts = new Map<string, number>()
      filteredRoles.forEach((item) => {
        const value = accessor(item)
        counts.set(value, (counts.get(value) ?? 0) + 1)
      })
      return Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count }))
    },
    [filteredRoles]
  )

  const roleScopeFilterOptions = useMemo(() => buildRoleFilterOptions((item) => item.accessScope), [buildRoleFilterOptions])
  const roleStatusFilterOptions = useMemo(() => buildRoleFilterOptions((item) => item.status), [buildRoleFilterOptions])

  const columnFilteredRoles = useMemo(() => {
    return filteredRoles.filter((item) => {
      if (roleColumnFilterScope.size > 0 && !roleColumnFilterScope.has(item.accessScope)) return false
      if (roleColumnFilterStatus.size > 0 && !roleColumnFilterStatus.has(item.status)) return false
      return true
    })
  }, [filteredRoles, roleColumnFilterScope, roleColumnFilterStatus])

  const toggleRoleTableSort = useCallback((key: RoleTableColumnKey) => {
    setRoleTableSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }, [])

  const sortedRoleRows = useMemo(() => {
    if (!roleTableSort) return columnFilteredRoles
    const { key, dir } = roleTableSort
    const mul = dir === 'asc' ? 1 : -1
    const valueByKey = (item: RoleItem): string | number => {
      switch (key) {
        case 'name': return item.name
        case 'accessScope': return item.accessScope
        case 'assignedUsers': return item.assignedUsers
        case 'privilege': return item.privilege
        case 'status': return item.status
        case 'lastUpdated': return item.lastUpdated
      }
    }
    return [...columnFilteredRoles].sort((a, b) => {
      const left = valueByKey(a)
      const right = valueByKey(b)
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * mul
      return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * mul
    })
  }, [columnFilteredRoles, roleTableSort])

  const roleFlatRows = useMemo(() => {
    if (roleTableGroupBy) {
      const grouped = [...sortedRoleRows].sort((a, b) =>
        roleTableGroupLabel(a, roleTableGroupBy).localeCompare(roleTableGroupLabel(b, roleTableGroupBy), undefined, {
          sensitivity: 'base',
        })
      )
      return grouped.map((item) => ({ item, groupLabel: roleTableGroupLabel(item, roleTableGroupBy) }))
    }
    return sortedRoleRows.map((item) => ({ item, groupLabel: null as string | null }))
  }, [sortedRoleRows, roleTableGroupBy])

  const roleTotalPages = Math.max(1, Math.ceil(roleFlatRows.length / rolePageSize))
  const rolePageSafe = Math.min(rolePage, roleTotalPages)
  const roleStart = roleFlatRows.length === 0 ? 0 : (rolePageSafe - 1) * rolePageSize + 1
  const roleEnd = Math.min(roleFlatRows.length, rolePageSafe * rolePageSize)
  const pagedRoleRows = roleFlatRows.slice(roleStart === 0 ? 0 : roleStart - 1, roleEnd)

  const { tableRef: roleTableRef, ...roleTableColumns } = useEnterpriseSortableColumns<RoleTableColumnKey>({
    initialOrder: ROLE_TABLE_DEFAULT_COLUMN_ORDER,
    pinnedFirstKey: ROLE_TABLE_PINNED_FIRST_COLUMN,
    hasSelectionColumn: showRoleTableSelection,
    onColumnHidden: (key) => {
      if (roleTableGroupBy && (key as string) === roleTableGroupBy) setRoleTableGroupBy(null)
    },
  })

  const toggleRoleTableRowSelection = useCallback((id: string) => {
    setRoleTableSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const setShowRoleTableSelectionSafe = useCallback((checked: boolean) => {
    setShowRoleTableSelection(checked)
    if (!checked) setRoleTableSelectedIds([])
  }, [])

  const renderRoleTableCell = (item: RoleItem, key: RoleTableColumnKey) => {
    switch (key) {
      case 'name':
        if (renamingRoleId === item.id) {
          return (
            <div className="min-w-0" onClick={(event) => event.stopPropagation()}>
              <Input
                autoFocus
                value={renameValue}
                disabled={renameSubmitting}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commitRenameRole(item)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelRenameRole()
                  }
                }}
                onBlur={() => void commitRenameRole(item)}
                className="h-8 text-sm font-semibold"
              />
              <div className="mt-0.5 truncate text-[11px] leading-5 text-slate-500">{item.description}</div>
            </div>
          )
        }
        return (
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{item.name}</div>
            <div className="mt-0.5 truncate text-[11px] leading-5 text-slate-500">{item.description}</div>
          </div>
        )
      case 'accessScope':
        return (
          <Badge variant="outline" className={badgeClass(item.accessScope)}>
            {item.accessScope}
          </Badge>
        )
      case 'assignedUsers':
        return <span className="tabular-nums text-slate-700">{item.assignedUsers}</span>
      case 'privilege':
        return (
          <Badge variant="outline" className={badgeClass(item.privilege)}>
            {item.privilege}
          </Badge>
        )
      case 'status':
        return (
          <Badge variant="outline" className={badgeClass(item.status)}>
            {item.status}
          </Badge>
        )
      case 'lastUpdated':
        return <span className="text-slate-500">{item.lastUpdated}</span>
    }
  }

  const renderRoleFilterSlot = (key: RoleTableColumnKey) => {
    switch (key) {
      case 'accessScope':
        return (
          <EnterpriseColumnFilterDropdown
            label="Scope"
            ariaLabel="Filter by scope"
            options={roleScopeFilterOptions}
            selected={roleColumnFilterScope}
            onToggleOption={(value) => toggleRoleFilterValue(setRoleColumnFilterScope, value)}
            onShowAll={() => setRoleColumnFilterScope(new Set())}
          />
        )
      case 'status':
        return (
          <EnterpriseColumnFilterDropdown
            label="Status"
            ariaLabel="Filter by status"
            options={roleStatusFilterOptions}
            selected={roleColumnFilterStatus}
            onToggleOption={(value) => toggleRoleFilterValue(setRoleColumnFilterStatus, value)}
            onShowAll={() => setRoleColumnFilterStatus(new Set())}
          />
        )
      default:
        return undefined
    }
  }

  const filteredScopedAccess = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return liveScopedAccessItems.filter((item) => {
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
  }, [deferredSearch, liveScopedAccessItems, projectFilter, roleFilter, scopeFilter, teamFilter, userTypeFilter, workspaceFilter])

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
      {
        label: 'Total Roles',
        value: `${roles.length}`,
        detail: 'Reusable access profiles across platform scopes',
        trend: '+1',
        icon: ShieldCheck,
        trendColor: '#0ea5e9',
        section: 'rbac',
      },
      {
        label: 'Active Users',
        value: '226',
        detail: 'Identities with current platform access',
        trend: '+12',
        icon: Users,
        trendColor: '#6366f1',
        section: 'reviews',
      },
      {
        label: 'SSO / federated users',
        value: '187',
        detail: 'Identities federated via enterprise IdP connections',
        trend: '+4',
        icon: Network,
        trendColor: '#10b981',
        section: 'identity',
      },
      {
        label: 'Privileged Roles',
        value: `${roles.filter((role) => role.privilege === 'Privileged').length}`,
        detail: 'Roles with elevated or administrative impact',
        trend: '0',
        icon: BadgeCheck,
        trendColor: '#f59e0b',
        section: 'rbac',
      },
      {
        label: 'Policy Violations',
        value: '12',
        detail: 'Open issues across reviews, exceptions, and sync drift',
        trend: '-3',
        icon: AlertTriangle,
        trendColor: '#a855f7',
        section: 'compliance',
      },
      {
        label: 'Audit Events Today',
        value: `${auditEvents.length}`,
        detail: 'Security-relevant events visible for export',
        trend: '+6',
        icon: Activity,
        trendColor: '#06b6d4',
        section: 'audit',
      },
    ],
    [roles]
  )

  const currentMatrixRole = useMemo(
    () => roles.find((role) => role.name === selectedMatrixRole) ?? roles[0],
    [roles, selectedMatrixRole]
  )
  const matrixRoleOptions = useMemo(
    () => [...roles].sort((left, right) => {
      const leftCustom = left.roleCode.startsWith('tectona.custom_') ? 1 : 0
      const rightCustom = right.roleCode.startsWith('tectona.custom_') ? 1 : 0
      const leftPreferred = isPersonalWorkspaceContext
        ? left.roleCode === 'tectona.personal_workspace_admin' ? -2 : 0
        : isOrganizationAdminContext
          ? left.roleCode === 'tectona.organization_admin' ? -2 : 0
          : 0
      const rightPreferred = isPersonalWorkspaceContext
        ? right.roleCode === 'tectona.personal_workspace_admin' ? -2 : 0
        : isOrganizationAdminContext
          ? right.roleCode === 'tectona.organization_admin' ? -2 : 0
          : 0
      return leftPreferred - rightPreferred || leftCustom - rightCustom || left.name.localeCompare(right.name)
    }),
    [isOrganizationAdminContext, isPersonalWorkspaceContext, roles]
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
      ...liveScopedAccessItems.map((item) => ['Scoped Access', item.subject, item.scopeName, item.status]),
    ])
  }

  const isOverviewSectionActive = activePanel === 'overview'

  const accessDistributionTotal = accessDistribution.reduce((sum, item) => sum + item.value, 0)
  const accessDistributionByShare = [...accessDistribution].sort((a, b) => a.value - b.value)
  const accessBroadRole = accessDistributionByShare[accessDistributionByShare.length - 1]
  const accessBroadSharePct = accessDistributionTotal > 0 ? Math.round((accessBroadRole.value / accessDistributionTotal) * 100) : 0
  const accessElevatedRoles = accessDistributionByShare.slice(0, 2)
  const accessElevatedSharePct =
    accessDistributionTotal > 0
      ? Math.round((accessElevatedRoles.reduce((sum, item) => sum + item.value, 0) / accessDistributionTotal) * 100)
      : 0
  const accessConcentrationSignal =
    accessBroadSharePct >= 50 ? 'Broad Access Prevails' : accessBroadSharePct >= 30 ? 'Balanced Distribution' : 'Concentrated Access'

  return (
    <div className="space-y-6 pb-10 text-slate-900">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked && showEnterpriseNavPanel, showEnterpriseNavPanel && isWorkspaceCollapsed, enterpriseNavLayoutVariant))}>
        <Breadcrumb items={[{ label: 'Security & Access Control' }]} />

        <PageHeader
          title="Security & Access Control"
          description="Operational security governance for the platform—roles, permissions, scoped access, identity posture, data protection, and compliance readiness. Connector infrastructure and IAM engine configuration are maintained in Platform Settings & Administration."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-sm flex-nowrap shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKpiCards((current) => !current)}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                    showKpiCards && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  )}
                  aria-label={showKpiCards ? 'Hide KPI cards' : 'Show KPI cards'}
                  title={showKpiCards ? 'Hide KPI cards' : 'Show KPI cards'}
                >
                  <LayoutGrid className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnterpriseNavPanel((visible) => !visible)}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                    showEnterpriseNavPanel && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  )}
                  aria-label={showEnterpriseNavPanel ? 'Hide enterprise navigation' : 'Show enterprise navigation'}
                  title={showEnterpriseNavPanel ? 'Hide enterprise navigation' : 'Show enterprise navigation'}
                >
                  <PanelLeft className="h-5 w-5" strokeWidth={2} />
                </button>
                {!isOverviewSectionActive ? (
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel((current) => !current)}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                      showFiltersPanel && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                    )}
                    aria-label={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                    title={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                  >
                    <Filter className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm"
                  aria-label="Export access report"
                  title="Export access report"
                  onClick={exportAccessReport}
                >
                  <Download className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
          }
        />

        {showKpiCards ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {overviewCards.map((card) => (
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
                    <card.icon className="h-7 w-7" />
                  </div>
                </div>

                <div className="text-xs text-slate-500">{card.label}</div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{card.value}</div>
                  <div className="h-10 min-w-0 flex-1">
                    <KpiSparkline data={[10, 12, 11, 13, 12, 14, 14, 15]} color={card.trendColor} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <card.icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <span className="truncate">{card.detail}</span>
                  </span>
                  <span className={cn('shrink-0 font-semibold', card.trend.startsWith('-') ? 'text-rose-600' : 'text-emerald-600')}>
                    {card.trend}
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>
        ) : null}
      </div>

      <div
        className={cn(
          showEnterpriseNavPanel
            ? workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavLayoutVariant)
            : 'relative'
        )}
      >
        {showEnterpriseNavPanel ? (
        <aside className={workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant)}>
          <div
            ref={navPanelRef}
            className={cn(
              workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed),
              // Match Document & Knowledge Management's Enterprise Navigation panel corner radius (rounded-2xl, not rounded-[28px]).
              'rounded-2xl xl:rounded-r-2xl',
              !navDocked && 'overflow-hidden'
            )}
            style={!navDocked && navPanelHeightPx ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx } : undefined}
            aria-label="Security workspace navigation"
          >
            <div className="shrink-0">
              <div className={cn('flex items-center', isWorkspaceCollapsed ? 'mb-2 justify-center' : 'mb-3 justify-between')}>
                {!isWorkspaceCollapsed ? (
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Enterprise Navigation</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'shrink-0 rounded-xl border border-slate-200/70 bg-white/75 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900',
                    isWorkspaceCollapsed ? 'h-8 w-8 rounded-full' : 'h-9 w-9'
                  )}
                  aria-label={isWorkspaceCollapsed ? 'Expand security workspace navigation' : 'Collapse security workspace navigation'}
                  title={isWorkspaceCollapsed ? 'Expand security workspace navigation' : 'Collapse security workspace navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                >
                  {isWorkspaceCollapsed ? (
                    <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                  )}
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
              {isWorkspaceCollapsed ? (
                <EnterpriseNavIconRail
                  items={PANEL_ITEMS}
                  activeId={activePanel}
                  onSelect={(id) => {
                    setActivePanel(id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />
              ) : (
              <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                {PANEL_GROUPS.map(({ group, items }) => (
                  <div key={group} className="space-y-1.5">
                    {!enterpriseNavCompact ? (
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
                            enterpriseNavCompact
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
                              className={cn('shrink-0', enterpriseNavCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
                            />
                          </span>
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
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              )}

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
        ) : null}

        <div
          className={cn(
            'min-w-0',
            showEnterpriseNavPanel
              ? workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant)
              : 'w-full max-w-full space-y-4'
          )}
        >
          {!isOverviewSectionActive && showFiltersPanel ? (
            <Card className="liquid-glass-enterprise-panel relative z-40 overflow-visible rounded-2xl p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  value={searchInput}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder={
                    activePanel === 'permissions'
                      ? 'Search permission, module, section, resource, or action'
                      : 'Search role name, user, team, workspace, project, or policy'
                  }
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-9 text-sm"
                />
              </div>

              {activePanel === 'rbac' ? (
                <div className="relative pt-3">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--border)/0.2)_18%,hsl(var(--border)/0.75)_50%,hsl(var(--border)/0.2)_82%,transparent_100%)]"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddRoleDrawer()}
                        className={enterpriseIndigoGradientActionButtonClass()}
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        Add Role
                      </button>
                      <button
                        type="button"
                        onClick={() => openAssignUserModal()}
                        className={enterpriseCyanGradientActionButtonClass()}
                      >
                        <UserPlus className="h-4 w-4" strokeWidth={2.5} />
                        Assign User
                      </button>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto">
                      <span className="shrink-0 text-xs text-slate-500">
                        Privilege <span className="tabular-nums">({roles.length})</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ALL_ROLE_PRIVILEGES.map((privilege) => {
                          const on = normalizedPrivilegeFilter.has(privilege)
                          const count = rolePrivilegeCounts.get(privilege) ?? 0
                          return (
                            <button
                              key={privilege}
                              type="button"
                              onClick={() => {
                                setPrivilegeChipFilter((prev) => {
                                  const allowed = new Set(ALL_ROLE_PRIVILEGES)
                                  const next = new Set<RoleItem['privilege']>()
                                  for (const v of prev) if (allowed.has(v)) next.add(v)
                                  if (next.has(privilege)) next.delete(privilege)
                                  else next.add(privilege)
                                  if (next.size === 0) return new Set(ALL_ROLE_PRIVILEGES)
                                  return next
                                })
                              }}
                              className={privilegeTagChrome(privilege, on)}
                              aria-pressed={on}
                              title={on ? `Hide ${privilege}` : `Show ${privilege}`}
                            >
                              <span>{privilege}</span>
                              <span className={cn('tabular-nums text-[10px]', on ? 'opacity-80' : 'opacity-60')}>{count}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activePanel === 'scoped-access' ? (
                <div className="relative pt-3">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--border)/0.2)_18%,hsl(var(--border)/0.75)_50%,hsl(var(--border)/0.2)_82%,transparent_100%)]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={openScopedAccessDrawer} className={enterpriseCyanGradientActionButtonClass()}>
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                      Assign Access
                    </button>
                  </div>
                </div>
              ) : null}

              {activePanel === 'permissions' ? (
                <div className="relative pt-3">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--border)/0.2)_18%,hsl(var(--border)/0.75)_50%,hsl(var(--border)/0.2)_82%,transparent_100%)]"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto">
                      {matrixViewMode === 'user' ? (
                        <div className="relative min-w-[280px]">
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <Input
                              value={selectedEffectiveUser ? selectedEffectiveUser.display_name : effectiveUserSearch}
                              onChange={(event) => {
                                setEffectiveUserId(null)
                                setEffectiveUserSearch(event.target.value)
                                setEffectiveUserPickerOpen(true)
                              }}
                              onFocus={() => setEffectiveUserPickerOpen(true)}
                              placeholder="Search user by name or email…"
                              className="h-9 rounded-lg border-slate-200 bg-white pl-9 pr-3 text-xs"
                            />
                          </div>
                          {effectiveUserPickerOpen ? (
                            <div className="absolute right-0 z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl">
                              {identityUsersLoading ? <LoadingSkeleton rows={3} /> : filteredEffectiveUsers.length === 0 ? (
                                <p className="px-3 py-4 text-center text-xs text-slate-500">No users found.</p>
                              ) : filteredEffectiveUsers.map((user) => (
                                <button key={user.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectEffectiveUser(user)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-blue-50">
                                  <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', userAvatarTone(user.display_name))}>{userInitials(user.display_name)}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-semibold text-slate-800">{user.display_name}</span>
                                    <span className="block truncate text-[10px] text-slate-500">{user.email}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {matrixViewMode === 'role' ? (
                        <>
                          <Select value={selectedMatrixRole} onChange={(event) => setSelectedMatrixRole(event.target.value)} className="min-w-[180px]">
                            {matrixRoleOptions.map((role) => (
                              <SelectItem key={role.id} value={role.name}>
                                <span className="flex items-center gap-2">
                                  <span>{role.roleCode.startsWith('tectona.custom_') ? 'Custom · ' : 'System · '}{role.name}</span>
                                  {!role.roleCode.startsWith('tectona.custom_') ? (
                                    <Badge variant="outline" className="border-violet-200 bg-violet-50 px-1.5 py-0 text-[9px] font-semibold text-violet-700">
                                      {isPersonalWorkspaceContext
                                        ? role.roleCode === 'tectona.personal_workspace_admin' ? 'Platform Admin Personal' : 'Workspace Role'
                                        : isOrganizationAdminContext && role.roleCode === 'tectona.organization_admin'
                                          ? 'Organization Admin'
                                          : 'Global Admin Only'}
                                    </Badge>
                                  ) : null}
                                </span>
                              </SelectItem>
                            ))}
                          </Select>
                          {!currentMatrixRole.roleCode.startsWith('tectona.custom_') ? (
                            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] font-semibold text-violet-700">
                              {isPersonalWorkspaceContext
                                ? currentMatrixRole.roleCode === 'tectona.personal_workspace_admin' ? 'Platform Admin Personal' : 'Workspace Role'
                                : isOrganizationAdminContext && currentMatrixRole.roleCode === 'tectona.organization_admin'
                                  ? 'Organization Admin'
                                  : 'Global Admin Only'}
                            </Badge>
                          ) : null}
                        </>
                      ) : null}
                      <div className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
                        <button
                          type="button"
                          onClick={() => setMatrixViewMode('role')}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                            matrixViewMode === 'role' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          By Role
                        </button>
                        <button
                          type="button"
                          onClick={() => switchToUserMatrixView()}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                            matrixViewMode === 'user' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <User className="h-3.5 w-3.5" />
                          By User
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          <div className="grid gap-6">
            <div className="space-y-6">
              {activePanel === 'overview' ? (
                <Panel
                  id="overview"
                  title="Security Overview"
                  description={`Enterprise control center for role governance, federated identity, and policy clarity. Current view grouped by ${groupBy.toLowerCase()}.`}
                  highlight={activePanel === 'overview'}
                  headerIcon={<ShieldCheck className="h-5 w-5" />}
                  showDivider={false}
                  outerRef={activeMainPanelRef}
                  style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
                  className={cn(mainPanelViewportHeightPx != null && 'overflow-hidden')}
                  scrollBody={mainPanelViewportHeightPx != null}
                >
                  <div className="grid gap-4 xl:grid-cols-2">
                    <OverviewChartPanel
                      title="Security posture widget"
                      description="Compact control view across identity, privileged reviews, policy enforcement, and exception closure."
                      icon={ShieldCheck}
                      tone="emerald"
                      right={
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          Overall posture 89%
                        </Badge>
                      }
                    >
                      <div className="space-y-3">
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

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/75 to-slate-100/80 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Adoption</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{accessSummary.adoption}</div>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(16,185,129,0.10)]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Privileged Coverage</div>
                          <div className="mt-1 text-sm font-semibold text-emerald-700">{accessSummary.privilegedCoverage}</div>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(245,158,11,0.10)]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500">Exception Aging</div>
                          <div className="mt-1 text-sm font-semibold text-amber-700">{accessSummary.exceptionAging}</div>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(244,63,94,0.10)]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-500">Sync Issues</div>
                          <div className="mt-1 text-sm font-semibold text-rose-700">{accessSummary.syncIssues}</div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Top privileged roles</p>
                        <div className="mt-2 space-y-2">
                          {roles
                            .filter((role) => role.privilege === 'Privileged')
                            .slice(0, 3)
                            .map((role) => (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => openRoleDetail(role)}
                                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300"
                              >
                                <span className="min-w-0 truncate text-xs font-semibold text-slate-800">{role.name}</span>
                                <span className="shrink-0 text-[11px] text-slate-500">{role.assignedUsers} users</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    </OverviewChartPanel>

                    <div className="grid gap-4">
                      <OverviewChartPanel
                        title="Access distribution"
                        description="Distribution by role and scope to surface concentration of elevated access."
                        icon={Activity}
                        tone="sky"
                        right={
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                            Role weighted
                          </Badge>
                        }
                      >
                        <div className="grid gap-5 lg:grid-cols-[176px,1fr] lg:items-center">
                          <div className="relative mx-auto h-44 w-44">
                            <div
                              className="pointer-events-none absolute -inset-3 rounded-full"
                              style={{
                                background:
                                  'conic-gradient(from 220deg, rgba(37,99,235,0.15), rgba(124,58,237,0.13), rgba(217,119,6,0.11), rgba(37,99,235,0.15))',
                                filter: 'blur(1px)',
                              }}
                            />
                            <div className="pointer-events-none absolute inset-2 rounded-full border border-white/90 bg-gradient-to-br from-white/95 via-slate-50/95 to-slate-100/85 shadow-[0_14px_32px_rgba(15,23,42,0.10)]" />
                            <div className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-200/80 bg-sky-50/95 px-2.5 py-1 text-[10px] font-semibold text-sky-700 shadow-sm">
                              Role Concentration
                            </div>
                            <div className="absolute inset-0">
                              <MeasuredResponsiveContainer>
                                <PieChart>
                                  <defs>
                                    {accessDistribution.map((entry) => (
                                      <linearGradient key={entry.name} id={`access-dist-${entry.name.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.8} />
                                      </linearGradient>
                                    ))}
                                  </defs>
                                  <Pie
                                    data={accessDistribution}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={46}
                                    outerRadius={68}
                                    cornerRadius={6}
                                    paddingAngle={2.5}
                                    stroke="white"
                                    strokeWidth={1.5}
                                  >
                                    {accessDistribution.map((entry) => (
                                      <Cell key={entry.name} fill={`url(#access-dist-${entry.name.replace(/\s+/g, '-')})`} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number, name: string) => [`${value} identities`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                </PieChart>
                              </MeasuredResponsiveContainer>
                            </div>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <div className="rounded-2xl border border-white/90 px-4 py-2 text-center backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.88)', boxShadow: '0 8px 22px rgba(15,23,42,0.10)' }}>
                                <div className="text-2xl font-bold leading-none tracking-tight text-slate-900">{accessDistributionTotal}</div>
                                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Identities</div>
                              </div>
                            </div>
                            <div className="pointer-events-none absolute bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/95 px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
                              {accessDistribution.length} roles tracked
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/75 to-slate-100/80 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Executive Signal</div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">{accessConcentrationSignal}</div>
                              </div>
                              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(16,185,129,0.10)]">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">Elevated Coverage</div>
                                <div className="mt-1 text-sm font-semibold text-emerald-700">{accessElevatedSharePct}% of pool</div>
                              </div>
                              <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(244,63,94,0.10)]">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500">Broad Exposure</div>
                                <div className="mt-1 text-sm font-semibold text-rose-700">{accessBroadSharePct}% of pool</div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              {accessDistribution.map((item) => {
                                const ratio = accessDistributionTotal > 0 ? Math.round((item.value / accessDistributionTotal) * 100) : 0
                                return (
                                  <div
                                    key={item.name}
                                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-3 py-2 transition-all duration-200 hover:border-slate-300 hover:bg-white"
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="w-6 text-right text-sm font-semibold text-slate-900">{item.value}</span>
                                      <span className="w-11 text-right text-xs font-semibold text-slate-500">{ratio}%</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </OverviewChartPanel>

                      <OverviewChartPanel
                        title="Review cadence"
                        description="Access review completion versus violations this week."
                        icon={BarChart3}
                        tone="violet"
                      >
                        <div className="h-44">
                          <MeasuredResponsiveContainer>
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
                          </MeasuredResponsiveContainer>
                        </div>
                      </OverviewChartPanel>
                    </div>
                  </div>
                </Panel>
              ) : null}

              {activePanel === 'rbac' ? (
                <Panel
                  id="rbac"
                  title="Role Directory Panel"
                  description="List of roles with privilege, scope, status, and quick operational actions."
                  highlight={activePanel === 'rbac'}
                  headerIcon={<ShieldCheck className="h-5 w-5" />}
                  showDivider={false}
                  outerRef={activeMainPanelRef}
                  style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
                  className={cn('flex min-h-0 w-full flex-col', mainPanelViewportHeightPx != null && 'overflow-hidden')}
                  scrollBody={mainPanelViewportHeightPx != null}
                  right={
                    <div className="flex flex-wrap items-center justify-end gap-3 py-1 text-xs text-muted-foreground">
                      <EnterpriseGroupByControl
                        options={ROLE_TABLE_GROUP_BY_OPTIONS}
                        value={roleTableGroupBy}
                        onChange={(key) => setRoleTableGroupBy(key)}
                      />
                      <EnterpriseSelectionToggle checked={showRoleTableSelection} onChange={setShowRoleTableSelectionSafe} />
                      <EnterpriseColumnVisibilityControl
                        columns={ROLE_TABLE_COLUMN_VISIBILITY_OPTIONS}
                        hidden={roleTableColumns.hiddenColumns}
                        visibleCount={roleTableColumns.visibleColumnOrder.length}
                        onToggle={roleTableColumns.toggleColumnVisibility}
                        onShowAll={roleTableColumns.showAllColumns}
                        canEnable={roleTableColumns.canShowColumn}
                      />
                      <p className="text-xs text-muted-foreground">
                        Showing <span className="font-semibold text-foreground">{roleStart}</span>-
                        <span className="font-semibold text-foreground">{roleEnd}</span> of{' '}
                        <span className="font-semibold text-foreground">{roleFlatRows.length}</span>
                      </p>
                      <span className="text-xs text-muted-foreground">Rows:</span>
                      <Select
                        value={String(rolePageSize)}
                        onChange={(e) => {
                          setRolePageSize(parseInt(e.target.value, 10))
                          setRolePage(1)
                        }}
                        className="h-10 w-[84px] text-sm"
                      >
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                      </Select>
                      <div className="flex h-10 items-stretch gap-0.5 rounded-lg border border-border bg-background/80 p-0.5 shadow-sm">
                        <button
                          type="button"
                          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                          onClick={() => setRolePage((prev) => Math.max(1, prev - 1))}
                          disabled={rolePageSafe <= 1}
                        >
                          Previous
                        </button>
                        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">
                          {rolePageSafe} / {roleTotalPages}
                        </div>
                        <button
                          type="button"
                          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                          onClick={() => setRolePage((prev) => Math.min(roleTotalPages, prev + 1))}
                          disabled={rolePageSafe >= roleTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  }
                >
                  <div
                    className={cn(
                      'shrink-0 overflow-hidden transition-all duration-500 ease-out',
                      showSeparationOfConcernsNotice ? 'mb-4 max-h-40 opacity-100' : 'mb-0 max-h-0 opacity-0'
                    )}
                  >
                    <EnterpriseInfoCallout title="Separation of concerns">
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
                  </div>

                  {roleFlatRows.length > 0 ? (
                    <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl">
                      <DndContext sensors={roleTableColumns.dndSensors} onDragEnd={roleTableColumns.handleColumnDragEnd}>
                        <table
                          ref={roleTableRef}
                          className={cn(
                            'border-collapse text-xs select-none',
                            roleTableColumns.hasAnyCustomWidth || roleTableColumns.resizingKey ? 'table-fixed w-full' : 'w-full'
                          )}
                        >
                          <colgroup>
                            {showRoleTableSelection ? <col className="w-10" /> : null}
                            {roleTableColumns.visibleColumnOrder.map((key) => (
                              <col key={key} style={roleTableColumns.columnWidthStyle(key)} />
                            ))}
                            <col className="w-12" />
                          </colgroup>
                          <thead className="sticky top-0 z-10">
                            <tr className="text-left text-muted-foreground">
                              {showRoleTableSelection ? (
                                <th className="w-10 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90">
                                  <input
                                    type="checkbox"
                                    id="role-table-select-all"
                                    name="role-table-select-all"
                                    checked={
                                      roleTableSelectedIds.length > 0 && roleTableSelectedIds.length === pagedRoleRows.length
                                    }
                                    onChange={() =>
                                      setRoleTableSelectedIds(
                                        roleTableSelectedIds.length === pagedRoleRows.length
                                          ? []
                                          : pagedRoleRows.map(({ item }) => item.id)
                                      )
                                    }
                                    aria-label="Select all rows on this page"
                                  />
                                </th>
                              ) : null}
                              <SortableContext items={roleTableColumns.visibleColumnOrder} strategy={rectSortingStrategy}>
                                {roleTableColumns.visibleColumnOrder.map((key) => (
                                  <EnterpriseSortableHeaderCell
                                    key={key}
                                    columnKey={key}
                                    label={roleTableColumnLabel(key)}
                                    icon={roleTableColumnHeaderIcon(key)}
                                    isPinned={roleTableColumns.isPinnedColumn(key)}
                                    isFirstColumn={roleTableColumns.isFirstColumn(key)}
                                    isLastColumn={roleTableColumns.isLastColumn(key)}
                                    widthStyle={roleTableColumns.columnWidthStyle(key)}
                                    sortDir={roleTableSort?.key === key ? roleTableSort.dir : null}
                                    onToggleSort={toggleRoleTableSort}
                                    filterSlot={renderRoleFilterSlot(key)}
                                    frozenColumnClass={roleTableColumns.frozenColumnHeaderClass}
                                    firstColumnTintClass={roleTableColumns.firstColumnTintHeaderClass}
                                    isResizing={roleTableColumns.resizingKey === key}
                                    onBeginResize={roleTableColumns.beginColumnResize}
                                    onContextMenu={(event, columnKey) =>
                                      roleTableColumns.setHeaderContextMenu({ x: event.clientX, y: event.clientY, columnKey })
                                    }
                                  />
                                ))}
                              </SortableContext>
                              <th className="w-12 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedRoleRows.map(({ item, groupLabel }, rowIndex) => {
                              const previousGroupLabel = pagedRoleRows[rowIndex - 1]?.groupLabel ?? null
                              const showGroupHeader = roleTableGroupBy && groupLabel && groupLabel !== previousGroupLabel
                              const groupTint = roleTableGroupBy && groupLabel ? getEnterpriseGroupTint(roleTableGroupBy, groupLabel) : null
                              const isSelected = showRoleTableSelection && roleTableSelectedIds.includes(item.id)
                              const resolveBodyCellBackground = (isFirstColumn: boolean) => {
                                if (isSelected) return ''
                                const stickyFirstClass =
                                  roleTableColumns.freezeFirstColumn && isFirstColumn
                                    ? 'sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.35)]'
                                    : ''
                                if (groupTint) {
                                  return cn(isFirstColumn ? groupTint.first : groupTint.row, stickyFirstClass)
                                }
                                if (roleTableColumns.freezeFirstColumn && isFirstColumn) return roleTableColumns.frozenColumnBodyClass
                                if (isFirstColumn) return roleTableColumns.firstColumnTintBodyClass
                                return ''
                              }
                              const cellClass = cn(
                                'border-b border-slate-200/60 px-3 py-3.5 align-middle transition-colors dark:border-slate-700/20',
                                isSelected
                                  ? 'bg-primary/10'
                                  : groupTint
                                    ? 'group-hover:brightness-[0.98] dark:group-hover:brightness-110'
                                    : 'group-hover:bg-sky-50/40'
                              )
                              return (
                                <Fragment key={item.id}>
                                  {showGroupHeader ? (
                                    <tr>
                                      <td
                                        colSpan={roleTableColumns.visibleColumnOrder.length + (showRoleTableSelection ? 1 : 0) + 1}
                                        className={cn(
                                          'px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
                                          groupTint?.first
                                        )}
                                      >
                                        {ROLE_TABLE_GROUP_BY_OPTIONS.find((opt) => opt.key === roleTableGroupBy)?.label}: {groupLabel}
                                      </td>
                                    </tr>
                                  ) : null}
                                  <tr
                                    onClick={() => openRoleDetail(item)}
                                    onContextMenu={(event) => {
                                      event.preventDefault()
                                      setRoleRowMenu({ id: item.id, x: event.clientX, y: event.clientY })
                                    }}
                                    className="group cursor-pointer transition-colors"
                                  >
                                    {showRoleTableSelection ? (
                                      <td
                                        className={cn(cellClass, 'w-10', resolveBodyCellBackground(false))}
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          id={`role-table-select-${item.id}`}
                                          name={`role-table-select-${item.id}`}
                                          checked={roleTableSelectedIds.includes(item.id)}
                                          onChange={() => toggleRoleTableRowSelection(item.id)}
                                          aria-label={`Select ${item.name}`}
                                        />
                                      </td>
                                    ) : null}
                                    {roleTableColumns.visibleColumnOrder.map((key) => {
                                      const isFirstCol = roleTableColumns.visibleColumnOrder[0] === key
                                      return (
                                        <td
                                          key={key}
                                          className={cn(cellClass, resolveBodyCellBackground(isFirstCol))}
                                          style={{
                                            ...(roleTableColumns.columnWidthStyle(key) ?? {}),
                                            ...(key === 'name' ? { boxShadow: `inset 3px 0 0 ${roleStatusAccentColor(item.status)}` } : {}),
                                          }}
                                        >
                                          {renderRoleTableCell(item, key)}
                                        </td>
                                      )
                                    })}
                                    <td className={cn(cellClass, 'w-12 text-right')} onClick={(event) => event.stopPropagation()}>
                                      <button
                                        type="button"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 data-[open=true]:opacity-100"
                                        data-open={roleRowMenu?.id === item.id}
                                        aria-label={`Actions for ${item.name}`}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          setRoleRowMenu(
                                            roleRowMenu?.id === item.id ? null : { id: item.id, x: event.clientX, y: event.clientY }
                                          )
                                        }}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </DndContext>

                      <ContextMenu
                        open={roleTableColumns.headerContextMenu !== null}
                        x={roleTableColumns.headerContextMenu?.x ?? 0}
                        y={roleTableColumns.headerContextMenu?.y ?? 0}
                        onClose={() => roleTableColumns.setHeaderContextMenu(null)}
                      >
                        <ContextMenuItem
                          onSelect={() => {
                            const key = roleTableColumns.headerContextMenu?.columnKey
                            if (!key) return
                            roleTableColumns.autoResizeColumn(key)
                            roleTableColumns.setHeaderContextMenu(null)
                          }}
                        >
                          <UnfoldHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Auto Resize Column
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            const key = roleTableColumns.headerContextMenu?.columnKey
                            if (!key) return
                            roleTableColumns.setColumnWidthDialog({ open: true, columnKey: key, valuePx: '' })
                            roleTableColumns.setHeaderContextMenu(null)
                          }}
                        >
                          <Ruler className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Column Width...
                        </ContextMenuItem>
                        {roleTableColumns.hasAnyCustomWidth ? (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => {
                                roleTableColumns.resetAllColumnWidths()
                                roleTableColumns.setHeaderContextMenu(null)
                              }}
                            >
                              <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              Reset Column Width
                            </ContextMenuItem>
                          </>
                        ) : null}
                        {roleTableColumns.headerContextMenu?.columnKey &&
                        roleTableColumns.isThirdColumnOrLater(roleTableColumns.headerContextMenu.columnKey) ? (
                          <>
                            <ContextMenuSeparator />
                            {(() => {
                              const key = roleTableColumns.headerContextMenu.columnKey
                              const columnIndex = roleTableColumns.getColumnIndex(key)
                              const canMoveEarlier = columnIndex > 1
                              const canMoveLater = columnIndex >= 0 && columnIndex < roleTableColumns.columnOrder.length - 1
                              return (
                                <>
                                  {canMoveEarlier ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        roleTableColumns.moveColumnToFirst(key)
                                        roleTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ArrowLeftToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to First Position
                                    </ContextMenuItem>
                                  ) : null}
                                  {canMoveEarlier ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        roleTableColumns.moveColumnLeft(key)
                                        roleTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to Left
                                    </ContextMenuItem>
                                  ) : null}
                                  {canMoveLater ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        roleTableColumns.moveColumnRight(key)
                                        roleTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to Right
                                    </ContextMenuItem>
                                  ) : null}
                                  {canMoveLater ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        roleTableColumns.moveColumnToLast(key)
                                        roleTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ArrowRightToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to Last Position
                                    </ContextMenuItem>
                                  ) : null}
                                </>
                              )
                            })()}
                          </>
                        ) : null}
                        {roleTableColumns.headerContextMenu?.columnKey &&
                        roleTableColumns.isFirstColumn(roleTableColumns.headerContextMenu.columnKey) ? (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => {
                                roleTableColumns.setFreezeFirstColumn((v) => !v)
                                roleTableColumns.setHeaderContextMenu(null)
                              }}
                            >
                              <Pin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              Freeze Column
                              <span className="ml-auto text-xs text-muted-foreground">
                                {roleTableColumns.freezeFirstColumn ? 'On' : 'Off'}
                              </span>
                            </ContextMenuItem>
                          </>
                        ) : null}
                      </ContextMenu>

                      <ContextMenu
                        open={roleRowMenu !== null}
                        x={roleRowMenu?.x ?? 0}
                        y={roleRowMenu?.y ?? 0}
                        onClose={() => setRoleRowMenu(null)}
                      >
                        <ContextMenuItem
                          onSelect={() => {
                            openAddRoleDrawer()
                            setRoleRowMenu(null)
                          }}
                        >
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Add Role
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            const role = roles.find((r) => r.id === roleRowMenu?.id)
                            if (role) openRoleDetail(role)
                            setRoleRowMenu(null)
                          }}
                        >
                          <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Open Role
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            const role = roles.find((r) => r.id === roleRowMenu?.id)
                            if (role) startRenameRole(role)
                            setRoleRowMenu(null)
                          }}
                        >
                          <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Rename
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            openAssignUserModal(roleRowMenu?.id)
                            setRoleRowMenu(null)
                          }}
                        >
                          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Assign Users
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            const role = roles.find((r) => r.id === roleRowMenu?.id)
                            if (role) {
                              setSelectedMatrixRole(role.name)
                              setActivePanel('permissions')
                            }
                            setRoleRowMenu(null)
                          }}
                        >
                          <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          View Permission Matrix
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            setActivePanel('audit')
                            setRoleRowMenu(null)
                          }}
                        >
                          <Activity className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          View Audit History
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            const role = roles.find((r) => r.id === roleRowMenu?.id)
                            if (role) void handleDuplicateRole(role)
                            setRoleRowMenu(null)
                          }}
                        >
                          <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Duplicate Role
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            const role = roles.find((r) => r.id === roleRowMenu?.id)
                            if (role) {
                              downloadCsv(`tectona-role-${role.id}.csv`, [
                                ['Field', 'Value'],
                                ['Role', role.name],
                                ['Description', role.description],
                                ['Scope', role.accessScope],
                                ['Assigned Users', role.assignedUsers],
                                ['Privilege', role.privilege],
                                ['Status', role.status],
                                ['Last Updated', role.lastUpdated],
                              ])
                            }
                            setRoleRowMenu(null)
                          }}
                        >
                          <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Export Role Details
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            const role = roles.find((r) => r.id === roleRowMenu?.id)
                            if (role) void handleToggleRoleStatus(role)
                            setRoleRowMenu(null)
                          }}
                        >
                          <Ban className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                          <span className="text-rose-600">
                            {roles.find((r) => r.id === roleRowMenu?.id)?.status === 'Disabled' ? 'Enable Role' : 'Disable Role'}
                          </span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            const role = roles.find((r) => r.id === roleRowMenu?.id)
                            if (role) setDeleteRoleTarget(role)
                            setRoleRowMenu(null)
                          }}
                        >
                          <Trash2 className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                          <span className="text-rose-600">Delete Role</span>
                        </ContextMenuItem>
                      </ContextMenu>

                      <EnterpriseColumnWidthModal
                        open={roleTableColumns.columnWidthDialog?.open ?? false}
                        onClose={() => roleTableColumns.setColumnWidthDialog(null)}
                        columnLabel={
                          roleTableColumns.columnWidthDialog ? roleTableColumnLabel(roleTableColumns.columnWidthDialog.columnKey) : '—'
                        }
                        valuePx={roleTableColumns.columnWidthDialog?.valuePx ?? ''}
                        onValuePxChange={(value) =>
                          roleTableColumns.setColumnWidthDialog((prev) => (prev ? { ...prev, valuePx: value } : prev))
                        }
                        onApply={(widthPx) => {
                          if (!roleTableColumns.columnWidthDialog) return
                          const key = roleTableColumns.columnWidthDialog.columnKey
                          roleTableColumns.setColumnWidthsWithSnapshot((prev) => {
                            if (widthPx == null) {
                              const next = { ...prev }
                              delete next[key]
                              return next
                            }
                            return { ...prev, [key]: widthPx }
                          }, roleTableRef.current)
                          roleTableColumns.setColumnWidthDialog(null)
                        }}
                        dialogTitleId="role-table-column-width-dialog-title"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                      <ShieldCheck className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.75} />
                      <p className="text-sm font-medium text-slate-500">No roles match the current filters</p>
                      <p className="mt-1 text-xs text-slate-400">Adjust the search or column filters to see roles.</p>
                    </div>
                  )}
                </Panel>
              ) : null}

              {activePanel === 'permissions' ? (
                <Panel
                  id="permissions"
                  title="Permission Matrix"
                  description="Live view of what each role can actually do — sourced from authorization-policy's permission catalog and role↔permission grants."
                  highlight={activePanel === 'permissions'}
                  headerIcon={<KeyRound className="h-5 w-5" />}
                  showDivider={false}
                  outerRef={activeMainPanelRef}
                  style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
                  className={cn('flex min-h-0 w-full flex-col', mainPanelViewportHeightPx != null && 'overflow-hidden')}
                  scrollBody={mainPanelViewportHeightPx != null}
                  right={
                    <div className="flex flex-wrap items-center justify-end gap-2 py-1 text-xs text-muted-foreground">
                      {matrixViewMode === 'role' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedMatrixModules(new Set(matrixTree.map((m) => m.key)))}
                            className="h-9 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted/40 hover:text-foreground"
                          >
                            Expand All
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedMatrixModules(new Set())
                              setExpandedMatrixSections(new Set())
                            }}
                            className="h-9 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted/40 hover:text-foreground"
                          >
                            Collapse All
                          </button>
                        </>
                      ) : null}
                    </div>
                }
                >
                  {!canEditPermissionMatrix ? (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                      Read-only view. {isPersonalWorkspaceContext
                        ? 'Permission grants are owned by this Personal Workspace and can only be changed through workspace-scoped administration.'
                        : isOrganizationAdminContext
                          ? 'Permission grants are owned by this Organization and can be changed by its Organization Admin.'
                        : 'Permission grants can only be changed by a Platform Admin Global.'}
                    </div>
                  ) : null}
                  {matrixViewMode === 'user' ? (
                    !effectiveUserId ? (
                      <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
                        <div>
                          <User className="mx-auto mb-3 h-8 w-8 text-slate-300" strokeWidth={1.75} />
                          <p className="text-sm font-semibold text-slate-600">Select a user to inspect access</p>
                          <p className="mt-1 text-xs text-slate-400">Use the user search in the Search &amp; Filter panel above.</p>
                        </div>
                      </div>
                    ) : effectivePermissionsLoading ? (
                      <LoadingSkeleton rows={6} />
                    ) : (
                      <div className="min-h-0 overflow-auto rounded-xl border border-slate-200/80">
                        {effectivePermissions.length === 0 ? (
                          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                            No permissions are granted to {selectedEffectiveUser?.display_name ?? 'this user'} in the selected scope.
                          </div>
                        ) : null}
                        {effectiveMatrixTree.map((moduleNode) => {
                          const moduleExpanded = expandedMatrixModules.has(moduleNode.key)
                          return (
                            <div key={moduleNode.key} className="border-b border-slate-100 last:border-b-0">
                              <button type="button" onClick={() => toggleMatrixModuleExpanded(moduleNode.key)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50">
                                <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', moduleExpanded && 'rotate-90')} />
                                <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
                                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">{moduleNode.module}</span>
                                <span className="ml-auto text-[10px] text-slate-400">{moduleNode.resourceCount} resources</span>
                              </button>
                              {moduleExpanded ? moduleNode.sections.map((sectionNode) => (
                                <div key={sectionNode.key} className="border-t border-slate-100/80">
                                  <button type="button" onClick={() => toggleMatrixSectionExpanded(sectionNode.key)} className="flex w-full items-center gap-2 py-2 pl-9 pr-4 text-left hover:bg-blue-50/30">
                                    <ChevronRight className={cn('h-3 w-3 text-blue-400 transition-transform', expandedMatrixSections.has(sectionNode.key) && 'rotate-90')} />
                                    <FileText className="h-3 w-3 text-blue-500" />
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">{sectionNode.section}</span>
                                    <span className="ml-auto text-[10px] text-blue-400">{sectionNode.resources.length}</span>
                                  </button>
                                  {expandedMatrixSections.has(sectionNode.key) ? sectionNode.resources.map((resourceNode) => (
                                    <div key={resourceNode.key} className="border-t border-slate-100 px-4 py-3 pl-14">
                                      <div className="mb-2 flex items-center gap-2">
                                        {(() => { const ResourceIcon = resourceTypeIcon(resourceNode.resource_type); return <ResourceIcon className="h-3.5 w-3.5 text-slate-400" /> })()}
                                        <span className="text-xs font-semibold text-slate-800">{resourceNode.resourceLabel}</span>
                                        <span className="font-mono text-[10px] text-slate-400">{resourceNode.resource_type}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {resourceNode.actions.map((action) => (
                                          <UiTooltip key={action.action} content={action.description ?? action.permission_code} size="compact">
                                            <Badge variant="outline" className={badgeClass(action.granted ? 'Allow' : 'Deny')}>{action.action} {action.granted ? '✓' : '—'}</Badge>
                                          </UiTooltip>
                                        ))}
                                      </div>
                                      {resourceNode.actions.some((action) => action.granted) ? (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {Array.from(new Set(resourceNode.actions.flatMap((action) => (action.sourceRoles ?? [])))).map((roleCode) => <span key={roleCode} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Source: {roles.find((role) => role.roleCode === roleCode)?.name ?? roleCode}</span>)}
                                        </div>
                                      ) : null}
                                    </div>
                                  )) : null}
                                </div>
                              )) : null}
                            </div>
                          )
                        })}
                      </div>
                    )
                  ) : null}
                  {matrixViewMode === 'role' ? (
                    permissionMatrixLoading ? (
                      <LoadingSkeleton rows={5} />
                    ) : permissionMatrixError ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                        <KeyRound className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.75} />
                        <p className="text-sm font-medium text-slate-500">Could not load the permission matrix</p>
                        <p className="mt-1 text-xs text-slate-400">The authorization-policy backend is unreachable.</p>
                      </div>
                    ) : (
                      <div className="min-h-0 w-full flex-1 overflow-auto">
                        {matrixTree.map((moduleNode) => {
                          const moduleExpanded = expandedMatrixModules.has(moduleNode.key)
                          return (
                            <div key={moduleNode.key} className="border-b border-slate-100 last:border-b-0">
                              <button
                                type="button"
                                onClick={() => toggleMatrixModuleExpanded(moduleNode.key)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors"
                              >
                                <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', moduleExpanded && 'rotate-90')} />
                                <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">{moduleNode.module}</span>
                                <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums text-slate-400">{moduleNode.resourceCount} resources</span>
                              </button>
                              {moduleExpanded
                                ? moduleNode.sections.map((sectionNode) => {
                                    const sectionExpanded = expandedMatrixSections.has(sectionNode.key)
                                    return (
                                      <div key={sectionNode.key} className="border-t border-slate-100/80">
                                        <button
                                          type="button"
                                          onClick={() => toggleMatrixSectionExpanded(sectionNode.key)}
                                          className="flex w-full items-center gap-2 py-2 pl-9 pr-4 text-left transition-colors"
                                        >
                                          <ChevronRight className={cn('h-3 w-3 shrink-0 text-blue-400 transition-transform', sectionExpanded && 'rotate-90')} />
                                          <FileText className="h-3 w-3 shrink-0 text-blue-500" />
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">{sectionNode.section}</span>
                                          <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums text-blue-400">{sectionNode.resources.length}</span>
                                        </button>
                                        {sectionExpanded
                                          ? sectionNode.resources.map((resourceNode) => {
                                              const ResourceIcon = resourceTypeIcon(resourceNode.resource_type)
                                              const grantedCount = resourceNode.actions.filter((a) => a.granted).length
                                              return (
                                                <div
                                                  key={resourceNode.key}
                                                  className="flex flex-wrap items-start gap-3 border-t border-slate-100 py-3 pl-14 pr-4 transition-colors"
                                                  style={{ boxShadow: `inset 3px 0 0 ${grantedCount > 0 ? '#10b981' : '#94a3b8'}` }}
                                                >
                                                  <div className="flex min-w-[180px] items-start gap-2.5">
                                                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                                      <ResourceIcon className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span className="min-w-0">
                                                      <span className="block truncate font-semibold capitalize text-slate-900">{resourceNode.resourceLabel}</span>
                                                      <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wide text-slate-400">{resourceNode.resource_type}</span>
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-1 flex-wrap items-center gap-1.5 pt-0.5">
                                                    {resourceNode.actions.map((action) => {
                                                      const isSubmitting = matrixCellSubmitting === `${currentMatrixRole.id}:${resourceNode.resource_type}:${action.action}`
                                                      return (
                                                        <UiTooltip key={action.action} content={action.description ?? action.permission_code} size="compact">
                                                          <button
                                                            type="button"
                                                            disabled={isSubmitting || !canEditPermissionMatrix}
                                                            title={canEditPermissionMatrix ? undefined : isPersonalWorkspaceContext
                                                              ? 'Only the Personal Workspace owner can change permission grants'
                                                              : 'Only a Platform Admin Global can change permission grants'}
                                                            onClick={() => void toggleMatrixCell(currentMatrixRole, resourceNode.resource_type, action.action)}
                                                            className={cn(
                                                              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-opacity disabled:opacity-50',
                                                              badgeClass(action.granted ? 'Allow' : 'Deny')
                                                            )}
                                                          >
                                                            {action.action}
                                                            {isSubmitting ? '…' : action.granted ? ' ✓' : ' —'}
                                                          </button>
                                                        </UiTooltip>
                                                      )
                                                    })}
                                                  </div>
                                                </div>
                                              )
                                            })
                                          : null}
                                      </div>
                                    )
                                  })
                                : null}
                            </div>
                          )
                        })}
                        {matrixTree.length === 0 ? <p className="px-4 py-8 text-center text-xs text-muted-foreground">No permissions match the current filters.</p> : null}
                      </div>
                    )
                  ) : (
                    <div className="hidden">
                      <div className="relative rounded-xl border border-border/70 bg-muted/20">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={effectiveUserSearch}
                          onChange={(event) => setEffectiveUserSearch(event.target.value)}
                          placeholder="Search by name or email…"
                          className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>

                      {identityUsersLoading ? (
                        <LoadingSkeleton rows={3} />
                      ) : !effectiveUserId ? (
                        <div className="max-h-80 overflow-y-auto rounded-xl border border-border/70 p-1.5">
                          {filteredEffectiveUsers.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No users found.</p>
                          ) : (
                            filteredEffectiveUsers.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => selectEffectiveUser(user)}
                                className="flex w-full items-center gap-3 rounded-lg border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-blue-50/50"
                              >
                                <span
                                  className={cn(
                                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                                    userAvatarTone(user.display_name)
                                  )}
                                >
                                  {userInitials(user.display_name)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-foreground">{user.display_name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {userAssignmentSummary.get(user.id)?.roles ?? 0} role{(userAssignmentSummary.get(user.id)?.roles ?? 0) === 1 ? '' : 's'}
                                  </span>
                                  <span className="block text-[10px] text-slate-400">View access</span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-[18px] border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-800">
                            <span className="flex items-center gap-2 font-semibold">
                              {(() => {
                                const user = identityUsers.find((u) => u.id === effectiveUserId)
                                return user ? (
                                  <>
                                    <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', userAvatarTone(user.display_name))}>
                                      {userInitials(user.display_name)}
                                    </span>
                                    {user.display_name}
                                  </>
                                ) : null
                              })()}
                            </span>
                            <button
                              type="button"
                              className="text-blue-700 hover:underline"
                              onClick={() => {
                                setEffectiveUserId(null)
                                setEffectivePermissions([])
                              }}
                            >
                              Change user
                            </button>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned roles</span>
                              <span className="text-lg font-semibold text-slate-900">{effectiveUserAssignments.length}</span>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Effective permissions</span>
                              <span className="text-lg font-semibold text-emerald-800">{effectivePermissions.length}</span>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2">
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-600">Evaluation scope</span>
                              <span className="block truncate text-xs font-semibold text-blue-900" title={activeTenant?.displayName ?? undefined}>
                                {activeTenant?.displayName || 'All accessible workspaces'}
                              </span>
                            </div>
                          </div>

                          {effectiveUserAssignments.length > 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Role assignments</div>
                              <div className="flex flex-wrap gap-1.5">
                                {effectiveUserAssignments.map((assignment) => (
                                  <Badge key={assignment.id} variant="outline" className={badgeClass(assignment.role?.privilege ?? 'Standard')}>
                                    {assignment.role?.name ?? assignment.role_name}
                                    <span className="ml-1 opacity-60">· {assignment.scope_type_code}</span>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {effectivePermissionsLoading ? (
                            <LoadingSkeleton rows={4} />
                          ) : (
                            <div className="min-h-0 overflow-auto rounded-xl border border-slate-200/80">
                              {effectivePermissions.length === 0 ? (
                                <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                                  <span className="font-semibold">No effective permissions in this scope.</span>{' '}
                                  The matrix below shows the complete catalog; every action is currently not granted to this user.
                                </div>
                              ) : null}
                              {effectiveMatrixTree.map((moduleNode) => {
                                const moduleExpanded = expandedMatrixModules.has(moduleNode.key)
                                return (
                                  <div key={moduleNode.key} className="border-b border-slate-100 last:border-b-0">
                                    <button type="button" onClick={() => toggleMatrixModuleExpanded(moduleNode.key)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-slate-50">
                                      <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', moduleExpanded && 'rotate-90')} />
                                      <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">{moduleNode.module}</span>
                                      <span className="ml-auto text-[10px] text-slate-400">{moduleNode.resourceCount} resources</span>
                                    </button>
                                    {moduleExpanded ? moduleNode.sections.map((sectionNode) => (
                                      <div key={sectionNode.key} className="border-t border-slate-100/80">
                                        <button type="button" onClick={() => toggleMatrixSectionExpanded(sectionNode.key)} className="flex w-full items-center gap-2 py-2 pl-9 pr-4 text-left hover:bg-blue-50/30">
                                          <ChevronRight className={cn('h-3 w-3 text-blue-400 transition-transform', expandedMatrixSections.has(sectionNode.key) && 'rotate-90')} />
                                          <FileText className="h-3 w-3 text-blue-500" />
                                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">{sectionNode.section}</span>
                                          <span className="ml-auto text-[10px] text-blue-400">{sectionNode.resources.length}</span>
                                        </button>
                                        {expandedMatrixSections.has(sectionNode.key) ? sectionNode.resources.map((resourceNode) => (
                                          <div key={resourceNode.key} className="border-t border-slate-100 px-4 py-3 pl-14">
                                            <div className="mb-2 flex items-center gap-2">
                                              {(() => { const ResourceIcon = resourceTypeIcon(resourceNode.resource_type); return <ResourceIcon className="h-3.5 w-3.5 text-slate-400" /> })()}
                                              <span className="text-xs font-semibold text-slate-800">{resourceNode.resourceLabel}</span>
                                              <span className="font-mono text-[10px] text-slate-400">{resourceNode.resource_type}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {resourceNode.actions.map((action) => (
                                                <UiTooltip key={action.action} content={action.description ?? action.permission_code} size="compact">
                                                  <Badge variant="outline" className={badgeClass(action.granted ? 'Allow' : 'Deny')}>
                                                    {action.action} {action.granted ? '✓' : '—'}
                                                  </Badge>
                                                </UiTooltip>
                                              ))}
                                            </div>
                                            {resourceNode.actions.some((action) => action.granted) ? (
                                              <div className="mt-2 flex flex-wrap gap-1">
                                                {Array.from(new Set(resourceNode.actions.flatMap((action) => (action.sourceRoles ?? [])))).map((roleCode) => {
                                                  const role = roles.find((item) => item.roleCode === roleCode)
                                                  return <span key={roleCode} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Source: {role?.name ?? roleCode}</span>
                                                })}
                                              </div>
                                            ) : null}
                                          </div>
                                        )) : null}
                                      </div>
                                    )) : null}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
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
                  headerIcon={<Target className="h-5 w-5" />}
                  showDivider={false}
                  outerRef={activeMainPanelRef}
                  style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
                  className={cn('flex min-h-0 w-full flex-col', mainPanelViewportHeightPx != null && 'overflow-hidden')}
                  scrollBody={mainPanelViewportHeightPx != null}
                  right={
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400" title="Available in the next scoped access phase">Remove Access</button>
                      <button type="button" disabled className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400" title="Available in the next scoped access phase">Change Scope</button>
                      <button type="button" disabled className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400" title="Available in the next scoped access phase">Review Inheritance</button>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    {scopedAccessLoading ? <LoadingSkeleton rows={5} /> : filteredScopedAccess.map((item) => (
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
                    {!scopedAccessLoading && filteredScopedAccess.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                        <Target className="mx-auto mb-3 h-8 w-8 text-slate-300" strokeWidth={1.75} />
                        <p className="text-sm font-medium text-slate-500">No scoped access found</p>
                        <p className="mt-1 text-xs text-slate-400">No live AuthZ assignment or Workspace membership matches the current filters.</p>
                      </div>
                    ) : null}
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
          </div>
        </div>
      </div>

      <SecurityDrawer
        open={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
        icon={Plus}
        title={editingRole ? 'Edit Role' : 'Add Role'}
        description={
          editingRole
            ? `Update details for "${editingRole.name}" in the authorization-policy registry.`
            : 'Create a new role in the authorization-policy registry.'
        }
        footer={
          <div className="flex w-full items-stretch">
            <Button
              type="button"
              className={cn(enterpriseIndigoGradientActionButtonClass(), 'w-full justify-center gap-2')}
              onClick={() => void handleCreateRole()}
              disabled={addRoleSubmitting || !addRoleForm.displayName.trim()}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              {addRoleSubmitting ? (editingRole ? 'Saving…' : 'Creating…') : editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="add-role-name" className="text-xs text-muted-foreground">
            Display name
          </Label>
          <Input
            id="add-role-name"
            value={addRoleForm.displayName}
            onChange={(event) => setAddRoleForm((prev) => ({ ...prev, displayName: event.target.value }))}
            placeholder="e.g. Compliance Auditor"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-role-description" className="text-xs text-muted-foreground">
            Description
          </Label>
          <Textarea
            id="add-role-description"
            value={addRoleForm.description}
            onChange={(event) => setAddRoleForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="What can this role do?"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Access scope</Label>
            <Select
              value={addRoleForm.accessScope}
              onChange={(event) => setAddRoleForm((prev) => ({ ...prev, accessScope: event.target.value }))}
            >
              <SelectItem value="Organization">Organization</SelectItem>
              <SelectItem value="Personal Workspace">Personal Workspace</SelectItem>
              <SelectItem value="Workspace">Workspace</SelectItem>
              <SelectItem value="Project">Project</SelectItem>
              <SelectItem value="Task">Task</SelectItem>
              <SelectItem value="Integration">Integration</SelectItem>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Privilege</Label>
            <Select
              value={addRoleForm.privilege}
              onChange={(event) =>
                setAddRoleForm((prev) => ({ ...prev, privilege: event.target.value as RoleItem['privilege'] }))
              }
            >
              <SelectItem value="Privileged">Privileged</SelectItem>
              <SelectItem value="Elevated">Elevated</SelectItem>
              <SelectItem value="Standard">Standard</SelectItem>
            </Select>
          </div>
        </div>
        {addRoleForm.privilege !== 'Standard' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Elevated and Privileged custom roles are created in Review status and require governance approval before activation.
          </div>
        ) : null}
      </SecurityDrawer>

      <SecurityDrawer
        open={assignUserOpen}
        onClose={() => setAssignUserOpen(false)}
        icon={UserPlus}
        title="Assign User"
        description={activeTenant?.workspaceId
          ? 'Grant a role to one or more users at the active workspace scope.'
          : 'Grant a role to one or more users at global scope.'}
        footer={
          <div className="flex w-full items-stretch">
            <Button
              type="button"
              className={cn(enterpriseCyanGradientActionButtonClass(), 'w-full justify-center gap-2')}
              onClick={() => void handleCreateAssignment()}
              disabled={assignUserSubmitting || !assignUserRoleId || assignUserPrincipals.size === 0}
            >
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              {assignUserSubmitting
                ? 'Assigning…'
                : assignUserPrincipals.size > 0
                  ? `Assign (${assignUserPrincipals.size})`
                  : 'Assign'}
            </Button>
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="shrink-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={assignUserRoleId} onChange={(event) => setAssignUserRoleId(event.target.value)}>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex shrink-0 items-center justify-between">
              <Label className="text-xs text-muted-foreground">Users</Label>
              {assignUserPrincipals.size > 0 ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setAssignUserPrincipals(new Set())}
                >
                  Clear all
                </button>
              ) : null}
            </div>

            {assignUserPrincipals.size > 0 ? (
              <div className="flex shrink-0 flex-wrap gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-2">
                {Array.from(assignUserPrincipals).map((id) => {
                  const user = identityUsers.find((u) => u.id === id)
                  const label = user ? user.display_name : id
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-2 text-xs font-medium text-foreground shadow-sm"
                    >
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white',
                          userAvatarTone(label)
                        )}
                      >
                        {userInitials(label)}
                      </span>
                      <span className="max-w-[160px] truncate">{label}</span>
                      <button
                        type="button"
                        onClick={() => toggleAssignUserPrincipal(id)}
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Remove ${label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            ) : null}

            {identityUsersLoading ? (
              <p className="text-xs text-slate-500">Loading user directory…</p>
            ) : identityUsers.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70">
                <div className="relative shrink-0 border-b border-border/70 bg-muted/20">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={assignUserSearch}
                    onChange={(event) => setAssignUserSearch(event.target.value)}
                    placeholder="Search by name or email…"
                    className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div
                  className={cn(
                    'min-h-0 flex-1 overflow-y-auto',
                    '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                  )}
                >
                  {filteredAssignUsers.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">No users match "{assignUserSearch}".</p>
                  ) : (
                    filteredAssignUsers.map((user) => {
                      const checked = assignUserPrincipals.has(user.id)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleAssignUserPrincipal(user.id)}
                          className={cn(
                            'flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/40',
                            checked && 'bg-sky-50 hover:bg-sky-50 dark:bg-sky-950/30'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                              userAvatarTone(user.display_name)
                            )}
                          >
                            {userInitials(user.display_name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{user.display_name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                          </span>
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                              checked ? 'border-sky-500 bg-sky-500 text-white' : 'border-border text-transparent'
                            )}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="flex shrink-0 gap-2">
                <Input
                  value={assignUserManualId}
                  onChange={(event) => setAssignUserManualId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addManualAssignUserPrincipal()
                    }
                  }}
                  placeholder="Principal ID (identity-lite user UUID)"
                />
                <Button type="button" variant="outline" onClick={addManualAssignUserPrincipal} disabled={!assignUserManualId.trim()}>
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      </SecurityDrawer>

      <SecurityDrawer
        open={scopedAccessOpen}
        onClose={() => setScopedAccessOpen(false)}
        icon={Target}
        title="Assign Scoped Access"
        description="Assign a role to one principal at a specific authorization scope."
        footer={
          <Button
            type="button"
            className={cn(enterpriseCyanGradientActionButtonClass(), 'w-full justify-center gap-2')}
            onClick={() => void handleCreateScopedAccess()}
            disabled={scopedAccessSubmitting || !scopedAccessPrincipal || !scopedAccessRoleId || (scopedAccessScopeType !== 'global' && !scopedAccessScopeId)}
          >
            <Target className="h-4 w-4" />
            {scopedAccessSubmitting ? 'Assigning…' : 'Assign Scoped Access'}
          </Button>
        }
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">User</Label>
          <Select value={scopedAccessPrincipal} onChange={(event) => setScopedAccessPrincipal(event.target.value)}>
            <SelectItem value="" disabled>Select a user</SelectItem>
            {identityUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name} · {user.email}</SelectItem>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Role</Label>
          <Select value={scopedAccessRoleId} onChange={(event) => setScopedAccessRoleId(event.target.value)}>
            {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name} · {role.accessScope}</SelectItem>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Scope type</Label>
            <Select value={scopedAccessScopeType} onChange={(event) => {
              const value = event.target.value as 'global' | 'workspace' | 'project'
              setScopedAccessScopeType(value)
              if (value === 'global') setScopedAccessScopeId('')
              else if (value === 'workspace' && !scopedAccessScopeId) setScopedAccessScopeId(scopedWorkspaceDirectory[0]?.id ?? '')
            }}>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="workspace">Workspace</SelectItem>
              <SelectItem value="project">Project</SelectItem>
            </Select>
          </div>
          {scopedAccessScopeType === 'workspace' ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Workspace</Label>
              <Select value={scopedAccessScopeId} onChange={(event) => setScopedAccessScopeId(event.target.value)}>
                {scopedWorkspaceDirectory.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}
              </Select>
            </div>
          ) : scopedAccessScopeType === 'project' ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project ID</Label>
              <Input value={scopedAccessScopeId} onChange={(event) => setScopedAccessScopeId(event.target.value)} placeholder="Project UUID" />
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
          Workspace assignments synchronize AuthZ with Workspace Access Control. Project assignments currently update AuthZ only; WAC project membership remains governed by the workspace membership flow.
        </div>
      </SecurityDrawer>

      <SecurityDrawer
        open={roleDetailOpen}
        onClose={() => setRoleDetailOpen(false)}
        icon={ShieldCheck}
        title={detailDrawer.title}
        description={detailDrawer.subtitle}
        showOverlay={false}
        footer={
          <div className="flex w-full items-stretch gap-3">
            <Button
              type="button"
              variant="outline"
              className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
              onClick={() => {
                const role = roles.find((r) => r.id === roleDetailRoleId)
                if (role) openEditRoleDrawer(role)
              }}
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden />
              Edit
            </Button>
            <Button
              type="button"
              className={cn(enterpriseCyanGradientActionButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
              onClick={() => {
                setRoleDetailOpen(false)
                openAssignUserModal(roleDetailRoleId ?? undefined)
              }}
            >
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              Assign User
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {detailDrawer.badges.map((badge) => (
            <Badge
              key={badge}
              variant="outline"
              className={cn(badgeClass(badge), 'rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm')}
            >
              {badge}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {detailDrawer.metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={cn(
                'relative overflow-hidden rounded-2xl border border-white/60 p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]',
                'bg-[linear-gradient(160deg,rgba(255,255,255,0.95),rgba(248,250,252,0.85))]',
                'dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(30,41,59,0.85),rgba(15,23,42,0.7))]'
              )}
            >
              <div
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-85',
                  index % 2 === 0 ? 'from-sky-300 via-blue-400 to-indigo-400' : 'from-emerald-300 via-teal-400 to-cyan-400'
                )}
              />
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
              <p className="mt-1.5 text-base font-bold tracking-tight text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-blue-50/60 p-4 shadow-[0_10px_28px_rgba(14,165,233,0.10)] dark:border-sky-900/40 dark:from-sky-950/30 dark:via-background dark:to-blue-950/20">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
              <BadgeCheck className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-900 dark:text-sky-200">Executive Summary</p>
              <p className="mt-1 text-xs leading-5 text-sky-900/85 dark:text-sky-100/80">{detailDrawer.summary}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Assigned users</Label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const role = roles.find((r) => r.id === roleDetailRoleId)
              const entries = role ? assignedAssignmentsForRole(role) : []
              if (entries.length === 0) {
                return <span className="text-xs text-muted-foreground">No active assignments in this scope.</span>
              }
              return entries.map((entry) => (
                <span
                  key={entry.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-gradient-to-br from-background to-muted/40 py-1 pl-1 pr-1.5 text-xs font-medium text-foreground shadow-sm"
                >
                  <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white', userAvatarTone(entry.name))}>
                    {userInitials(entry.name)}
                  </span>
                  {entry.name}
                  <button
                    type="button"
                    disabled={removingAssignmentId === entry.id}
                    onClick={() => void handleRemoveAssignment(entry.id, entry.name)}
                    aria-label={`Remove ${entry.name} from this role`}
                    className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))
            })()}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Permissions</Label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detailDrawer.permissions.map((permission) => (
              <span
                key={permission}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-1 text-xs font-medium text-violet-800 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:to-fuchsia-950/20 dark:text-violet-200"
              >
                <KeyRound className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                {permission}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Related policies</Label>
          </div>
          <div className="space-y-2">
            {detailDrawer.relatedPolicies.map((policy) => (
              <div
                key={policy}
                className="group flex items-center gap-2.5 rounded-xl border border-border/70 bg-gradient-to-r from-background to-muted/20 px-3.5 py-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-sky-200 hover:from-sky-50/50"
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-600 dark:bg-slate-800 dark:text-slate-400">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                </span>
                {policy}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Audit history</Label>
          </div>
          <div className="relative space-y-4 pl-4">
            <div className="absolute bottom-1 left-[7px] top-1 w-px bg-gradient-to-b from-sky-300 via-border to-transparent" aria-hidden />
            {detailDrawer.auditHistory.map((entry) => (
              <div key={`${entry.label}-${entry.detail}`} className="relative">
                <span className="absolute -left-4 top-0.5 h-3 w-3 rounded-full border-2 border-background bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.15)]" aria-hidden />
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-400">{entry.label}</div>
                <div className="mt-0.5 text-xs leading-5 text-foreground">{entry.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {detailDrawer.complianceNotes.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Compliance notes</Label>
            </div>
            <div className="space-y-2">
              {detailDrawer.complianceNotes.map((note) => (
                <div
                  key={note}
                  className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/60 px-3.5 py-2.5 text-xs leading-5 text-amber-900 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/20 dark:text-amber-200"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                  {note}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </SecurityDrawer>

      {deleteRoleTarget && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
              <button
                type="button"
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                aria-label="Close delete confirmation"
                disabled={deleteRoleSubmitting}
                onClick={() => {
                  if (!deleteRoleSubmitting) setDeleteRoleTarget(null)
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="role-delete-dialog-title"
                className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
              >
                <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/12 text-red-700 ring-1 ring-red-500/25">
                      <Trash2 className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="space-y-1">
                      <h3 id="role-delete-dialog-title" className="text-base font-semibold tracking-tight text-foreground">
                        Delete Role
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        This action permanently removes the role and cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 px-6 py-5">
                  <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Role</p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">{deleteRoleTarget.name}</p>
                  </div>
                  {deleteRoleTarget.assignedUsers > 0 ? (
                    <p className="text-xs text-amber-600">
                      {deleteRoleTarget.assignedUsers} user{deleteRoleTarget.assignedUsers === 1 ? '' : 's'} currently
                      assigned to this role will lose the permissions it grants.
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    This will permanently delete the role from the authorization-policy registry.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                    disabled={deleteRoleSubmitting}
                    onClick={() => setDeleteRoleTarget(null)}
                  >
                    <X className="h-4 w-4 shrink-0" aria-hidden />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-w-0 basis-0 flex-1 justify-center gap-2 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                    disabled={deleteRoleSubmitting}
                    onClick={() => void handleDeleteRole()}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                    {deleteRoleSubmitting ? 'Deleting…' : 'Delete role'}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

type PermissionMatrixRow = AuthzPermissionDto & {
  module: string
  section: string
  resourceLabel: string
}

function permissionMatrixHierarchy(permission: AuthzPermissionDto): PermissionMatrixRow {
  const moduleByResource: Record<string, string> = {
    workspace: 'Workspace Management',
    organization: 'Workspace Management',
    governance: 'Governance & Compliance',
    security_matrix: 'Security & Access Control',
    project: 'Project Management',
    idea_backlog: 'Idea Backlog',
    knowledge_base: 'Knowledge Base',
    portfolio: 'Portfolio Governance',
  }
  const sectionByResource: Record<string, string> = {
    workspace: 'Workspace Directory',
    organization: 'Workspace Directory',
    governance: 'Policy & Governance',
    security_matrix: 'Permission Matrix',
    project: 'Project Delivery',
    idea_backlog: 'Demand & Intake',
    knowledge_base: 'Knowledge Base',
    portfolio: 'Portfolio Planning',
  }
  return {
    ...permission,
    module: permission.ui_module || moduleByResource[permission.resource_type] || 'Other Platform Services',
    section: permission.ui_section || sectionByResource[permission.resource_type] || 'General Access',
    resourceLabel: permission.resource_type.replace(/_/g, ' '),
  }
}
