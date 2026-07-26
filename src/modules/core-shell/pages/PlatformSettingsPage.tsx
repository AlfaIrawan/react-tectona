import { startTransition, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FolderTree,
  GitBranch,
  History,
  LayoutTemplate,
  Layers3,
  Save,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

type FilterState = {
  category: string
  organization: string
  team: string
  status: string
  scope: string
  environment: string
  updated: string
  owner: string
}

type DetailRecord = {
  title: string
  kind: string
  scope: string
  owner: string
  version: string
  status: string
  summary: string
  dependencies: string[]
  history: { label: string; detail: string; time: string }[]
  notes: string[]
  warnings: string[]
  metadata: { label: string; value: string }[]
}

type FilterableRecord = {
  category: string
  organization?: string
  team?: string
  status: string
  scope: string
  environment?: string
  updated: string
  owner: string
}

type OrganizationRecord = FilterableRecord & {
  id: string
  name: string
  departments: number
  workspaces: number
  users: number
  lastUpdatedLabel: string
  hierarchy: string[]
}

type UserRecord = FilterableRecord & {
  id: string
  name: string
  role: string
  access: string
  lastActive: string
}

type TeamRecord = FilterableRecord & {
  id: string
  name: string
  lead: string
  members: number
  projects: number
}

type FieldRecord = FilterableRecord & {
  id: string
  name: string
  fieldType: string
  requirement: string
  defaultValue: string
  validation: string
}

type WorkflowRecord = FilterableRecord & {
  id: string
  name: string
  states: string
  approval: string
  automation: string
  lastUpdatedLabel: string
}

type TemplateRecord = FilterableRecord & {
  id: string
  name: string
  templateType: string
  usageCount: string
  versionLabel: string
  lastUpdatedLabel: string
}

type PreferenceRecord = FilterableRecord & {
  id: string
  name: string
  values: string[]
  mode: string
}

type PolicyRecord = FilterableRecord & {
  id: string
  name: string
  description: string
  defaultValue: string
  reviewImpact: string
}

type EnvironmentRecord = FilterableRecord & {
  id: string
  name: string
  versionLabel: string
  configurationStatus: string
  lastDeployment: string
  maintenanceMode: string
  syncStatus: string
}

type AuditRecord = FilterableRecord & {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  result: string
}

type CatalogRecord = FilterableRecord & {
  id: string
  name: string
  description: string
  configurationCount: string
  lastChanged: string
  related: string[]
}

const adminSummary = [
  { label: 'Total Organizations', value: '12', detail: '+2 subsidiaries onboarded this quarter' },
  { label: 'Active Users', value: '1,284', detail: '96 privileged administrators in managed scope' },
  { label: 'Active Teams', value: '86', detail: '22 delivery and governance pods cross-linked' },
  { label: 'Custom Fields', value: '148', detail: '31 inherited defaults and 117 scoped overrides' },
  { label: 'Workflow Templates', value: '57', detail: '14 published this month across PMO programs' },
  { label: 'System Configurations', value: '312', detail: '14 policy changes awaiting controlled rollout' },
] as const

const platformHealthSignals = [
  { label: 'Configuration health', value: 'Healthy', note: '2 warning-level drifts require follow-up' },
  { label: 'Change success', value: '99.1%', note: 'Last 30 days of configuration deployments' },
  { label: 'Audit readiness', value: '94%', note: '3 evidence packs missing approver sign-off' },
  { label: 'Sync posture', value: 'Synchronized', note: 'All production environments aligned < 4 mins' },
] as const

const configurationDistribution = [
  { name: 'Organization', count: 34, ratio: 84, owner: 'Platform Operations' },
  { name: 'Users & Teams', count: 172, ratio: 92, owner: 'Access Governance' },
  { name: 'Fields', count: 148, ratio: 76, owner: 'Delivery Standards' },
  { name: 'Workflows', count: 57, ratio: 68, owner: 'Automation Office' },
  { name: 'Templates', count: 96, ratio: 73, owner: 'PMO Enablement' },
  { name: 'Preferences', count: 84, ratio: 61, owner: 'Platform Operations' },
  { name: 'Policies', count: 46, ratio: 57, owner: 'Governance Council' },
  { name: 'Environment', count: 18, ratio: 49, owner: 'SRE Delivery' },
] as const

const organizations: OrganizationRecord[] = [
  {
    id: 'org-adira-core',
    name: 'Adira PMO Core',
    category: 'Organization',
    organization: 'Adira PMO Core',
    status: 'Active',
    scope: 'Tenant',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Nadia Kusuma',
    departments: 8,
    workspaces: 14,
    users: 128,
    lastUpdatedLabel: 'Today, 09:14',
    hierarchy: ['Adira Group', 'PMO Office', 'Strategic Delivery Hub'],
  },
  {
    id: 'org-risk-office',
    name: 'Risk Transformation Office',
    category: 'Organization',
    organization: 'Risk Transformation Office',
    status: 'Review',
    scope: 'Business Unit',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Dario Gomez',
    departments: 5,
    workspaces: 9,
    users: 74,
    lastUpdatedLabel: '16 Apr 2026',
    hierarchy: ['Adira Group', 'Risk Office', 'Regulatory Programs'],
  },
  {
    id: 'org-finance-platform',
    name: 'Finance Platform Office',
    category: 'Organization',
    organization: 'Finance Platform Office',
    status: 'Active',
    scope: 'Business Unit',
    environment: 'Staging',
    updated: 'Last 7 days',
    owner: 'Maya Henderson',
    departments: 6,
    workspaces: 11,
    users: 82,
    lastUpdatedLabel: '15 Apr 2026',
    hierarchy: ['Adira Group', 'Finance Technology', 'Delivery Factory'],
  },
  {
    id: 'org-digital-partners',
    name: 'Digital Partner Programs',
    category: 'Organization',
    organization: 'Digital Partner Programs',
    status: 'Archived',
    scope: 'Partner Tenant',
    environment: 'Sandbox',
    updated: 'Last 30 days',
    owner: 'Elena Park',
    departments: 3,
    workspaces: 4,
    users: 36,
    lastUpdatedLabel: '28 Mar 2026',
    hierarchy: ['Partner Network', 'Joint Delivery', 'External Programs'],
  },
] 

const users: UserRecord[] = [
  {
    id: 'user-nadia',
    name: 'Nadia Kusuma',
    category: 'Users & Teams',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Active',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Access Governance',
    role: 'Platform Administrator',
    access: '12 workspaces / 46 projects',
    lastActive: '4 min ago',
  },
  {
    id: 'user-aiko',
    name: 'Aiko Fernandez',
    category: 'Users & Teams',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Active',
    scope: 'Portfolio',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Access Governance',
    role: 'Program Governance Lead',
    access: '8 workspaces / 19 projects',
    lastActive: '19 min ago',
  },
  {
    id: 'user-dario',
    name: 'Dario Gomez',
    category: 'Users & Teams',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Review',
    scope: 'Organization',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Access Governance',
    role: 'Tenant Administrator',
    access: '6 workspaces / 12 projects',
    lastActive: 'Yesterday',
  },
  {
    id: 'user-elena',
    name: 'Elena Park',
    category: 'Users & Teams',
    organization: 'Digital Partner Programs',
    team: 'Partner Delivery Desk',
    status: 'Inactive',
    scope: 'Partner',
    environment: 'Sandbox',
    updated: 'Last 30 days',
    owner: 'Access Governance',
    role: 'Partner Workspace Admin',
    access: '2 workspaces / 6 projects',
    lastActive: '12 days ago',
  },
]

const teams: TeamRecord[] = [
  {
    id: 'team-platform-ops',
    name: 'Platform Operations',
    category: 'Users & Teams',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Active',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Nadia Kusuma',
    lead: 'Nadia Kusuma',
    members: 18,
    projects: 22,
  },
  {
    id: 'team-delivery-excellence',
    name: 'Delivery Excellence',
    category: 'Users & Teams',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Active',
    scope: 'Portfolio',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Aiko Fernandez',
    lead: 'Aiko Fernandez',
    members: 24,
    projects: 17,
  },
  {
    id: 'team-workflow-control',
    name: 'Workflow Control',
    category: 'Users & Teams',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Review',
    scope: 'Organization',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Dario Gomez',
    lead: 'Dario Gomez',
    members: 12,
    projects: 10,
  },
  {
    id: 'team-partner-desk',
    name: 'Partner Delivery Desk',
    category: 'Users & Teams',
    organization: 'Digital Partner Programs',
    team: 'Partner Delivery Desk',
    status: 'Inactive',
    scope: 'Partner',
    environment: 'Sandbox',
    updated: 'Last 30 days',
    owner: 'Elena Park',
    lead: 'Elena Park',
    members: 9,
    projects: 5,
  },
] 

const fields: FieldRecord[] = [
  {
    id: 'field-delivery-tier',
    name: 'Delivery Tier',
    category: 'Fields',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Active',
    scope: 'Project / Workspace',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Delivery Standards',
    fieldType: 'Dropdown',
    requirement: 'Required',
    defaultValue: 'Tier 2',
    validation: 'Enumerated delivery criticality levels',
  },
  {
    id: 'field-gate-owner',
    name: 'Gate Owner',
    category: 'Fields',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Active',
    scope: 'Workflow / Approval',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Delivery Standards',
    fieldType: 'User reference',
    requirement: 'Required',
    defaultValue: 'PMO approver pool',
    validation: 'Must map to active approver role',
  },
  {
    id: 'field-regulatory-impact',
    name: 'Regulatory Impact',
    category: 'Fields',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Draft',
    scope: 'Idea / Project',
    environment: 'Staging',
    updated: 'Last 7 days',
    owner: 'Risk Controls',
    fieldType: 'Multi-select',
    requirement: 'Optional',
    defaultValue: 'Unclassified',
    validation: 'Mapped to risk taxonomy',
  },
  {
    id: 'field-freeze-window',
    name: 'Freeze Window',
    category: 'Fields',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Disabled',
    scope: 'Environment',
    environment: 'Sandbox',
    updated: 'Last 30 days',
    owner: 'Platform Operations',
    fieldType: 'Date',
    requirement: 'Optional',
    defaultValue: 'None',
    validation: 'Cannot overlap maintenance calendar',
  },
] 

const workflows: WorkflowRecord[] = [
  {
    id: 'workflow-enterprise-stage-gate',
    name: 'Enterprise Stage Gate',
    category: 'Workflows',
    organization: 'Adira PMO Core',
    team: 'Workflow Control',
    status: 'Published',
    scope: 'Portfolio',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Automation Office',
    states: 'Intake, Assess, Approve, Execute, Close',
    approval: 'Required',
    automation: 'Enabled',
    lastUpdatedLabel: 'Today, 08:20',
  },
  {
    id: 'workflow-regulatory-change',
    name: 'Regulatory Change Review',
    category: 'Workflows',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Published',
    scope: 'Organization',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Automation Office',
    states: 'Draft, Review, Committee, Approved',
    approval: 'Dual approval',
    automation: 'Enabled',
    lastUpdatedLabel: '16 Apr 2026',
  },
  {
    id: 'workflow-partner-rollout',
    name: 'Partner Rollout Control',
    category: 'Workflows',
    organization: 'Digital Partner Programs',
    team: 'Partner Delivery Desk',
    status: 'Draft',
    scope: 'Partner',
    environment: 'Sandbox',
    updated: 'Last 30 days',
    owner: 'Automation Office',
    states: 'Plan, Validate, Pilot, Launch',
    approval: 'Conditional',
    automation: 'Partial',
    lastUpdatedLabel: '29 Mar 2026',
  },
] 

const templates: TemplateRecord[] = [
  {
    id: 'template-enterprise-project',
    name: 'Enterprise Delivery Blueprint',
    category: 'Templates',
    organization: 'Adira PMO Core',
    team: 'Delivery Excellence',
    status: 'Published',
    scope: 'Project template',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'PMO Enablement',
    templateType: 'Project template',
    usageCount: '214 launches',
    versionLabel: 'v5.2',
    lastUpdatedLabel: 'Today, 07:35',
  },
  {
    id: 'template-brd',
    name: 'Regulated BRD Pack',
    category: 'Templates',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Published',
    scope: 'BRD template',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'PMO Enablement',
    templateType: 'BRD template',
    usageCount: '81 launches',
    versionLabel: 'v3.1',
    lastUpdatedLabel: '15 Apr 2026',
  },
  {
    id: 'template-meeting-note',
    name: 'Executive Steering Notes',
    category: 'Templates',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Draft',
    scope: 'Meeting note template',
    environment: 'Staging',
    updated: 'Last 7 days',
    owner: 'PMO Enablement',
    templateType: 'Meeting note template',
    usageCount: '12 pilots',
    versionLabel: 'v1.4',
    lastUpdatedLabel: '14 Apr 2026',
  },
  {
    id: 'template-approval',
    name: 'Change Approval Packet',
    category: 'Templates',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Archived',
    scope: 'Approval template',
    environment: 'Sandbox',
    updated: 'Last 30 days',
    owner: 'PMO Enablement',
    templateType: 'Approval template',
    usageCount: 'Legacy',
    versionLabel: 'v2.0',
    lastUpdatedLabel: '01 Apr 2026',
  },
] 

const preferences: PreferenceRecord[] = [
  {
    id: 'pref-general',
    name: 'General Preferences',
    category: 'Preferences',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Default',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Platform Operations',
    values: ['Tenant time zone: Asia/Jakarta', 'Date format: DD MMM YYYY', 'Business week starts Monday'],
    mode: 'Platform default',
  },
  {
    id: 'pref-notification',
    name: 'Notification Defaults',
    category: 'Preferences',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Custom',
    scope: 'Workspace',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Platform Operations',
    values: ['Daily digest for steering updates', 'Critical workflow failures trigger instant alert'],
    mode: 'Scoped override',
  },
  {
    id: 'pref-branding',
    name: 'Branding & Theme',
    category: 'Preferences',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Custom',
    scope: 'Organization',
    environment: 'Staging',
    updated: 'Last 7 days',
    owner: 'Platform Operations',
    values: ['Navy control accent', 'Executive dashboard opens in portfolio mode'],
    mode: 'Regional theme pack',
  },
] 

const policies: PolicyRecord[] = [
  {
    id: 'policy-naming',
    name: 'Default Naming Convention',
    category: 'Policies',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Default',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Governance Council',
    description: 'Program and project code standards with organization prefixes and fiscal sequence rules.',
    defaultValue: 'ORG-PROGRAM-YYYY-NNN',
    reviewImpact: 'Low operational impact; medium downstream reporting impact',
  },
  {
    id: 'policy-priority',
    name: 'Priority Schema',
    category: 'Policies',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Custom',
    scope: 'Portfolio',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Governance Council',
    description: 'Priority model aligned to regulatory risk posture, customer impact, and delivery complexity.',
    defaultValue: 'Critical / High / Managed / Monitor',
    reviewImpact: 'High impact to execution routing and reporting baselines',
  },
  {
    id: 'policy-sla',
    name: 'SLA Defaults',
    category: 'Policies',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Review',
    scope: 'Organization',
    environment: 'Staging',
    updated: 'Last 7 days',
    owner: 'Governance Council',
    description: 'Baseline review, approval, and escalation timers for executive reporting and task governance.',
    defaultValue: '24h / 48h / 72h escalation ladder',
    reviewImpact: 'Medium impact to workflow timers and audit evidence',
  },
] 

const environments: EnvironmentRecord[] = [
  {
    id: 'env-production',
    name: 'Production',
    category: 'Environment',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Healthy',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'SRE Delivery',
    versionLabel: 'v2026.04.17',
    configurationStatus: 'Aligned',
    lastDeployment: 'Today, 06:40',
    maintenanceMode: 'Off',
    syncStatus: 'Synchronized',
  },
  {
    id: 'env-staging',
    name: 'Staging',
    category: 'Environment',
    organization: 'Finance Platform Office',
    team: 'Platform Operations',
    status: 'Watch',
    scope: 'Global',
    environment: 'Staging',
    updated: 'Last 24 hours',
    owner: 'SRE Delivery',
    versionLabel: 'v2026.04.18-rc1',
    configurationStatus: 'Pending publish',
    lastDeployment: 'Today, 10:05',
    maintenanceMode: 'Scheduled',
    syncStatus: 'Lagging',
  },
  {
    id: 'env-sandbox',
    name: 'Sandbox',
    category: 'Environment',
    organization: 'Digital Partner Programs',
    team: 'Partner Delivery Desk',
    status: 'Review',
    scope: 'Partner',
    environment: 'Sandbox',
    updated: 'Last 7 days',
    owner: 'SRE Delivery',
    versionLabel: 'v2026.04.10',
    configurationStatus: 'Drift detected',
    lastDeployment: '11 Apr 2026',
    maintenanceMode: 'On',
    syncStatus: 'Paused',
  },
] 

const audits: AuditRecord[] = [
  {
    id: 'audit-1',
    category: 'Audit',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Success',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Audit Office',
    timestamp: 'Today, 09:14',
    actor: 'Nadia Kusuma',
    action: 'Organization created',
    target: 'Finance Platform Office / Delivery Factory',
    result: 'Committed',
  },
  {
    id: 'audit-2',
    category: 'Audit',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Success',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Audit Office',
    timestamp: 'Today, 08:52',
    actor: 'Automation Office',
    action: 'Workflow published',
    target: 'Enterprise Stage Gate',
    result: 'Published to Production',
  },
  {
    id: 'audit-3',
    category: 'Audit',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Warning',
    scope: 'Portfolio',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Audit Office',
    timestamp: 'Yesterday, 16:30',
    actor: 'Dario Gomez',
    action: 'User role updated',
    target: 'Partner Workspace Admin',
    result: 'Awaiting reviewer acknowledgement',
  },
  {
    id: 'audit-4',
    category: 'Audit',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Success',
    scope: 'Organization',
    environment: 'Staging',
    updated: 'Last 7 days',
    owner: 'Audit Office',
    timestamp: 'Yesterday, 13:15',
    actor: 'PMO Enablement',
    action: 'Template changed',
    target: 'Executive Steering Notes',
    result: 'Draft version created',
  },
  {
    id: 'audit-5',
    category: 'Audit',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Success',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Audit Office',
    timestamp: 'Yesterday, 10:11',
    actor: 'Platform Operations',
    action: 'Preference updated',
    target: 'Notification Defaults',
    result: 'Applied scoped override',
  },
  {
    id: 'audit-6',
    category: 'Audit',
    organization: 'Digital Partner Programs',
    team: 'Partner Delivery Desk',
    status: 'Error',
    scope: 'Partner',
    environment: 'Sandbox',
    updated: 'Last 30 days',
    owner: 'Audit Office',
    timestamp: '29 Mar 2026',
    actor: 'SRE Delivery',
    action: 'Configuration sync failed',
    target: 'Sandbox environment',
    result: 'Manual review required',
  },
] 

const catalog: CatalogRecord[] = [
  {
    id: 'catalog-organization',
    name: 'Organization',
    category: 'Organization',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Active',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Platform Operations',
    description: 'Tenant hierarchy, business unit structures, and workspace placement controls.',
    configurationCount: '34 configurations',
    lastChanged: 'Today, 09:14',
    related: ['Users & Teams', 'Policies'],
  },
  {
    id: 'catalog-users-teams',
    name: 'Users & Teams',
    category: 'Users & Teams',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Active',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Access Governance',
    description: 'Administrator roles, team assignments, workspace access, and delegation guardrails.',
    configurationCount: '172 configurations',
    lastChanged: 'Today, 08:44',
    related: ['Organization', 'Environment'],
  },
  {
    id: 'catalog-fields',
    name: 'Fields',
    category: 'Fields',
    organization: 'Adira PMO Core',
    team: 'Delivery Excellence',
    status: 'Active',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Delivery Standards',
    description: 'Reusable fields, validation rules, inheritance controls, and scope assignments.',
    configurationCount: '148 configurations',
    lastChanged: 'Today, 08:05',
    related: ['Templates', 'Workflows'],
  },
  {
    id: 'catalog-workflows',
    name: 'Workflows',
    category: 'Workflows',
    organization: 'Risk Transformation Office',
    team: 'Workflow Control',
    status: 'Active',
    scope: 'Portfolio',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'Automation Office',
    description: 'Default flow orchestration, state models, automation policies, and publish controls.',
    configurationCount: '57 configurations',
    lastChanged: '16 Apr 2026',
    related: ['Fields', 'Policies'],
  },
  {
    id: 'catalog-templates',
    name: 'Templates',
    category: 'Templates',
    organization: 'Finance Platform Office',
    team: 'Delivery Excellence',
    status: 'Active',
    scope: 'Organization',
    environment: 'Production',
    updated: 'Last 7 days',
    owner: 'PMO Enablement',
    description: 'Reusable launch patterns, document kits, meeting packs, and approval starters.',
    configurationCount: '96 configurations',
    lastChanged: '15 Apr 2026',
    related: ['Fields', 'Preferences'],
  },
  {
    id: 'catalog-preferences',
    name: 'Preferences',
    category: 'Preferences',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Active',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'Platform Operations',
    description: 'General defaults, localization, notifications, branding, and dashboard behaviors.',
    configurationCount: '84 configurations',
    lastChanged: 'Today, 07:50',
    related: ['Policies', 'Environment'],
  },
  {
    id: 'catalog-environment',
    name: 'Environment',
    category: 'Environment',
    organization: 'Adira PMO Core',
    team: 'Platform Operations',
    status: 'Active',
    scope: 'Global',
    environment: 'Production',
    updated: 'Last 24 hours',
    owner: 'SRE Delivery',
    description: 'Operational configuration, runtime versions, sync posture, and maintenance controls.',
    configurationCount: '18 configurations',
    lastChanged: 'Today, 06:40',
    related: ['Users & Teams', 'Preferences'],
  },
]

const defaultFilters: FilterState = {
  category: 'All categories',
  organization: 'All organizations',
  team: 'All teams',
  status: 'All statuses',
  scope: 'All scopes',
  environment: 'All environments',
  updated: 'Any time',
  owner: 'All owners',
}

function matchesSearch(query: string, values: Array<string | number | undefined>) {
  if (!query) {
    return true
  }

  return values.some((value) => String(value ?? '').toLowerCase().includes(query))
}

function matchesFilters(filters: FilterState, record: FilterableRecord) {
  const categoryMatch = filters.category === 'All categories' || filters.category === record.category
  const organizationMatch = filters.organization === 'All organizations' || filters.organization === record.organization
  const teamMatch = filters.team === 'All teams' || filters.team === record.team
  const statusMatch = filters.status === 'All statuses' || filters.status === record.status
  const scopeMatch = filters.scope === 'All scopes' || filters.scope === record.scope
  const environmentMatch = filters.environment === 'All environments' || filters.environment === record.environment
  const updatedMatch = filters.updated === 'Any time' || filters.updated === record.updated
  const ownerMatch = filters.owner === 'All owners' || filters.owner === record.owner

  return categoryMatch && organizationMatch && teamMatch && statusMatch && scopeMatch && environmentMatch && updatedMatch && ownerMatch
}

function statusTone(label: string) {
  const toneMap: Record<string, string> = {
    Active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Default: 'border-sky-200 bg-sky-50 text-sky-700',
    Synchronized: 'border-sky-200 bg-sky-50 text-sky-700',
    Required: 'border-sky-200 bg-sky-50 text-sky-700',
    Custom: 'border-violet-200 bg-violet-50 text-violet-700',
    Review: 'border-amber-200 bg-amber-50 text-amber-700',
    Watch: 'border-amber-200 bg-amber-50 text-amber-700',
    Warning: 'border-amber-200 bg-amber-50 text-amber-700',
    Optional: 'border-slate-200 bg-slate-100 text-slate-700',
    Draft: 'border-slate-200 bg-slate-100 text-slate-700',
    Inactive: 'border-slate-200 bg-slate-100 text-slate-600',
    Archived: 'border-slate-200 bg-slate-100 text-slate-600',
    Disabled: 'border-slate-200 bg-slate-100 text-slate-600',
    Off: 'border-slate-200 bg-slate-100 text-slate-600',
    Scheduled: 'border-amber-200 bg-amber-50 text-amber-700',
    On: 'border-rose-200 bg-rose-50 text-rose-700',
    Error: 'border-rose-200 bg-rose-50 text-rose-700',
    Paused: 'border-rose-200 bg-rose-50 text-rose-700',
    Lagging: 'border-amber-200 bg-amber-50 text-amber-700',
  }

  return toneMap[label] ?? 'border-slate-200 bg-slate-100 text-slate-700'
}

function buildOrganizationDetail(record: OrganizationRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Organization configuration',
    scope: record.scope,
    owner: record.owner,
    version: 'Structure v2.8',
    status: record.status,
    summary: 'Tenant hierarchy, workspace placement, and business-unit governance controls for enterprise-scale delivery administration.',
    dependencies: ['Users & Teams', 'Policies', 'Environment'],
    history: [
      { label: 'Structure updated', detail: `${record.departments} departments aligned to workspace map`, time: record.lastUpdatedLabel },
      { label: 'Workspace review', detail: `${record.workspaces} workspaces validated for tenancy rules`, time: 'Yesterday, 17:20' },
      { label: 'Access propagation', detail: `${record.users} user memberships reconciled`, time: '15 Apr 2026' },
    ],
    notes: ['Hierarchy rules are inherited by template provisioning and scoped workflow defaults.'],
    warnings: record.status === 'Review' ? ['Pending reviewer acknowledgement on organization-level override package.'] : [],
    metadata: [
      { label: 'Business units', value: String(record.departments) },
      { label: 'Active workspaces', value: String(record.workspaces) },
      { label: 'Users', value: String(record.users) },
      { label: 'Hierarchy', value: record.hierarchy.join(' -> ') },
    ],
  }
}

function buildUserDetail(record: UserRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'User administration',
    scope: record.scope,
    owner: record.owner,
    version: 'Access v4.2',
    status: record.status,
    summary: 'Role assignment, workspace access summary, and governed team membership for privileged operations.',
    dependencies: ['Organization', 'Users & Teams', 'Environment'],
    history: [
      { label: 'Last active', detail: record.lastActive, time: 'Realtime' },
      { label: 'Role reviewed', detail: `${record.role} approved by access governance`, time: '16 Apr 2026' },
      { label: 'Access refreshed', detail: record.access, time: '14 Apr 2026' },
    ],
    notes: ['Use inline actions to update role, assign teams, or deactivate access without leaving the dashboard.'],
    warnings: record.status !== 'Active' ? ['User requires revalidation before next privileged change.'] : [],
    metadata: [
      { label: 'Role', value: record.role },
      { label: 'Team', value: record.team ?? '-' },
      { label: 'Access', value: record.access },
      { label: 'Organization', value: record.organization ?? '-' },
    ],
  }
}

function buildTeamDetail(record: TeamRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Team administration',
    scope: record.scope,
    owner: record.owner,
    version: 'Team v3.1',
    status: record.status,
    summary: 'Lead ownership, team composition, and assigned project footprint used for administration and delivery governance.',
    dependencies: ['Organization', 'Users & Teams', 'Workflows'],
    history: [
      { label: 'Lead assigned', detail: record.lead, time: record.updated },
      { label: 'Member sync', detail: `${record.members} members aligned to source groups`, time: '15 Apr 2026' },
      { label: 'Project linkage', detail: `${record.projects} assigned projects`, time: '12 Apr 2026' },
    ],
    notes: ['Team assignments determine default workflow reviewers and dashboard visibility scopes.'],
    warnings: record.status === 'Inactive' ? ['Team is inactive; assignments remain in read-only mode until reactivated.'] : [],
    metadata: [
      { label: 'Lead', value: record.lead },
      { label: 'Members', value: String(record.members) },
      { label: 'Assigned projects', value: String(record.projects) },
      { label: 'Organization', value: record.organization ?? '-' },
    ],
  }
}

function buildFieldDetail(record: FieldRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Custom field configuration',
    scope: record.scope,
    owner: record.owner,
    version: 'Field v2.0',
    status: record.status,
    summary: 'Reusable field definition used across projects, ideas, tasks, approvals, and delivery workflow surfaces.',
    dependencies: ['Fields', 'Templates', 'Policies'],
    history: [
      { label: 'Validation updated', detail: record.validation, time: record.updated },
      { label: 'Default changed', detail: `Default value: ${record.defaultValue}`, time: '16 Apr 2026' },
      { label: 'Scope reviewed', detail: record.scope, time: '14 Apr 2026' },
    ],
    notes: ['Field inheritance follows platform default rules unless a workspace-specific override exists.'],
    warnings: record.status === 'Draft' ? ['Draft fields are visible to administrators only until published.'] : [],
    metadata: [
      { label: 'Field type', value: record.fieldType },
      { label: 'Requirement', value: record.requirement },
      { label: 'Default', value: record.defaultValue },
      { label: 'Validation', value: record.validation },
    ],
  }
}

function buildWorkflowDetail(record: WorkflowRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Workflow configuration',
    scope: record.scope,
    owner: record.owner,
    version: 'Flow v5.0',
    status: record.status,
    summary: 'Reusable workflow path controlling states, approvals, and automation defaults for program and project execution.',
    dependencies: ['Workflows', 'Fields', 'Environment'],
    history: [
      { label: 'Published', detail: record.lastUpdatedLabel, time: record.lastUpdatedLabel },
      { label: 'Automation posture', detail: record.automation, time: '16 Apr 2026' },
      { label: 'Approval mode', detail: record.approval, time: '15 Apr 2026' },
    ],
    notes: ['Set Default changes are impact-reviewed before rollout to production workspaces.'],
    warnings: record.status === 'Draft' ? ['This workflow is not yet the default path for any production workspace.'] : [],
    metadata: [
      { label: 'States', value: record.states },
      { label: 'Approval', value: record.approval },
      { label: 'Automation', value: record.automation },
      { label: 'Environment', value: record.environment ?? '-' },
    ],
  }
}

function buildTemplateDetail(record: TemplateRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Template management',
    scope: record.scope,
    owner: record.owner,
    version: record.versionLabel,
    status: record.status,
    summary: 'Reusable execution asset packaged for projects, workspaces, BRDs, meetings, and controlled approvals.',
    dependencies: ['Templates', 'Fields', 'Preferences'],
    history: [
      { label: 'Version updated', detail: record.versionLabel, time: record.lastUpdatedLabel },
      { label: 'Usage footprint', detail: record.usageCount, time: 'Usage rolling 30d' },
      { label: 'Owner confirmation', detail: record.owner, time: '14 Apr 2026' },
    ],
    notes: ['Template versions are published independently from workflow and field releases.'],
    warnings: record.status === 'Draft' ? ['Draft template cannot be selected as a default provisioning asset.'] : [],
    metadata: [
      { label: 'Template type', value: record.templateType },
      { label: 'Usage', value: record.usageCount },
      { label: 'Version', value: record.versionLabel },
      { label: 'Last updated', value: record.lastUpdatedLabel },
    ],
  }
}

function buildPreferenceDetail(record: PreferenceRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'System preference',
    scope: record.scope,
    owner: record.owner,
    version: 'Preference pack v3.4',
    status: record.status,
    summary: 'Platform-wide default behavior for localization, notifications, branding, and dashboard entry experience.',
    dependencies: ['Preferences', 'Policies', 'Environment'],
    history: [
      { label: 'Preference mode', detail: record.mode, time: record.updated },
      { label: 'Last changed', detail: record.values[0], time: '16 Apr 2026' },
      { label: 'Approval', detail: 'Approved by platform governance council', time: '14 Apr 2026' },
    ],
    notes: ['Preferences can be restored to platform defaults when scoped overrides are no longer required.'],
    warnings: record.status === 'Custom' ? ['Custom preference pack may override executive reporting defaults.'] : [],
    metadata: record.values.map((value, index) => ({ label: `Preference ${index + 1}`, value })),
  }
}

function buildPolicyDetail(record: PolicyRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Configuration policy',
    scope: record.scope,
    owner: record.owner,
    version: 'Policy v2.6',
    status: record.status,
    summary: 'Platform governance defaults controlling naming rules, statuses, priority schema, SLA baselines, and inheritance behaviors.',
    dependencies: ['Policies', 'Fields', 'Workflows'],
    history: [
      { label: 'Policy baseline', detail: record.defaultValue, time: record.updated },
      { label: 'Impact review', detail: record.reviewImpact, time: '16 Apr 2026' },
      { label: 'Governance sync', detail: 'Aligned with portfolio governance control pack', time: '13 Apr 2026' },
    ],
    notes: [record.description],
    warnings: record.status === 'Review' ? ['Policy requires controlled rollout approval before becoming the new default.'] : [],
    metadata: [
      { label: 'Default value', value: record.defaultValue },
      { label: 'Impact review', value: record.reviewImpact },
      { label: 'Scope', value: record.scope },
      { label: 'Organization', value: record.organization ?? '-' },
    ],
  }
}

function buildEnvironmentDetail(record: EnvironmentRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Environment control',
    scope: record.scope,
    owner: record.owner,
    version: record.versionLabel,
    status: record.status,
    summary: 'Runtime configuration posture, deployment visibility, sync status, and maintenance governance for enterprise operations.',
    dependencies: ['Environment', 'Preferences', 'Users & Teams'],
    history: [
      { label: 'Deployment', detail: record.lastDeployment, time: record.lastDeployment },
      { label: 'Sync status', detail: record.syncStatus, time: 'Realtime' },
      { label: 'Configuration state', detail: record.configurationStatus, time: '15 Apr 2026' },
    ],
    notes: ['Environment configuration is exported as part of controlled administration snapshots.'],
    warnings: record.syncStatus !== 'Synchronized' ? ['Environment is not fully aligned with the approved configuration baseline.'] : [],
    metadata: [
      { label: 'Version', value: record.versionLabel },
      { label: 'Configuration status', value: record.configurationStatus },
      { label: 'Maintenance', value: record.maintenanceMode },
      { label: 'Sync', value: record.syncStatus },
    ],
  }
}

function buildAuditDetail(record: AuditRecord): DetailRecord {
  return {
    title: record.action,
    kind: 'Administrative activity',
    scope: record.scope,
    owner: record.owner,
    version: 'Audit trace',
    status: record.status,
    summary: 'Administrative action captured for audit review, operational follow-up, and exportable evidence packaging.',
    dependencies: ['Audit', 'Policies', 'Environment'],
    history: [
      { label: 'Event recorded', detail: record.timestamp, time: record.timestamp },
      { label: 'Actor', detail: record.actor, time: record.timestamp },
      { label: 'Outcome', detail: record.result, time: record.timestamp },
    ],
    notes: ['Audit feed remains exportable with filters applied to category, owner, organization, and result state.'],
    warnings: record.status === 'Error' ? ['Open operational incident linked to this audit event.'] : [],
    metadata: [
      { label: 'Target object', value: record.target },
      { label: 'Result', value: record.result },
      { label: 'Environment', value: record.environment ?? '-' },
      { label: 'Actor', value: record.actor },
    ],
  }
}

function buildCatalogDetail(record: CatalogRecord): DetailRecord {
  return {
    title: record.name,
    kind: 'Settings catalog category',
    scope: record.scope,
    owner: record.owner,
    version: 'Catalog view',
    status: record.status,
    summary: 'Directory entry used to group related administrative settings, controls, and dependent configuration surfaces.',
    dependencies: record.related,
    history: [
      { label: 'Category updated', detail: record.lastChanged, time: record.lastChanged },
      { label: 'Configuration count', detail: record.configurationCount, time: 'Snapshot' },
      { label: 'Owner', detail: record.owner, time: 'Governance assignment' },
    ],
    notes: [record.description],
    warnings: [],
    metadata: [
      { label: 'Configurations', value: record.configurationCount },
      { label: 'Last changed', value: record.lastChanged },
      { label: 'Environment', value: record.environment ?? '-' },
      { label: 'Related settings', value: record.related.join(', ') },
    ],
  }
}

function SectionShell({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden rounded-[26px] border-slate-200/80 bg-white/95 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
      <CardHeader className="border-b border-slate-100/90 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-5 text-slate-500">{description}</CardDescription>
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4">{children}</CardContent>
    </Card>
  )
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (nextValue: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-slate-300"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function StatusBadge({ label }: { label: string }) {
  return <Badge variant="outline" className={cn('rounded-full text-[11px] font-medium', statusTone(label))}>{label}</Badge>
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/80 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-600">{detail}</div>
    </div>
  )
}

function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`skeleton-${index}`} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="h-3 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

export function PlatformSettingsPage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const [loadingState, setLoadingState] = useState({ overview: true, fields: true, audit: true })
  const [selectedDetail, setSelectedDetail] = useState<DetailRecord>(() => buildCatalogDetail(catalog[0]))
  const [pinnedCatalog, setPinnedCatalog] = useState<string[]>(['catalog-users-teams', 'catalog-preferences'])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoadingState({ overview: false, fields: false, audit: false })
    }, 850)

    return () => window.clearTimeout(timer)
  }, [])

  const refreshSnapshot = () => {
    setLoadingState({ overview: true, fields: true, audit: true })
    window.setTimeout(() => {
      setLoadingState({ overview: false, fields: false, audit: false })
    }, 700)
  }

  const organizationOptions = useMemo(
    () => ['All organizations', ...organizations.map((record) => record.name)],
    []
  )
  const teamOptions = useMemo(
    () => ['All teams', ...teams.map((record) => record.name)],
    []
  )
  const ownerOptions = useMemo(
    () => ['All owners', ...Array.from(new Set([
      ...organizations.map((record) => record.owner),
      ...users.map((record) => record.owner),
      ...fields.map((record) => record.owner),
      ...workflows.map((record) => record.owner),
      ...templates.map((record) => record.owner),
      ...preferences.map((record) => record.owner),
      ...policies.map((record) => record.owner),
      ...environments.map((record) => record.owner),
    ]))],
    []
  )

  const updateFilter = (key: keyof FilterState, value: string) => {
    startTransition(() => {
      setFilters((currentFilters) => ({ ...currentFilters, [key]: value }))
    })
  }

  const openDetail = (detail: DetailRecord) => {
    startTransition(() => {
      setSelectedDetail(detail)
    })
  }

  const togglePin = (catalogId: string) => {
    startTransition(() => {
      setPinnedCatalog((currentPins) =>
        currentPins.includes(catalogId)
          ? currentPins.filter((value) => value !== catalogId)
          : [...currentPins, catalogId]
      )
    })
  }

  const filteredOrganizations = useMemo(
    () =>
      organizations.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.owner, record.scope, record.status])
      ),
    [deferredQuery, filters]
  )

  const filteredUsers = useMemo(
    () =>
      users.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.role, record.team, record.access])
      ),
    [deferredQuery, filters]
  )

  const filteredTeams = useMemo(
    () =>
      teams.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.lead, record.organization, record.projects])
      ),
    [deferredQuery, filters]
  )

  const filteredFields = useMemo(
    () =>
      fields.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.fieldType, record.validation, record.requirement])
      ),
    [deferredQuery, filters]
  )

  const filteredWorkflows = useMemo(
    () =>
      workflows.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.states, record.approval, record.automation])
      ),
    [deferredQuery, filters]
  )

  const filteredTemplates = useMemo(
    () =>
      templates.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.templateType, record.owner, record.versionLabel])
      ),
    [deferredQuery, filters]
  )

  const filteredPreferences = useMemo(
    () =>
      preferences.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.mode, ...record.values])
      ),
    [deferredQuery, filters]
  )

  const filteredPolicies = useMemo(
    () =>
      policies.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.defaultValue, record.reviewImpact, record.description])
      ),
    [deferredQuery, filters]
  )

  const filteredEnvironments = useMemo(
    () =>
      environments.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.versionLabel, record.configurationStatus, record.syncStatus])
      ),
    [deferredQuery, filters]
  )

  const filteredAudits = useMemo(
    () =>
      audits.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.actor, record.action, record.target, record.result])
      ),
    [deferredQuery, filters]
  )

  const filteredCatalog = useMemo(
    () =>
      catalog.filter((record) =>
        matchesFilters(filters, record) &&
        matchesSearch(deferredQuery, [record.name, record.description, record.owner, record.configurationCount])
      ),
    [deferredQuery, filters]
  )

  const openCategory = (categoryName: string) => {
    const matchingCatalog = catalog.find((record) => record.name === categoryName)
    if (!matchingCatalog) {
      return
    }

    startTransition(() => {
      setFilters((currentFilters) => ({ ...currentFilters, category: categoryName }))
      setSelectedDetail(buildCatalogDetail(matchingCatalog))
    })
  }

  const activeFilterChips = [
    filters.category !== 'All categories' ? filters.category : null,
    filters.organization !== 'All organizations' ? filters.organization : null,
    filters.team !== 'All teams' ? filters.team : null,
    filters.status !== 'All statuses' ? filters.status : null,
    filters.scope !== 'All scopes' ? filters.scope : null,
    filters.environment !== 'All environments' ? filters.environment : null,
    filters.updated !== 'Any time' ? filters.updated : null,
    filters.owner !== 'All owners' ? filters.owner : null,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6 pb-10">
      <Breadcrumb items={[{ label: 'Platform Settings & Administration' }]} />

      <PageHeader
        title="Platform Settings & Administration"
        description="Configure organization structure, users, teams, workflows, templates, fields, and platform-wide settings"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button className="h-10 rounded-xl px-4 text-sm font-semibold">
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-sm font-medium">
              <Upload className="mr-2 h-4 w-4" />
              Import Settings
            </Button>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-sm font-medium">
              <Download className="mr-2 h-4 w-4" />
              Export Configuration
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4 text-sm font-medium"
              onClick={() => openDetail(buildPreferenceDetail(preferences[0]))}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              System Preferences
            </Button>
          </div>
        }
      />

      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_rgba(255,255,255,0.98)_38%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))] p-5 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.55)]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">Enterprise admin control center</span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">Multi-tenant governance</span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">Audit-ready visibility</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search setting name, user, team, workflow, template, or configuration item"
                className="h-12 rounded-2xl border-slate-200 bg-white/95 pl-11 text-sm shadow-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilterChips.length === 0 ? (
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  No filters applied
                </Badge>
              ) : (
                activeFilterChips.map((label) => (
                  <Badge key={label} variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                    {label}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect value={filters.category} options={['All categories', ...configurationDistribution.map((item) => item.name)]} onChange={(value) => updateFilter('category', value)} />
            <FilterSelect value={filters.organization} options={organizationOptions} onChange={(value) => updateFilter('organization', value)} />
            <FilterSelect value={filters.team} options={teamOptions} onChange={(value) => updateFilter('team', value)} />
            <FilterSelect value={filters.status} options={['All statuses', 'Active', 'Healthy', 'Published', 'Default', 'Custom', 'Review', 'Draft', 'Inactive', 'Archived']} onChange={(value) => updateFilter('status', value)} />
            <FilterSelect value={filters.scope} options={['All scopes', 'Global', 'Tenant', 'Business Unit', 'Organization', 'Portfolio', 'Project / Workspace', 'Workflow / Approval', 'Partner', 'Environment']} onChange={(value) => updateFilter('scope', value)} />
            <FilterSelect value={filters.environment} options={['All environments', 'Production', 'Staging', 'Sandbox']} onChange={(value) => updateFilter('environment', value)} />
            <FilterSelect value={filters.updated} options={['Any time', 'Last 24 hours', 'Last 7 days', 'Last 30 days']} onChange={(value) => updateFilter('updated', value)} />
            <FilterSelect value={filters.owner} options={ownerOptions} onChange={(value) => updateFilter('owner', value)} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <div className="space-y-6">
          <SectionShell
            title="Administration Overview"
            description="Operational summary across organizational administration, reusable configuration assets, governance defaults, and runtime control posture."
            action={
              <Button variant="outline" className="h-9 rounded-xl border-slate-200 px-3 text-xs font-medium" onClick={refreshSnapshot}>
                <Activity className="mr-2 h-4 w-4" />
                Refresh admin snapshot
              </Button>
            }
          >
            {loadingState.overview ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <SkeletonRows rows={4} />
                <SkeletonRows rows={3} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {adminSummary.map((item) => (
                    <MetricCard key={item.label} label={item.label} value={item.value} detail={item.detail} />
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                  <div className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-5 text-white shadow-[0_28px_60px_-44px_rgba(15,23,42,0.95)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Compact platform health</div>
                        <h2 className="mt-2 text-xl font-semibold tracking-tight">Administration posture is stable, controlled, and audit-ready.</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                          Centralized policy defaults, synchronized environments, and access reviews remain within governance thresholds while scoped exceptions are tracked in-line.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-white/15 bg-white/10 text-white">
                        Healthy
                      </Badge>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {platformHealthSignals.map((signal) => (
                        <div key={signal.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            {signal.label}
                          </div>
                          <div className="mt-3 text-lg font-semibold text-white">{signal.value}</div>
                          <div className="mt-2 text-xs leading-5 text-slate-300">{signal.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Configuration distribution</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">Drill from overview into category-level control surfaces.</div>
                      </div>
                      <Button variant="ghost" className="h-8 rounded-xl px-2 text-xs text-slate-600" onClick={() => updateFilter('category', 'All categories')}>
                        Clear grouping
                      </Button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {configurationDistribution.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50"
                          onClick={() => openCategory(item.name)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                              <div className="mt-1 text-xs text-slate-500">Owner: {item.owner}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900">{item.count}</div>
                              <div className="text-[11px] text-slate-500">configurations</div>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-200">
                            <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${item.ratio}%` }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SectionShell>

          <div className="grid gap-6 2xl:grid-cols-2">
            <SectionShell
              title="Organization Management"
              description="Tenant-level structure, workspace placement, and organization hierarchy controls."
              action={
                <>
                  <Button className="h-9 rounded-xl px-3 text-xs font-semibold"><Building2 className="mr-2 h-4 w-4" />Create Organization</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><FolderTree className="mr-2 h-4 w-4" />Manage Structure</Button>
                </>
              }
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_0.7fr_0.7fr_0.65fr_0.8fr_0.85fr_auto] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <div>Organization</div>
                    <div>Departments</div>
                    <div>Workspaces</div>
                    <div>Users</div>
                    <div>Status</div>
                    <div>Last updated</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {filteredOrganizations.map((record) => (
                      <button
                        key={record.id}
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1.4fr)_0.7fr_0.7fr_0.65fr_0.8fr_0.85fr_auto] gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => openDetail(buildOrganizationDetail(record))}
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{record.scope}</div>
                        </div>
                        <div className="text-sm text-slate-700">{record.departments}</div>
                        <div className="text-sm text-slate-700">{record.workspaces}</div>
                        <div className="text-sm text-slate-700">{record.users}</div>
                        <div><StatusBadge label={record.status} /></div>
                        <div className="text-sm text-slate-600">{record.lastUpdatedLabel}</div>
                        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                          <span>Edit</span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FolderTree className="h-4 w-4 text-sky-600" />
                    Organization hierarchy
                  </div>
                  {filteredOrganizations.slice(0, 3).map((record) => (
                    <button
                      key={`${record.id}-tree`}
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm"
                      onClick={() => openDetail(buildOrganizationDetail(record))}
                    >
                      <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                      <div className="mt-3 space-y-2 text-xs text-slate-600">
                        {record.hierarchy.map((node, index) => (
                          <div key={`${record.id}-${node}`} className="flex items-center gap-2" style={{ paddingLeft: `${index * 12}px` }}>
                            <span className="h-2 w-2 rounded-full bg-sky-500" />
                            {node}
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </SectionShell>

            <SectionShell
              title="User & Team Management"
              description="Role assignments, team ownership, workspace access, and inline administration actions."
              action={
                <>
                  <Button className="h-9 rounded-xl px-3 text-xs font-semibold"><UserPlus className="mr-2 h-4 w-4" />Add User</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><Users className="mr-2 h-4 w-4" />Create Team</Button>
                </>
              }
            >
              <div className="space-y-4">
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1.2fr)_0.95fr_0.8fr_0.75fr_1fr_0.8fr_auto] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <div>Name</div>
                    <div>Role</div>
                    <div>Team</div>
                    <div>Status</div>
                    <div>Access</div>
                    <div>Last active</div>
                    <div className="text-right">Quick actions</div>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {filteredUsers.map((record) => (
                      <button
                        key={record.id}
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1.2fr)_0.95fr_0.8fr_0.75fr_1fr_0.8fr_auto] gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => openDetail(buildUserDetail(record))}
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{record.organization}</div>
                        </div>
                        <div className="text-sm text-slate-700">{record.role}</div>
                        <div className="text-sm text-slate-700">{record.team}</div>
                        <div><StatusBadge label={record.status} /></div>
                        <div className="text-sm text-slate-600">{record.access}</div>
                        <div className="text-sm text-slate-600">{record.lastActive}</div>
                        <div className="flex items-center justify-end gap-2 text-xs text-slate-600">
                          <span>Update Role</span>
                          <span>Assign Team</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredTeams.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                      onClick={() => openDetail(buildTeamDetail(record))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                          <div className="mt-1 text-xs text-slate-500">Lead: {record.lead}</div>
                        </div>
                        <StatusBadge label={record.status} />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Members</div>
                          <div className="mt-2 font-semibold text-slate-900">{record.members}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Assigned projects</div>
                          <div className="mt-2 font-semibold text-slate-900">{record.projects}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </SectionShell>

            <SectionShell
              title="Custom Fields Configuration"
              description="Reusable field definitions, validation rules, inheritance controls, and scope assignment governance."
              action={
                <>
                  <Button className="h-9 rounded-xl px-3 text-xs font-semibold"><Boxes className="mr-2 h-4 w-4" />Create Field</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><Layers3 className="mr-2 h-4 w-4" />Apply Scope</Button>
                </>
              }
            >
              {loadingState.fields ? (
                <SkeletonRows rows={4} />
              ) : (
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1.1fr)_0.8fr_0.9fr_0.75fr_0.8fr_1fr_0.7fr_auto] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <div>Field name</div>
                    <div>Field type</div>
                    <div>Scope</div>
                    <div>Required</div>
                    <div>Default</div>
                    <div>Validation</div>
                    <div>Status</div>
                    <div className="text-right">Quick actions</div>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {filteredFields.map((record) => (
                      <button
                        key={record.id}
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1.1fr)_0.8fr_0.9fr_0.75fr_0.8fr_1fr_0.7fr_auto] gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => openDetail(buildFieldDetail(record))}
                      >
                        <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                        <div className="text-sm text-slate-700">{record.fieldType}</div>
                        <div className="text-sm text-slate-700">{record.scope}</div>
                        <div><StatusBadge label={record.requirement} /></div>
                        <div className="text-sm text-slate-600">{record.defaultValue}</div>
                        <div className="text-sm text-slate-600">{record.validation}</div>
                        <div><StatusBadge label={record.status} /></div>
                        <div className="flex items-center justify-end gap-2 text-xs text-slate-600">
                          <span>Edit</span>
                          <span>Disable</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </SectionShell>

            <SectionShell
              title="Workflow Configuration"
              description="Default and reusable flow definitions with publish controls, approval posture, and automation visibility."
              action={
                <>
                  <Button className="h-9 rounded-xl px-3 text-xs font-semibold"><Workflow className="mr-2 h-4 w-4" />Create Workflow</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><GitBranch className="mr-2 h-4 w-4" />Publish Configuration</Button>
                </>
              }
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredWorkflows.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                    onClick={() => openDetail(buildWorkflowDetail(record))}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{record.scope}</div>
                      </div>
                      <StatusBadge label={record.status} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">States</div>
                        <div className="mt-2 text-sm text-slate-700">{record.states}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Automation</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{record.automation}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>Approval: {record.approval}</span>
                      <span>Set Default</span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionShell>

            <SectionShell
              title="Template Management"
              description="Reusable templates across project launch, task delivery, BRDs, meetings, and approval workflows."
              action={
                <>
                  <Button className="h-9 rounded-xl px-3 text-xs font-semibold"><LayoutTemplate className="mr-2 h-4 w-4" />Preview Template</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><Sparkles className="mr-2 h-4 w-4" />Publish</Button>
                </>
              }
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredTemplates.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                    onClick={() => openDetail(buildTemplateDetail(record))}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{record.templateType}</div>
                      </div>
                      <StatusBadge label={record.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Owner</div>
                        <div className="mt-2 font-semibold text-slate-900">{record.owner}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Usage</div>
                        <div className="mt-2 font-semibold text-slate-900">{record.usageCount}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>{record.versionLabel}</span>
                      <span>{record.lastUpdatedLabel}</span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionShell>

            <SectionShell
              title="System Settings & Preferences"
              description="Grouped preference packs for general defaults, localization, notifications, branding, and dashboard behavior."
              action={
                <>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><Settings2 className="mr-2 h-4 w-4" />Edit Preference</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium">Restore Default</Button>
                </>
              }
            >
              <div className="grid gap-3 lg:grid-cols-3">
                {filteredPreferences.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                    onClick={() => openDetail(buildPreferenceDetail(record))}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{record.mode}</div>
                      </div>
                      <StatusBadge label={record.status} />
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      {record.values.map((value) => (
                        <div key={`${record.id}-${value}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5">
                          {value}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-xs text-slate-500">Save Preference</div>
                  </button>
                ))}
              </div>
            </SectionShell>

            <SectionShell
              title="Configuration Policy & Defaults"
              description="Platform-wide governance defaults for naming, statuses, priority, SLA, approvals, and inheritance controls."
              action={
                <>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><ShieldCheck className="mr-2 h-4 w-4" />Edit Policy</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium">Apply Standard</Button>
                </>
              }
            >
              <div className="grid gap-3 lg:grid-cols-3">
                {filteredPolicies.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                    onClick={() => openDetail(buildPolicyDetail(record))}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{record.description}</div>
                      </div>
                      <StatusBadge label={record.status} />
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Default</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{record.defaultValue}</div>
                    </div>
                    <div className="mt-4 text-xs text-slate-500">Review Impact: {record.reviewImpact}</div>
                  </button>
                ))}
              </div>
            </SectionShell>

            <SectionShell
              title="Environment & System Control"
              description="Runtime configuration visibility, deployment cadence, maintenance posture, and synchronization control."
              action={
                <>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><Server className="mr-2 h-4 w-4" />Update Configuration</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium">Enable Maintenance</Button>
                </>
              }
            >
              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="grid grid-cols-[minmax(0,1fr)_0.8fr_0.9fr_0.9fr_0.8fr_0.8fr_auto] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <div>Environment</div>
                  <div>Version</div>
                  <div>Config status</div>
                  <div>Last deployment</div>
                  <div>Maintenance</div>
                  <div>Sync</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-slate-200 bg-white">
                  {filteredEnvironments.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="grid w-full grid-cols-[minmax(0,1fr)_0.8fr_0.9fr_0.9fr_0.8fr_0.8fr_auto] gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      onClick={() => openDetail(buildEnvironmentDetail(record))}
                    >
                      <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                      <div className="text-sm text-slate-700">{record.versionLabel}</div>
                      <div className="text-sm text-slate-700">{record.configurationStatus}</div>
                      <div className="text-sm text-slate-600">{record.lastDeployment}</div>
                      <div><StatusBadge label={record.maintenanceMode} /></div>
                      <div><StatusBadge label={record.syncStatus} /></div>
                      <div className="flex items-center justify-end gap-2 text-xs text-slate-600">
                        <span>Review Health</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </SectionShell>

            <SectionShell
              title="Administrative Activity & Audit"
              description="Recent administrative activity with audit-friendly timestamps, actors, targets, and outcomes."
              action={
                <>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><History className="mr-2 h-4 w-4" />Filter Activity</Button>
                  <Button variant="outline" className="h-9 rounded-xl px-3 text-xs font-medium"><Download className="mr-2 h-4 w-4" />Export Audit Log</Button>
                </>
              }
            >
              {loadingState.audit ? (
                <SkeletonRows rows={5} />
              ) : (
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="grid grid-cols-[0.85fr_0.8fr_1fr_1.1fr_0.8fr_auto] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <div>Timestamp</div>
                    <div>Actor</div>
                    <div>Action</div>
                    <div>Target</div>
                    <div>Result</div>
                    <div className="text-right">Open</div>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {filteredAudits.map((record) => (
                      <button
                        key={record.id}
                        type="button"
                        className="grid w-full grid-cols-[0.85fr_0.8fr_1fr_1.1fr_0.8fr_auto] gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => openDetail(buildAuditDetail(record))}
                      >
                        <div className="text-sm text-slate-700">{record.timestamp}</div>
                        <div className="text-sm font-medium text-slate-900">{record.actor}</div>
                        <div className="text-sm text-slate-700">{record.action}</div>
                        <div className="text-sm text-slate-600">{record.target}</div>
                        <div><StatusBadge label={record.status} /></div>
                        <div className="flex items-center justify-end gap-2 text-xs text-slate-600">
                          <span>Open Detail</span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </SectionShell>

            <SectionShell
              title="Settings Catalog / Navigation"
              description="Directory of administrative modules for grouped navigation, favorites, and related-setting drill-down."
              action={
                <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {pinnedCatalog.length} pinned favorites
                </Badge>
              }
            >
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {filteredCatalog.map((record) => {
                  const isPinned = pinnedCatalog.includes(record.id)
                  return (
                    <div key={record.id} className="rounded-[22px] border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                      <button type="button" className="w-full text-left" onClick={() => openDetail(buildCatalogDetail(record))}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">{record.description}</div>
                          </div>
                          <StatusBadge label={record.status} />
                        </div>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                          {record.configurationCount}
                        </div>
                        <div className="mt-3 text-xs text-slate-500">Last changed: {record.lastChanged}</div>
                      </button>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => openCategory(record.name)}>
                          Open Category
                        </Button>
                        <Button variant="ghost" className="h-8 rounded-xl px-2 text-xs text-slate-600" onClick={() => togglePin(record.id)}>
                          <Star className={cn('mr-2 h-4 w-4', isPinned && 'fill-amber-300 text-amber-500')} />
                          {isPinned ? 'Pinned' : 'Pin Favorite'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionShell>
          </div>
        </div>

        <aside className="h-fit xl:sticky xl:top-20">
          <Card className="overflow-hidden rounded-[28px] border-slate-200/80 bg-white/95 shadow-[0_28px_60px_-42px_rgba(15,23,42,0.45)]">
            <CardHeader className="border-b border-slate-100/90 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    <Layers3 className="h-4 w-4 text-sky-600" />
                    Configuration Detail Drawer
                  </div>
                  <CardTitle className="mt-2 text-base font-semibold text-slate-950">{selectedDetail.title}</CardTitle>
                  <CardDescription className="mt-2 text-xs leading-5 text-slate-500">{selectedDetail.summary}</CardDescription>
                </div>
                <StatusBadge label={selectedDetail.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Kind</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedDetail.kind}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Version</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedDetail.version}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Scope</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedDetail.scope}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Owner / Admin</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{selectedDetail.owner}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {['Edit', 'Duplicate', 'Publish', 'Disable', 'Export Detail'].map((label) => (
                  <Button key={label} variant={label === 'Edit' ? 'default' : 'outline'} className="h-9 rounded-xl px-3 text-xs font-medium">
                    {label}
                  </Button>
                ))}
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <ArrowUpRight className="h-4 w-4 text-sky-600" />
                  Configuration information
                </div>
                <div className="mt-3 space-y-2">
                  {selectedDetail.metadata.map((item) => (
                    <div key={`${selectedDetail.title}-${item.label}`} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                      <div className="text-slate-500">{item.label}</div>
                      <div className="max-w-[180px] text-right font-medium text-slate-900">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <GitBranch className="h-4 w-4 text-sky-600" />
                  Related dependencies
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedDetail.dependencies.map((dependency) => (
                    <Badge key={`${selectedDetail.title}-${dependency}`} variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                      {dependency}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <History className="h-4 w-4 text-sky-600" />
                  Change history
                </div>
                <div className="mt-3 space-y-3">
                  {selectedDetail.history.map((item) => (
                    <div key={`${selectedDetail.title}-${item.label}-${item.time}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</div>
                        </div>
                        <div className="text-[11px] text-slate-500">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <BellRing className="h-4 w-4 text-sky-600" />
                    Notes
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {selectedDetail.notes.map((note) => (
                      <div key={`${selectedDetail.title}-${note}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 leading-6">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    Notes / warnings
                  </div>
                  {selectedDetail.warnings.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-white px-3 py-3 text-sm text-amber-700">
                      No active warnings on this configuration item.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2 text-sm text-amber-700">
                      {selectedDetail.warnings.map((warning) => (
                        <div key={`${selectedDetail.title}-${warning}`} className="rounded-2xl border border-amber-200 bg-white px-3 py-3 leading-6">
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Clock3 className="h-4 w-4 text-sky-600" />
                  Inline admin quick actions supported
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Role update', 'Team assignment', 'Field status', 'Workflow default', 'Template publish state', 'Preference update'].map((label) => (
                    <Badge key={label} variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}