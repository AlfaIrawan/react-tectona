import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Calendar, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { EnterpriseInfoCallout } from '@/components/layout/EnterpriseInfoCallout'
import { ManageOperationalTeamsModal } from '@/components/workspace/ManageOperationalTeamsModal'
import { ManageParticipationScopesModal } from '@/components/workspace/ManageParticipationScopesModal'
import { getSession } from '@/auth/authService'
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
import { participationScopeHint, normalizeParticipationScopeCode } from '@/lib/participationScopeRules'
import {
  DEFAULT_OPERATIONAL_TEAM_VALUE,
  mapWacOperationalTeamDto,
  type OperationalTeamOption,
} from '@/lib/workspaceOperationalTeams'
import {
  filterCanonicalParticipationScopeOptions,
  mapWacParticipationScopeDto,
  type ParticipationScopeOption,
} from '@/lib/workspaceParticipationScopes'

const WORKSPACE_ROLES = ['Admin', 'Manager', 'Member', 'Viewer'] as const
type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]
type ParticipationDuration = 'Permanent' | 'Temporary' | ''

export type EditMembershipTarget = {
  subjectId: string
  name: string
  team: string
  memberships: Array<{
    membershipId: string
    workspaceId: string
    workspaceName: string
    role: WorkspaceRole
    scopeCode: string
    operationalTeamCode: string
    participationDuration: ParticipationDuration
    participationStartDate: string
    participationEndDate: string
    version: number
  }>
}

export type EditWorkspaceMembershipSavePayload = {
  membershipId: string
  workspaceId: string
  workspaceName: string
  workspaceRole: WorkspaceRole
  participationScope: string
  operationalTeamCode: string
  participationDuration: ParticipationDuration
  participationStartDate: string
  participationEndDate: string
  version: number
}

export type EditWorkspaceMembershipDrawerProps = {
  open: boolean
  onClose: () => void
  member: EditMembershipTarget | null
  submitting?: boolean
  onSave?: (payload: EditWorkspaceMembershipSavePayload) => void
}

function DrawerSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.12)] dark:border-slate-800/80 dark:bg-slate-950/50">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </Label>
  )
}

function applyMembershipToForm(ref: EditMembershipTarget['memberships'][number]) {
  return {
    workspaceRole: ref.role,
    participationScope: normalizeParticipationScopeCode(ref.scopeCode),
    operationalTeam: ref.operationalTeamCode || DEFAULT_OPERATIONAL_TEAM_VALUE,
    participationDuration: ref.participationDuration || 'Permanent',
    startDate: ref.participationStartDate,
    endDate: ref.participationEndDate,
  }
}

export function EditWorkspaceMembershipDrawer({
  open,
  onClose,
  member,
  submitting = false,
  onSave,
}: EditWorkspaceMembershipDrawerProps) {
  const [activeMembershipId, setActiveMembershipId] = useState('')
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | ''>('')
  const [participationScope, setParticipationScope] = useState('')
  const [operationalTeam, setOperationalTeam] = useState('')
  const [participationDuration, setParticipationDuration] = useState<ParticipationDuration>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [operationalTeamOptions, setOperationalTeamOptions] = useState<OperationalTeamOption[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamsMutating, setTeamsMutating] = useState(false)
  const [manageOperationalTeamsOpen, setManageOperationalTeamsOpen] = useState(false)
  const [participationScopeOptions, setParticipationScopeOptions] = useState<ParticipationScopeOption[]>([])
  const [scopesLoading, setScopesLoading] = useState(false)
  const [scopesMutating, setScopesMutating] = useState(false)
  const [manageParticipationScopesOpen, setManageParticipationScopesOpen] = useState(false)

  const activeMembership = useMemo(
    () => member?.memberships.find((m) => m.membershipId === activeMembershipId) ?? member?.memberships[0] ?? null,
    [activeMembershipId, member]
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
    void reloadOperationalTeams()
    void reloadParticipationScopes()
  }, [open, reloadOperationalTeams, reloadParticipationScopes])

  useEffect(() => {
    if (!open || !member?.memberships[0]) return
    const first = member.memberships[0]
    setActiveMembershipId(first.membershipId)
    const next = applyMembershipToForm(first)
    setWorkspaceRole(next.workspaceRole)
    setParticipationScope(next.participationScope)
    setOperationalTeam(next.operationalTeam)
    setParticipationDuration(next.participationDuration)
    setStartDate(next.startDate)
    setEndDate(next.endDate)
  }, [open, member])

  useEffect(() => {
    if (!activeMembership) return
    const next = applyMembershipToForm(activeMembership)
    setWorkspaceRole(next.workspaceRole)
    setParticipationScope(next.participationScope)
    setOperationalTeam(next.operationalTeam)
    setParticipationDuration(next.participationDuration)
    setStartDate(next.startDate)
    setEndDate(next.endDate)
  }, [activeMembership])

  useEffect(() => {
    if (!operationalTeam) return
    if (operationalTeamOptions.some((t) => t.value === operationalTeam)) return
    setOperationalTeam('')
  }, [operationalTeam, operationalTeamOptions])

  const handleClose = useCallback(() => {
    if (submitting) return
    onClose()
  }, [onClose, submitting])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || submitting) return
      if (manageOperationalTeamsOpen || manageParticipationScopesOpen) return
      handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, handleClose, manageOperationalTeamsOpen, manageParticipationScopesOpen])

  const wacActorId = () => getSession()?.user?.id

  const canSave = Boolean(
    activeMembership
    && workspaceRole
    && participationScope
    && operationalTeam
    && participationDuration
    && (participationDuration !== 'Temporary' || (startDate && endDate))
  )

  const handleSave = () => {
    if (!activeMembership || !canSave || !workspaceRole || !participationDuration) return
    onSave?.({
      membershipId: activeMembership.membershipId,
      workspaceId: activeMembership.workspaceId,
      workspaceName: activeMembership.workspaceName,
      workspaceRole,
      participationScope,
      operationalTeamCode: operationalTeam,
      participationDuration,
      participationStartDate: participationDuration === 'Temporary' ? startDate : '',
      participationEndDate: participationDuration === 'Temporary' ? endDate : '',
      version: activeMembership.version,
    })
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={handleClose}
        aria-hidden={!open}
      />
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[1100] flex w-[min(100%,580px)] max-w-[92vw] flex-col transform border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl transition-all duration-300',
          open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
        )}
        style={{
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-workspace-membership-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
          <div className="pr-3">
            <h2
              id="edit-workspace-membership-title"
              className="flex items-center gap-2 text-xl font-semibold text-foreground"
            >
              <Pencil className="h-5 w-5 text-primary" aria-hidden />
              Edit Workspace Membership
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Update workspace role, operational team, participation scope, and duration for an existing member.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close edit workspace membership drawer"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-hide px-5 py-5">
            <EnterpriseInfoCallout title="Separation of concerns">
              This workflow updates workspace participation only. Platform authorization remains in Security &amp;
              Access Control.
            </EnterpriseInfoCallout>

            {member ? (
              <>
                <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Member</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{member.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{member.team}</p>
                </div>

                <DrawerSectionCard title="Workspace Participation">
                  <div className="space-y-1.5">
                    <FieldLabel required>Assigned workspace</FieldLabel>
                    <div className="max-h-28 overflow-y-auto rounded-xl border border-border/60 bg-muted/10 px-2 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {member.memberships.map((ref) => {
                          const isActive = ref.membershipId === activeMembershipId
                          return (
                            <button
                              key={ref.membershipId}
                              type="button"
                              disabled={submitting}
                              onClick={() => setActiveMembershipId(ref.membershipId)}
                              className={cn(
                                'inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-2.5 text-[11px] font-medium transition-colors',
                                isActive
                                  ? 'border-indigo-300/90 bg-indigo-100/90 text-indigo-950 ring-2 ring-indigo-400/45 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-100'
                                  : 'border-indigo-200/80 bg-indigo-50/90 text-indigo-900 hover:bg-indigo-100/80 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100'
                              )}
                              aria-pressed={isActive}
                            >
                              <Building2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                              <span className="truncate">{ref.workspaceName}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {member.memberships.length > 1 ? (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Click a workspace chip to edit role, team, scope, and duration for that membership.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="edit-membership-role" required>
                      Workspace role
                    </FieldLabel>
                    <Select
                      id="edit-membership-role"
                      value={workspaceRole}
                      onChange={(e) => setWorkspaceRole(e.target.value as WorkspaceRole)}
                      disabled={submitting || !activeMembership}
                      className="h-10 w-full text-sm"
                    >
                      <option value="">Select workspace role</option>
                      {WORKSPACE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Workspace roles define operational participation only.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel htmlFor="edit-membership-team" required>
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
                      id="edit-membership-team"
                      value={operationalTeam}
                      onChange={(e) => setOperationalTeam(e.target.value)}
                      disabled={submitting || teamsLoading || !activeMembership}
                      className="h-10 w-full text-sm"
                    >
                      {teamsLoading ? (
                        <option value="">Loading teams…</option>
                      ) : (
                        <option value="">Select operational team</option>
                      )}
                      {operationalTeamOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel htmlFor="edit-membership-scope" required>
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
                      id="edit-membership-scope"
                      value={participationScope}
                      onChange={(e) => setParticipationScope(e.target.value)}
                      disabled={submitting || scopesLoading || !activeMembership}
                      className="h-10 w-full text-sm"
                    >
                      {scopesLoading ? (
                        <option value="">Loading scopes…</option>
                      ) : (
                        <option value="">Select participation scope</option>
                      )}
                      {participationScopeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {participationScope
                        ? participationScopeHint(participationScope)
                        : 'Select how this member participates across project, program, and portfolio in assigned workspaces.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel required>Participation duration</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {(['Permanent', 'Temporary'] as const).map((duration) => {
                        const active = participationDuration === duration
                        return (
                          <button
                            key={duration}
                            type="button"
                            disabled={submitting}
                            onClick={() => setParticipationDuration(duration)}
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
                    {!participationDuration ? (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">Select participation duration.</p>
                    ) : null}
                    {participationDuration === 'Temporary' ? (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <FieldLabel htmlFor="edit-start-date" required>
                            Start date
                          </FieldLabel>
                          <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <Input
                              id="edit-start-date"
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              disabled={submitting}
                              className="h-10 pl-9 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel htmlFor="edit-end-date" required>
                            End date
                          </FieldLabel>
                          <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <Input
                              id="edit-end-date"
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              disabled={submitting}
                              className="h-10 pl-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </DrawerSectionCard>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a member from the Workspace Members table.</p>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
            <Button
              type="button"
              className={cn(
                enterpriseCyanGradientActionButtonClass(),
                'w-full min-h-11 justify-center gap-2 rounded-lg sm:min-h-10'
              )}
              disabled={submitting || !canSave}
              onClick={handleSave}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Pencil className="h-4 w-4 shrink-0" aria-hidden />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <ManageOperationalTeamsModal
        open={manageOperationalTeamsOpen}
        onClose={() => setManageOperationalTeamsOpen(false)}
        options={operationalTeamOptions}
        selectedValue={operationalTeam}
        onSelectedValueChange={setOperationalTeam}
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
        selectedValue={participationScope}
        onSelectedValueChange={setParticipationScope}
        disabled={submitting}
        saving={scopesMutating}
        onUpdateScope={async (scopeId, displayName) => {
          setScopesMutating(true)
          try {
            await updateParticipationScope(TECTONA_WAC_APP_ID, scopeId, displayName, { actorId: wacActorId() })
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
