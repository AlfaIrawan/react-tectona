import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, Loader2, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { fetchWorkspaceMembers, TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'
import {
  assignWorkflowApprovalRole,
  unassignWorkflowApprovalRole,
  type WorkflowApprovalRoleDto,
} from '@/lib/api/workflowAutomationApi'

export type ApprovalTargetMember = { id: string; name: string; email: string }

type Props = {
  /** Null while "all workspaces" is selected — holders are per workspace. */
  workspaceId: string | null
  members: ApprovalTargetMember[]
  roleCode: string
  teamCode: string
  onChange: (patch: { approverRole?: string; approverTeam?: string }) => void
  /** Owned by the canvas so one fetch serves both this control and graph validation. */
  roles: WorkflowApprovalRoleDto[]
  rolesState: 'loading' | 'ready' | 'error'
  onRolesChanged: () => void
}

const NEW_ROLE = '__new__'

const LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500'

/** The approval gate's target: a role (one accountability) or an operational team
    (a group of people). Both resolve to people at run time; neither names a person,
    so the flow survives someone changing jobs. */
export function ApprovalTargetField({
  workspaceId, members, roleCode, teamCode, onChange, roles, rolesState, onRolesChanged,
}: Props) {
  const { addToast } = useToast()
  const [teams, setTeams] = useState<Array<{ code: string; label: string }>>([])
  const [adding, setAdding] = useState(false)
  const [newHolder, setNewHolder] = useState('')
  const [newRole, setNewRole] = useState('')
  const [busy, setBusy] = useState(false)

  // Explicit, not derived from teamCode: switching to Tim clears the role first, so a
  // derived mode would snap straight back to Peran before a team is ever picked.
  // The canvas keys this component by node id, so selecting another node re-seeds it.
  const [mode, setMode] = useState<'role' | 'team'>(teamCode.trim() ? 'team' : 'role')

  // Teams come from WAC, where a membership may belong to several of them.
  useEffect(() => {
    if (!workspaceId) {
      setTeams([])
      return
    }
    let cancelled = false
    fetchWorkspaceMembers(TECTONA_WAC_APP_ID, workspaceId)
      .then((response) => {
        if (cancelled) return
        const seen = new Map<string, string>()
        ;(response.items ?? []).forEach((member) => {
          const list = member.operational_teams ?? []
          list.forEach((team) => {
            if (team?.team_code) seen.set(team.team_code, team.display_name || team.team_code)
          })
          if (member.operational_team_code && !seen.has(member.operational_team_code)) {
            seen.set(member.operational_team_code, member.operational_team_display_name || member.operational_team_code)
          }
        })
        setTeams([...seen.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label)))
      })
      .catch(() => {
        if (!cancelled) setTeams([])
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const memberName = useCallback(
    (id: string) => members.find((member) => member.id === id)?.name ?? id,
    [members],
  )

  const roleCodes = useMemo(
    () => [...new Set(roles.map((role) => role.role_code))].sort((a, b) => a.localeCompare(b)),
    [roles],
  )

  const holders = useMemo(
    () => roles.filter((role) => role.role_code === roleCode.trim()),
    [roleCode, roles],
  )

  const assignable = useMemo(
    () => members.filter((member) => !holders.some((holder) => holder.subject_id === member.id)),
    [holders, members],
  )

  const addHolder = useCallback(() => {
    if (!workspaceId || !roleCode.trim() || !newHolder) return
    setBusy(true)
    assignWorkflowApprovalRole({ workspace_id: workspaceId, role_code: roleCode.trim(), subject_id: newHolder })
      .then(() => {
        setNewHolder('')
        setAdding(false)
        onRolesChanged()
      })
      .catch((error) =>
        addToast({
          variant: 'error',
          title: 'Gagal menambah pemegang peran',
          description: error instanceof Error ? error.message : 'Coba lagi.',
        }),
      )
      .finally(() => setBusy(false))
  }, [addToast, newHolder, onRolesChanged, roleCode, workspaceId])

  const removeHolder = useCallback(
    (holder: WorkflowApprovalRoleDto) => {
      unassignWorkflowApprovalRole({
        workspace_id: holder.workspace_id,
        role_code: holder.role_code,
        subject_id: holder.subject_id,
      })
        .then(onRolesChanged)
        .catch((error) =>
          addToast({
            variant: 'error',
            title: 'Gagal melepas pemegang peran',
            description: error instanceof Error ? error.message : 'Coba lagi.',
          }),
        )
    },
    [addToast, onRolesChanged],
  )

  return (
    <div className="space-y-2">
      <label className={LABEL_CLASS}>Approver</label>

      {/* Role or team — a role is an accountability, a team is a group of people. */}
      <div className="flex rounded-lg border border-slate-200 p-0.5 text-[11px]">
        {(['role', 'team'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option)
              onChange(option === 'role' ? { approverTeam: '' } : { approverRole: '' })
            }}
            className={cn(
              'flex-1 rounded-md py-1 font-medium transition',
              mode === option ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50',
            )}
          >
            {option === 'role' ? 'Peran' : 'Tim'}
          </button>
        ))}
      </div>

      {mode === 'team' ? (
        <>
          <Select
            value={teamCode}
            onChange={(event) => onChange({ approverTeam: event.target.value })}
            className="h-9 text-sm"
          >
            <SelectItem value="">Pilih tim</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.code} value={team.code}>{team.label}</SelectItem>
            ))}
          </Select>
          {teams.length === 0 ? (
            <p className="flex gap-1.5 text-[10px] leading-snug text-amber-700">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              Workspace ini belum punya tim operasional. Pakai peran, atau isi timnya di Workspace Members.
            </p>
          ) : (
            <p className="flex gap-1.5 text-[10px] leading-snug text-slate-500">
              <Info className="mt-px h-3 w-3 shrink-0" />
              Tim itu sekumpulan orang, bukan tanggung jawab tunggal — biasanya dipasangkan dengan kuorum
              &ldquo;any&rdquo;.
            </p>
          )}
        </>
      ) : (
        <>
          <Select
            value={roleCodes.includes(roleCode.trim()) || !roleCode.trim() ? roleCode.trim() : NEW_ROLE}
            onChange={(event) => {
              if (event.target.value === NEW_ROLE) {
                setNewRole(roleCode)
                return
              }
              setNewRole('')
              onChange({ approverRole: event.target.value })
            }}
            className="h-9 text-sm"
          >
            <SelectItem value="">Pilih peran</SelectItem>
            {roleCodes.map((code) => (
              <SelectItem key={code} value={code}>{code}</SelectItem>
            ))}
            <SelectItem value={NEW_ROLE}>+ Peran baru…</SelectItem>
          </Select>

          {newRole !== '' || (roleCode.trim() && !roleCodes.includes(roleCode.trim())) ? (
            <Input
              autoFocus
              value={roleCode}
              placeholder="mis. head_of_division"
              onChange={(event) => onChange({ approverRole: event.target.value })}
              className="h-8 text-xs"
            />
          ) : null}

          {!workspaceId ? (
            <p className="text-[10px] leading-snug text-slate-500">
              Pilih satu workspace untuk melihat pemegang perannya.
            </p>
          ) : rolesState === 'loading' ? (
            <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Memuat pemegang peran…
            </p>
          ) : rolesState === 'error' ? (
            <p className="text-[10px] leading-snug text-amber-700">Daftar pemegang peran tidak bisa dimuat.</p>
          ) : !roleCode.trim() ? null : holders.length === 0 ? (
            <p className="flex gap-1.5 rounded-lg bg-amber-50 p-2 text-[10px] leading-snug text-amber-800">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              <span>
                <strong>{roleCode.trim()}</strong> belum punya pemegang di workspace ini maupun di organisasinya. Node ini akan
                menggagalkan alurnya saat dijalankan.
              </span>
            </p>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500">{holders.length} orang</div>
              <div className="flex flex-wrap gap-1">
                {holders.map((holder) => {
                  // Held at the organization workspace: it applies here, but it is
                  // managed there, so this node must not offer to remove it.
                  const inherited = holder.workspace_id !== workspaceId
                  return (
                    <span
                      key={holder.id}
                      title={inherited ? 'Diwariskan dari workspace organisasi — ubah di sana.' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border py-0.5 pl-2 text-[10px]',
                        inherited ? 'border-sky-200 bg-sky-50 pr-2 text-sky-800' : 'border-slate-200 bg-slate-50 pr-0.5 text-slate-700',
                      )}
                    >
                      {memberName(holder.subject_id)}
                      {inherited ? (
                        <span className="text-[8px] font-semibold uppercase tracking-wide">Org</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeHolder(holder)}
                          aria-label={`Lepas ${memberName(holder.subject_id)} dari ${holder.role_code}`}
                          className="rounded-full p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {workspaceId && roleCode.trim() ? (
            adding ? (
              <div className="space-y-1.5">
                <Select value={newHolder} onChange={(event) => setNewHolder(event.target.value)} className="h-8 text-xs">
                  <SelectItem value="">Pilih anggota workspace</SelectItem>
                  {assignable.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </Select>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 flex-1 text-[11px]" onClick={addHolder} disabled={busy || !newHolder}>
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Simpan'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setAdding(false)
                      setNewHolder('')
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-7 w-full text-[11px]" onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-3 w-3" /> Tambah pemegang peran
              </Button>
            )
          ) : null}

          {workspaceId && roleCode.trim() ? (
            <p className="flex gap-1.5 text-[10px] leading-snug text-slate-500">
              <Info className="mt-px h-3 w-3 shrink-0" />
              Pemegang peran berlaku untuk seluruh workspace, bukan hanya node ini.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
