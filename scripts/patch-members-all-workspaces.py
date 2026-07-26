# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/modules/workspace-management/pages/WorkspaceManagementPage.tsx"
s = p.read_text(encoding="utf-8")

old_dropdown = """                          {allWorkspacesForList.length > 0 ? (
                            <motion.div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground">Workspace</span>
                              <Select
                                value={membersWorkspaceId ?? ''}
                                onChange={(e) => setMembersWorkspaceId(e.target.value || null)}
                                className="h-9 min-w-[220px] max-w-full text-sm"
                                disabled={membersLoading}
                              >
                                {allWorkspacesForList.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </Select>
                              {membersLoading ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  Loading members…
                                </span>
                              ) : null}
                            </motion.div>
                          ) : null}"""
old_dropdown = old_dropdown.replace("<motion.div", "<motion.div").replace("motion.div", "motion.div")
old_dropdown = old_dropdown.replace("<motion.div", "<motion.div")
# actual file uses div
old_dropdown = """                          {allWorkspacesForList.length > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground">Workspace</span>
                              <Select
                                value={membersWorkspaceId ?? ''}
                                onChange={(e) => setMembersWorkspaceId(e.target.value || null)}
                                className="h-9 min-w-[220px] max-w-full text-sm"
                                disabled={membersLoading}
                              >
                                {allWorkspacesForList.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </Select>
                              {membersLoading ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  Loading members…
                                </span>
                              ) : null}
                            </div>
                          ) : null}"""

new_dropdown = """                          {membersLoading ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              Loading members…
                            </p>
                          ) : null}"""

if old_dropdown not in s:
    raise SystemExit("dropdown block not found")
s = s.replace(old_dropdown, new_dropdown, 1)

s = s.replace(
    "Workspace membership, participation scope, and operational team context for delivery boundaries.",
    "Membership across all workspaces — participation scope and operational team context per delivery boundary.",
    1,
)

old_cols = """                                [
                                  { key: 'name' as const, label: 'Member' },
                                  { key: 'role' as const, label: 'Workspace Role' },"""
new_cols = """                                [
                                  { key: 'name' as const, label: 'Member' },
                                  { key: 'workspace' as const, label: 'Workspace' },
                                  { key: 'role' as const, label: 'Workspace Role' },"""
if old_cols not in s:
    raise SystemExit("table cols not found")
s = s.replace(old_cols, new_cols, 1)

marker = "membersTableRows.map((member) =>"
idx = s.find(marker)
if idx < 0:
    raise SystemExit("membersTableRows not found")
sub = s[idx : idx + 2500]
old_cell = """                                <td className="px-3 py-3">
                                  <Badge className={cn('rounded-full border px-2.5 py-1 text-xs', roleStyles[member.role])}>
                                    {member.role}
                                  </Badge>
                                </td>"""
new_cell = """                                <td className="px-3 py-3">
                                  <span className="font-medium text-foreground">{member.workspaceName}</span>
                                </td>
                                <td className="px-3 py-3">
                                  <Badge className={cn('rounded-full border px-2.5 py-1 text-xs', roleStyles[member.role])}>
                                    {member.role}
                                  </Badge>
                                </td>"""
if old_cell not in sub:
    raise SystemExit("member role cell not found in table")
s = s.replace(old_cell, new_cell, 1)

s = s.replace(
    """        workspaceName={membersWorkspaceName}
        employees={inviteEmployeeDirectory.length > 0 ? inviteEmployeeDirectory : undefined}""",
    """        workspaces={inviteWorkspaceOptions}
        employees={inviteEmployeeDirectory.length > 0 ? inviteEmployeeDirectory : undefined}""",
    1,
)

old_invite = """        onInvite={(payload) => {
          if (!payload.employee || !membersWorkspaceId) return
          setInviteWorkspaceMemberSubmitting(true)
          const session = getSession()
          void (async () => {
            try {
              await createWorkspaceMembership(
                TECTONA_WAC_APP_ID,
                membersWorkspaceId,
                {
                  subject_id: payload.employee.id,
                  role_code: uiRoleToWacRoleCode(payload.workspaceRole as MemberRole),
                  status_code: 'active',
                },
                {
                  actorId: session?.user?.id,
                  idempotencyKey:
                    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                      ? crypto.randomUUID()
                      : `idem-${Date.now().toString(36)}`,
                }
              )
              await refreshWorkspaceMembersForWorkspace(membersWorkspaceId)
              void refreshWorkspaceMemberCounts(allWorkspacesForList.map((w) => w.id))
              setInviteWorkspaceMemberOpen(false)
              addToast({
                variant: 'success',
                title: 'Workspace member invited',
                description: `${payload.employee.name} joined ${payload.workspaceName} as ${payload.workspaceRole}.`,
              })
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Could not add membership.'
              addToast({ variant: 'error', title: 'Invite failed', description: msg })
            } finally {
              setInviteWorkspaceMemberSubmitting(false)
            }
          })()
        }}"""

new_invite = """        onInvite={(payload) => {
          if (!payload.employee || !payload.workspaceId) return
          setInviteWorkspaceMemberSubmitting(true)
          const session = getSession()
          void (async () => {
            try {
              await createWorkspaceMembership(
                TECTONA_WAC_APP_ID,
                payload.workspaceId,
                {
                  subject_id: payload.employee.id,
                  role_code: uiRoleToWacRoleCode(payload.workspaceRole as MemberRole),
                  status_code: 'active',
                },
                {
                  actorId: session?.user?.id,
                  idempotencyKey:
                    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                      ? crypto.randomUUID()
                      : `idem-${Date.now().toString(36)}`,
                }
              )
              await refreshAllWorkspaceMembers()
              setInviteWorkspaceMemberOpen(false)
              addToast({
                variant: 'success',
                title: 'Workspace member invited',
                description: `${payload.employee.name} joined ${payload.workspaceName} as ${payload.workspaceRole}.`,
              })
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Could not add membership.'
              addToast({ variant: 'error', title: 'Invite failed', description: msg })
            } finally {
              setInviteWorkspaceMemberSubmitting(false)
            }
          })()
        }}"""

if old_invite not in s:
    raise SystemExit("invite block not found")
s = s.replace(old_invite, new_invite, 1)

s = s.replace(
    "? 'Search member name, operational team, or workspace role'",
    "? 'Search member, workspace, team, or role'",
    1,
)

p.write_text(s, encoding="utf-8")
print("patched OK")
