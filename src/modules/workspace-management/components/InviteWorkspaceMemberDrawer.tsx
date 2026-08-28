import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2,
  Calendar,
  CircleCheck,
  Clock3,
  Loader2,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EnterpriseInfoCallout } from '@/components/layout/EnterpriseInfoCallout'
import { getSession } from '@/auth/authService'
import { ManageOperationalTeamsModal } from '@/components/workspace/ManageOperationalTeamsModal'
import { ManageParticipationScopesModal } from '@/components/workspace/ManageParticipationScopesModal'
import { fetchAllFolders } from '@/lib/api/folderApi'
import { fetchAllProjects, TECTONA_PROJECT_APP_ID } from '@/lib/api/projectApi'
import {
  createOperationalTeam,
  deleteOperationalTeam,
  fetchOperationalTeams,
  fetchParticipationScopes,
  TECTONA_WAC_APP_ID,
  updateOperationalTeam,
  updateParticipationScope,
} from '@/lib/api/workspaceAccessControlApi'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { mapWacOperationalTeamDto, type OperationalTeamOption } from '@/lib/workspaceOperationalTeams'
import {
  participationScopeAllowsLinkedPrograms,
  participationScopeAllowsLinkedProjects,
  participationScopeHint,
  normalizeParticipationScopeCode,
} from '@/lib/participationScopeRules'
import {
  filterCanonicalParticipationScopeOptions,
  mapWacParticipationScopeDto,
  type ParticipationScopeOption,
} from '@/lib/workspaceParticipationScopes'
import {
  buildInviteMemberActivityAudit,
  buildInviteMemberGovernancePosture,
  type InviteWorkspaceGovernanceSnapshot,
} from '@/modules/workspace-management/lib/inviteMemberGovernancePosture'
import {
  DIRECTORY_PICKER_LIST_ATTR,
  directoryPickerListOpen,
  focusDirectoryPickerOption,
  focusedFormFieldInDrawer,
  handleDirectoryPickerInputKeyDown,
  handleDirectoryPickerOptionKeyDown,
  isFocusMovingToDirectoryPickerList,
  retainFocusForDirectoryPicker,
} from '@/modules/workspace-management/lib/directoryPickerKeyboard'

export type WorkspaceRoleOption = { code: string; label: string }
type WorkspaceParticipationRole = string
type ParticipationDuration = 'Permanent' | 'Temporary' | ''

export type EmployeeDirectoryEntry = {
  id: string
  name: string
  email: string
  directoryId: string
  initials: string
  organizationalUnit: string
  manager: string
}

function employeeFromDirectoryExactMatch(
  query: string,
  employees: EmployeeDirectoryEntry[]
): EmployeeDirectoryEntry | null {
  const q = query.trim()
  if (!q) return null
  const lower = q.toLowerCase()
  const matches = employees.filter(
    (e) =>
      e.name.trim().toLowerCase() === lower
      || e.email.trim().toLowerCase() === lower
      || e.directoryId.trim().toLowerCase() === lower
  )
  return matches.length === 1 ? matches[0] : null
}

export type InviteWorkspaceMemberFormState = {
  employeeId: string | null
  workspaceIds: string[]
  workspaceRole: WorkspaceParticipationRole
  operationalTeams: string[]
  participationScope: string
  participationDuration: ParticipationDuration
  startDate: string
  endDate: string
  /** Folder ids from project-service (program grouping until dedicated program SoR). */
  linkedPrograms: string[]
  /** Project ids from project-service. */
  linkedProjects: string[]
  notifyEmail: boolean
  notifySlackTeams: boolean
  notifyGovernance: boolean
  notifyDelivery: boolean
}

/** Enable when invite flow saves channel preferences (notification integration). */
const INVITE_NOTIFICATION_PREFERENCES_ENABLED = false

const DEFAULT_FORM: InviteWorkspaceMemberFormState = {
  employeeId: null,
  workspaceIds: [],
  workspaceRole: '',
  operationalTeams: [],
  participationScope: '',
  participationDuration: '',
  startDate: '',
  endDate: '',
  linkedPrograms: [],
  linkedProjects: [],
  notifyEmail: false,
  notifySlackTeams: false,
  notifyGovernance: false,
  notifyDelivery: false,
}

function DrawerSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.12)] dark:border-slate-800/80 dark:bg-slate-950/50">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="mt-3 flex flex-col space-y-3">{children}</div>
    </section>
  )
}

function RequiredMark() {
  return <span className="text-red-500"> *</span>
}

function FieldLabel({
  htmlFor,
  required,
  children,
  className,
}: {
  htmlFor?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  const labelClassName = cn('text-xs font-medium text-muted-foreground', className)
  const content = (
    <>
      {children}
      {required ? <RequiredMark /> : null}
    </>
  )
  if (!htmlFor) {
    return <span className={labelClassName}>{content}</span>
  }
  return (
    <Label htmlFor={htmlFor} className={labelClassName}>
      {content}
    </Label>
  )
}

function ReadOnlyField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 text-sm text-foreground/90">{value || '—'}</div>
    </div>
  )
}

function GovernancePostureCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'info' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200/80 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
      : tone === 'info'
        ? 'border-sky-200/80 bg-sky-50/60 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100'
        : tone === 'warning'
          ? 'border-amber-200/80 bg-amber-50/60 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100'
          : 'border-slate-200/80 bg-slate-50/70 text-slate-900 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100'
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">{label}</p>
      <p className="mt-1 text-xs font-semibold leading-snug">{value}</p>
    </div>
  )
}

const SEARCHABLE_MULTI_SELECT_MAX_RESULTS = 50

export type SearchableMultiSelectOption = { value: string; label: string }

export type InviteWorkspaceOption = {
  id: string
  name: string
  /** Directory classification — Organization workspaces auto-nest invitees' personal WS. */
  type?: string
  governance: InviteWorkspaceGovernanceSnapshot
}

function SearchableMultiSelectField({
  label,
  options,
  selectedValues,
  onToggle,
  onRemove,
  disabled,
  placeholder = 'Search to add…',
  searchHint = 'Type to search and add one or more items.',
  emptySearchMessage = 'No matches for your search.',
  pickerActive = true,
  optionsLoading = false,
  catalogError = null,
  catalogEmptyMessage = 'No items available from the catalog.',
  required = false,
}: {
  label: string
  required?: boolean
  options: SearchableMultiSelectOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  onRemove: (value: string) => void
  disabled?: boolean
  placeholder?: string
  searchHint?: string
  emptySearchMessage?: string
  /** When false (e.g. drawer closed), clears search UI state. */
  pickerActive?: boolean
  optionsLoading?: boolean
  catalogError?: string | null
  catalogEmptyMessage?: string
}) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (pickerActive) return
    setQuery('')
    setPickerOpen(false)
  }, [pickerActive])

  const optionByValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])

  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map((value) => optionByValue.get(value))
        .filter((o): o is SearchableMultiSelectOption => Boolean(o)),
    [selectedValues, optionByValue]
  )

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, SEARCHABLE_MULTI_SELECT_MAX_RESULTS)
  }, [options, query])

  const handlePickerSelect = (value: string) => {
    onToggle(value)
    setQuery('')
    setPickerOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={inputId} required={required}>
        {label}
      </FieldLabel>

      {selectedOptions.length > 0 ? (
        <div className="max-h-24 overflow-y-auto rounded-xl border border-border/60 bg-muted/10 px-2 py-2">
          <div className="flex flex-wrap gap-1.5">
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200/80 bg-indigo-50/90 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100"
              >
                <span className="truncate">{opt.label}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(opt.value)}
                  className="rounded-full p-0.5 text-indigo-700/80 hover:bg-indigo-100/80 disabled:opacity-50 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                  aria-label={`Remove ${opt.label}`}
                >
                  <X className="h-3 w-3 shrink-0" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No items selected yet.</p>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={inputId}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPickerOpen(true)
          }}
          onFocus={() => setPickerOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setPickerOpen(false), 150)
          }}
          placeholder={placeholder}
          className="h-10 pl-9 text-sm"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{searchHint}</p>
      {catalogError ? (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">{catalogError}</p>
      ) : null}
      {!optionsLoading && !catalogError && options.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{catalogEmptyMessage}</p>
      ) : null}

      {pickerOpen && query.trim().length > 0 ? (
        <div className="max-h-44 overflow-y-auto rounded-xl border border-border/70 bg-background shadow-sm">
          {optionsLoading ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading catalog…
            </p>
          ) : filteredOptions.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">{emptySearchMessage}</p>
          ) : (
            filteredOptions.map((opt) => {
              const active = selectedValues.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  className="flex w-full items-center gap-2 border-t border-border/50 px-3 py-2.5 text-left first:border-t-0 hover:bg-muted/40 disabled:opacity-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickerSelect(opt.value)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{opt.label}</span>
                  {active ? <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : null}
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}

export type InviteWorkspaceMemberDrawerProps = {
  open: boolean
  onClose: () => void
  /** When set (e.g. from workspace directory context menu), pre-fills Assigned Workspace. */
  initialWorkspaceIds?: string[]
  workspaceName?: string
  workspaces?: InviteWorkspaceOption[]
  submitting?: boolean
  /** When set, replaces built-in mock employee directory (e.g. identity-lite users). */
  employees?: EmployeeDirectoryEntry[]
  /** RBAC roles returned by WAC for the selected Tectona workspace. */
  workspaceRoles?: WorkspaceRoleOption[]
  workspaceRolesLoading?: boolean
  onInvite?: (
    payload: InviteWorkspaceMemberFormState & {
      employee: EmployeeDirectoryEntry | null
      workspaceIds: string[]
      workspaceNames: string[]
      /** JIT provision when email is not in identity directory yet. */
      inviteByEmail?: { email: string; displayName: string }
    }
  ) => void
}

export function InviteWorkspaceMemberDrawer({
  open,
  onClose,
  initialWorkspaceIds,
  workspaceName = 'Enterprise Delivery Office',
  workspaces,
  submitting = false,
  employees,
  workspaceRoles = [],
  workspaceRolesLoading = false,
  onInvite,
}: InviteWorkspaceMemberDrawerProps) {
  const workspaceOptions = useMemo(() => workspaces ?? [], [workspaces])
  const [form, setForm] = useState<InviteWorkspaceMemberFormState>(DEFAULT_FORM)
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false)
  const [operationalTeamOptions, setOperationalTeamOptions] = useState<OperationalTeamOption[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamsMutating, setTeamsMutating] = useState(false)
  const [manageOperationalTeamsOpen, setManageOperationalTeamsOpen] = useState(false)
  const [participationScopeOptions, setParticipationScopeOptions] = useState<ParticipationScopeOption[]>([])
  const [scopesLoading, setScopesLoading] = useState(false)
  const [scopesMutating, setScopesMutating] = useState(false)
  const [manageParticipationScopesOpen, setManageParticipationScopesOpen] = useState(false)
  const [programSearchOptions, setProgramSearchOptions] = useState<SearchableMultiSelectOption[]>([])
  const [projectSearchOptions, setProjectSearchOptions] = useState<SearchableMultiSelectOption[]>([])
  const [deliveryCatalogLoading, setDeliveryCatalogLoading] = useState(false)
  const [deliveryCatalogError, setDeliveryCatalogError] = useState<string | null>(null)
  const inviteMemberDrawerRef = useRef<HTMLDivElement>(null)
  const employeeSearchRevertRef = useRef<{ employeeId: string | null; employeeQuery: string } | null>(null)
  const employeePickerSkipBlurRef = useRef(false)
  const employeeDirectory = useMemo(
    () => employees ?? [],
    [employees],
  )

  const reloadOperationalTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const res = await fetchOperationalTeams(TECTONA_WAC_APP_ID)
      setOperationalTeamOptions(res.items.map(mapWacOperationalTeamDto))
    } catch {
      setOperationalTeamOptions([])
    } finally {
      setTeamsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void reloadOperationalTeams()
  }, [open, reloadOperationalTeams])

  const reloadParticipationScopes = useCallback(async () => {
    setScopesLoading(true)
    try {
      const res = await fetchParticipationScopes(TECTONA_WAC_APP_ID)
      setParticipationScopeOptions(
        filterCanonicalParticipationScopeOptions(res.items.map(mapWacParticipationScopeDto))
      )
    } catch {
      setParticipationScopeOptions([])
    } finally {
      setScopesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void reloadParticipationScopes()
  }, [open, reloadParticipationScopes])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDeliveryCatalogLoading(true)
    setDeliveryCatalogError(null)
    void (async () => {
      try {
        const [projects, folders] = await Promise.all([
          fetchAllProjects({ app_id: TECTONA_PROJECT_APP_ID }),
          fetchAllFolders(),
        ])
        if (cancelled) return
        const activeProjects = projects.filter((p) => p.status_code === 'active')
        const projectOpts = activeProjects
          .map((p) => ({ value: p.id, label: p.name }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
        const programOpts = folders
          .map((f) => ({ value: f.id, label: f.name }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
        setProjectSearchOptions(projectOpts)
        setProgramSearchOptions(programOpts)
        setForm((prev) => ({
          ...prev,
          linkedPrograms: prev.linkedPrograms.filter((id) => programOpts.some((o) => o.value === id)),
          linkedProjects: prev.linkedProjects.filter((id) => projectOpts.some((o) => o.value === id)),
        }))
      } catch (e) {
        if (cancelled) return
        setProgramSearchOptions([])
        setProjectSearchOptions([])
        const raw = e instanceof Error ? e.message : 'Could not load programs and projects.'
        const msg =
          raw === 'Failed to fetch' || raw.toLowerCase().includes('network')
            ? 'Programs and projects could not be loaded. Check your connection and try again.'
            : 'Programs and projects could not be loaded. Try again in a moment.'
        setDeliveryCatalogError(msg)
      } finally {
        if (!cancelled) setDeliveryCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const wacActorId = () => getSession()?.user?.id

  const selectedEmployee = useMemo(
    () => employeeDirectory.find((e) => e.id === form.employeeId) ?? null,
    [employeeDirectory, form.employeeId]
  )

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase()
    if (!q) return employeeDirectory
    return employeeDirectory.filter(
      (e) =>
        e.name.toLowerCase().includes(q)
        || e.email.toLowerCase().includes(q)
        || e.directoryId.toLowerCase().includes(q)
    )
  }, [employeeDirectory, employeeQuery])

  const emailInviteCandidate = null

  const markEmployeePickerFocusMovingToList = useCallback(() => {
    employeePickerSkipBlurRef.current = true
  }, [])

  const shouldSkipEmployeePickerInputBlur = useCallback((relatedTarget: EventTarget | null) => {
    if (employeePickerSkipBlurRef.current) {
      employeePickerSkipBlurRef.current = false
      return true
    }
    return isFocusMovingToDirectoryPickerList(relatedTarget)
  }, [])

  const beginEmployeeSearchChange = useCallback((currentEmployee: EmployeeDirectoryEntry | null, query: string) => {
    employeeSearchRevertRef.current = {
      employeeId: currentEmployee?.id ?? null,
      employeeQuery: currentEmployee?.name ?? query,
    }
    setForm((prev) => ({ ...prev, employeeId: null }))
    setEmployeeQuery('')
    setEmployeePickerOpen(true)
  }, [])

  const cancelEmployeeSearch = useCallback(() => {
    employeePickerSkipBlurRef.current = true
    const revert = employeeSearchRevertRef.current
    if (revert) {
      setForm((prev) => ({ ...prev, employeeId: revert.employeeId }))
      setEmployeeQuery(revert.employeeQuery)
      employeeSearchRevertRef.current = null
    } else {
      setEmployeeQuery('')
    }
    setEmployeePickerOpen(false)
  }, [])

  const finishEmployeeSearchBlur = useCallback(() => {
    if (employeePickerSkipBlurRef.current) {
      employeePickerSkipBlurRef.current = false
      return
    }
    const matched = employeeFromDirectoryExactMatch(employeeQuery, employeeDirectory)
    if (matched) {
      setForm((prev) => ({ ...prev, employeeId: matched.id }))
      setEmployeeQuery(matched.name)
      employeeSearchRevertRef.current = null
      setEmployeePickerOpen(false)
      return
    }
    if (employeeQuery.trim()) {
      const revert = employeeSearchRevertRef.current
      if (revert) {
        setForm((prev) => ({ ...prev, employeeId: revert.employeeId }))
        setEmployeeQuery(revert.employeeQuery)
        employeeSearchRevertRef.current = null
      } else {
        setEmployeeQuery('')
      }
    }
    setEmployeePickerOpen(false)
  }, [employeeDirectory, employeeQuery])

  const openEmployeeSearchFocus = useCallback((currentEmployee: EmployeeDirectoryEntry | null) => {
    if (employeeSearchRevertRef.current === null) {
      employeeSearchRevertRef.current = {
        employeeId: currentEmployee?.id ?? null,
        employeeQuery: currentEmployee?.name ?? '',
      }
    }
  }, [])

  const session = getSession()

  const selectedWorkspaceGovernance = useMemo(
    () =>
      workspaceOptions
        .filter((w) => form.workspaceIds.includes(w.id))
        .map((w) => w.governance),
    [workspaceOptions, form.workspaceIds]
  )

  const governancePostureInput = useMemo(
    () => ({
      selectedWorkspaces: selectedWorkspaceGovernance,
      workspaceRole: form.workspaceRole,
      participationDuration: form.participationDuration,
      participationScopeCode: form.participationScope,
      participationScopeOptions,
      requestedByName: session?.user?.name ?? '',
    }),
    [
      selectedWorkspaceGovernance,
      form.workspaceRole,
      form.participationDuration,
      form.participationScope,
      participationScopeOptions,
      session?.user?.name,
    ]
  )

  const governancePostureCards = useMemo(
    () => buildInviteMemberGovernancePosture(governancePostureInput),
    [governancePostureInput]
  )

  const activityAudit = useMemo(
    () => buildInviteMemberActivityAudit(governancePostureInput),
    [governancePostureInput]
  )

  useEffect(() => {
    if (form.operationalTeams.length === 0) return
    const allowed = new Set(operationalTeamOptions.map((t) => t.value))
    const filtered = form.operationalTeams.filter((v) => allowed.has(v))
    if (filtered.length === form.operationalTeams.length) return
    setForm((prev) => ({ ...prev, operationalTeams: filtered }))
  }, [form.operationalTeams, operationalTeamOptions])

  useEffect(() => {
    if (!form.participationScope) return
    const normalized = normalizeParticipationScopeCode(form.participationScope)
    if (normalized !== form.participationScope) {
      setForm((prev) => ({ ...prev, participationScope: normalized }))
      return
    }
    if (participationScopeOptions.some((s) => s.value === form.participationScope)) return
    setForm((prev) => ({ ...prev, participationScope: '' }))
  }, [form.participationScope, participationScopeOptions])

  const deliveryAllowsPrograms = form.participationScope
    ? participationScopeAllowsLinkedPrograms(form.participationScope)
    : false
  const deliveryAllowsProjects = form.participationScope
    ? participationScopeAllowsLinkedProjects(form.participationScope)
    : false

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM)
    setEmployeeQuery('')
    setEmployeePickerOpen(false)
    employeeSearchRevertRef.current = null
    employeePickerSkipBlurRef.current = false
  }, [])

  const handleClose = useCallback(() => {
    if (submitting) return
    onClose()
    resetForm()
  }, [onClose, resetForm, submitting])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || submitting) return
      if (manageOperationalTeamsOpen || manageParticipationScopesOpen) return

      const drawer = inviteMemberDrawerRef.current
      const active = document.activeElement

      if (drawer && active instanceof HTMLElement && active.closest(`[${DIRECTORY_PICKER_LIST_ATTR}]`)) {
        e.preventDefault()
        e.stopPropagation()
        cancelEmployeeSearch()
        focusDirectoryPickerOption('invite-member-search')
        return
      }

      const focusedField = focusedFormFieldInDrawer(drawer)
      if (focusedField) {
        e.preventDefault()
        e.stopPropagation()
        if (focusedField.id === 'invite-member-search') {
          cancelEmployeeSearch()
        }
        focusedField.blur()
        return
      }

      handleClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    open,
    submitting,
    handleClose,
    manageOperationalTeamsOpen,
    manageParticipationScopesOpen,
    cancelEmployeeSearch,
  ])

  const selectedWorkspaces = useMemo(
    () => workspaceOptions.filter((w) => form.workspaceIds.includes(w.id)),
    [form.workspaceIds, workspaceOptions]
  )

  const resolvedWorkspaceNames = useMemo(() => {
    if (selectedWorkspaces.length > 0) return selectedWorkspaces.map((w) => w.name)
    return workspaceName ? [workspaceName] : []
  }, [selectedWorkspaces, workspaceName])

  useEffect(() => {
    if (!open) return
    setForm(DEFAULT_FORM)
    setEmployeeQuery('')
    setEmployeePickerOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const preset = (initialWorkspaceIds ?? []).filter((id) =>
      workspaceOptions.some((w) => w.id === id)
    )
    if (preset.length === 0) return
    setForm((prev) => ({ ...prev, workspaceIds: preset }))
  }, [open, initialWorkspaceIds, workspaceOptions])

  const buildPayload = () => {
    const workspaceIds =
      form.workspaceIds.length > 0
        ? form.workspaceIds
        : workspaceOptions.length > 0
          ? [workspaceOptions[0].id]
          : []
    const workspaceNames = workspaceIds
      .map((id) => workspaceOptions.find((w) => w.id === id)?.name)
      .filter((name): name is string => Boolean(name))
    return {
      ...form,
      workspaceIds,
      employee: selectedEmployee,
      workspaceNames: workspaceNames.length > 0 ? workspaceNames : resolvedWorkspaceNames,
      inviteByEmail: emailInviteCandidate ?? undefined,
    }
  }

  const workspaceSearchOptions = useMemo(
    () => workspaceOptions.map((w) => ({ value: w.id, label: w.name })),
    [workspaceOptions]
  )

  const toggleMultiValue = (key: 'workspaceIds' | 'linkedPrograms' | 'linkedProjects', value: string) => {
    setForm((prev) => {
      const list = prev[key]
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...prev, [key]: next }
    })
  }

  const removeMultiValue = (key: 'workspaceIds' | 'linkedPrograms' | 'linkedProjects', value: string) => {
    setForm((prev) => ({ ...prev, [key]: prev[key].filter((v) => v !== value) }))
  }

  const selectEmployee = (employee: EmployeeDirectoryEntry) => {
    setForm((prev) => ({ ...prev, employeeId: employee.id }))
    setEmployeeQuery(employee.name)
    employeeSearchRevertRef.current = null
    setEmployeePickerOpen(false)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-0 z-[1050] bg-transparent transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={handleClose}
        aria-hidden={!open}
      />
      <div
        ref={inviteMemberDrawerRef}
        className={cn(
          'fixed inset-y-0 right-0 z-[1100] flex w-[min(100%,580px)] max-w-[92vw] flex-col transform border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl transition-all duration-300',
          open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
        )}
        style={{
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-workspace-member-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
          <div className="pr-3">
            <h2 id="invite-workspace-member-title" className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <UserPlus className="h-5 w-5 text-primary" aria-hidden />
              Invite Workspace Member
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Add operational participants into this governed workspace and define collaboration scope.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close invite workspace member drawer"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-hide px-5 py-5">
            <EnterpriseInfoCallout title="Separation of concerns">
              This workflow manages workspace participation and operational collaboration scope. Enterprise authorization
              policies and reusable permission models are managed separately in{' '}
              <a
                href="/security-access-control"
                className="font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-200"
              >
                Security &amp; Access Control
              </a>
              .
            </EnterpriseInfoCallout>

            <DrawerSectionCard title="Member Identity">
              <div className="order-2 space-y-1.5">
                {selectedEmployee ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    Search organization member
                    <RequiredMark />
                  </span>
                ) : (
                <FieldLabel htmlFor="invite-member-search" required>
                  Search organization member
                </FieldLabel>
                )}
                {selectedEmployee ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/15 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200/60 dark:text-indigo-100"
                      aria-hidden
                    >
                      {selectedEmployee.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{selectedEmployee.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{selectedEmployee.email}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{selectedEmployee.directoryId}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      disabled={submitting}
                      onClick={() => beginEmployeeSearchChange(selectedEmployee, employeeQuery)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="invite-member-search"
                        value={employeeQuery}
                        onChange={(e) => {
                          setEmployeeQuery(e.target.value)
                          setEmployeePickerOpen(true)
                        }}
                        onFocus={() => {
                          setEmployeePickerOpen(true)
                          openEmployeeSearchFocus(selectedEmployee)
                        }}
                        onBlur={(e) => {
                          if (shouldSkipEmployeePickerInputBlur(e.relatedTarget)) return
                          window.setTimeout(() => finishEmployeeSearchBlur(), 0)
                        }}
                        onKeyDown={(e) => {
                          handleDirectoryPickerInputKeyDown(e, {
                            listOpen: directoryPickerListOpen(
                              !!form.employeeId,
                              employeeQuery,
                              filteredEmployees.length
                            ),
                            firstOptionId: `invite-member-employee-opt-${filteredEmployees[0]?.id ?? ''}`,
                            onBeforeFocusList: markEmployeePickerFocusMovingToList,
                            onEnter: () => {
                              const matched = employeeFromDirectoryExactMatch(employeeQuery, employeeDirectory)
                              if (matched) selectEmployee(matched)
                            },
                          })
                        }}
                        aria-autocomplete="list"
                        aria-controls={
                          directoryPickerListOpen(!!form.employeeId, employeeQuery, filteredEmployees.length)
                            ? 'invite-member-employee-listbox'
                            : undefined
                        }
                        aria-expanded={directoryPickerListOpen(
                          !!form.employeeId,
                          employeeQuery,
                          filteredEmployees.length
                        )}
                        placeholder="Search organization member name, email, or directory ID"
                        className="h-10 pl-9 text-sm"
                        disabled={submitting}
                        autoComplete="off"
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Only active organization members who are not already in this workspace are listed.
                    </p>
                    {employeePickerOpen && employeeQuery.trim().length > 0 ? (
                      <div
                        id="invite-member-employee-listbox"
                        role="listbox"
                        {...{ [DIRECTORY_PICKER_LIST_ATTR]: '' }}
                        className="max-h-44 overflow-y-auto rounded-xl border border-border/70 bg-background shadow-sm"
                      >
                        {filteredEmployees.length === 0 ? (
                          emailInviteCandidate ? (
                            <div className="px-3 py-2.5 text-xs text-muted-foreground">
                              <p className="font-medium text-foreground">Invite new user</p>
                              <p className="mt-1">
                                {emailInviteCandidate.displayName} ({emailInviteCandidate.email}) will be created in identity-lite
                                and activated once the membership is saved.
                              </p>
                            </div>
                          ) : (
                            <p className="px-3 py-2.5 text-xs text-muted-foreground">No employees match your search.</p>
                          )
                        ) : (
                          filteredEmployees.map((employee, employeeIndex) => {
                            const optionId = `invite-member-employee-opt-${employee.id}`
                            const optionIds = filteredEmployees.map((e) => `invite-member-employee-opt-${e.id}`)
                            const selectRow = () => selectEmployee(employee)
                            return (
                            <button
                              key={employee.id}
                              id={optionId}
                              type="button"
                              role="option"
                              tabIndex={0}
                              className="flex w-full items-center gap-3 border-t border-border/50 px-3 py-2.5 text-left first:border-t-0 hover:bg-muted/40 focus:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                              onMouseDown={retainFocusForDirectoryPicker}
                              onKeyDown={(e) =>
                                handleDirectoryPickerOptionKeyDown(e, {
                                  inputId: 'invite-member-search',
                                  optionIds,
                                  index: employeeIndex,
                                  onSelect: selectRow,
                                })
                              }
                              onClick={selectRow}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {employee.initials}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{employee.name}</span>
                                <span className="block truncate text-[11px] text-muted-foreground">{employee.email}</span>
                              </span>
                              {form.employeeId === employee.id ? (
                                <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                              ) : null}
                            </button>
                            )
                          })
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <ReadOnlyField className="order-3" label="Organizational Unit" value={selectedEmployee?.organizationalUnit ?? ''} />
              <ReadOnlyField className="order-3" label="Manager" value={selectedEmployee?.manager ?? ''} />
            </DrawerSectionCard>

            <DrawerSectionCard title="Workspace Participation">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="invite-workspace-role" required>
                  Workspace role
                </FieldLabel>
                <Select
                  id="invite-workspace-role"
                  value={form.workspaceRole}
                  onChange={(e) => {
                    const workspaceRole = e.target.value as WorkspaceParticipationRole
                    setForm((prev) => {
                      if (!workspaceRole) {
                        return { ...prev, workspaceRole: '' }
                      }
                      return {
                        ...prev,
                        workspaceRole,
                      }
                    })
                  }}
                  disabled={submitting || workspaceRolesLoading || workspaceRoles.length === 0}
                  className="h-10 w-full text-sm"
                >
                  <option value="">Select workspace role</option>
                  {workspaceRolesLoading ? <option value="">Loading RBAC roles…</option> : null}
                  {!workspaceRolesLoading && workspaceRoles.length === 0 ? <option value="">No RBAC roles available</option> : null}
                  {workspaceRoles.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.label}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Roles are provided by Tectona RBAC. Participation scope controls operational coverage separately.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="invite-operational-team" required>
                    Operational team
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => setManageOperationalTeamsOpen(true)}
                    disabled={submitting}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Manage
                  </button>
                </div>
                <Select
                  id="invite-operational-team"
                  multiple
                  value={form.operationalTeams}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value).filter(Boolean)
                    setForm((prev) => ({ ...prev, operationalTeams: selected }))
                  }}
                  disabled={submitting || teamsLoading}
                  className="h-32 w-full text-sm"
                >
                  {teamsLoading ? <option disabled>Loading teams…</option> : null}
                  {operationalTeamOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="invite-participation-scope" required>
                    Participation scope
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => setManageParticipationScopesOpen(true)}
                    disabled={submitting}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Manage
                  </button>
                </div>
                <Select
                  id="invite-participation-scope"
                  value={form.participationScope}
                  onChange={(e) => {
                    const nextScope = e.target.value
                    setForm((prev) => ({
                      ...prev,
                      participationScope: nextScope,
                      linkedPrograms:
                        nextScope && participationScopeAllowsLinkedPrograms(nextScope)
                          ? prev.linkedPrograms
                          : [],
                      linkedProjects:
                        nextScope && participationScopeAllowsLinkedProjects(nextScope)
                          ? prev.linkedProjects
                          : [],
                    }))
                  }}
                  disabled={submitting || scopesLoading}
                  className="h-10 w-full text-sm"
                >
                  {scopesLoading ? (
                    <option value="">Loading scopes…</option>
                  ) : (
                    <option value="">Select participation scope</option>
                  )}
                  {participationScopeOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {form.participationScope
                    ? participationScopeHint(form.participationScope)
                    : 'Select how this member participates across project, program, and portfolio in assigned workspaces.'}
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel required>Participation duration</FieldLabel>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Participation duration"
                >
                  {(['Permanent', 'Temporary'] as const).map((duration) => {
                    const active = form.participationDuration === duration
                    return (
                      <button
                        key={duration}
                        type="button"
                        disabled={submitting}
                        onClick={() => setForm((prev) => ({ ...prev, participationDuration: duration }))}
                        className={cn(
                          'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                          active
                            ? 'border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                        )}
                      >
                        {duration}
                      </button>
                    )
                  })}
                </div>
                {!form.participationDuration ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">Select participation duration.</p>
                ) : null}
                {form.participationDuration === 'Temporary' ? (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="invite-start-date" required>
                        Start date
                      </FieldLabel>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                          id="invite-start-date"
                          type="date"
                          value={form.startDate}
                          onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                          disabled={submitting}
                          className="h-10 pl-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="invite-end-date" required>
                        End date
                      </FieldLabel>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                          id="invite-end-date"
                          type="date"
                          value={form.endDate}
                          onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                          disabled={submitting}
                          className="h-10 pl-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </DrawerSectionCard>

            <DrawerSectionCard title="Delivery Context">
              {workspaceOptions.length > 0 ? (
                <SearchableMultiSelectField
                  label="Assigned workspace"
                  required
                  options={workspaceSearchOptions}
                  selectedValues={form.workspaceIds}
                  onToggle={(v) => toggleMultiValue('workspaceIds', v)}
                  onRemove={(v) => removeMultiValue('workspaceIds', v)}
                  disabled={submitting}
                  pickerActive={open}
                  placeholder="Search workspace name…"
                  searchHint="Search to assign one or more workspaces. Remove selections with ×."
                />
              ) : (
                <div className="space-y-1.5">
                  <FieldLabel required>Assigned workspace</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border-slate-200 bg-slate-50/90 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/60"
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                      <span className="truncate">{resolvedWorkspaceNames.join(', ')}</span>
                    </Badge>
                  </div>
                </div>
              )}

              <SearchableMultiSelectField
                label="Linked programs (optional)"
                options={programSearchOptions}
                selectedValues={form.linkedPrograms}
                onToggle={(v) => toggleMultiValue('linkedPrograms', v)}
                onRemove={(v) => removeMultiValue('linkedPrograms', v)}
                disabled={submitting || deliveryCatalogLoading || !deliveryAllowsPrograms}
                pickerActive={open}
                optionsLoading={deliveryCatalogLoading}
                catalogError={deliveryCatalogError}
                placeholder="Search program name…"
                searchHint={
                  deliveryAllowsPrograms
                    ? 'Search to link one or more programs. Remove selections with ×.'
                    : 'Not applicable for the selected participation scope.'
                }
                catalogEmptyMessage="No programs are available to link yet."
                emptySearchMessage="No programs match your search."
              />
              <SearchableMultiSelectField
                label="Linked projects (optional)"
                options={projectSearchOptions}
                selectedValues={form.linkedProjects}
                onToggle={(v) => toggleMultiValue('linkedProjects', v)}
                onRemove={(v) => removeMultiValue('linkedProjects', v)}
                disabled={submitting || deliveryCatalogLoading || !deliveryAllowsProjects}
                pickerActive={open}
                optionsLoading={deliveryCatalogLoading}
                catalogError={deliveryCatalogError}
                placeholder="Search project name…"
                searchHint={
                  deliveryAllowsProjects
                    ? 'Search to link one or more projects. Remove selections with ×.'
                    : 'Not applicable for the selected participation scope.'
                }
                catalogEmptyMessage="No active projects are available to link yet."
                emptySearchMessage="No projects match your search."
              />

              <div className="space-y-2">
                <FieldLabel>Notification preference (optional)</FieldLabel>
                <div
                  className={cn(
                    'space-y-2 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5',
                    !INVITE_NOTIFICATION_PREFERENCES_ENABLED && 'opacity-60'
                  )}
                  role="group"
                  aria-label="Notification preference"
                  aria-disabled={!INVITE_NOTIFICATION_PREFERENCES_ENABLED}
                >
                  {(
                    [
                      { key: 'notifyEmail' as const, label: 'Email notification' },
                      { key: 'notifySlackTeams' as const, label: 'Slack / Teams notification' },
                      { key: 'notifyGovernance' as const, label: 'Governance alerts' },
                      { key: 'notifyDelivery' as const, label: 'Delivery reminders' },
                    ] as const
                  ).map(({ key, label }) => (
                    <label
                      key={key}
                      className={cn(
                        'flex items-center gap-2.5 text-sm text-foreground/90',
                        INVITE_NOTIFICATION_PREFERENCES_ENABLED ? 'cursor-pointer' : 'cursor-not-allowed'
                      )}
                    >
                      <input
                        type="checkbox"
                        id={`invite-notify-${key}`}
                        name={`invite-notify-${key}`}
                        className="h-3.5 w-3.5 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed"
                        checked={form[key]}
                        disabled={submitting || !INVITE_NOTIFICATION_PREFERENCES_ENABLED}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <span className="text-[13px]">{label}</span>
                    </label>
                  ))}
                </div>
                {!INVITE_NOTIFICATION_PREFERENCES_ENABLED ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Not available yet — notification channels will apply after your organization connects email and
                    collaboration tools for workspace invitations.
                  </p>
                ) : null}
              </div>
            </DrawerSectionCard>

            <DrawerSectionCard title="Governance Posture">
              <div className="grid grid-cols-2 gap-2">
                {governancePostureCards.map((card) => (
                  <GovernancePostureCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    tone={card.tone}
                  />
                ))}
              </div>
            </DrawerSectionCard>

            <section className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Activity &amp; Audit
              </div>
              <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                {(
                  [
                    ['Invitation source', activityAudit.invitationSource],
                    ['Requested by', activityAudit.requestedBy],
                    ['Approval requirement', activityAudit.approvalRequirement],
                    ['Last policy review', activityAudit.lastPolicySync],
                  ] as const
                ).map(([term, detail]) => (
                  <div key={term}>
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock3 className="h-3 w-3" aria-hidden />
                Participation changes are traceable in workspace activity streams.
              </p>
            </section>
          </div>

          <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
            <Button
              type="button"
              className={cn(
                enterpriseCyanGradientActionButtonClass(),
                'w-full min-h-11 justify-center gap-2 rounded-lg sm:min-h-10'
              )}
              disabled={
                submitting ||
                (!selectedEmployee && !emailInviteCandidate) ||
                !form.workspaceRole ||
                form.operationalTeams.length === 0 ||
                !form.participationScope ||
                !form.participationDuration ||
                (form.participationDuration === 'Temporary' && (!form.startDate || !form.endDate)) ||
                (workspaceOptions.length > 0 && form.workspaceIds.length === 0)
              }
              onClick={() => onInvite?.(buildPayload())}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              )}
              Invite Member
            </Button>
          </div>
        </div>
      </div>

      <ManageOperationalTeamsModal
        open={manageOperationalTeamsOpen}
        onClose={() => setManageOperationalTeamsOpen(false)}
        options={operationalTeamOptions}
        selectedValue={form.operationalTeams[0] ?? ''}
        onSelectedValueChange={(value) =>
          setForm((prev) => ({
            ...prev,
            operationalTeams: value ? Array.from(new Set([value, ...prev.operationalTeams])) : prev.operationalTeams,
          }))
        }
        disabled={submitting}
        saving={teamsMutating}
        onCreateTeam={async (displayName) => {
          setTeamsMutating(true)
          try {
            await createOperationalTeam(TECTONA_WAC_APP_ID, displayName, { actorId: wacActorId() })
            await reloadOperationalTeams()
          } finally {
            setTeamsMutating(false)
          }
        }}
        onUpdateTeam={async (teamId, displayName) => {
          setTeamsMutating(true)
          try {
            await updateOperationalTeam(TECTONA_WAC_APP_ID, teamId, displayName, { actorId: wacActorId() })
            await reloadOperationalTeams()
          } finally {
            setTeamsMutating(false)
          }
        }}
        onDeleteTeam={async (teamId) => {
          setTeamsMutating(true)
          try {
            await deleteOperationalTeam(TECTONA_WAC_APP_ID, teamId, { actorId: wacActorId() })
            await reloadOperationalTeams()
          } finally {
            setTeamsMutating(false)
          }
        }}
      />

      <ManageParticipationScopesModal
        open={manageParticipationScopesOpen}
        onClose={() => setManageParticipationScopesOpen(false)}
        options={participationScopeOptions}
        disabled={submitting}
        saving={scopesMutating}
        onUpdateScope={async (scopeId, displayName) => {
          setScopesMutating(true)
          try {
            await updateParticipationScope(TECTONA_WAC_APP_ID, scopeId, { display_name: displayName }, { actorId: wacActorId() })
            await reloadParticipationScopes()
          } finally {
            setScopesMutating(false)
          }
        }}
      />
    </>,
    document.body
  )
}
