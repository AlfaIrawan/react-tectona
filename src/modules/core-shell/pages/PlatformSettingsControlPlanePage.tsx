import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Boxes,
  Building2,
  Cable,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  ExternalLink,
  Flag,
  FolderTree,
  Info,
  Lock,
  Save,
  ScrollText,
  Settings2,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { KnowledgeBaseSettingsPanel } from '@/modules/core-shell/components/KnowledgeBaseSettingsPanel'

type SettingsSectionId =
  | 'general'
  | 'access'
  | 'integrations'
  | 'metadata'
  | 'notifications'
  | 'audit'
  | 'features'
  | 'workspace'
  | 'knowledge-base'

const ALL_SETTINGS_SECTION_IDS: SettingsSectionId[] = [
  'general',
  'access',
  'integrations',
  'metadata',
  'notifications',
  'audit',
  'features',
  'workspace',
  'knowledge-base',
]

function parseSettingsSection(raw: string | null): SettingsSectionId {
  if (raw && ALL_SETTINGS_SECTION_IDS.includes(raw as SettingsSectionId)) {
    return raw as SettingsSectionId
  }
  return 'general'
}

function enterpriseSecondaryButtonClass(): string {
  return cn(
    'h-10 px-4 rounded-lg text-sm font-semibold tracking-tight',
    'border border-slate-300/90 bg-background/95 text-foreground',
    'shadow-sm hover:shadow-md',
    'hover:!bg-slate-100 hover:!text-foreground dark:hover:!bg-slate-800/70 dark:hover:!text-foreground',
    'hover:border-slate-400/90 dark:hover:border-slate-500/80',
    'transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out',
    'hover:-translate-y-px active:translate-y-0',
    'focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  )
}

function CrossLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
    </Link>
  )
}

/** Enterprise advisory: control plane vs operational governance. */
function ControlPlaneGovernanceNotice() {
  const refChips: { label: string; to: string }[] = [
    { label: 'Security & Access Control', to: '/security-access-control' },
    { label: 'Workspace Management', to: '/workspace-management' },
    { label: 'Execution Portfolio Governance', to: '/portfolio-governance-management' },
  ]

  return (
    <div
      role="note"
      className={cn(
        'w-full rounded-xl border border-slate-200/75 bg-gradient-to-br from-slate-100/95 via-slate-50/80 to-sky-50/35 px-4 py-3.5',
        'dark:border-slate-700/65 dark:from-slate-900/55 dark:via-slate-900/35 dark:to-sky-950/25',
        'shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_24px_rgba(15,23,42,0.04)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-200/70 bg-white/80 dark:border-sky-800/50 dark:bg-slate-950/40">
          <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400">
            Control plane vs. operational governance
          </p>
          <p className="max-w-4xl text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
            This workspace defines the foundational identity architecture of the platform—including federation topology, authorization ownership, synchronization strategy,
            and IAM deployment behavior.
          </p>
          <p className="max-w-4xl text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
            Operational monitoring, MFA posture, access review, audit investigation, and identity risk management are handled separately in{' '}
            <Link to="/security-access-control" className="font-medium text-primary hover:underline">
              Security &amp; Access Control
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {refChips.map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className={cn(
                  'inline-flex items-center rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1',
                  'text-[10px] font-semibold text-slate-700 shadow-sm transition-colors',
                  'hover:border-primary/45 hover:bg-primary/[0.06] hover:text-primary',
                  'dark:border-slate-600/80 dark:bg-slate-950/55 dark:text-slate-200'
                )}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GuidedField({
  label,
  htmlFor,
  helper,
  children,
  inherited = false,
}: {
  label: ReactNode
  htmlFor?: string
  helper: string
  children: ReactNode
  inherited?: boolean
}) {
  return (
    <div
      className={cn(
        'space-y-2',
        inherited &&
          'rounded-lg border border-slate-200/55 bg-slate-50/45 p-2.5 dark:border-slate-700/55 dark:bg-slate-900/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
          {label}
        </Label>
        {inherited ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400" title="Inherited from selected IAM topology">
            <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            Derived
        </span>
        ) : null}
      </div>
      {children}
      <p className="text-[10px] leading-relaxed text-muted-foreground">{helper}</p>
    </div>
  )
}

function ArchitectureFlowArrow() {
  return (
    <div className="flex justify-center py-0.5" aria-hidden>
      <span className="text-[10px] font-medium text-slate-400">↓</span>
    </div>
  )
}

function AccessSectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" aria-hidden />
      <h3 className="text-[12px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">{children}</h3>
    </div>
  )
}

function AccessConfigShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200/75 bg-gradient-to-b from-white/90 to-slate-50/40 p-3 shadow-sm',
        'dark:border-slate-700/70 dark:from-background/90 dark:to-slate-950/25',
        className
      )}
    >
      {children}
    </div>
  )
}

function DirectoryAuthProviderIcon({ name }: { name: string }) {
  return <EcosystemProviderIcon providerKey={resolveProviderKeyFromLabel(name)} />
}

type IdentityConnectorKey = 'entra' | 'okta' | 'ldap'
type VirtualEcosystemKey = 'tectona-built-in' | 'external-pdp'

function resolveProviderKeyFromLabel(label: string): IdentityConnectorKey | VirtualEcosystemKey | null {
  const lower = label.toLowerCase()
  if (lower.includes('entra') || lower.includes('microsoft')) return 'entra'
  if (lower.includes('okta')) return 'okta'
  if (lower.includes('ldap')) return 'ldap'
  if (lower.includes('tectona') && lower.includes('built')) return 'tectona-built-in'
  if (lower.includes('pdp') || lower.includes('external')) return 'external-pdp'
  return null
}

function EcosystemProviderIcon({
  providerKey,
  className,
}: {
  providerKey: IdentityConnectorKey | VirtualEcosystemKey | null
  className?: string
}) {
  const iconClass = cn('h-3.5 w-3.5 shrink-0', className)
  switch (providerKey) {
    case 'entra':
      return <Building2 className={cn(iconClass, 'text-sky-600 dark:text-sky-400')} aria-hidden />
    case 'okta':
      return <Cloud className={cn(iconClass, 'text-indigo-600 dark:text-indigo-400')} aria-hidden />
    case 'ldap':
      return <Database className={cn(iconClass, 'text-slate-500')} aria-hidden />
    case 'external-pdp':
      return <Boxes className={cn(iconClass, 'text-amber-700 dark:text-amber-400')} aria-hidden />
    case 'tectona-built-in':
    default:
      return <Shield className={cn(iconClass, 'text-primary')} aria-hidden />
  }
}

function PanelIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="note"
      className={cn(
        'rounded-xl border border-slate-200/80 px-4 py-3.5 text-sm',
        'bg-gradient-to-r from-slate-100/90 via-background/92 to-slate-50/75',
        'dark:from-slate-900/40 dark:via-background/70 dark:to-slate-950/30',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]'
      )}
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">{title}</p>
          <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 [&_strong]:font-semibold [&_strong]:text-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function SubsectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-5 w-1 rounded-full bg-gradient-to-b from-primary to-blue-600" aria-hidden />
      <h3 className="text-sm font-semibold text-foreground tracking-tight">{children}</h3>
    </div>
  )
}

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-b from-background/90 to-muted/20 p-2.5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5',
        'border-border/65 bg-gradient-to-r from-background/95 to-muted/25',
        'hover:border-primary/30 hover:from-background hover:to-blue-50/40 dark:hover:to-blue-950/10',
        'transition-colors duration-200'
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </div>
  )
}

const NAV_GROUPS: {
  heading: string
  items: { id: SettingsSectionId; label: string; description: string; icon: typeof Settings2 }[]
}[] = [
  {
    heading: 'Foundation configuration',
    items: [
      { id: 'general', label: 'General platform', description: 'Identity, locale, defaults', icon: SlidersHorizontal },
      { id: 'workspace', label: 'Workspace & organization', description: 'Tenancy, hierarchy, ownership', icon: Boxes },
    ],
  },
  {
    heading: 'Security & data',
    items: [
      { id: 'access', label: 'Identity & Authorization Model', description: 'IAM foundation, providers, delegation', icon: Users },
      { id: 'metadata', label: 'Metadata schema & vocabulary', description: 'Taxonomy, naming, templates', icon: FolderTree },
      { id: 'audit', label: 'Audit, retention & housekeeping', description: 'Compliance and evidence', icon: ScrollText },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { id: 'integrations', label: 'Integration sources', description: 'Generic connector registry', icon: Cable },
      { id: 'notifications', label: 'Notifications & alerts', description: 'Signal routing and escalation', icon: Bell },
      { id: 'features', label: 'Feature flags & modules', description: 'Rollout and visibility', icon: Flag },
      { id: 'knowledge-base', label: 'Knowledge Base', description: 'KB service URL, health checks, UI validation', icon: Database },
    ],
  },
]

const MODULE_ENABLEMENT_ROWS: { key: string; label: string; locked?: boolean }[] = [
  { key: 'workspace', label: 'Workspace' },
  { key: 'projects', label: 'Project' },
  { key: 'idea-backlog', label: 'Idea & Backlog Management' },
  { key: 'task-work', label: 'Task & Work Management' },
  { key: 'planning', label: 'Planning & Scheduling' },
  { key: 'workflow-automation', label: 'Workflow & Automation Engine' },
  { key: 'resource', label: 'Resource Management' },
  { key: 'portfolio', label: 'Execution Portfolio & Delivery Governance' },
  { key: 'reporting', label: 'Reporting & Analytics' },
  { key: 'document', label: 'Document & Knowledge Management' },
  { key: 'integration', label: 'Integration & API Platform' },
  { key: 'security', label: 'Security & Access Control' },
  { key: 'ai-project', label: 'AI Project Intelligence' },
  { key: 'ai-idea', label: 'AI Idea & Prioritization Intelligence' },
  { key: 'settings', label: 'Platform Settings & Administration', locked: true },
]

const SECTION_COPY: Record<SettingsSectionId, { title: string; hint: string }> = {
  general: {
    title: 'General platform settings',
    hint: 'Branding, locale, list UX defaults, and default landing route after sign-in.',
  },
  access: {
    title: 'Identity & Authorization Model',
    hint: 'Define how authentication, authorization, federation, synchronization, and enterprise access governance operate across the TECTONA platform.',
  },
  integrations: {
    title: 'Integration sources',
    hint: 'Connector infrastructure, synchronization policies, endpoint configuration, and integration behavior across enterprise systems.',
  },
  metadata: {
    title: 'Metadata schema & vocabulary',
    hint: 'Required fields, controlled vocabulary, naming templates, and portfolio taxonomy.',
  },
  notifications: {
    title: 'Notifications & alerts',
    hint: 'Operational and governance signals delivered through configured channels.',
  },
  audit: {
    title: 'Audit, retention & housekeeping',
    hint: 'Retention, archival behavior, and housekeeping for stale items and evidence packs.',
  },
  features: {
    title: 'Feature flags & module enablement',
    hint: 'Gradual rollout and tenant-specific visibility for advanced modules.',
  },
  workspace: {
    title: 'Workspace & organization',
    hint: 'Multi-team and multi-tenant boundaries for visibility, ownership, and governance.',
  },
  'knowledge-base': {
    title: 'Knowledge Base',
    hint: 'Endpoint layanan KB, timeout health check, dan persist validasi UI di browser (runtime tetap dari environment backend).',
  },
}

const MOCK_USERS = [
  {
    id: 'u1',
    name: 'Dina Kusuma',
    email: 'dina.kusuma@company.internal',
    platformRole: 'Platform Admin',
    identitySource: 'SCIM directory',
    authProvider: 'Microsoft Entra ID',
    authzProvider: 'Tectona Built-in',
    syncState: 'Synced',
  },
  {
    id: 'u2',
    name: 'Raka Permana',
    email: 'raka.permana@company.internal',
    platformRole: 'Governance Lead',
    identitySource: 'JIT federation',
    authProvider: 'Okta',
    authzProvider: 'Tectona Built-in',
    syncState: 'Synced',
  },
  {
    id: 'u3',
    name: 'Nadia Putri',
    email: 'nadia.putri@company.internal',
    platformRole: 'Integration Operator',
    identitySource: 'Manual invite',
    authProvider: 'Tectona Built-in',
    authzProvider: 'Tectona Built-in',
    syncState: 'Pending validation',
  },
]

type ConnectorRegistryRow = {
  key: string
  title: string
  connectorType: string
  detail: string
  status: 'Connected' | 'Progressing' | 'Paused'
  endpoint: string
  tenantId: string
  clientId: string
  secretRef: string
  vaultRef: string
  retryPolicy: string
  pollingMin: string
  scimEndpoint: string
  tokenRotation: string
  syncCadence: string
  timeoutSec: string
  claimRules: string
}

const INTEGRATION_ROWS: ConnectorRegistryRow[] = [
  {
    key: 'entra',
    title: 'Microsoft Entra ID',
    connectorType: 'Identity / OIDC',
    detail: 'Primary workforce directory, OIDC login, and SCIM user provisioning.',
    status: 'Connected',
    endpoint: 'https://login.microsoftonline.com/638e5bdd-5eeb-45f4-8eb7-f9fadc94425b/v2.0',
    tenantId: '638e5bdd-5eeb-45f4-8eb7-f9fadc94425b',
    clientId: '46e8af3e-f15c-4e56-a973-a45f52b33f67',
    secretRef: 'secret://tectona/prod/entra-main',
    vaultRef: 'vault://tectona/prod/kv/entra',
    retryPolicy: 'Exponential backoff, max 5',
    pollingMin: '15',
    scimEndpoint: 'https://scim.internal.company/entra',
    tokenRotation: 'Automated (90d)',
    syncCadence: 'Incremental + nightly full',
    timeoutSec: '45',
    claimRules: 'Normalize groups → platform scopes',
  },
  {
    key: 'okta',
    title: 'Okta',
    connectorType: 'Identity / SAML',
    detail: 'Workforce SSO and delegated administration boundaries.',
    status: 'Connected',
    endpoint: 'https://adira.okta.com/oauth2/default',
    tenantId: 'okta-org-default',
    clientId: 'tectona-workforce',
    secretRef: 'secret://tectona/prod/okta-api',
    vaultRef: 'vault://tectona/prod/kv/okta',
    retryPolicy: 'Fixed 30s, max 4',
    pollingMin: '15',
    scimEndpoint: 'https://scim.internal.company/okta',
    tokenRotation: 'Semi-annual',
    syncCadence: 'Event-driven',
    timeoutSec: '40',
    claimRules: 'Map Okta groups to roles (read-only)',
  },
  {
    key: 'ldap',
    title: 'LDAP',
    connectorType: 'Identity / Directory',
    detail: 'On-prem directory bind for hybrid identity paths.',
    status: 'Progressing',
    endpoint: 'ldaps://directory.corp.internal:636',
    tenantId: '—',
    clientId: 'svc-tectona-bind',
    secretRef: 'secret://tectona/prod/ldap-bind',
    vaultRef: 'vault://tectona/prod/kv/ldap',
    retryPolicy: 'Linear, max 3',
    pollingMin: '30',
    scimEndpoint: '—',
    tokenRotation: 'Service credential rotation (60d)',
    syncCadence: 'Scheduled delta',
    timeoutSec: '60',
    claimRules: 'Attribute map: department, cost center, manager',
  },
  {
    key: 'jira',
    title: 'Jira',
    connectorType: 'Work management',
    detail: 'Issue and epic linkage for delivery traceability.',
    status: 'Connected',
    endpoint: 'https://jira.company.internal/rest/api/3',
    tenantId: 'cloud-site-01',
    clientId: 'oauth-jira-tec',
    secretRef: 'secret://tectona/prod/jira-oauth',
    vaultRef: 'vault://tectona/prod/kv/jira',
    retryPolicy: 'Exponential, max 6',
    pollingMin: '10',
    scimEndpoint: '—',
    tokenRotation: 'OAuth refresh token rotation',
    syncCadence: 'Webhook + reconciliation',
    timeoutSec: '30',
    claimRules: 'Project key ↔ portfolio mapping',
  },
  {
    key: 'slack',
    title: 'Slack',
    connectorType: 'Notifications',
    detail: 'Operational alerts and routing channels.',
    status: 'Connected',
    endpoint: 'https://slack.com/api',
    tenantId: 'T012Workspace',
    clientId: 'slack-app-tec',
    secretRef: 'secret://tectona/prod/slack-bot',
    vaultRef: 'vault://tectona/prod/kv/slack',
    retryPolicy: 'Rate-limit aware',
    pollingMin: '5',
    scimEndpoint: '—',
    tokenRotation: 'On-demand (Slack app)',
    syncCadence: 'Real-time',
    timeoutSec: '20',
    claimRules: 'Channel routing by severity',
  },
  {
    key: 'github',
    title: 'GitHub',
    connectorType: 'Development',
    detail: 'Repository metadata and delivery automation hooks.',
    status: 'Paused',
    endpoint: 'https://api.github.com',
    tenantId: 'org: adira-delivery',
    clientId: 'github-app-tectona',
    secretRef: 'secret://tectona/prod/gh-app',
    vaultRef: 'vault://tectona/prod/kv/github',
    retryPolicy: 'Exponential + jitter',
    pollingMin: '20',
    scimEndpoint: '—',
    tokenRotation: 'GitHub App key rotation',
    syncCadence: 'Webhook primary',
    timeoutSec: '35',
    claimRules: 'Repo → product lineage tags',
  },
  {
    key: 'sap',
    title: 'SAP',
    connectorType: 'ERP',
    detail: 'Financial and master-data interfaces (governed read models).',
    status: 'Progressing',
    endpoint: 'https://sap-gw.internal.company/odata',
    tenantId: 'SAP-CLIENT-800',
    clientId: 'TEC_SAP_USER',
    secretRef: 'secret://tectona/prod/sap-rfc',
    vaultRef: 'vault://tectona/prod/kv/sap',
    retryPolicy: 'Batch retry queue',
    pollingMin: '60',
    scimEndpoint: '—',
    tokenRotation: 'RFC credential policy',
    syncCadence: 'Batch window / off-peak',
    timeoutSec: '120',
    claimRules: 'Cost object normalization',
  },
  {
    key: 'kafka',
    title: 'Kafka',
    connectorType: 'Event streaming',
    detail: 'Internal event bus for cross-module propagation.',
    status: 'Connected',
    endpoint: 'kafka://cluster-governed.internal:9093',
    tenantId: 'tectona-prod',
    clientId: 'tectona-integrations',
    secretRef: 'secret://tectona/prod/kafka-sasl',
    vaultRef: 'vault://tectona/prod/kv/kafka',
    retryPolicy: 'Broker-aware retry',
    pollingMin: '—',
    scimEndpoint: '—',
    tokenRotation: 'SASL credential rotation',
    syncCadence: 'Stream (no poll)',
    timeoutSec: '15',
    claimRules: 'Topic ACL by workspace',
  },
  {
    key: 'servicenow',
    title: 'ServiceNow',
    connectorType: 'ITSM',
    detail: 'Change, incident, and request synchronization.',
    status: 'Connected',
    endpoint: 'https://adira.service-now.com/api/now',
    tenantId: 'SN-PD',
    clientId: 'oauth-sn-tec',
    secretRef: 'secret://tectona/prod/snow-oauth',
    vaultRef: 'vault://tectona/prod/kv/servicenow',
    retryPolicy: 'Respect SN rate limits',
    pollingMin: '30',
    scimEndpoint: '—',
    tokenRotation: 'Refresh token policy',
    syncCadence: 'Polling + on-demand push',
    timeoutSec: '90',
    claimRules: 'CMDB class → asset scope',
  },
]

const IAM_DEPLOYMENT_MODES: {
  id: 'tectona-managed' | 'external-authz' | 'external-authn' | 'fully-external'
  title: string
  topologyBadge: string
  authentication: string
  authorization: string
  governanceOwner: string
  chips: string[]
  operational: string
  governance: string
  bestFor: string
  integration: 'Low' | 'Medium' | 'High'
  enterpriseFit: string
}[] = [
  {
    id: 'tectona-managed',
    title: 'Tectona Managed IAM',
    topologyBadge: 'Unified topology',
    authentication: 'Tectona Built-in',
    authorization: 'Tectona Built-in',
    governanceOwner: 'Platform-native attestation',
    chips: ['Built-in', 'SCIM', 'LDAP', 'OIDC', 'SAML'],
    operational: 'Smallest integration surface; fastest outage triage.',
    governance: 'Policies and evidence natively co-located in-platform.',
    bestFor: 'Greenfield organizations and rapid, governed deployment.',
    integration: 'Low',
    enterpriseFit: 'Fast value — single control plane',
  },
  {
    id: 'external-authz',
    title: 'External Authorization Only',
    topologyBadge: 'Split authZ',
    authentication: 'Tectona Built-in',
    authorization: 'External PDP',
    governanceOwner: 'Split: PDP + platform receipts',
    chips: ['Built-in', 'External', 'PDP', 'REST'],
    operational: 'Adds PDP latency; align SLOs with policy partner.',
    governance: 'Centralize SoD in PDP; Tectona retains audit receipts.',
    bestFor: 'Teams with a centralized policy engine (OPA, enterprise PDP).',
    integration: 'Medium',
    enterpriseFit: 'Policy hub — authorization as a service',
  },
  {
    id: 'external-authn',
    title: 'External Authentication Only',
    topologyBadge: 'Federation primary',
    authentication: 'External IdP',
    authorization: 'Tectona Built-in',
    governanceOwner: 'Platform reviews; IdP attests identity',
    chips: ['External', 'Federation', 'OIDC', 'SAML', 'SCIM'],
    operational: 'IdP-owned lifecycle; federation drives session trust.',
    governance: 'Reviews in-platform; IdP attestation as evidence input.',
    bestFor: 'Enterprise SSO with platform-native access governance.',
    integration: 'Medium',
    enterpriseFit: 'SSO-led — workforce already on Entra / Okta',
  },
  {
    id: 'fully-external',
    title: 'Fully External IAM',
    topologyBadge: 'Delegated stack',
    authentication: 'External IdP',
    authorization: 'External PDP',
    governanceOwner: 'Enterprise IAM owns coarse policy',
    chips: ['External', 'Federation', 'OIDC', 'SAML', 'PDP'],
    operational: 'Largest integration surface; enforce drift monitoring.',
    governance: 'Workspace boundaries in-platform; enterprise IAM owns coarse policy.',
    bestFor: 'Large IAM ecosystems and multi-vendor identity estates.',
    integration: 'High',
    enterpriseFit: 'Federated megasuite — maximum delegation',
  },
]

type IamTopologyId = (typeof IAM_DEPLOYMENT_MODES)[number]['id']

type TopologyEcosystemItem =
  | { kind: 'connector'; key: IdentityConnectorKey }
  | { kind: 'virtual'; id: VirtualEcosystemKey; label: string }

const TOPOLOGY_ECOSYSTEM: Record<IamTopologyId, { items: TopologyEcosystemItem[]; protocols: string[] }> = {
  'tectona-managed': {
    items: [
      { kind: 'virtual', id: 'tectona-built-in', label: 'Tectona Built-in' },
      { kind: 'connector', key: 'ldap' },
    ],
    protocols: ['SCIM', 'LDAP', 'OIDC'],
  },
  'external-authz': {
    items: [
      { kind: 'virtual', id: 'tectona-built-in', label: 'Tectona Built-in' },
      { kind: 'virtual', id: 'external-pdp', label: 'External PDP' },
      { kind: 'connector', key: 'ldap' },
    ],
    protocols: ['PDP', 'REST', 'SCIM'],
  },
  'external-authn': {
    items: [
      { kind: 'connector', key: 'entra' },
      { kind: 'connector', key: 'okta' },
    ],
    protocols: ['OIDC', 'SAML', 'SCIM'],
  },
  'fully-external': {
    items: [
      { kind: 'connector', key: 'entra' },
      { kind: 'connector', key: 'okta' },
      { kind: 'virtual', id: 'external-pdp', label: 'External PDP' },
    ],
    protocols: ['OIDC', 'SAML', 'SCIM', 'PDP'],
  },
}

function ecosystemConnectorStatusClass(status: 'Connected' | 'Progressing' | 'Paused' | 'Configured'): string {
  if (status === 'Connected' || status === 'Configured') {
    return 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/55 dark:bg-emerald-950/40 dark:text-emerald-200'
  }
  if (status === 'Progressing') {
    return 'border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-900/55 dark:bg-amber-950/35 dark:text-amber-100'
  }
  return 'border-slate-200/80 bg-slate-50/90 text-slate-600 dark:border-slate-600 dark:bg-slate-900/45 dark:text-slate-300'
}

function TopologyEcosystemStrip({ topologyId }: { topologyId: IamTopologyId }) {
  const ecosystem = TOPOLOGY_ECOSYSTEM[topologyId]
  const resolved = useMemo(() => {
    return ecosystem.items.map((item) => {
      if (item.kind === 'connector') {
        const row = INTEGRATION_ROWS.find((r) => r.key === item.key)
        return {
          key: item.key,
          label: row?.title ?? item.key,
          providerKey: item.key as IdentityConnectorKey,
          status: row?.status ?? ('Paused' as const),
          href: `/platform-settings-administration?section=integrations&connector=${item.key}`,
          isRegistry: true,
        }
      }
      return {
        key: item.id,
        label: item.label,
        providerKey: item.id,
        status: 'Configured' as const,
        href:
          item.id === 'external-pdp'
            ? '/integration-api-platform'
            : '/platform-settings-administration?section=integrations',
        isRegistry: false,
      }
    })
  }, [ecosystem.items])

  const connectedCount = resolved.filter((r) => r.status === 'Connected' || r.status === 'Configured').length
  const progressingCount = resolved.filter((r) => r.status === 'Progressing').length
  const needsAttention = resolved.some((r) => r.isRegistry && r.status !== 'Connected')

  return (
    <div
      className="mt-3 rounded-lg border border-slate-200/70 bg-gradient-to-r from-slate-50/90 via-white/80 to-sky-50/25 p-2.5 dark:border-slate-700/65 dark:from-slate-950/50 dark:via-slate-900/30 dark:to-sky-950/15"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Connected ecosystem</p>
        <span className="text-[9px] font-medium text-muted-foreground">
          {connectedCount} ready
          {progressingCount > 0 ? ` · ${progressingCount} in progress` : null}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {resolved.map((item) => (
          <Link
            key={item.key}
            to={item.href}
            title={`${item.label} — ${item.status}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors',
              'hover:border-primary/45 hover:bg-primary/[0.05]',
              ecosystemConnectorStatusClass(item.status)
            )}
          >
            <EcosystemProviderIcon providerKey={item.providerKey} />
            <span className="text-[10px] font-semibold leading-none">{item.label}</span>
          </Link>
        ))}
        <span className="text-[10px] text-slate-400 dark:text-slate-500" aria-hidden>
          ·
        </span>
        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{ecosystem.protocols.join(' · ')}</span>
      </div>

      {needsAttention ? (
        <p className="mt-2 text-[9px] font-medium text-amber-800 dark:text-amber-200">
          One or more identity connectors are not fully connected — complete setup in Integration sources.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
        <Link
          to="/platform-settings-administration?section=integrations"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
        >
          Configure integration sources
          <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
        </Link>
        <Link
          to="/integration-api-platform"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
        >
          Integration &amp; API Platform
          <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
        </Link>
      </div>
    </div>
  )
}

/** Derived foundation configuration — single source of truth when topology changes. */
type TopologyFoundationValues = {
  authProviderStrategy: string
  federationProtocol: string
  directorySynchronizationMode: string
  identityProviderStrategy: string
  authzProviderStrategy: string
  rbacModel: string
  policyDecisionOwnership: string
  permissionResolution: string
  delegationMode: string
  identityInheritance: string
  defaultTenantAuthz: string
  sessionPolicyDefaults: string
  auditOwnership: string
  accessReviewResponsibility: string
  identitySyncMode: string
  provisioningBehavior: string
  reconciliationCadence: string
  jitFederationMode: string
  evaluationPrecedence: string
  attributeResolutionFallback: string
  fallbackPolicyRouting: string
}

const TOPOLOGY_FOUNDATION: Record<IamTopologyId, TopologyFoundationValues> = {
  'tectona-managed': {
    authProviderStrategy: 'tectona-built-in',
    federationProtocol: 'oidc-only',
    directorySynchronizationMode: 'hybrid-synchronization',
    identityProviderStrategy: 'enterprise-standard',
    authzProviderStrategy: 'tectona-authorization-engine',
    rbacModel: 'rbac',
    policyDecisionOwnership: 'platform-coordinated',
    permissionResolution: 'role-first',
    delegationMode: 'controlled-admin-delegation',
    identityInheritance: 'hierarchical-workspace',
    defaultTenantAuthz: 'least-privilege-default',
    sessionPolicyDefaults: 'enterprise-balanced',
    auditOwnership: 'platform-native',
    accessReviewResponsibility: 'platform-primary',
    identitySyncMode: 'manual-governed',
    provisioningBehavior: 'incremental',
    reconciliationCadence: 'nightly',
    jitFederationMode: 'enabled-balanced',
    evaluationPrecedence: 'role-then-attribute',
    attributeResolutionFallback: 'deny-by-default',
    fallbackPolicyRouting: 'platform-default-deny',
  },
  'external-authz': {
    authProviderStrategy: 'tectona-built-in',
    federationProtocol: 'oidc-scim',
    directorySynchronizationMode: 'scim-authoritative',
    identityProviderStrategy: 'enterprise-standard',
    authzProviderStrategy: 'external-pdp',
    rbacModel: 'hybrid',
    policyDecisionOwnership: 'external-pdp-primary',
    permissionResolution: 'attribute-first',
    delegationMode: 'controlled-admin-delegation',
    identityInheritance: 'hierarchical-workspace',
    defaultTenantAuthz: 'least-privilege-default',
    sessionPolicyDefaults: 'enterprise-balanced',
    auditOwnership: 'shared-evidence',
    accessReviewResponsibility: 'shared-idp-platform',
    identitySyncMode: 'scim-incremental',
    provisioningBehavior: 'incremental',
    reconciliationCadence: 'near-real-time',
    jitFederationMode: 'enabled-balanced',
    evaluationPrecedence: 'policy-graph-walk',
    attributeResolutionFallback: 'escalate-review',
    fallbackPolicyRouting: 'external-pdp-queue',
  },
  'external-authn': {
    authProviderStrategy: 'enterprise-idp-primary',
    federationProtocol: 'oidc-scim',
    directorySynchronizationMode: 'scim-authoritative',
    identityProviderStrategy: 'enterprise-standard',
    authzProviderStrategy: 'tectona-authorization-engine',
    rbacModel: 'rbac',
    policyDecisionOwnership: 'platform-coordinated',
    permissionResolution: 'role-first',
    delegationMode: 'controlled-admin-delegation',
    identityInheritance: 'hierarchical-workspace',
    defaultTenantAuthz: 'least-privilege-default',
    sessionPolicyDefaults: 'enterprise-balanced',
    auditOwnership: 'shared-evidence',
    accessReviewResponsibility: 'shared-idp-platform',
    identitySyncMode: 'scim-incremental',
    provisioningBehavior: 'incremental',
    reconciliationCadence: 'near-real-time',
    jitFederationMode: 'enabled-balanced',
    evaluationPrecedence: 'role-then-attribute',
    attributeResolutionFallback: 'inherit-parent-workspace',
    fallbackPolicyRouting: 'platform-default-deny',
  },
  'fully-external': {
    authProviderStrategy: 'enterprise-idp-primary',
    federationProtocol: 'oidc-scim',
    directorySynchronizationMode: 'scim-authoritative',
    identityProviderStrategy: 'enterprise-standard',
    authzProviderStrategy: 'external-pdp',
    rbacModel: 'hybrid',
    policyDecisionOwnership: 'external-pdp-primary',
    permissionResolution: 'attribute-first',
    delegationMode: 'workspace-scoped-delegation',
    identityInheritance: 'portfolio-driven',
    defaultTenantAuthz: 'role-baseline',
    sessionPolicyDefaults: 'regulated-strict',
    auditOwnership: 'external-primary',
    accessReviewResponsibility: 'enterprise-iam-coordinated',
    identitySyncMode: 'scim-incremental',
    provisioningBehavior: 'full-reconcile',
    reconciliationCadence: 'near-real-time',
    jitFederationMode: 'strict-directory',
    evaluationPrecedence: 'attribute-then-role',
    attributeResolutionFallback: 'escalate-review',
    fallbackPolicyRouting: 'external-pdp-queue',
  },
}

const GOVERNANCE_POSTURE_BY_TOPOLOGY: Record<
  IamTopologyId,
  { posture: string; risk: 'Low' | 'Medium' | 'High'; delegationComplexity: 'Low' | 'Medium' | 'High'; audit: string }
> = {
  'tectona-managed': {
    posture: 'Unified platform governance',
    risk: 'Low',
    delegationComplexity: 'Low',
    audit: 'Platform-native',
  },
  'external-authz': {
    posture: 'Policy-hub enterprise governance',
    risk: 'Medium',
    delegationComplexity: 'Medium',
    audit: 'Shared receipts',
  },
  'external-authn': {
    posture: 'Federated session trust (IdP-led)',
    risk: 'Medium',
    delegationComplexity: 'Medium',
    audit: 'Shared platform + IdP attestation',
  },
  'fully-external': {
    posture: 'Federated enterprise governance',
    risk: 'High',
    delegationComplexity: 'High',
    audit: 'External-primary',
  },
}

function riskToneClass(risk: 'Low' | 'Medium' | 'High'): string {
  if (risk === 'Low') return 'text-emerald-700 dark:text-emerald-300'
  if (risk === 'Medium') return 'text-amber-800 dark:text-amber-200'
  return 'text-rose-800 dark:text-rose-200'
}

function InheritedFromBanner({ topologyTitle }: { topologyTitle: string }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5 dark:border-slate-600/70 dark:bg-slate-900/45">
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Inherited from</span>
      <Badge variant="outline" className="h-5 border-primary/35 bg-primary/[0.06] px-2 text-[9px] font-semibold text-primary">
        {topologyTitle}
      </Badge>
    </div>
  )
}

function integrationSurfaceBadgeClass(level: 'Low' | 'Medium' | 'High'): string {
  if (level === 'Low') {
    return 'border-emerald-200/75 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/55 dark:bg-emerald-950/40 dark:text-emerald-200'
  }
  if (level === 'Medium') {
    return 'border-amber-200/75 bg-amber-50/90 text-amber-950 dark:border-amber-900/55 dark:bg-amber-950/35 dark:text-amber-100'
  }
  return 'border-rose-200/75 bg-rose-50/90 text-rose-950 dark:border-rose-900/55 dark:bg-rose-950/35 dark:text-rose-100'
}

function allowedAuthSourcesForTopology(id: IamTopologyId): string[] {
  if (id === 'tectona-managed' || id === 'external-authz') return ['tectona-built-in']
  return ['enterprise-idp-primary', 'hybrid-directory']
}

function allowedAuthzEnginesForTopology(id: IamTopologyId): string[] {
  if (id === 'tectona-managed' || id === 'external-authn') return ['tectona-authorization-engine']
  return ['external-pdp', 'split-trust']
}

export function PlatformSettingsControlPlanePage() {
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const active = useMemo(() => parseSettingsSection(searchParams.get('section')), [searchParams])
  const connectorHighlight = searchParams.get('connector')

  const setActiveSection = useCallback(
    (id: SettingsSectionId) => {
      setSearchParams({ section: id }, { replace: true })
    },
    [setSearchParams]
  )
  const panelGridRef = useRef<HTMLDivElement | null>(null)
  const [panelHeight, setPanelHeight] = useState<number | null>(null)

  const [platformName, setPlatformName] = useState('Tectona Project Management')
  const [envLabel, setEnvLabel] = useState('Production (governed)')
  const [brandingNote, setBrandingNote] = useState('Use corporate brand kit; follow platform design system tokens.')
  const [defaultLang, setDefaultLang] = useState('id')
  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [pageSize, setPageSize] = useState('25')
  const [tableDensity, setTableDensity] = useState('comfortable')
  const [searchScope, setSearchScope] = useState('project-first')
  const [landingPage, setLandingPage] = useState('/')

  const [rbacModel, setRbacModel] = useState(TOPOLOGY_FOUNDATION['external-authn'].rbacModel)
  const [claimMappingNs, setClaimMappingNs] = useState('workspace_id, portfolio_id, data_classification')
  const [iamDeploymentMode, setIamDeploymentMode] = useState<IamTopologyId>('external-authn')
  const [authProviderStrategy, setAuthProviderStrategy] = useState(TOPOLOGY_FOUNDATION['external-authn'].authProviderStrategy)
  const [authzProviderStrategy, setAuthzProviderStrategy] = useState(TOPOLOGY_FOUNDATION['external-authn'].authzProviderStrategy)
  const [delegationMode, setDelegationMode] = useState(TOPOLOGY_FOUNDATION['external-authn'].delegationMode)
  const [identityInheritance, setIdentityInheritance] = useState(TOPOLOGY_FOUNDATION['external-authn'].identityInheritance)
  const [defaultTenantAuthz, setDefaultTenantAuthz] = useState(TOPOLOGY_FOUNDATION['external-authn'].defaultTenantAuthz)
  const [sessionPolicyDefaults, setSessionPolicyDefaults] = useState(TOPOLOGY_FOUNDATION['external-authn'].sessionPolicyDefaults)
  const [identitySyncMode, setIdentitySyncMode] = useState(TOPOLOGY_FOUNDATION['external-authn'].identitySyncMode)
  const [federationProtocol, setFederationProtocol] = useState(TOPOLOGY_FOUNDATION['external-authn'].federationProtocol)
  const [directorySynchronizationMode, setDirectorySynchronizationMode] = useState(
    TOPOLOGY_FOUNDATION['external-authn'].directorySynchronizationMode
  )
  const [policyDecisionOwnership, setPolicyDecisionOwnership] = useState(TOPOLOGY_FOUNDATION['external-authn'].policyDecisionOwnership)
  const [permissionResolution, setPermissionResolution] = useState(TOPOLOGY_FOUNDATION['external-authn'].permissionResolution)
  const [provisioningBehavior, setProvisioningBehavior] = useState(TOPOLOGY_FOUNDATION['external-authn'].provisioningBehavior)
  const [reconciliationCadence, setReconciliationCadence] = useState(TOPOLOGY_FOUNDATION['external-authn'].reconciliationCadence)
  const [jitFederationMode, setJitFederationMode] = useState(TOPOLOGY_FOUNDATION['external-authn'].jitFederationMode)
  const [identityProviderStrategy, setIdentityProviderStrategy] = useState(TOPOLOGY_FOUNDATION['external-authn'].identityProviderStrategy)
  const [auditOwnership, setAuditOwnership] = useState(TOPOLOGY_FOUNDATION['external-authn'].auditOwnership)
  const [accessReviewResponsibility, setAccessReviewResponsibility] = useState(
    TOPOLOGY_FOUNDATION['external-authn'].accessReviewResponsibility
  )
  const [evaluationPrecedence, setEvaluationPrecedence] = useState(TOPOLOGY_FOUNDATION['external-authn'].evaluationPrecedence)
  const [attributeResolutionFallback, setAttributeResolutionFallback] = useState(
    TOPOLOGY_FOUNDATION['external-authn'].attributeResolutionFallback
  )
  const [fallbackPolicyRouting, setFallbackPolicyRouting] = useState(TOPOLOGY_FOUNDATION['external-authn'].fallbackPolicyRouting)

  const [architectureView, setArchitectureView] = useState<'basic' | 'advanced'>('basic')
  const [authFoundationOverridesOpen, setAuthFoundationOverridesOpen] = useState(false)
  const [authzFoundationOverridesOpen, setAuthzFoundationOverridesOpen] = useState(false)
  const [syncFoundationOverridesOpen, setSyncFoundationOverridesOpen] = useState(false)

  const foundationFieldsLocked = architectureView === 'basic'

  const [syncInterval, setSyncInterval] = useState('15')
  const [reconcile, setReconcile] = useState('platform-wins')

  const [auditDays, setAuditDays] = useState('365')
  const [metaHistoryDays, setMetaHistoryDays] = useState('180')
  const [dormantDays, setDormantDays] = useState('90')

  const [alertMetaIncomplete, setAlertMetaIncomplete] = useState(true)
  const [alertOwnerMissing, setAlertOwnerMissing] = useState(true)
  const [alertSla, setAlertSla] = useState(true)
  const [alertIntegrationFail, setAlertIntegrationFail] = useState(true)
  const [alertDigest, setAlertDigest] = useState(false)

  const [emailChannel, setEmailChannel] = useState(true)
  const [slackChannel, setSlackChannel] = useState(true)
  const [webhookChannel, setWebhookChannel] = useState(false)

  const [flagSandbox, setFlagSandbox] = useState(true)
  const [flagExperimental, setFlagExperimental] = useState(false)
  const [flagBetaRollout, setFlagBetaRollout] = useState(true)

  const [moduleEnabled, setModuleEnabled] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const row of MODULE_ENABLEMENT_ROWS) initial[row.key] = true
    return initial
  })

  const [tenantModuleIsolation, setTenantModuleIsolation] = useState(true)
  const [sharedCatalog, setSharedCatalog] = useState(false)

  const selectedTopologyMeta = useMemo(() => IAM_DEPLOYMENT_MODES.find((m) => m.id === iamDeploymentMode), [iamDeploymentMode])
  const governancePostureCard = GOVERNANCE_POSTURE_BY_TOPOLOGY[iamDeploymentMode]
  const syncOperationalChips = useMemo(() => {
    if (iamDeploymentMode === 'fully-external') {
      return ['Mandatory SCIM', 'Strict reconciliation', 'Continuous drift validation', 'Orphan detection']
    }
    if (iamDeploymentMode === 'external-authn') {
      return ['SCIM enabled', 'JIT federation', 'Drift monitoring']
    }
    if (iamDeploymentMode === 'tectona-managed') {
      return ['Manual + optional SCIM', 'Lightweight reconciliation']
    }
    return ['Directory orchestration', 'Policy-engine alignment']
  }, [iamDeploymentMode])

  useEffect(() => {
    const t = TOPOLOGY_FOUNDATION[iamDeploymentMode]
    setAuthProviderStrategy(t.authProviderStrategy)
    setFederationProtocol(t.federationProtocol)
    setDirectorySynchronizationMode(t.directorySynchronizationMode)
    setIdentityProviderStrategy(t.identityProviderStrategy)
    setAuthzProviderStrategy(t.authzProviderStrategy)
    setRbacModel(t.rbacModel)
    setPolicyDecisionOwnership(t.policyDecisionOwnership)
    setPermissionResolution(t.permissionResolution)
    setDelegationMode(t.delegationMode)
    setIdentityInheritance(t.identityInheritance)
    setDefaultTenantAuthz(t.defaultTenantAuthz)
    setSessionPolicyDefaults(t.sessionPolicyDefaults)
    setAuditOwnership(t.auditOwnership)
    setAccessReviewResponsibility(t.accessReviewResponsibility)
    setIdentitySyncMode(t.identitySyncMode)
    setProvisioningBehavior(t.provisioningBehavior)
    setReconciliationCadence(t.reconciliationCadence)
    setJitFederationMode(t.jitFederationMode)
    setEvaluationPrecedence(t.evaluationPrecedence)
    setAttributeResolutionFallback(t.attributeResolutionFallback)
    setFallbackPolicyRouting(t.fallbackPolicyRouting)
    setAuthFoundationOverridesOpen(false)
    setAuthzFoundationOverridesOpen(false)
    setSyncFoundationOverridesOpen(false)
  }, [iamDeploymentMode])

  useEffect(() => {
    if (active !== 'integrations' || !connectorHighlight) return
    const timer = window.setTimeout(() => {
      document.getElementById(`integration-connector-${connectorHighlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [active, connectorHighlight])

  const architectureSummary = useMemo(() => {
    const mode = IAM_DEPLOYMENT_MODES.find((m) => m.id === iamDeploymentMode)
    const federationLabels: Record<string, string> = {
      'oidc-scim': 'OIDC + SCIM',
      'saml-scim': 'SAML + SCIM',
      'oidc-only': 'OIDC federation',
      'hybrid-protocols': 'Hybrid federation stack',
    }
    const syncLabels: Record<string, string> = {
      'just-in-time': 'JIT federation',
      'scim-incremental': 'Incremental reconciliation',
      'batch-nightly': 'Scheduled directory batch',
      'manual-governed': 'Governed manual provisioning',
    }
    const governanceLabels: Record<string, string> = {
      'least-privilege-default': 'Least privilege',
      'role-baseline': 'Role baseline posture',
      'catalog-templates': 'Catalog-driven posture',
    }
    return {
      authentication: mode?.authentication ?? '—',
      authorization: mode?.authorization ?? '—',
      federation: federationLabels[federationProtocol] ?? 'Federation configured',
      sync: syncLabels[identitySyncMode] ?? 'Synchronization configured',
      governance: governanceLabels[defaultTenantAuthz] ?? 'Governed defaults',
    }
  }, [iamDeploymentMode, federationProtocol, identitySyncMode, defaultTenantAuthz])

  const notifySave = useCallback(() => {
    addToast({
      title: 'Preferences saved (demo)',
      description: 'Values are stored in this session only until backend settings API is wired.',
      variant: 'success',
    })
  }, [addToast])

  useEffect(() => {
    const computePanelHeight = () => {
      const el = panelGridRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const bottomGapPx = 14
      const next = Math.max(460, Math.floor(window.innerHeight - rect.top - bottomGapPx))
      setPanelHeight(next)
    }

    computePanelHeight()
    window.addEventListener('resize', computePanelHeight)
    return () => window.removeEventListener('resize', computePanelHeight)
  }, [])

  const sidebarCardClass = cn(
    'glass-card rounded-2xl border border-border/40 overflow-hidden',
    'shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.32)]'
  )

  const mainSurfaceClass = cn(
    'glass-card rounded-2xl border border-border/40 overflow-hidden',
    'bg-gradient-to-b from-background/95 via-background/90 to-muted/15',
    'shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.32)]'
  )

  const activeNav = NAV_GROUPS.flatMap((g) => g.items).find((item) => item.id === active)
  const ActiveSectionIcon = activeNav?.icon ?? Settings2

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Platform Settings & Administration' }]} />

      <PageHeader
        title="Platform Settings & Administration"
        description="Global control-plane configuration for platform behavior, integrations, metadata policy, notifications, retention, and module rollout—not operational security monitoring."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className={enterpriseSecondaryButtonClass()} onClick={notifySave}>
              <Save className="h-4 w-4 shrink-0" />
              Save changes
            </Button>
          </div>
        }
      />

      <div
        ref={panelGridRef}
        className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-stretch"
        style={panelHeight ? { height: `${panelHeight}px` } : undefined}
      >
        <aside
          className={cn(
            sidebarCardClass,
            'h-full overflow-hidden p-3.5 bg-gradient-to-b from-background/85 via-background/75 to-muted/20 flex flex-col'
          )}
        >
          <div className="shrink-0 rounded-xl border border-border/60 bg-gradient-to-r from-slate-900/[0.04] via-primary/[0.04] to-transparent px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Control plane</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Platform capability domains</p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Foundation configuration — not operational governance</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary bg-primary/[0.06]">
                Enterprise
              </Badge>
            </div>
          </div>

          <div className="mt-4 flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-4 pr-0.5">
            {NAV_GROUPS.map((group) => (
              <div key={group.heading}>
                <div className="mb-2 flex items-center justify-between px-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.heading}</p>
                  <span className="rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const on = active === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'w-full rounded-xl border px-2.5 py-2.5 text-left transition-all duration-200',
                          'flex items-center justify-between gap-2',
                          on
                            ? 'border-primary/80 bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-[0_12px_28px_rgba(37,99,235,0.35)]'
                            : 'border-transparent bg-background/45 text-muted-foreground hover:border-border/70 hover:bg-background/90 hover:text-foreground hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]'
                        )}
                      >
                        <span className="inline-flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                              on ? 'border-white/30 bg-white/20 text-white' : 'border-border/70 bg-background/80 text-slate-500'
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                          </span>
                          <span className="min-w-0">
                            <span className={cn('block truncate text-sm font-medium', on ? 'text-white' : 'text-foreground')}>
                              {item.label}
                            </span>
                            <span className={cn('block truncate text-[11px]', on ? 'text-white/80' : 'text-muted-foreground')}>
                              {item.description}
                            </span>
                          </span>
                        </span>
                        <ChevronRight className={cn('h-4 w-4 shrink-0', on ? 'text-white' : 'text-slate-400')} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className={cn(mainSurfaceClass, 'h-full min-h-0 flex flex-col')}>
          {active === 'access' ? (
            <div className="border-b border-border/60 bg-gradient-to-r from-slate-900/[0.02] via-primary/[0.03] to-transparent px-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-primary">
                    <ActiveSectionIcon className="h-3 w-3" />
                    Active capability
                  </div>
                  <h2 className="text-sm font-semibold leading-tight text-foreground">{SECTION_COPY[active].title}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="outline" className="h-6 border-slate-200/80 px-2 text-[9px] font-semibold text-slate-600">
                    Governed defaults
                  </Badge>
                  <Badge variant="outline" className="h-6 border-slate-200/80 px-2 text-[9px] font-semibold text-slate-600">
                    Enterprise mode
                  </Badge>
                </div>
              </div>
              <p className="mt-1 max-w-3xl text-[11px] leading-snug text-muted-foreground">{SECTION_COPY[active].hint}</p>
            </div>
          ) : (
          <div className="border-b border-border/60 bg-gradient-to-r from-slate-900/[0.03] via-primary/[0.04] to-transparent px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                  <ActiveSectionIcon className="h-3.5 w-3.5" />
                  Active capability
                </div>
                <h2 className="mt-2 text-base font-semibold text-foreground">{SECTION_COPY[active].title}</h2>
                <p className="mt-1 text-xs text-muted-foreground max-w-3xl">{SECTION_COPY[active].hint}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] border-border/70 bg-background/70">
                  Governed defaults
                </Badge>
                <Badge variant="outline" className="text-[10px] border-border/70 bg-background/70">
                  Enterprise mode
                </Badge>
              </div>
            </div>
          </div>
          )}

          <div
            className={cn(
              'relative flex-1 min-h-0 overflow-y-auto scrollbar-hide p-4 space-y-4',
              active === 'access' && 'p-4'
            )}
          >
            <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-primary/5 blur-2xl" aria-hidden />

            {active === 'general' ? (
              <>
                <SubsectionTitle>Identity &amp; presentation</SubsectionTitle>
                <FieldGrid>
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="platform-name">Platform name</Label>
                    <Input id="platform-name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="env-label">Environment label</Label>
                    <Input id="env-label" value={envLabel} onChange={(e) => setEnvLabel(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="branding">Branding notes</Label>
                    <Textarea id="branding" rows={2} value={brandingNote} onChange={(e) => setBrandingNote(e.target.value)} />
                  </div>
                </FieldGrid>

                <Separator />

                <SubsectionTitle>Locale &amp; formats</SubsectionTitle>
                <FieldGrid>
                  <div className="space-y-2">
                    <Label htmlFor="lang">Default language</Label>
                    <Select id="lang" value={defaultLang} onChange={(e) => setDefaultLang(e.target.value)}>
                      <SelectItem value="id">Bahasa Indonesia</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tz">Default timezone</Label>
                    <Select id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      <SelectItem value="Asia/Jakarta">Asia/Jakarta</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="df">Date format</Label>
                    <Select id="df" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    </Select>
                  </div>
                </FieldGrid>

                <Separator />

                <SubsectionTitle>List &amp; table UX defaults</SubsectionTitle>
                <FieldGrid>
                  <div className="space-y-2">
                    <Label htmlFor="ps">Default pagination (rows)</Label>
                    <Select id="ps" value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="density">Table density</Label>
                    <Select id="density" value={tableDensity} onChange={(e) => setTableDensity(e.target.value)}>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="spacious">Spacious</SelectItem>
                    </Select>
                  </div>
                </FieldGrid>

                <Separator />

                <SubsectionTitle>Global search &amp; navigation</SubsectionTitle>
                <div className="space-y-2">
                  <Label htmlFor="search-behavior">Global search behavior</Label>
                  <Select id="search-behavior" value={searchScope} onChange={(e) => setSearchScope(e.target.value)}>
                    <SelectItem value="project-first">Prioritize projects, then tasks</SelectItem>
                    <SelectItem value="balanced">Balanced across modules</SelectItem>
                    <SelectItem value="strict-id">Strict ID/code first</SelectItem>
                  </Select>
                </div>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="landing">Default landing page</Label>
                  <Select id="landing" value={landingPage} onChange={(e) => setLandingPage(e.target.value)}>
                    <SelectItem value="/">Workspace</SelectItem>
                    <SelectItem value="/projects">Project</SelectItem>
                    <SelectItem value="/idea-backlog">Idea &amp; Backlog</SelectItem>
                    <SelectItem value="/portfolio-governance-management">Execution Portfolio &amp; Delivery Governance</SelectItem>
                  </Select>
                </div>
              </>
            ) : null}

            {active === 'access' ? (
              <div className="flex flex-col gap-10">
                <div className="flex flex-col gap-4">
                <section className="space-y-3">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-stretch">
                    <div
                      className={cn(
                        'rounded-2xl border border-slate-200/70 p-5 shadow-sm',
                        'bg-gradient-to-br from-slate-50/90 via-background to-sky-50/20',
                        'dark:border-slate-700/60 dark:from-slate-900/45 dark:via-background dark:to-sky-950/15'
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Foundation overview</p>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Identity &amp; Authorization Foundation</h3>
                      <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
                        Define how authentication, authorization, federation, synchronization, and enterprise access governance operate across the TECTONA platform.
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-2xl border border-slate-200/65 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]',
                        'bg-gradient-to-b from-white/95 via-slate-50/55 to-slate-100/30',
                        'dark:border-slate-700/55 dark:from-slate-950/55 dark:via-slate-900/35 dark:to-slate-950/20'
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Architecture summary</p>
                      <dl className="mt-3 space-y-2.5">
                        {(
                          [
                            ['Authentication', architectureSummary.authentication],
                            ['Authorization', architectureSummary.authorization],
                            ['Federation', architectureSummary.federation],
                            ['Sync', architectureSummary.sync],
                            ['Governance', architectureSummary.governance],
                          ] as const
                        ).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-start justify-between gap-3 border-b border-slate-200/50 pb-2 last:border-0 last:pb-0 dark:border-slate-700/50"
                          >
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{k}</dt>
                            <dd className="max-w-[58%] text-right text-[11px] font-semibold leading-snug text-foreground">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200/70 bg-gradient-to-r from-slate-50/60 via-background to-transparent p-2.5 dark:border-slate-700/60 dark:from-slate-900/40">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Foundation view</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border border-slate-200/80 bg-background/90 p-0.5 shadow-sm dark:border-slate-600/80">
                      <button
                        type="button"
                        onClick={() => {
                          setArchitectureView('basic')
                          setAuthFoundationOverridesOpen(false)
                          setAuthzFoundationOverridesOpen(false)
                          setSyncFoundationOverridesOpen(false)
                        }}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                          architectureView === 'basic'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Basic foundation view
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchitectureView('advanced')}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                          architectureView === 'advanced'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Advanced architecture view
                      </button>
                    </div>
                    <p className="min-w-0 max-w-2xl text-[10px] leading-snug text-muted-foreground">
                      {architectureView === 'basic'
                        ? 'Simplified enterprise decisions with topology-derived defaults—low-level IAM complexity stays hidden.'
                        : 'Expose overrides, claim mapping, precedence, and synchronization tuning for architecture teams.'}
                    </p>
                  </div>
                </section>

                <section>
                  <ControlPlaneGovernanceNotice />
                </section>

                <section className="space-y-3">
                  <AccessSectionHeading>Identity Ownership Model</AccessSectionHeading>
                  <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                    Choose how authentication and authorization responsibilities are distributed across TECTONA and your enterprise IAM systems.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {IAM_DEPLOYMENT_MODES.map((mode) => {
                      const selected = iamDeploymentMode === mode.id
                      return (
                        <div
                          key={mode.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setIamDeploymentMode(mode.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setIamDeploymentMode(mode.id)
                            }
                          }}
                          className={cn(
                            'cursor-pointer rounded-xl border bg-gradient-to-b from-white/98 to-slate-50/50 p-3.5 text-left transition-all duration-200',
                            'shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]',
                            'dark:from-slate-950/80 dark:to-slate-900/40',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                            selected
                              ? 'border-primary/50 ring-2 ring-primary/15 shadow-[0_0_0_1px_rgba(37,99,235,0.12),0_16px_40px_rgba(37,99,235,0.12)]'
                              : 'border-slate-200/85 hover:border-slate-300/90 dark:border-slate-700/80'
                          )}
                        >
                          {selected ? (
                            <div className="mb-3 rounded-lg border border-primary/40 bg-primary/[0.07] px-2.5 py-2 dark:bg-primary/[0.12]">
                              <p className="text-[10px] font-semibold text-primary">Inherited foundation configuration active</p>
                              <p className="mt-1 text-[9px] leading-snug text-muted-foreground">
                                This topology automatically configures authentication ownership, authorization ownership, governance defaults, and synchronization posture.
                              </p>
                            </div>
                          ) : null}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold leading-tight text-foreground">{mode.title}</div>
                              <Badge
                                variant="outline"
                                className="mt-1.5 h-5 border-slate-200/80 px-1.5 text-[9px] font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
                              >
                                {mode.topologyBadge}
                              </Badge>
                            </div>
                            <div
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                                selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900'
                              )}
                              aria-hidden
                            >
                              {selected ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
                            </div>
                          </div>

                          <div className="mt-3 rounded-lg border border-slate-200/65 bg-slate-50/85 p-2.5 dark:border-slate-700/65 dark:bg-slate-950/40">
                            <div className="space-y-0.5 text-[10px] leading-snug">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Authentication</span>
                                <span className="text-right font-semibold text-foreground">{mode.authentication}</span>
                              </div>
                              <ArchitectureFlowArrow />
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Authorization</span>
                                <span className="text-right font-semibold text-foreground">{mode.authorization}</span>
                              </div>
                              <ArchitectureFlowArrow />
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Governance ownership</span>
                                <span className="max-w-[62%] text-right font-medium text-slate-700 dark:text-slate-300">{mode.governanceOwner}</span>
                              </div>
                            </div>
                          </div>

                          {selected ? <TopologyEcosystemStrip topologyId={mode.id} /> : null}

                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {mode.chips.map((chip) => (
                              <span
                                key={`${mode.id}-${chip}`}
                                className="rounded-md border border-slate-200/90 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900/55 dark:text-slate-300"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] font-semibold',
                                integrationSurfaceBadgeClass(mode.integration)
                              )}
                            >
                              Integration surface · {mode.integration}
                            </span>
                            <span className="rounded-full border border-slate-200/80 bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900/45 dark:text-slate-200">
                              Enterprise fit · {mode.enterpriseFit}
                            </span>
                          </div>

                          <p className="mt-2 border-t border-slate-200/60 pt-2 text-[10px] font-medium leading-snug text-slate-700 dark:border-slate-700/60 dark:text-slate-300">
                            {mode.bestFor}
                          </p>

                          <div className="mt-2 space-y-1 text-[10px] leading-snug text-slate-600 dark:text-slate-400">
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Operational · </span>
                              {mode.operational}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Governance · </span>
                              {mode.governance}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
                </div>

                <section className="space-y-3">
                  <AccessSectionHeading>Authentication Foundation</AccessSectionHeading>
                  <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                    Authentication ownership and federation behavior inherited from the selected IAM topology.
                  </p>
                  {selectedTopologyMeta ? <InheritedFromBanner topologyTitle={selectedTopologyMeta.title} /> : null}
                  {foundationFieldsLocked ? (
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      Inherited from selected IAM topology to preserve architectural consistency. Switch to advanced architecture view to override.
                    </p>
                  ) : null}
                  <AccessConfigShell className="p-4">
                    <div className="grid gap-5 lg:grid-cols-2">
                      <GuidedField
                        htmlFor="auth-ownership"
                        label="Authentication source"
                        helper="Determines where enterprise users authenticate and where identity trust originates."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="auth-ownership"
                          value={authProviderStrategy}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setAuthProviderStrategy(e.target.value)}
                          className={foundationFieldsLocked ? 'opacity-80' : undefined}
                        >
                          {allowedAuthSourcesForTopology(iamDeploymentMode).includes('tectona-built-in') ? (
                            <SelectItem value="tectona-built-in">Tectona Built-in</SelectItem>
                          ) : null}
                          {allowedAuthSourcesForTopology(iamDeploymentMode).includes('enterprise-idp-primary') ? (
                            <SelectItem value="enterprise-idp-primary">External IdP</SelectItem>
                          ) : null}
                          {allowedAuthSourcesForTopology(iamDeploymentMode).includes('hybrid-directory') ? (
                            <SelectItem value="hybrid-directory">Hybrid Federation</SelectItem>
                          ) : null}
                    </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="fed-proto"
                        label="Federation protocol"
                        helper="Describes the primary standards used to assert identity between your IdP and TECTONA."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="fed-proto"
                          value={federationProtocol}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setFederationProtocol(e.target.value)}
                        >
                          <SelectItem value="oidc-scim">OIDC + SCIM — enterprise default</SelectItem>
                          <SelectItem value="saml-scim">SAML + SCIM</SelectItem>
                          <SelectItem value="oidc-only">OIDC federation (optional / lightweight)</SelectItem>
                          <SelectItem value="hybrid-protocols">Hybrid protocol stack</SelectItem>
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="idp-strategy"
                        label="Identity provider strategy"
                        helper="Sets how aggressively you standardize on a primary IdP versus routing across multiple enterprise directories."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="idp-strategy"
                          value={identityProviderStrategy}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setIdentityProviderStrategy(e.target.value)}
                        >
                          <SelectItem value="enterprise-standard">Enterprise standard (Entra / Okta patterns)</SelectItem>
                          <SelectItem value="best-of-breed">Best-of-breed IdP routing</SelectItem>
                          <SelectItem value="legacy-ldap">Legacy LDAP-centric estate</SelectItem>
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="dir-sync-field"
                        label="Directory synchronization mode"
                        helper="Defines how authoritative directory data is reconciled with session-first federation paths."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="dir-sync-field"
                          value={directorySynchronizationMode}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setDirectorySynchronizationMode(e.target.value)}
                        >
                          <SelectItem value="scim-authoritative">Authoritative SCIM directory</SelectItem>
                          <SelectItem value="jit-federated">JIT with federated directory reads</SelectItem>
                          <SelectItem value="ldap-gateway">LDAP gateway with normalization</SelectItem>
                          <SelectItem value="hybrid-synchronization">Hybrid directory orchestration</SelectItem>
                        </Select>
                      </GuidedField>
                  </div>
                    {architectureView === 'advanced' ? (
                      <div className="mt-5 border-t border-slate-200/75 pt-4 dark:border-slate-700/70">
                        <button
                          type="button"
                          onClick={() => setAuthFoundationOverridesOpen((o) => !o)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-left text-[11px] font-semibold text-foreground transition-colors hover:bg-slate-100/90 dark:border-slate-600/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                        >
                          <span>Advanced overrides — federation &amp; directory routing</span>
                          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', authFoundationOverridesOpen && 'rotate-180')} />
                        </button>
                        {authFoundationOverridesOpen ? (
                          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                            Expert tuning for federation protocol, directory reconciliation paths, and token binding assumptions. Changes should stay aligned with your selected topology; invalid
                            combinations may break attestation guarantees.
                          </p>
                        ) : null}
                  </div>
                    ) : null}
                  </AccessConfigShell>
                </section>

                <section className="space-y-3">
                  <AccessSectionHeading>Authorization Foundation</AccessSectionHeading>
                  <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                    Permission evaluation and policy ownership inherited from the selected IAM topology.
                  </p>
                  {selectedTopologyMeta ? <InheritedFromBanner topologyTitle={selectedTopologyMeta.title} /> : null}
                  {foundationFieldsLocked ? (
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      Inherited from selected IAM topology to preserve architectural consistency. Switch to advanced architecture view to override.
                    </p>
                  ) : null}
                  <AccessConfigShell className="p-4">
                    <div className="grid gap-5 lg:grid-cols-2">
                      <GuidedField
                        htmlFor="az-engine"
                        label="Authorization engine"
                        helper="Identifies which runtime evaluates permission outcomes for TECTONA resources."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="az-engine"
                          value={authzProviderStrategy}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setAuthzProviderStrategy(e.target.value)}
                        >
                          {allowedAuthzEnginesForTopology(iamDeploymentMode).includes('tectona-authorization-engine') ? (
                            <SelectItem value="tectona-authorization-engine">TECTONA authorization engine</SelectItem>
                          ) : null}
                          {allowedAuthzEnginesForTopology(iamDeploymentMode).includes('external-pdp') ? (
                            <SelectItem value="external-pdp">External policy engine (PDP)</SelectItem>
                          ) : null}
                          {allowedAuthzEnginesForTopology(iamDeploymentMode).includes('split-trust') ? (
                            <SelectItem value="split-trust">Coordinated split trust</SelectItem>
                          ) : null}
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="eval-model"
                        label="Authorization evaluation model"
                        helper="Determines whether coarse roles, fine-grained attributes, or blended constraints govern grants."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="eval-model"
                          value={rbacModel}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setRbacModel(e.target.value)}
                        >
                          <SelectItem value="rbac">Role-centric evaluation (RBAC)</SelectItem>
                          <SelectItem value="abac">Attribute-aware constraints (ABAC)</SelectItem>
                          <SelectItem value="hybrid">Hybrid RBAC + ABAC guardrails</SelectItem>
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="pdo"
                        label="Policy decision ownership"
                        helper="States whether TECTONA, your PDP, or a shared evidence model holds decision accountability."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="pdo"
                          value={policyDecisionOwnership}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setPolicyDecisionOwnership(e.target.value)}
                        >
                          <SelectItem value="platform-coordinated">Platform-coordinated decisions</SelectItem>
                          <SelectItem value="external-pdp-primary">External PDP owns coarse policy</SelectItem>
                          <SelectItem value="shared-evidence">Shared evidence registry</SelectItem>
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="perm-res"
                        label="Permission resolution behavior"
                        helper="Clarifies whether roles, attributes, or delegated workspace policies resolve first in the evaluation chain."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="perm-res"
                          value={permissionResolution}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setPermissionResolution(e.target.value)}
                        >
                          <SelectItem value="role-first">Role-first with attribute guards</SelectItem>
                          <SelectItem value="attribute-first">Attribute-first with role caps</SelectItem>
                          <SelectItem value="delegated-workspace">Delegated workspace resolution</SelectItem>
                        </Select>
                      </GuidedField>
                    </div>

                    {architectureView === 'advanced' ? (
                      <div className="mt-5 border-t border-slate-200/75 pt-4 dark:border-slate-700/70">
                        <button
                          type="button"
                          onClick={() => setAuthzFoundationOverridesOpen((o) => !o)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-left text-[11px] font-semibold text-foreground transition-colors hover:bg-slate-100/90 dark:border-slate-600/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                        >
                          <span>Advanced overrides — claims, precedence &amp; routing</span>
                          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', authzFoundationOverridesOpen && 'rotate-180')} />
                        </button>
                        {authzFoundationOverridesOpen ? (
                          <div className="mt-3 grid gap-4 lg:grid-cols-2">
                            <GuidedField
                              htmlFor="claim-ns"
                              label="Claim mapping namespace (comma-separated)"
                              helper="Stable keys aligned with federation attributes and policy evidence."
                            >
                              <Input
                                id="claim-ns"
                                value={claimMappingNs}
                                onChange={(e) => setClaimMappingNs(e.target.value)}
                                className="h-9 w-full font-mono text-xs"
                                spellCheck={false}
                              />
                            </GuidedField>
                            <GuidedField
                              htmlFor="eval-prec"
                              label="Evaluation precedence"
                              helper="Orders how role, attribute, and policy graph layers are consulted."
                            >
                              <Select id="eval-prec" value={evaluationPrecedence} onChange={(e) => setEvaluationPrecedence(e.target.value)}>
                                <SelectItem value="role-then-attribute">Role-first precedence</SelectItem>
                                <SelectItem value="attribute-then-role">Attribute-first precedence</SelectItem>
                                <SelectItem value="policy-graph-walk">Policy graph evaluation</SelectItem>
                              </Select>
                            </GuidedField>
                            <GuidedField
                              htmlFor="attr-fallback"
                              label="Attribute resolution fallback"
                              helper="Behavior when attribute sources conflict or are incomplete."
                            >
                              <Select
                                id="attr-fallback"
                                value={attributeResolutionFallback}
                                onChange={(e) => setAttributeResolutionFallback(e.target.value)}
                              >
                                <SelectItem value="deny-by-default">Deny by default</SelectItem>
                                <SelectItem value="inherit-parent-workspace">Inherit parent workspace</SelectItem>
                                <SelectItem value="escalate-review">Escalate to governance review</SelectItem>
                              </Select>
                            </GuidedField>
                            <GuidedField
                              htmlFor="fallback-route"
                              label="Fallback policy routing"
                              helper="Where unresolved decisions are routed when PDP or graph evaluation stalls."
                            >
                              <Select
                                id="fallback-route"
                                value={fallbackPolicyRouting}
                                onChange={(e) => setFallbackPolicyRouting(e.target.value)}
                              >
                                <SelectItem value="platform-default-deny">Platform default deny</SelectItem>
                                <SelectItem value="idp-hint-routing">Route using IdP hints</SelectItem>
                                <SelectItem value="external-pdp-queue">External PDP queue</SelectItem>
                              </Select>
                            </GuidedField>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </AccessConfigShell>
                </section>

                <section className="space-y-3">
                  <AccessSectionHeading>Governance Defaults</AccessSectionHeading>
                  <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                    Default governance posture automatically generated from the selected IAM topology—not a standalone policy form.
                  </p>
                  {selectedTopologyMeta ? <InheritedFromBanner topologyTitle={selectedTopologyMeta.title} /> : null}
                  {foundationFieldsLocked ? (
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      Auto-generated from topology for governance safety. Use advanced architecture view to tune.
                    </p>
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start">
                    <AccessConfigShell className="p-4">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <GuidedField
                          htmlFor="del-mode"
                          label="Delegation behavior"
                          helper="Defines how administrative authority may be delegated across workspaces and operational domains."
                          inherited={foundationFieldsLocked}
                        >
                          <Select
                            id="del-mode"
                            value={delegationMode}
                            disabled={foundationFieldsLocked}
                            onChange={(e) => setDelegationMode(e.target.value)}
                          >
                            <SelectItem value="no-delegation">No administrative delegation</SelectItem>
                            <SelectItem value="controlled-admin-delegation">Controlled administrative delegation</SelectItem>
                            <SelectItem value="workspace-scoped-delegation">Workspace-scoped delegation</SelectItem>
                          </Select>
                        </GuidedField>
                        <GuidedField
                          htmlFor="inh"
                          label="Inheritance model"
                          helper="Controls how access permissions propagate across your organizational hierarchy."
                          inherited={foundationFieldsLocked}
                        >
                          <Select
                            id="inh"
                            value={identityInheritance}
                            disabled={foundationFieldsLocked}
                            onChange={(e) => setIdentityInheritance(e.target.value)}
                          >
                            <SelectItem value="flat">Flat — explicit assignments only</SelectItem>
                            <SelectItem value="hierarchical-workspace">Hierarchical via workspace tree</SelectItem>
                            <SelectItem value="portfolio-driven">Portfolio-driven inheritance</SelectItem>
                          </Select>
                        </GuidedField>
                        <GuidedField
                          htmlFor="tenant-authz"
                          label="Default privilege posture"
                          helper="Defines the platform’s default security stance for newly created resources and tenants."
                          inherited={foundationFieldsLocked}
                        >
                          <Select
                            id="tenant-authz"
                            value={defaultTenantAuthz}
                            disabled={foundationFieldsLocked}
                            onChange={(e) => setDefaultTenantAuthz(e.target.value)}
                          >
                            <SelectItem value="least-privilege-default">Least privilege by default</SelectItem>
                            <SelectItem value="role-baseline">Role baseline then tighten</SelectItem>
                            <SelectItem value="catalog-templates">Catalog templates per tenant tier</SelectItem>
                          </Select>
                        </GuidedField>
                        <GuidedField
                          htmlFor="sess"
                          label="Session trust model"
                          helper="Enterprise session TTL, idle behavior, and trust boundaries for productivity scenarios."
                          inherited={foundationFieldsLocked}
                        >
                          <Select
                            id="sess"
                            value={sessionPolicyDefaults}
                            disabled={foundationFieldsLocked}
                            onChange={(e) => setSessionPolicyDefaults(e.target.value)}
                          >
                            <SelectItem value="enterprise-balanced">Enterprise balanced (TTL + idle)</SelectItem>
                            <SelectItem value="regulated-strict">Regulated strict (short-lived)</SelectItem>
                            <SelectItem value="extended-analytics">Extended for trusted analytics sessions</SelectItem>
                          </Select>
                        </GuidedField>
                        <GuidedField
                          htmlFor="audit-own"
                          label="Audit ownership"
                          helper="Clarifies whether audit evidence is owned by the platform, shared, or primarily by enterprise IAM."
                          inherited={foundationFieldsLocked}
                        >
                          <Select id="audit-own" value={auditOwnership} disabled={foundationFieldsLocked} onChange={(e) => setAuditOwnership(e.target.value)}>
                            <SelectItem value="platform-native">Platform-native audit ownership</SelectItem>
                            <SelectItem value="shared-evidence">Shared evidence registry</SelectItem>
                            <SelectItem value="external-primary">External audit ownership</SelectItem>
                          </Select>
                        </GuidedField>
                        <GuidedField
                          htmlFor="access-rev"
                          label="Access review responsibility"
                          helper="Defines who runs periodic access reviews relative to IdP attestations and platform roles."
                          inherited={foundationFieldsLocked}
                        >
                          <Select
                            id="access-rev"
                            value={accessReviewResponsibility}
                            disabled={foundationFieldsLocked}
                            onChange={(e) => setAccessReviewResponsibility(e.target.value)}
                          >
                            <SelectItem value="platform-primary">Platform-led access reviews</SelectItem>
                            <SelectItem value="shared-idp-platform">Shared: platform + IdP</SelectItem>
                            <SelectItem value="enterprise-iam-coordinated">Enterprise IAM coordinated</SelectItem>
                          </Select>
                        </GuidedField>
                      </div>
                    </AccessConfigShell>
                    <div
                      className={cn(
                        'rounded-xl border border-slate-200/70 p-4 shadow-sm',
                        'bg-gradient-to-b from-white/95 via-slate-50/50 to-slate-100/25',
                        'dark:border-slate-700/65 dark:from-slate-950/55 dark:via-slate-900/35 dark:to-slate-950/25'
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Governance posture</p>
                      <dl className="mt-3 space-y-2.5 text-[11px]">
                        <div className="flex flex-col gap-0.5 border-b border-slate-200/50 pb-2 dark:border-slate-700/50">
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Posture</dt>
                          <dd className="font-medium leading-snug text-foreground">{governancePostureCard.posture}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2 dark:border-slate-700/50">
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Risk profile</dt>
                          <dd className={cn('font-semibold', riskToneClass(governancePostureCard.risk))}>{governancePostureCard.risk}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2 dark:border-slate-700/50">
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Delegation complexity</dt>
                          <dd className="font-semibold text-foreground">{governancePostureCard.delegationComplexity}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5 pt-0.5">
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Audit ownership</dt>
                          <dd className="font-medium text-foreground">{governancePostureCard.audit}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <AccessSectionHeading>Identity Synchronization Defaults</AccessSectionHeading>
                  <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                    Directory orchestration and reconciliation inherited from the selected IAM topology.
                  </p>
                  {selectedTopologyMeta ? <InheritedFromBanner topologyTitle={selectedTopologyMeta.title} /> : null}
                  <div className="flex flex-wrap gap-1.5">
                    {syncOperationalChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-slate-200/80 bg-slate-50/90 px-2 py-0.5 text-[9px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900/45 dark:text-slate-200"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  {foundationFieldsLocked ? (
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      Inherited synchronization posture preserves lifecycle alignment with your IAM topology.
                    </p>
                  ) : null}
                  <AccessConfigShell className="p-4">
                    <div className="grid gap-5 lg:grid-cols-2">
                      <GuidedField
                        htmlFor="sync-strat"
                        label="Synchronization strategy"
                        helper="Chooses how directory truth is synchronized relative to interactive federation sessions."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="sync-strat"
                          value={identitySyncMode}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setIdentitySyncMode(e.target.value)}
                        >
                          <SelectItem value="just-in-time">Just-in-time federation only</SelectItem>
                          <SelectItem value="scim-incremental">SCIM incremental + reconciliation</SelectItem>
                          <SelectItem value="batch-nightly">Batch directory refresh (nightly)</SelectItem>
                          <SelectItem value="manual-governed">Manual invites with governed approval</SelectItem>
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="provision"
                        label="Provisioning behavior"
                        helper="Incremental updates versus scheduled full realignments across directory systems."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="provision"
                          value={provisioningBehavior}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setProvisioningBehavior(e.target.value)}
                        >
                          <SelectItem value="incremental">Incremental provisioning</SelectItem>
                          <SelectItem value="full-reconcile">Periodic full reconciliation</SelectItem>
                          <SelectItem value="jit-only">JIT-only alignment</SelectItem>
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="recon-cadence"
                        label="Reconciliation cadence"
                        helper="How quickly directory drift is corrected between SCIM, JIT, and manual exceptions."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="recon-cadence"
                          value={reconciliationCadence}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setReconciliationCadence(e.target.value)}
                        >
                          <SelectItem value="near-real-time">Near real-time convergence</SelectItem>
                          <SelectItem value="hourly">Hourly convergence</SelectItem>
                          <SelectItem value="nightly">Nightly baseline alignment</SelectItem>
                        </Select>
                      </GuidedField>
                      <GuidedField
                        htmlFor="jit-fed"
                        label="JIT federation mode"
                        helper="Balances just-in-time trust for external collaborators against authoritative directory controls."
                        inherited={foundationFieldsLocked}
                      >
                        <Select
                          id="jit-fed"
                          value={jitFederationMode}
                          disabled={foundationFieldsLocked}
                          onChange={(e) => setJitFederationMode(e.target.value)}
                        >
                          <SelectItem value="enabled-balanced">Balanced JIT + directory truth</SelectItem>
                          <SelectItem value="strict-directory">Directory-only provisioning</SelectItem>
                          <SelectItem value="jit-primary">JIT-primary for external collaborators</SelectItem>
                        </Select>
                      </GuidedField>
                    </div>
                    {architectureView === 'advanced' ? (
                      <div className="mt-5 border-t border-slate-200/75 pt-4 dark:border-slate-700/70">
                        <button
                          type="button"
                          onClick={() => setSyncFoundationOverridesOpen((o) => !o)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-left text-[11px] font-semibold text-foreground transition-colors hover:bg-slate-100/90 dark:border-slate-600/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                        >
                          <span>Advanced overrides — reconciliation tuning</span>
                          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', syncFoundationOverridesOpen && 'rotate-180')} />
                        </button>
                        {syncFoundationOverridesOpen ? (
                          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                            Use for staged migrations, phased SCIM cutovers, or temporary reconciliation windows. Document deviations in your enterprise architecture record—this control plane assumes
                            topology consistency by default.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </AccessConfigShell>
                </section>

                <section className="space-y-3">
                  <AccessSectionHeading>Foundational Identity Directory</AccessSectionHeading>
                  <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                    Read-only synchronized identity registry used by platform authorization and governance foundations.
                  </p>
                  <div
                    className={cn(
                      'rounded-xl border border-sky-200/55 bg-gradient-to-r from-sky-50/55 via-background to-transparent px-3.5 py-3',
                      'dark:border-sky-900/45 dark:from-sky-950/25 dark:via-background'
                    )}
                  >
                    <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                      This directory reflects foundational synchronized identities used by the platform authorization model. Operational workspace participation is managed separately in{' '}
                      <Link to="/workspace-management" className="font-semibold text-primary hover:underline">
                        Workspace Management
                      </Link>
                      .
                    </p>
                  </div>
                  <AccessConfigShell className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[820px] text-left text-[11px]">
                        <thead className="border-b border-slate-200/80 bg-slate-50/90 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-2.5 font-medium">User</th>
                            <th className="whitespace-nowrap px-3 py-2.5 font-medium">Platform role</th>
                            <th className="whitespace-nowrap px-3 py-2.5 font-medium">Identity source</th>
                            <th className="whitespace-nowrap px-3 py-2.5 font-medium">Authentication provider</th>
                            <th className="whitespace-nowrap px-3 py-2.5 font-medium">Authorization provider</th>
                            <th className="whitespace-nowrap px-3 py-2.5 font-medium">Synchronization state</th>
                      </tr>
                    </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {MOCK_USERS.map((u) => {
                            const sourceType =
                              u.identitySource.toLowerCase().includes('scim')
                                ? 'SCIM'
                                : u.identitySource.toLowerCase().includes('jit')
                                  ? 'JIT'
                                  : 'Manual'
                            return (
                              <tr key={u.id} className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-900/35">
                                <td className="px-3 py-2 align-middle">
                                  <div className="font-semibold leading-tight text-foreground">{u.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{u.email}</div>
                          </td>
                                <td className="px-3 py-2 align-middle">
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[9px] font-medium">
                                    {u.platformRole}
                            </Badge>
                          </td>
                                <td className="px-3 py-2 align-middle">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="w-fit rounded border border-slate-200/80 bg-white px-1.5 py-0 text-[9px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900/45">
                                      {sourceType}
                                    </span>
                                    <span className="text-[10px] text-slate-600 dark:text-slate-400">{u.identitySource}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <div className="flex items-center gap-1.5">
                                    <DirectoryAuthProviderIcon name={u.authProvider} />
                                    <span className="font-medium text-foreground">{u.authProvider}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <div className="flex items-center gap-1.5">
                                    <Shield className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                                    <span className="font-medium text-foreground">{u.authzProvider}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold',
                                      u.syncState === 'Synced'
                                        ? 'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200'
                                    )}
                                  >
                                    {u.syncState}
                                  </span>
                                </td>
                        </tr>
                            )
                          })}
                    </tbody>
                  </table>
                </div>
                  </AccessConfigShell>

                  <div className="pt-1">
                    <Button type="button" variant="outline" size="sm" className={cn(enterpriseSecondaryButtonClass(), 'h-8 text-xs')}>
                      Export foundational directory (read only)
                  </Button>
                </div>
                </section>
              </div>
            ) : null}

            {active === 'integrations' ? (
              <>
                <PanelIntro title="CONFIGURATION VS. OPERATIONS">
                  This section configures <strong>connector infrastructure</strong> and synchronization behavior. Runtime monitoring, operational health, identity governance, and security posture are handled in{' '}
                  <CrossLink to="/security-access-control">Security &amp; Access Control</CrossLink>. For API runtime telemetry, use{' '}
                  <CrossLink to="/integration-api-platform">Integration &amp; API Platform</CrossLink>.
                </PanelIntro>

                <SubsectionTitle>Platform-wide connector defaults</SubsectionTitle>
                <FieldGrid>
                  <div className="space-y-2">
                    <Label htmlFor="sync">Default sync interval (minutes)</Label>
                    <Input id="sync" type="number" min={1} value={syncInterval} onChange={(e) => setSyncInterval(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec">Source priority &amp; reconciliation</Label>
                    <Select id="rec" value={reconcile} onChange={(e) => setReconcile(e.target.value)}>
                      <SelectItem value="platform-wins">Platform data wins on conflict</SelectItem>
                      <SelectItem value="source-wins">Source system wins</SelectItem>
                      <SelectItem value="manual-queue">Queue for manual merge</SelectItem>
                    </Select>
                  </div>
                </FieldGrid>

                <SubsectionTitle>Generic connector registry</SubsectionTitle>
                <p className="text-xs text-muted-foreground -mt-1 mb-2">
                  Register endpoints, secrets references, and synchronization behavior for governed integrations—including identity, work management, notifications, and enterprise systems.
                </p>
                <div className="space-y-4">
                  {INTEGRATION_ROWS.map((row) => (
                    <div
                      key={row.key}
                      id={`integration-connector-${row.key}`}
                      className={cn(
                        'rounded-xl border bg-background/40 p-4 space-y-3 shadow-sm transition-shadow',
                        connectorHighlight === row.key
                          ? 'border-primary/50 ring-2 ring-primary/20 bg-primary/[0.03]'
                          : 'border-border/60'
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {row.key === 'entra' || row.key === 'okta' || row.key === 'ldap' ? (
                            <EcosystemProviderIcon providerKey={row.key as IdentityConnectorKey} />
                          ) : null}
                          <div>
                        <div className="font-semibold text-sm text-foreground">{row.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{row.connectorType}</div>
                          </div>
                        </div>
                        <Badge
                          variant={row.status === 'Connected' ? 'default' : row.status === 'Paused' ? 'outline' : 'secondary'}
                          className="shrink-0"
                        >
                          {row.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{row.detail}</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Endpoint URL</Label>
                          <Input readOnly value={row.endpoint} className="h-9 text-[11px] font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tenant ID</Label>
                          <Input readOnly value={row.tenantId} className="h-9 text-[11px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Client ID</Label>
                          <Input readOnly value={row.clientId} className="h-9 text-[11px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Secret reference</Label>
                          <Input readOnly value={row.secretRef} className="h-9 text-[11px] font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vault reference</Label>
                          <Input readOnly value={row.vaultRef} className="h-9 text-[11px] font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Retry policy</Label>
                          <Input readOnly value={row.retryPolicy} className="h-9 text-[11px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Polling interval (minutes)</Label>
                          <Input readOnly value={row.pollingMin} className="h-9 text-[11px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SCIM endpoint</Label>
                          <Input readOnly value={row.scimEndpoint} className="h-9 text-[11px] font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Token rotation policy</Label>
                          <Input readOnly value={row.tokenRotation} className="h-9 text-[11px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sync cadence</Label>
                          <Input readOnly value={row.syncCadence} className="h-9 text-[11px]" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Connector timeout (seconds)</Label>
                          <Input readOnly value={row.timeoutSec} className="h-9 text-[11px]" />
                        </div>
                        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                          <Label className="text-xs">Claim normalization rules</Label>
                          <Input readOnly value={row.claimRules} className="h-9 text-[11px]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {active === 'metadata' ? (
              <>
                <PanelIntro title="Portfolio taxonomy alignment">
                  Field definitions and templates are applied in <CrossLink to="/project-management">Project Management</CrossLink>. Define here the{' '}
                  <strong>platform-wide policies</strong> those editors must respect.
                </PanelIntro>

                <SubsectionTitle>Required metadata fields</SubsectionTitle>
                <div className="space-y-2">
                  {['Project', 'Idea', 'Task / Work item'].map((t) => (
                    <div key={t} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                      <span className="text-sm font-medium">{t}</span>
                      <div className="flex flex-wrap gap-1">
                        {['owner', 'domain', 'priority', 'status'].map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px]">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <SubsectionTitle>Custom fields</SubsectionTitle>
                <Textarea
                  rows={3}
                  className="font-mono text-xs"
                  defaultValue={'cost_center (string, optional)\nrisk_rating (enum: low, medium, high)\nregulatory_scope (boolean)'}
                />
              </>
            ) : null}

            {active === 'notifications' ? (
              <>
                <SubsectionTitle>Alert rules</SubsectionTitle>
                <div className="grid gap-2 sm:grid-cols-1">
                  <ToggleRow
                    id="a1"
                    label="Metadata incomplete"
                    description="Fire when mandatory fields missing after SLA."
                    checked={alertMetaIncomplete}
                    onCheckedChange={setAlertMetaIncomplete}
                  />
                  <ToggleRow
                    id="a2"
                    label="Ownership missing"
                    description="No accountable owner or deputy on active items."
                    checked={alertOwnerMissing}
                    onCheckedChange={setAlertOwnerMissing}
                  />
                  <ToggleRow
                    id="a4"
                    label="SLA threshold notifications"
                    description="Escalate when SLA breaches occur on governed work."
                    checked={alertSla}
                    onCheckedChange={setAlertSla}
                  />
                  <ToggleRow
                    id="a5"
                    label="Integration failure alerts"
                    description="Connector errors, auth expiry, or backlog."
                    checked={alertIntegrationFail}
                    onCheckedChange={setAlertIntegrationFail}
                  />
                  <ToggleRow
                    id="a6"
                    label="Weekly digest"
                    description="Curated changes: new projects, approvals, escalations."
                    checked={alertDigest}
                    onCheckedChange={setAlertDigest}
                  />
                </div>

                <Separator />

                <SubsectionTitle>Channels</SubsectionTitle>
                <div className="grid gap-2">
                  <ToggleRow id="ch1" label="Email" description="SMTP relay or enterprise mail API." checked={emailChannel} onCheckedChange={setEmailChannel} />
                  <ToggleRow id="ch2" label="Slack" description="Workspace app + channel routing by severity." checked={slackChannel} onCheckedChange={setSlackChannel} />
                  <ToggleRow id="ch3" label="Webhook" description="HTTPS callbacks with signed payloads." checked={webhookChannel} onCheckedChange={setWebhookChannel} />
                </div>
                <div className="space-y-2 max-w-lg">
                  <Label>Default webhook URL (masked)</Label>
                  <Input readOnly value="https://hooks.example.com/tectona/••••••••" className="font-mono text-xs" />
                </div>
              </>
            ) : null}

            {active === 'audit' ? (
              <>
                <SubsectionTitle>Retention</SubsectionTitle>
                <FieldGrid>
                  <div className="space-y-2">
                    <Label htmlFor="audit-ret">Audit log retention (days)</Label>
                    <Input id="audit-ret" type="number" value={auditDays} onChange={(e) => setAuditDays(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meta-ret">Metadata history retention (days)</Label>
                    <Input id="meta-ret" type="number" value={metaHistoryDays} onChange={(e) => setMetaHistoryDays(e.target.value)} />
                  </div>
                </FieldGrid>

                <Separator />

                <SubsectionTitle>Housekeeping &amp; freshness</SubsectionTitle>
                <FieldGrid>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="dormant">Dormant policy (days without activity)</Label>
                    <Input id="dormant" type="number" value={dormantDays} onChange={(e) => setDormantDays(e.target.value)} />
                  </div>
                </FieldGrid>
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <span>
                    Cleanup jobs should coordinate with <CrossLink to="/workflow-automation-engine">Workflow &amp; Automation Engine</CrossLink>.
                  </span>
                </div>
              </>
            ) : null}

            {active === 'features' ? (
              <>
                <PanelIntro title="Module enablement">
                  Mirrors the capability tiles in the app launcher. Disabling a module hides navigation and blocks related scopes. This Settings area stays enabled so the platform remains recoverable.
                </PanelIntro>

                <div className="space-y-2">
                  {MODULE_ENABLEMENT_ROWS.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                      <span className="text-sm font-medium">{row.label}</span>
                      <Switch
                        checked={moduleEnabled[row.key] ?? false}
                        disabled={!!row.locked}
                        onCheckedChange={(v) =>
                          setModuleEnabled((prev) => ({
                            ...prev,
                            [row.key]: v,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                <SubsectionTitle>Advanced toggles</SubsectionTitle>
                <div className="grid gap-2">
                  <ToggleRow
                    id="sandbox"
                    label="Developer sandbox / try-out"
                    description="Exposes sample data and safe mutation for demos."
                    checked={flagSandbox}
                    onCheckedChange={setFlagSandbox}
                  />
                  <ToggleRow
                    id="exp"
                    label="Experimental features"
                    description="UI may change without notice; logged separately in audit trail."
                    checked={flagExperimental}
                    onCheckedChange={setFlagExperimental}
                  />
                  <ToggleRow
                    id="beta"
                    label="Beta rollout controls"
                    description="Percentage-based enablement per workspace cohort."
                    checked={flagBetaRollout}
                    onCheckedChange={setFlagBetaRollout}
                  />
                </div>
              </>
            ) : null}

            {active === 'workspace' ? (
              <>
                <SubsectionTitle>Workspace topology</SubsectionTitle>
                <Textarea
                  rows={4}
                  className="text-sm font-mono"
                  defaultValue={`Portfolio Office (WS-PO)\n  ├─ Strategy\n  └─ Governance\nDelivery (WS-DLV)\nEngineering (WS-ENG)\nPartners (WS-PRT)`}
                />

                <Separator />

                <SubsectionTitle>Isolation &amp; visibility</SubsectionTitle>
                <div className="grid gap-2">
                  <ToggleRow
                    id="iso"
                    label="Strict tenant isolation for APIs"
                    description="Cross-tenant reads return 404; break-glass via audited override only."
                    checked={tenantModuleIsolation}
                    onCheckedChange={setTenantModuleIsolation}
                  />
                  <ToggleRow
                    id="shared"
                    label="Shared read-only catalog across tenants"
                    description="Use for shared standards; writes remain scoped."
                    checked={sharedCatalog}
                    onCheckedChange={setSharedCatalog}
                  />
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs">
                  <Lock className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                  <span>
                    Access boundaries are enforced by <CrossLink to="/security-access-control">Security &amp; Access Control</CrossLink> and audited for break-glass usage.
                  </span>
                </div>
              </>
            ) : null}

            {active === 'knowledge-base' ? <KnowledgeBaseSettingsPanel /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

