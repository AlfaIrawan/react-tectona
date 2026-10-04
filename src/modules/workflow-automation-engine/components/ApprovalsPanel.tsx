import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck, Trash2, UserPlus, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  approveWorkflowRun,
  assignWorkflowApprovalRole,
  listWorkflowApprovalRoles,
  listWorkflowApprovals,
  rejectWorkflowRun,
  unassignWorkflowApprovalRole,
  type WorkflowApprovalDto,
  type WorkflowApprovalRoleDto,
} from '@/lib/api/workflowAutomationApi'

export type ApprovalsPanelMember = {
  id: string
  name: string
  email: string
}

type Props = {
  /** Null while "all workspaces" is selected — role mapping is per workspace. */
  workspaceId: string | null
  members: ApprovalsPanelMember[]
}

/** Roles an approval node can name. The canvas takes a free-text code, so these are
    the ones we offer by default rather than a closed list. */
const SUGGESTED_ROLES: Array<{ code: string; name: string }> = [
  { code: 'business_owner', name: 'Business Owner' },
  { code: 'it_owner', name: 'IT Owner' },
  { code: 'head_of_division', name: 'Head of Division' },
  { code: 'compliance', name: 'Compliance' },
]

function subjectOf(approval: WorkflowApprovalDto): string {
  const context = approval.subject_context ?? {}
  const label = context.subject_label ?? context.document_title ?? context.idea_title
  return String(label ?? '').trim() || approval.node_id
}

function requestedAgo(value?: string | null): string {
  if (!value) return ''
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return ''
  const minutes = Math.round((Date.now() - at.getTime()) / 60000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.round(hours / 24)} hari lalu`
}

export function ApprovalsPanel({ workspaceId, members }: Props) {
  const { addToast } = useToast()
  const [inbox, setInbox] = useState<WorkflowApprovalDto[]>([])
  const [inboxState, setInboxState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [deciding, setDeciding] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})

  const [roles, setRoles] = useState<WorkflowApprovalRoleDto[]>([])
  const [rolesState, setRolesState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [roleCode, setRoleCode] = useState(SUGGESTED_ROLES[0]?.code ?? '')
  const [subjectId, setSubjectId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const memberName = useCallback(
    (id: string) => members.find((member) => member.id === id)?.name ?? id,
    [members],
  )

  const loadInbox = useCallback(() => {
    setInboxState('loading')
    listWorkflowApprovals({ mine: true, limit: 50 })
      .then((items) => {
        setInbox(items.filter((item) => item.status === 'pending'))
        setInboxState('ready')
      })
      .catch(() => setInboxState('error'))
  }, [])

  const loadRoles = useCallback(() => {
    if (!workspaceId) {
      setRoles([])
      setRolesState('ready')
      return
    }
    setRolesState('loading')
    listWorkflowApprovalRoles(workspaceId)
      .then((items) => {
        setRoles(items)
        setRolesState('ready')
      })
      .catch(() => setRolesState('error'))
  }, [workspaceId])

  useEffect(loadInbox, [loadInbox])
  useEffect(loadRoles, [loadRoles])

  const decide = useCallback(
    (approval: WorkflowApprovalDto, outcome: 'approve' | 'reject') => {
      setDeciding(approval.id)
      const reason = note[approval.id]?.trim() || undefined
      const call = outcome === 'approve' ? approveWorkflowRun : rejectWorkflowRun
      call(approval.run_id, reason)
        .then(() => {
          addToast({
            variant: 'success',
            title: outcome === 'approve' ? 'Disetujui' : 'Dikembalikan',
            description: subjectOf(approval),
          })
          setNote((current) => {
            const next = { ...current }
            delete next[approval.id]
            return next
          })
          loadInbox()
        })
        .catch((error) =>
          addToast({
            variant: 'error',
            title: 'Keputusan gagal dikirim',
            description: error instanceof Error ? error.message : 'Coba lagi.',
          }),
        )
        .finally(() => setDeciding(null))
    },
    [addToast, loadInbox, note],
  )

  const assign = useCallback(() => {
    if (!workspaceId || !roleCode.trim() || !subjectId) return
    setAssigning(true)
    const known = SUGGESTED_ROLES.find((role) => role.code === roleCode.trim())
    assignWorkflowApprovalRole({
      workspace_id: workspaceId,
      role_code: roleCode.trim(),
      role_name: known?.name,
      subject_id: subjectId,
    })
      .then(() => {
        addToast({ variant: 'success', title: 'Pemegang peran ditambahkan', description: `${memberName(subjectId)} → ${roleCode}` })
        setSubjectId('')
        loadRoles()
      })
      .catch((error) =>
        addToast({
          variant: 'error',
          title: 'Gagal menambahkan',
          description: error instanceof Error ? error.message : 'Coba lagi.',
        }),
      )
      .finally(() => setAssigning(false))
  }, [addToast, loadRoles, memberName, roleCode, subjectId, workspaceId])

  const unassign = useCallback(
    (role: WorkflowApprovalRoleDto) => {
      unassignWorkflowApprovalRole({
        workspace_id: role.workspace_id,
        role_code: role.role_code,
        subject_id: role.subject_id,
      })
        .then(() => {
          addToast({ variant: 'success', title: 'Pemegang peran dilepas', description: `${memberName(role.subject_id)} → ${role.role_code}` })
          loadRoles()
        })
        .catch((error) =>
          addToast({
            variant: 'error',
            title: 'Gagal melepas',
            description: error instanceof Error ? error.message : 'Coba lagi.',
          }),
        )
    },
    [addToast, loadRoles, memberName],
  )

  /** Grouped by role so it reads as "who is the Business Owner", not a flat list. */
  const rolesByCode = useMemo(() => {
    const grouped = new Map<string, WorkflowApprovalRoleDto[]>()
    roles.forEach((role) => {
      const list = grouped.get(role.role_code) ?? []
      list.push(role)
      grouped.set(role.role_code, list)
    })
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [roles])

  const assignable = useMemo(
    () => members.filter((member) => !roles.some((role) => role.role_code === roleCode.trim() && role.subject_id === member.id)),
    [members, roleCode, roles],
  )

  return (
    <div className="space-y-6">
      {/* --- Inbox -------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Menunggu keputusan saya</h3>
            <p className="text-xs text-slate-500">Semua permintaan approval yang ditujukan kepada Anda, dari workspace mana pun.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadInbox} disabled={inboxState === 'loading'}>
            {inboxState === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Muat ulang'}
          </Button>
        </div>

        {inboxState === 'error' ? (
          <Card className="rounded-2xl border-amber-200 bg-amber-50/80">
            <CardContent className="py-3 text-xs text-amber-800">
              Daftar approval tidak bisa dimuat. Layanan Workflow &amp; Automation mungkin sedang tidak tersedia.
            </CardContent>
          </Card>
        ) : inboxState === 'ready' && inbox.length === 0 ? (
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="flex items-center gap-2 py-4 text-xs text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Tidak ada yang menunggu keputusan Anda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {inbox.map((approval) => {
              const busy = deciding === approval.id
              return (
                <Card key={approval.id} className="rounded-2xl border-slate-200">
                  <CardContent className="space-y-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{subjectOf(approval)}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          {approval.role_code ? <Badge variant="outline">{approval.role_code}</Badge> : null}
                          <span>Kuorum: {approval.quorum === 'all' ? 'semua approver' : 'salah satu approver'}</span>
                          {approval.requested_at ? <span>Diminta {requestedAgo(approval.requested_at)}</span> : null}
                        </div>
                      </div>
                    </div>
                    <Input
                      value={note[approval.id] ?? ''}
                      onChange={(event) => setNote((current) => ({ ...current, [approval.id]: event.target.value }))}
                      placeholder="Catatan (opsional) — wajib diisi kalau Anda minta perbaikan"
                      className="h-8 text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => decide(approval, 'approve')} disabled={busy}>
                        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => decide(approval, 'reject')}
                        disabled={busy}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Minta perbaikan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* --- Role holders -------------------------------------------------- */}
      <section className="space-y-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            Pemegang peran approval
          </h3>
          <p className="text-xs text-slate-500">
            Node approval menyebut <em>peran</em>, bukan orang — jadi alurnya tetap benar saat orangnya berganti jabatan. Di sini Anda
            menentukan siapa yang memegang peran itu di workspace ini.
          </p>
        </div>

        {!workspaceId ? (
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="py-3 text-xs text-slate-500">
              Pilih satu workspace dulu — pemegang peran ditentukan per workspace.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="flex flex-wrap items-end gap-2 py-3">
                <label className="min-w-[180px] flex-1 space-y-1 text-[11px] font-medium text-slate-600">
                  Peran
                  <Input
                    value={roleCode}
                    onChange={(event) => setRoleCode(event.target.value)}
                    list="approval-role-codes"
                    placeholder="business_owner"
                    className="h-8 text-xs"
                  />
                  <datalist id="approval-role-codes">
                    {SUGGESTED_ROLES.map((role) => (
                      <option key={role.code} value={role.code}>{role.name}</option>
                    ))}
                  </datalist>
                </label>
                <label className="min-w-[200px] flex-1 space-y-1 text-[11px] font-medium text-slate-600">
                  Orang
                  <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                    <SelectItem value="">Pilih anggota workspace</SelectItem>
                    {assignable.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </Select>
                </label>
                <Button size="sm" onClick={assign} disabled={assigning || !roleCode.trim() || !subjectId}>
                  {assigning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
                  Tambahkan
                </Button>
              </CardContent>
            </Card>

            {rolesState === 'error' ? (
              <Card className="rounded-2xl border-amber-200 bg-amber-50/80">
                <CardContent className="py-3 text-xs text-amber-800">Daftar peran tidak bisa dimuat.</CardContent>
              </Card>
            ) : rolesState === 'ready' && rolesByCode.length === 0 ? (
              <Card className="rounded-2xl border-amber-200 bg-amber-50/80">
                <CardContent className="py-3 text-xs text-amber-800">
                  Belum ada pemegang peran di workspace ini maupun di workspace organisasinya. Node approval yang menyebut peran tanpa
                  pemegang akan membuat alurnya gagal, bukan lolos diam-diam.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {rolesByCode.map(([code, holders]) => (
                  <Card key={code} className="rounded-2xl border-slate-200">
                    <CardContent className="space-y-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-700">{code}</span>
                        <span className="text-[11px] text-slate-400">{holders.length} orang</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {holders.map((role) => {
                          // Held at the organization workspace: it applies here, but it is
                          // managed there, so this workspace must not offer to remove it.
                          const inherited = role.workspace_id !== workspaceId
                          return (
                            <span
                              key={role.id}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-2.5 text-[11px]',
                                inherited
                                  ? 'border-sky-200 bg-sky-50 pr-2.5 text-sky-800'
                                  : 'border-slate-200 bg-slate-50 pr-1 text-slate-700',
                              )}
                              title={inherited ? 'Diwariskan dari workspace organisasi — ubah di sana.' : undefined}
                            >
                              {memberName(role.subject_id)}
                              {inherited ? (
                                <span className="text-[9px] font-semibold uppercase tracking-wide">Organisasi</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => unassign(role)}
                                  aria-label={`Lepas ${memberName(role.subject_id)} dari ${code}`}
                                  className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
