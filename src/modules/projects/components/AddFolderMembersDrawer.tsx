import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Search, Trash2, UserPlus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import {
  addFolderMember,
  removeFolderMember,
  updateFolderMemberRole,
  type FolderApi,
  type FolderMemberRoleCode,
} from '@/lib/api/folderApi'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { fetchProjectWorkspaceDirectoryUsers } from '../lib/projectWorkspaceMembers'
import { enrichFolderWithIdentityNames } from '../lib/folderMemberIdentity'
import { ProjectMemberRoleSelect, projectMemberRoleLabel } from './ProjectMemberRoleSelect'
import type { Folder } from '../store/folderStore'

const AVATAR_THEMES = [
  'bg-violet-100 text-violet-700 ring-violet-200/80',
  'bg-amber-100 text-amber-800 ring-amber-200/80',
  'bg-orange-100 text-orange-700 ring-orange-200/80',
  'bg-sky-100 text-sky-700 ring-sky-200/80',
  'bg-emerald-100 text-emerald-700 ring-emerald-200/80',
  'bg-rose-100 text-rose-700 ring-rose-200/80',
] as const

function hashLabel(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function memberInitials(name: string): string {
  const normalized = name.trim()
  if (!normalized) return '?'
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function roleLabel(roleCode: string): string {
  return projectMemberRoleLabel(roleCode)
}

type DirectoryUser = {
  id: string
  name: string
  email: string
  subtitle: string
}

type AddFolderMembersDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: Folder
  onFolderUpdated: (folder: Folder) => void
}

export function AddFolderMembersDrawer({
  open,
  onOpenChange,
  folder,
  onFolderUpdated,
}: AddFolderMembersDrawerProps) {
  const { addToast } = useToast()
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([])
  const [displayNameByUserId, setDisplayNameByUserId] = useState<Map<string, string>>(() => new Map())
  const [loadingDirectory, setLoadingDirectory] = useState(false)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<FolderMemberRoleCode>('member')
  const [submitting, setSubmitting] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const memberUserIds = useMemo(
    () => new Set((folder.members ?? []).map((member) => member.userId)),
    [folder.members],
  )

  const sortedMembers = useMemo(
    () =>
      [...(folder.members ?? [])].sort((left, right) => {
        if (left.roleCode === 'owner') return -1
        if (right.roleCode === 'owner') return 1
        return left.displayName.localeCompare(right.displayName)
      }),
    [folder.members],
  )

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return directoryUsers
      .filter((user) => !memberUserIds.has(user.id))
      .filter((user) => {
        if (!query) return true
        return (
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.subtitle.toLowerCase().includes(query)
        )
      })
      .slice(0, 12)
  }, [directoryUsers, memberUserIds, searchQuery])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSelectedUserId(null)
      setSelectedRole('member')
      setDirectoryError(null)
      return
    }

    let cancelled = false
    setLoadingDirectory(true)
    setDirectoryError(null)

    void fetchProjectWorkspaceDirectoryUsers()
      .then(({ users, displayNameByUserId: nameMap }) => {
        if (cancelled) return
        setDirectoryUsers(
          users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            subtitle: user.subtitle,
          })),
        )
        setDisplayNameByUserId(nameMap)
        onFolderUpdated(enrichFolderWithIdentityNames(folder, nameMap))
        if (users.length === 0) {
          setDirectoryError('No workspace members registered yet. Invite members via Workspace Management first.')
        }
      })
      .catch(() => {
        if (cancelled) return
        setDirectoryUsers([])
        setDisplayNameByUserId(new Map())
        setDirectoryError(
          'Unable to load workspace members. Make sure Workspace Org and Workspace Access Control are running.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoadingDirectory(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || submitting) return
      event.preventDefault()
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onOpenChange, submitting])

  const applyFolderApi = (apiFolder: FolderApi) => {
    const nextFolder = enrichFolderWithIdentityNames(
      {
        ...folder,
        members: (apiFolder.members ?? []).map((member) => ({
          userId: member.user_id,
          displayName: member.display_name,
          roleCode: member.role_code,
          roleName: member.role_name,
        })),
        updatedAt: apiFolder.updated_date ?? apiFolder.created_date,
      },
      displayNameByUserId,
    )
    onFolderUpdated(nextFolder)
  }

  const handleAddMember = async () => {
    if (!selectedUserId) return
    setSubmitting(true)
    try {
      const apiFolder = await addFolderMember(folder.id, {
        user_id: selectedUserId,
        role_code: selectedRole,
      })
      applyFolderApi(apiFolder)
      setSelectedUserId(null)
      setSearchQuery('')
      addToast({
        title: 'Member added',
        description: 'User has been added to this folder.',
        variant: 'success',
      })
    } catch (error: unknown) {
      addToast({
        title: 'Add member failed',
        description: error instanceof Error ? error.message : 'Could not add folder member.',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveMember = async (userId: string, displayName: string) => {
    setPendingUserId(userId)
    try {
      const apiFolder = await removeFolderMember(folder.id, userId)
      applyFolderApi(apiFolder)
      addToast({
        title: 'Member removed',
        description: `${displayName} was removed from the folder.`,
        variant: 'success',
      })
    } catch (error: unknown) {
      addToast({
        title: 'Remove member failed',
        description: error instanceof Error ? error.message : 'Could not remove folder member.',
        variant: 'error',
      })
    } finally {
      setPendingUserId(null)
    }
  }

  const handleRoleChange = async (userId: string, roleCode: FolderMemberRoleCode) => {
    setPendingUserId(userId)
    try {
      const apiFolder = await updateFolderMemberRole(folder.id, userId, roleCode)
      applyFolderApi(apiFolder)
    } catch (error: unknown) {
      addToast({
        title: 'Update role failed',
        description: error instanceof Error ? error.message : 'Could not update member role.',
        variant: 'error',
      })
    } finally {
      setPendingUserId(null)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1400]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
        aria-label="Close share folder drawer"
        disabled={submitting}
        onClick={() => {
          if (!submitting) onOpenChange(false)
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-folder-members-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-border bg-background shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)]"
      >
        <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/20">
              <UserPlus className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="add-folder-members-title" className="text-base font-semibold tracking-tight text-foreground">
                Share folder
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Manage who can access <span className="font-medium text-foreground">{folder.name}</span>.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Close"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.12)] dark:border-slate-800/80 dark:bg-slate-950/50">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Current members</h3>
            <div className="mt-3 space-y-2">
              {sortedMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                sortedMembers.map((member) => {
                  const theme = AVATAR_THEMES[hashLabel(member.displayName.toLowerCase()) % AVATAR_THEMES.length]
                  const isOwner = member.roleCode === 'owner'
                  const busy = pendingUserId === member.userId
                  return (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5"
                    >
                      <span
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase ring-2 ring-background',
                          theme,
                        )}
                      >
                        {memberInitials(member.displayName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{member.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.roleName || roleLabel(member.roleCode)}</p>
                      </div>
                      {isOwner ? (
                        <Badge variant="secondary" className="shrink-0">
                          Owner
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <ProjectMemberRoleSelect
                            value={member.roleCode as FolderMemberRoleCode}
                            disabled={busy}
                            aria-label={`Change role for ${member.displayName}`}
                            onChange={(roleCode) => void handleRoleChange(member.userId, roleCode)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${member.displayName}`}
                            disabled={busy}
                            onClick={() => void handleRemoveMember(member.userId, member.displayName)}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.12)] dark:border-slate-800/80 dark:bg-slate-950/50">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Add people</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Search for a member already registered in any workspace, then set their folder role.
            </p>

            {directoryError ? (
              <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                {directoryError}
              </p>
            ) : null}

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search workspace member…"
                className="h-10 pl-9"
              />
            </div>

            <div className="mt-3 space-y-1.5">
              {loadingDirectory ? (
                <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading directory…
                </div>
              ) : filteredCandidates.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted-foreground">No matching workspace members found.</p>
              ) : (
                filteredCandidates.map((user) => {
                  const selected = selectedUserId === user.id
                  const theme = AVATAR_THEMES[hashLabel(user.name.toLowerCase()) % AVATAR_THEMES.length]
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                        selected
                          ? 'border-sky-300/80 bg-sky-50/80 ring-1 ring-sky-200/70'
                          : 'border-border/70 bg-background/70 hover:border-slate-300 hover:bg-muted/40',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase ring-2 ring-background',
                          theme,
                        )}
                      >
                        {memberInitials(user.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{user.subtitle}</span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            <div className="mt-4 flex items-center gap-4">
              <Label htmlFor="folder-member-role" className="shrink-0 text-muted-foreground">
                Role
              </Label>
              <ProjectMemberRoleSelect
                id="folder-member-role"
                value={selectedRole}
                disabled={submitting}
                aria-label="Role for new folder member"
                onChange={setSelectedRole}
              />
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
          <Button
            type="button"
            className={cn(enterpriseCyanGradientActionButtonClass(), 'w-full min-h-10 justify-center gap-2 rounded-lg')}
            disabled={submitting || !selectedUserId}
            onClick={() => void handleAddMember()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add to folder
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
