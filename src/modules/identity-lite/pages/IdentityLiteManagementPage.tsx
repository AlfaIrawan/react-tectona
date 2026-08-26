import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Shield, Trash2, UserRound, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnterpriseDeleteConfirmModal } from '@/components/enterprise/EnterpriseDeleteConfirmModal'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { getSession } from '@/auth/authService'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { deleteIdentityUser, fetchIdentityUser, fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  fetchIdentityWorkspaceOrgMemberships,
  repairIdentityWorkspace,
} from '@/lib/api/workspaceOrgApi'
import { fetchWorkspaceMembers, TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'

type DirectoryRow = IdentityUserDto & {
  roleCode?: string | null
  hasWorkspace: boolean
  checking: boolean
  repairing: boolean
  deleting: boolean
}

function slugForIdentity(user: IdentityUserDto): string {
  const base = (user.display_name || user.email.split('@')[0] || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${base || 'workspace'}-ws`
}

export function IdentityLiteManagementPage() {
  const { addToast } = useToast()
  const tenant = useTenantContextOptional()
  const session = getSession()
  const isRootUser = session?.user.role?.trim().toLowerCase() === 'root'
  const [rows, setRows] = useState<DirectoryRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DirectoryRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const activeWorkspaceId = tenant?.workspaceId
      let next: DirectoryRow[]

      if (isRootUser) {
        // Only the root identity may bypass workspace scoping. Regular
        // administrators must always use the selected workspace membership.
        const response = await fetchIdentityUsers({ limit: 500 })
        next = await Promise.all(
          response.items.map(async (user) => {
            // This endpoint is backed by the workspace-org identity relations:
            // active memberships plus the personal-workspace default owner link.
            const memberships = await fetchIdentityWorkspaceOrgMemberships(user.id)
            return {
              ...user,
              hasWorkspace: memberships.length > 0,
              checking: false,
              repairing: false,
              deleting: false,
            }
          }),
        )
      } else if (activeWorkspaceId && !isAllWorkspacesSelection(activeWorkspaceId)) {
        // WAC is the source of truth for platform/workspace membership. Only
        // enrich these subject IDs from Identity-Lite; never load the global
        // identity directory for a concrete workspace scope.
        const memberships = await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, activeWorkspaceId)
        const activeMembers = memberships.items.filter((membership) => {
          const status = (membership.status_code ?? membership.membership_status ?? '').toLowerCase()
          return !status || status === 'active'
        })
        const identities = await Promise.all(
          [...new Set(activeMembers.map((membership) => membership.subject_id))].map(async (subjectId) => {
            const user = await fetchIdentityUser(subjectId).catch(() => null)
            if (!user) return null
            const membership = activeMembers.find((item) => item.subject_id === subjectId)
            return {
              ...user,
              roleCode: membership?.role_code ?? null,
              hasWorkspace: true,
              checking: false,
              repairing: false,
              deleting: false,
            }
          }),
        )
        next = identities.filter((identity): identity is DirectoryRow => identity !== null)
      } else {
        // Do not fall back to the global directory for non-root users.
        next = []
      }
      setRows(next)
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Identity directory unavailable',
        description: error instanceof Error ? error.message : 'Could not load Identity-Lite users.',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addToast, isRootUser, tenant?.workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) => `${row.display_name} ${row.email} ${row.job_title ?? ''}`.toLowerCase().includes(normalized))
  }, [query, rows])

  const repair = async (user: DirectoryRow) => {
    const actorId = getSession()?.user.id
    if (!actorId) return
    setRows((current) => current.map((row) => (row.id === user.id ? { ...row, repairing: true } : row)))
    try {
      const created = await repairIdentityWorkspace(
        {
          identityRef: user.id,
          ownerEmail: user.email,
          displayName: `${user.display_name.trim()} WS`,
          slug: slugForIdentity(user),
          appId: TECTONA_WAC_APP_ID,
        },
        { actorId },
      )
      setRows((current) => current.map((row) => (row.id === user.id ? { ...row, hasWorkspace: true, repairing: false } : row)))
      addToast({
        variant: 'success',
        title: 'Workspace repaired',
        description: `${created.display_name} is now linked to the existing identity.`,
      })
    } catch (error) {
      setRows((current) => current.map((row) => (row.id === user.id ? { ...row, repairing: false } : row)))
      addToast({
        variant: 'error',
        title: 'Workspace repair failed',
        description: error instanceof Error ? error.message : 'Could not create the missing workspace.',
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    const actorId = getSession()?.user.id
    if (!actorId) {
      addToast({ variant: 'error', title: 'Delete unavailable', description: 'Your session has expired. Please sign in again.' })
      return
    }
    setDeleting(true)
    setRows((current) => current.map((row) => (row.id === deleteTarget.id ? { ...row, deleting: true } : row)))
    try {
      await deleteIdentityUser(deleteTarget.id, { actorId })
      setRows((current) => current.filter((row) => row.id !== deleteTarget.id))
      addToast({
        variant: 'success',
        title: 'Identity deleted',
        description: `${deleteTarget.display_name} (${deleteTarget.email}) can no longer sign in.`,
      })
      setDeleteTarget(null)
    } catch (error) {
      setRows((current) => current.map((row) => (row.id === deleteTarget.id ? { ...row, deleting: false } : row)))
      addToast({
        variant: 'error',
        title: 'Identity deletion failed',
        description: error instanceof Error ? error.message : 'Could not delete the identity.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-full space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" aria-hidden />
            Identity-Lite Administration
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Identity directory</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {isRootUser
              ? 'Root access: showing the global Identity-Lite directory.'
              : tenant?.workspaceId && !isAllWorkspacesSelection(tenant.workspaceId)
              ? `Showing active ${TECTONA_WAC_APP_ID} members in ${tenant.displayName ?? 'the selected workspace'}.`
              : 'Select a concrete workspace to review its active members.'}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load(true)} disabled={loading || refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{isRootUser ? 'Registered identities' : 'Workspace members'}</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Active in scope</p><p className="mt-1 text-2xl font-semibold text-emerald-600">{rows.filter((row) => row.hasWorkspace).length}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Scope</p><p className="mt-1 truncate text-sm font-semibold" title={isRootUser ? 'Global Identity-Lite directory' : tenant?.displayName ?? undefined}>{isRootUser ? 'Global (root bypass)' : tenant?.displayName ?? 'Select workspace'}</p></div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2"><UserRound className="h-5 w-5" aria-hidden /><h2 className="font-semibold">Identity-Lite users</h2></div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email..." className="md:w-80" />
        </div>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredRows.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">No identities found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Identity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Workspace</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
              <tbody>
                {filteredRows.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-4 py-3"><div className="font-medium">{user.display_name}</div><div className="text-xs text-muted-foreground">{user.email}</div></td>
                    <td className="px-4 py-3"><Badge variant="outline">{user.status_code}</Badge>{user.roleCode ? <Badge className="ml-2" variant="secondary">{user.roleCode}</Badge> : null}</td>
                    <td className="px-4 py-3">{user.hasWorkspace ? <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Linked</span> : <span className="inline-flex items-center gap-1.5 text-amber-700"><AlertTriangle className="h-4 w-4" />Missing</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.hasWorkspace ? <Button size="sm" onClick={() => void repair(user)} disabled={user.repairing || user.deleting}><Wrench className="mr-1.5 h-4 w-4" />{user.repairing ? 'Repairing...' : 'Create workspace'}</Button> : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          aria-label={`Delete ${user.display_name}`}
                          onClick={() => setDeleteTarget(user)}
                          disabled={user.repairing || user.deleting}
                        >
                          {user.deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EnterpriseDeleteConfirmModal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDelete()}
        busy={deleting}
        title="Delete identity?"
        description="This removes the identity from Identity-Lite and revokes its sign-in tokens."
        entityLabel="Identity"
        entityValue={deleteTarget ? `${deleteTarget.display_name} (${deleteTarget.email})` : ''}
        impactSummary={
          deleteTarget?.hasWorkspace
            ? 'The linked workspace and its data are not deleted by this action. Remove the workspace separately if needed.'
            : 'This identity will be removed from the directory. The user can sign up again with the same email.'
        }
        enterpriseNote="Only authorized platform administrators can perform this action."
        confirmLabel="Delete identity"
        confirmBusyLabel="Deleting identity..."
        dialogTitleId="identity-lite-delete-dialog-title"
      />
    </div>
  )
}
