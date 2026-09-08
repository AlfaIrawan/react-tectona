/**
 * Document explainer assistants — create and govern knowledge-only assistant packs.
 *
 * A pack is a display name plus a corpus (folders and/or documents already governed
 * by this module). It grants no tools: chat execution lives in tectona-agent-runtime,
 * which reads this same catalog. Publishing is what makes a pack selectable in chat,
 * so the button is deliberately gated on the corpus resolving to at least one document.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { Archive, Bot, Check, ChevronDown, ChevronRight, Copy, FileText, Folder, Loader2, Maximize2, Minimize2, Pencil, Plus, Save, Search, Send, Shield, Users, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  enterpriseSecondaryButtonClass,
  registerServicePrimaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import {
  EXPLAINER_AVATARS,
  archiveExplainerAssistant,
  createExplainerAssistant,
  listAllDocuments,
  listExplainerAssistants,
  patchExplainerAssistant,
  publishExplainerAssistant,
  type DocumentResponse,
  type ExplainerAccessGrant,
  type ExplainerAssistant,
  type ExplainerAssistantAvatar,
  type ExplainerChatLimitKind,
} from '@/lib/api/documentKnowledgeApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import { getSession } from '@/auth/authService'
import { fetchSubjectMembershipsCached } from '@/lib/wacMembershipCache'
import { isUuidLike } from '@/modules/projects/lib/projectMemberIdentity'
import { identityUserDisplayName, resolveActiveWorkspaceMembershipRows } from '@/modules/task-work-management/utils/tectonaAssigneeOptions'
import {
  fetchWorkspaceMembers,
  fetchWorkspaceRoles,
  TECTONA_WAC_APP_ID,
  type WacMembershipDto,
  type WacRoleDto,
} from '@/lib/api/workspaceAccessControlApi'
import { fetchAllDocumentFolders, type DocumentFolder } from '@/lib/api/documentFolderApi'
import {
  fetchExplainerAssistantInsights,
  type ExplainerAssistantInsights,
} from '@/lib/api/tectonaAgentRuntimeApi'
import { isFolderInSamplesTree } from '@/modules/document-knowledge-management/lib/samplesFolder'

/**
 * The "New assistant" trigger lives in the module toolbar (next to the search bar),
 * alongside the other panels' primary actions, so the panel exposes its create
 * drawer instead of rendering a second button of its own.
 */
export interface ExplainerAssistantsPanelHandle {
  openCreate: () => void
}

interface AccessibleWorkspaceOption {
  id: string
  name: string
  organizationId?: string
}

interface GrantMemberRow extends WacMembershipDto {
  workspaceNames: string[]
}

interface ExplainerAssistantsPanelProps {
  workspaceId: string | null
  /** WAC directory id (UUID). May differ from DKM `workspaceId` when the switcher holds a slug. */
  wacWorkspaceId?: string | null
  /** Display name of the Tectona workspace this pack is stored in (tenant switcher). */
  workspaceName?: string | null
  /** Workspaces the current user can grant chat access to (switcher roster). */
  accessibleWorkspaces?: AccessibleWorkspaceOption[]
  className?: string
  style?: React.CSSProperties
}

interface GrantMenuFor {
  assistant: ExplainerAssistant
  x: number
  y: number
}

interface DraftState {
  id: string | null
  version: number | null
  displayName: string
  description: string
  avatar: ExplainerAssistantAvatar
  folderIds: string[]
  documentIds: string[]
  accessGrants: ExplainerAccessGrant[]
  chatLimitKind: 'none' | ExplainerChatLimitKind
  chatLimitValue: string
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  version: null,
  displayName: '',
  description: '',
  avatar: 'meta-human-adira-01',
  folderIds: [],
  documentIds: [],
  accessGrants: [],
  chatLimitKind: 'none',
  chatLimitValue: '',
}

const CHAT_LIMIT_OPTIONS: Array<{
  kind: DraftState['chatLimitKind']
  label: string
  hint: string
}> = [
  { kind: 'none', label: 'Unlimited', hint: 'No cap until you set one.' },
  { kind: 'token', label: 'Tokens', hint: 'Total LLM tokens for this assistant.' },
  { kind: 'question', label: 'Questions', hint: 'User questions, excluding the opening greeting.' },
  { kind: 'cost', label: 'Cost (IDR)', hint: 'Estimated LLM cost in rupiah.' },
]

function parseChatLimitDraft(
  kind: DraftState['chatLimitKind'],
  rawValue: string,
): { chat_limit_kind: ExplainerChatLimitKind | null; chat_limit_value: number | null } {
  if (kind === 'none') {
    return { chat_limit_kind: null, chat_limit_value: null }
  }
  const numeric = Number(rawValue)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('Enter a chat limit greater than zero, or choose Unlimited.')
  }
  return {
    chat_limit_kind: kind,
    chat_limit_value: kind === 'question' ? Math.floor(numeric) : numeric,
  }
}

function chatLimitDraftFromAssistant(assistant: ExplainerAssistant): {
  chatLimitKind: DraftState['chatLimitKind']
  chatLimitValue: string
} {
  const kind = assistant.chat_limit_kind
  if (kind === 'token' || kind === 'question' || kind === 'cost') {
    return {
      chatLimitKind: kind,
      chatLimitValue: assistant.chat_limit_value != null ? String(assistant.chat_limit_value) : '',
    }
  }
  return { chatLimitKind: 'none', chatLimitValue: '' }
}

function chatLimitKindLabel(kind: string | null | undefined): string {
  if (kind === 'token') return 'Tokens'
  if (kind === 'question') return 'Questions'
  if (kind === 'cost') return 'Cost (IDR)'
  return 'Unlimited'
}

function formatUsageAmount(kind: string | null | undefined, value: number | null | undefined): string {
  if (value == null) return '—'
  if (kind === 'cost') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  return String(Math.round(value))
}

function chatLimitValuePlaceholder(kind: DraftState['chatLimitKind']): string {
  if (kind === 'token') return 'e.g. 500000'
  if (kind === 'question') return 'e.g. 200'
  if (kind === 'cost') return 'e.g. 250000'
  return ''
}

function workspaceGrantLabel(workspaceName?: string | null): string {
  const name = (workspaceName || '').trim()
  return name ? `Everyone in ${name}` : 'Everyone in this workspace'
}

function defaultWorkspaceGrant(workspaceId: string, workspaceName?: string | null): ExplainerAccessGrant {
  return { kind: 'workspace', value: workspaceId, label: workspaceGrantLabel(workspaceName) }
}

function grantsFromAssistant(
  assistant: ExplainerAssistant,
  workspaceId: string,
  workspaceName?: string | null,
): ExplainerAccessGrant[] {
  if (Array.isArray(assistant.access_grants)) return assistant.access_grants
  if (assistant.visibility === 'private') return []
  return [defaultWorkspaceGrant(workspaceId, workspaceName)]
}

function grantIdentity(grant: ExplainerAccessGrant): string {
  const value = grant.kind === 'role' ? grant.value.toLowerCase() : grant.value
  return `${grant.kind}:${value}`
}

function hasGrant(grants: ExplainerAccessGrant[], kind: ExplainerAccessGrant['kind'], value: string): boolean {
  return grants.some((grant) => grantIdentity(grant) === grantIdentity({ kind, value }))
}

function toggleAccessGrant(grants: ExplainerAccessGrant[], next: ExplainerAccessGrant): ExplainerAccessGrant[] {
  const key = grantIdentity(next)
  return grants.some((grant) => grantIdentity(grant) === key)
    ? grants.filter((grant) => grantIdentity(grant) !== key)
    : [...grants, next]
}

const ORG_GRANT_ROSTER_KEY = '__organization__'

interface GrantRosterMerge {
  members: GrantMemberRow[]
  roles: WacRoleDto[]
}

interface GrantRosterWorkspaceBatch {
  workspace: AccessibleWorkspaceOption
  memberItems: WacMembershipDto[]
}

type GrantBrowseMode = 'workspace' | 'users'

function mergeGrantRoster(
  rosterResults: GrantRosterWorkspaceBatch[],
  roleItems: WacRoleDto[],
  preferredWorkspaceId?: string,
): GrantRosterMerge {
  const membersBySubject = new Map<string, GrantMemberRow>()
  const roleByCode = new Map<string, WacRoleDto>()
  for (const role of roleItems) {
    if (role.role_code) roleByCode.set(role.role_code.toLowerCase(), role)
  }
  for (const { workspace, memberItems } of rosterResults) {
    for (const member of memberItems) {
      const existing = membersBySubject.get(member.subject_id)
      if (existing) {
        if (workspace.name && !existing.workspaceNames.includes(workspace.name)) {
          existing.workspaceNames = [...existing.workspaceNames, workspace.name]
        }
        if (preferredWorkspaceId && workspace.id === preferredWorkspaceId) {
          existing.role_code = member.role_code
          existing.role_display_name = member.role_display_name
        }
        continue
      }
      membersBySubject.set(member.subject_id, {
        ...member,
        workspaceNames: workspace.name ? [workspace.name] : [],
      })
      const code = member.role_code?.trim()
      if (code && !roleByCode.has(code.toLowerCase())) {
        roleByCode.set(code.toLowerCase(), {
          id: `from-member:${code}`,
          role_code: code,
          display_name: member.role_display_name?.trim() || code,
        })
      }
    }
  }
  return {
    members: Array.from(membersBySubject.values()),
    roles: Array.from(roleByCode.values()).sort((left, right) =>
      left.display_name.localeCompare(right.display_name, undefined, { sensitivity: 'base' }),
    ),
  }
}

/**
 * The documents endpoint caps page_size at 100, so a corpus picker that wants more
 * than one page has to actually page — asking for 200 is rejected with a 422.
 */
const DOCUMENT_PAGE_SIZE = 100
const DOCUMENT_PAGE_LIMIT = 10

async function fetchDocumentsForCorpus(workspaceId: string): Promise<DocumentResponse[]> {
  const collected: DocumentResponse[] = []
  for (let page = 1; page <= DOCUMENT_PAGE_LIMIT; page += 1) {
    const res = await listAllDocuments({
      workspace_id: workspaceId,
      page,
      page_size: DOCUMENT_PAGE_SIZE,
    })
    collected.push(...res.items)
    if (res.items.length < DOCUMENT_PAGE_SIZE || collected.length >= res.total) break
  }
  return collected
}

/**
 * Token to bundled asset. The stored value is the token, never this path, so the
 * artwork can be re-cropped or re-encoded without migrating a single row.
 */
const AVATAR_SRC: Record<ExplainerAssistantAvatar, string> = {
  'meta-human-adira-01': '/images/assistant-avatars/meta-human-adira-01.webp',
  'meta-human-adira-02': '/images/assistant-avatars/meta-human-adira-02.webp',
  'meta-human-adira-03': '/images/assistant-avatars/meta-human-adira-03.webp',
  'meta-human-adira-04': '/images/assistant-avatars/meta-human-adira-04.webp',
  'meta-human-adira-05': '/images/assistant-avatars/meta-human-adira-05.webp',
  'meta-human-01': '/images/assistant-avatars/meta-human-01.webp',
  'meta-human-02': '/images/assistant-avatars/meta-human-02.webp',
  'meta-human-03': '/images/assistant-avatars/meta-human-03.webp',
  'meta-human-04': '/images/assistant-avatars/meta-human-04.webp',
}

const AVATAR_LABEL: Record<ExplainerAssistantAvatar, string> = {
  'meta-human-adira-01': 'Adira uniform 1',
  'meta-human-adira-02': 'Adira uniform 2',
  'meta-human-adira-03': 'Adira uniform 3',
  'meta-human-adira-04': 'Adira uniform 4',
  'meta-human-adira-05': 'Adira uniform 5',
  'meta-human-01': 'Corporate 1',
  'meta-human-02': 'Corporate 2',
  'meta-human-03': 'Corporate 3',
  'meta-human-04': 'Assistant bot',
}

/** Explorer-style timestamp: 02/09/2026 19:59. */
function formatModified(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusTone(status: ExplainerAssistant['status']): string {
  if (status === 'published') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (status === 'archived') return 'border-border/60 bg-muted/40 text-muted-foreground'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
}

/** Status label the user actually thinks in: a draft is simply not published yet. */
function statusLabel(status: ExplainerAssistant['status']): string {
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return 'Unpublished'
}

/**
 * Colour enters from the left edge and fades into the card, so status is readable
 * at a glance across a grid without every card shouting a full tinted background.
 */
function statusWash(status: ExplainerAssistant['status']): string {
  if (status === 'published') return 'from-emerald-500/20 via-emerald-500/[0.06] to-transparent'
  if (status === 'archived') return 'from-slate-500/15 via-slate-500/[0.05] to-transparent'
  return 'from-amber-500/20 via-amber-500/[0.06] to-transparent'
}

function statusEdge(status: ExplainerAssistant['status']): string {
  if (status === 'published') return 'from-emerald-400/50 via-emerald-500 to-emerald-600/70'
  if (status === 'archived') return 'from-slate-300/50 via-slate-400 to-slate-500/70'
  return 'from-amber-300/50 via-amber-500 to-amber-600/70'
}

export const ExplainerAssistantsPanel = forwardRef(function ExplainerAssistantsPanel(
  {
    workspaceId,
    wacWorkspaceId,
    workspaceName,
    accessibleWorkspaces = [],
    className,
    style,
  }: ExplainerAssistantsPanelProps,
  ref: Ref<ExplainerAssistantsPanelHandle>,
) {
  const [assistants, setAssistants] = useState<ExplainerAssistant[]>([])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [documents, setDocuments] = useState<DocumentResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<GrantMenuFor | null>(null)
  const [detailFor, setDetailFor] = useState<ExplainerAssistant | null>(null)
  const [detailInsights, setDetailInsights] = useState<ExplainerAssistantInsights | null>(null)
  const [detailInsightsLoading, setDetailInsightsLoading] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerFullscreen, setDrawerFullscreen] = useState(false)
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [corpusQuery, setCorpusQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [grantQuery, setGrantQuery] = useState('')
  const [grantBrowseMode, setGrantBrowseMode] = useState<GrantBrowseMode>('workspace')
  const [grantPickerWorkspaceId, setGrantPickerWorkspaceId] = useState<string | null>(null)
  const [membershipWorkspaceIds, setMembershipWorkspaceIds] = useState<string[] | null>(null)
  const [membersByWorkspaceId, setMembersByWorkspaceId] = useState<Record<string, GrantMemberRow[]>>({})
  const [rolesByWorkspaceId, setRolesByWorkspaceId] = useState<Record<string, WacRoleDto[]>>({})
  const [identityNameById, setIdentityNameById] = useState<Map<string, string>>(new Map())
  const [grantRosterLoading, setGrantRosterLoading] = useState(false)
  const [grantRosterError, setGrantRosterError] = useState<string | null>(null)

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  }, [])

  const closeDrawer = useCallback(() => {
    if (saving) return
    setDrawerOpen(false)
    setDrawerFullscreen(false)
  }, [saving])

  const reload = useCallback(async () => {
    if (!workspaceId) {
      setAssistants([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await listExplainerAssistants({ workspaceId, pageSize: 200 })
      setAssistants(res.assistants)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the assistant list.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void reload()
  }, [reload])

  // Corpus pickers only need the catalog when the drawer is actually opened.
  useEffect(() => {
    if ((!drawerOpen && !detailFor) || !workspaceId) return
    let cancelled = false
    void (async () => {
      try {
        const [folderList, documentList] = await Promise.all([
          fetchAllDocumentFolders(workspaceId),
          fetchDocumentsForCorpus(workspaceId),
        ])
        if (cancelled) return
        // Samples is a Tectona system library, not workspace content — binding an
        // assistant to it would ground answers in demo material. Hide the whole
        // subtree, not just the root, so its category folders go too.
        const selectableFolders = folderList.filter(
          (folder) => !isFolderInSamplesTree(folder.id, folderList),
        )
        setFolders(selectableFolders)
        setDocuments(documentList.filter((doc) => !isFolderInSamplesTree(doc.folder_id, folderList)))
      } catch (err) {
        if (!cancelled) setSaveError(err instanceof Error ? err.message : 'Could not load folders and documents.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drawerOpen, detailFor, workspaceId])

  useEffect(() => {
    if (!drawerOpen || !workspaceId) return
    let cancelled = false

    void (async () => {
      try {
        const identityItems = await fetchIdentityUsers({ limit: 400, offset: 0 })
          .then((res) => res.items)
          .catch(() => [] as IdentityUserDto[])
        if (cancelled) return
        const nameById = new Map<string, string>()
        for (const user of identityItems) {
          const name = identityUserDisplayName(user)
          if (name) nameById.set(user.id, name)
        }
        setIdentityNameById(nameById)
      } catch {
        if (!cancelled) setIdentityNameById(new Map())
      }
    })()

    const subjectId = getSession()?.user?.id?.trim()
    if (subjectId) {
      void fetchSubjectMembershipsCached(subjectId, { activeOnly: true })
        .then((res) => {
          if (cancelled) return
          setMembershipWorkspaceIds(
            (res.items ?? [])
              .map((item) => (item.workspace_id || '').trim())
              .filter(Boolean),
          )
        })
        .catch(() => {
          if (!cancelled) setMembershipWorkspaceIds(null)
        })
    } else if (!cancelled) {
      setMembershipWorkspaceIds(null)
    }

    return () => {
      cancelled = true
    }
  }, [drawerOpen, workspaceId])

  useEffect(() => {
    if (!drawerOpen) return
    const packId = (wacWorkspaceId || workspaceId || '').trim()
    const catalog =
      accessibleWorkspaces.length > 0
        ? accessibleWorkspaces
        : [{ id: packId, name: workspaceName?.trim() || 'This workspace' }]
    const selectedId = (grantPickerWorkspaceId || '').trim()

    let rosterTargets: AccessibleWorkspaceOption[] = []
    let rosterKey = selectedId
    let rolesWorkspaceId = selectedId

    if (grantBrowseMode === 'workspace') {
      if (!selectedId) {
        setGrantRosterLoading(false)
        setGrantRosterError(null)
        return
      }
      const selected = catalog.find((item) => item.id === selectedId)
      rosterTargets = [
        {
          id: selectedId,
          name: selected?.name || workspaceName?.trim() || 'This workspace',
          organizationId: selected?.organizationId,
        },
      ]
    } else {
      rosterKey = ORG_GRANT_ROSTER_KEY
      rolesWorkspaceId = packId || selectedId
      const packOrgId = (
        catalog.find((item) => item.id === packId)?.organizationId
        || catalog.find((item) => item.id === selectedId)?.organizationId
        || ''
      ).trim()
      rosterTargets = catalog.filter((item) => {
        if (!item.id.trim()) return false
        if (membershipWorkspaceIds && membershipWorkspaceIds.length > 0 && !membershipWorkspaceIds.includes(item.id)) {
          return item.id === packId
        }
        if (packOrgId && (item.organizationId || '').trim() && (item.organizationId || '').trim() !== packOrgId) {
          return false
        }
        return true
      })
      if (rosterTargets.length === 0 && packId) {
        rosterTargets = [{ id: packId, name: workspaceName?.trim() || 'This workspace' }]
      }
    }

    let cancelled = false
    setGrantRosterLoading(true)
    setGrantRosterError(null)

    void (async () => {
      try {
        const [roleItems, rosterResults] = await Promise.all([
          rolesWorkspaceId
            ? fetchWorkspaceRoles(TECTONA_WAC_APP_ID, rolesWorkspaceId)
                .then((res) => res.items)
                .catch(() => [] as WacRoleDto[])
            : Promise.resolve([] as WacRoleDto[]),
          Promise.all(
            rosterTargets.map(async (workspace) => ({
              workspace,
              memberItems: await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, workspace.id)
                .then((res) => resolveActiveWorkspaceMembershipRows(res.items))
                .catch(() => [] as WacMembershipDto[]),
            })),
          ),
        ])
        if (cancelled) return
        const merged = mergeGrantRoster(rosterResults, roleItems, rolesWorkspaceId)
        setMembersByWorkspaceId((prev) => ({ ...prev, [rosterKey]: merged.members }))
        setRolesByWorkspaceId((prev) => ({ ...prev, [rosterKey]: merged.roles }))
        setGrantRosterError(
          merged.members.length === 0 && rosterTargets.some((item) => !isUuidLike(item.id))
            ? 'Workspace Access Control needs workspace UUIDs to list members.'
            : null,
        )
      } finally {
        if (!cancelled) setGrantRosterLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    drawerOpen,
    grantBrowseMode,
    grantPickerWorkspaceId,
    accessibleWorkspaces,
    membershipWorkspaceIds,
    wacWorkspaceId,
    workspaceId,
    workspaceName,
  ])

  useEffect(() => {
    if (!detailFor) {
      setDetailInsights(null)
      setDetailInsightsLoading(false)
      return
    }
    const assistantId = detailFor.id
    let cancelled = false
    setDetailInsights(null)
    setDetailInsightsLoading(true)
    void fetchExplainerAssistantInsights(assistantId)
      .then((payload) => {
        if (!cancelled) setDetailInsights(payload)
      })
      .catch(() => {
        if (!cancelled) setDetailInsights(null)
      })
      .finally(() => {
        if (!cancelled) setDetailInsightsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailFor?.id])

  useEffect(() => {
    if (!detailFor) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailFor(null)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [detailFor])

  useEffect(() => {
    if (!drawerOpen) return
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (drawerFullscreen) {
        event.preventDefault()
        setDrawerFullscreen(false)
        return
      }
      closeDrawer()
    }
    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [drawerOpen, drawerFullscreen, closeDrawer])

  const openCreate = useCallback(() => {
    setDraft({
      ...EMPTY_DRAFT,
      accessGrants: (wacWorkspaceId || workspaceId)
        ? [defaultWorkspaceGrant(wacWorkspaceId || workspaceId, workspaceName)]
        : [],
    })
    setSaveError(null)
    setCorpusQuery('')
    setGrantQuery('')
    setGrantBrowseMode('workspace')
    setGrantPickerWorkspaceId(wacWorkspaceId || workspaceId || null)
    setCurrentFolderId(null)
    setDrawerFullscreen(false)
    setDrawerOpen(true)
  }, [workspaceId, wacWorkspaceId, workspaceName])

  useImperativeHandle(ref, () => ({ openCreate }), [openCreate])

  const openEdit = (assistant: ExplainerAssistant) => {
    setDraft({
      id: assistant.id,
      version: assistant.version,
      displayName: assistant.display_name,
      description: assistant.description ?? '',
      avatar: assistant.avatar ?? 'meta-human-adira-01',
      folderIds: assistant.corpus.folder_ids ?? [],
      documentIds: assistant.corpus.document_ids ?? [],
      accessGrants: grantsFromAssistant(
        assistant,
        workspaceId ?? assistant.workspace_id,
        workspaceName,
      ),
      ...chatLimitDraftFromAssistant(assistant),
    })
    setSaveError(null)
    setCorpusQuery('')
    setGrantQuery('')
    setGrantBrowseMode('workspace')
    setGrantPickerWorkspaceId(wacWorkspaceId || workspaceId || null)
    setCurrentFolderId(null)
    setDrawerFullscreen(false)
    setDrawerOpen(true)
  }

  const toggle = (key: 'folderIds' | 'documentIds', id: string) => {
    setDraft((prev) => {
      const current = prev[key]
      return {
        ...prev,
        [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      }
    })
  }

  const searching = corpusQuery.trim().length > 0

  /**
   * Mirrors the Document Repository: browse one folder at a time instead of dumping
   * every folder and document at once. A flat list also made same-named folders at
   * different depths indistinguishable (two rows both called "BRD").
   *
   * Search is the one exception — it looks across the whole workspace, because that
   * is what a search box is for, and each hit shows the path it was found in.
   */
  const folderPathById = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]))
    const paths = new Map<string, string>()
    for (const folder of folders) {
      const segments: string[] = []
      let cursor: DocumentFolder | undefined = folder
      const guard = new Set<string>()
      while (cursor && !guard.has(cursor.id)) {
        guard.add(cursor.id)
        segments.unshift(cursor.name)
        cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined
      }
      paths.set(folder.id, segments.join(' / '))
    }
    return paths
  }, [folders])

  const breadcrumb = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]))
    const trail: DocumentFolder[] = []
    let cursor = currentFolderId ? byId.get(currentFolderId) : undefined
    const guard = new Set<string>()
    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id)
      trail.unshift(cursor)
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined
    }
    return trail
  }, [folders, currentFolderId])

  const explorerGroups = useMemo(() => {
    const q = corpusQuery.trim().toLowerCase()

    const folderRows = (
      q
        ? folders.filter((folder) => folder.name.toLowerCase().includes(q))
        : folders.filter((folder) => (folder.parent_id ?? null) === currentFolderId)
    )
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        hint: q ? folderPathById.get(folder.id) : undefined,
        modified: formatModified(folder.updated_date ?? folder.created_date),
        childCount: (folder.children_count ?? 0) + (folder.document_count ?? 0),
      }))

    const documentRows = (
      q
        ? documents.filter((doc) => doc.title.toLowerCase().includes(q))
        : documents.filter((doc) => (doc.folder_id ?? null) === currentFolderId)
    )
      .slice()
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }))
      .map((doc) => ({
        id: doc.id,
        name: doc.title,
        hint: q && doc.folder_id ? folderPathById.get(doc.folder_id) : undefined,
        modified: formatModified(doc.updated_date ?? doc.created_date),
        childCount: 0,
      }))

    return [
      { key: 'folders', label: 'File folder', stateKey: 'folderIds' as const, rows: folderRows },
      { key: 'documents', label: 'Documents', stateKey: 'documentIds' as const, rows: documentRows },
    ]
  }, [folders, documents, corpusQuery, currentFolderId, folderPathById])

  /**
   * Select-all applies to what is currently on screen (this folder, or the search
   * hits) rather than the whole workspace — a header checkbox that silently bound
   * hundreds of unseen documents would be a trap, not a shortcut.
   */
  const visibleRowCount = explorerGroups.reduce((total, group) => total + group.rows.length, 0)

  const selectedVisibleCount = explorerGroups.reduce(
    (total, group) => total + group.rows.filter((row) => draft[group.stateKey].includes(row.id)).length,
    0,
  )

  const allVisibleSelected = visibleRowCount > 0 && selectedVisibleCount === visibleRowCount
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  const toggleVisibleSelection = useCallback(() => {
    setDraft((prev) => {
      const clearing = explorerGroups.every((group) =>
        group.rows.every((row) => prev[group.stateKey].includes(row.id)),
      )
      const next = { ...prev }
      for (const group of explorerGroups) {
        const ids = group.rows.map((row) => row.id)
        if (ids.length === 0) continue
        next[group.stateKey] = clearing
          ? next[group.stateKey].filter((id) => !ids.includes(id))
          : [...new Set([...next[group.stateKey], ...ids])]
      }
      return next
    })
  }, [explorerGroups])

  // The detail view shows names, not ids; both catalogs are already loaded for the
  // corpus picker, so this reuses them rather than fetching per assistant.
  const folderNameById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  )

  const documentTitleById = useMemo(
    () => new Map(documents.map((doc) => [doc.id, doc.title])),
    [documents],
  )

  const uniqueMembers = useMemo(() => {
    const rosterKey =
      grantBrowseMode === 'users' ? ORG_GRANT_ROSTER_KEY : (grantPickerWorkspaceId || '').trim()
    if (!rosterKey) return []
    return (membersByWorkspaceId[rosterKey] ?? [])
      .slice()
      .sort((left, right) => {
        const leftName = identityNameById.get(left.subject_id) || left.subject_id
        const rightName = identityNameById.get(right.subject_id) || right.subject_id
        return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' })
      })
  }, [grantBrowseMode, grantPickerWorkspaceId, membersByWorkspaceId, identityNameById])

  const pickerRoles = useMemo(() => {
    const rosterKey =
      grantBrowseMode === 'users' ? ORG_GRANT_ROSTER_KEY : (grantPickerWorkspaceId || '').trim()
    if (!rosterKey) return []
    return rolesByWorkspaceId[rosterKey] ?? []
  }, [grantBrowseMode, grantPickerWorkspaceId, rolesByWorkspaceId])

  const workspaceGrantTargets = useMemo(() => {
    const packId = (wacWorkspaceId || workspaceId || '').trim()
    const merged = new Map<string, AccessibleWorkspaceOption>()
    for (const item of accessibleWorkspaces) {
      if (!item.id.trim()) continue
      if (
        membershipWorkspaceIds
        && membershipWorkspaceIds.length > 0
        && !membershipWorkspaceIds.includes(item.id)
        && item.id !== packId
      ) {
        continue
      }
      if (!merged.has(item.id)) merged.set(item.id, item)
    }
    if (merged.size === 0 && packId) {
      return [{ id: packId, name: workspaceName?.trim() || 'This workspace' }]
    }
    return Array.from(merged.values()).sort((left, right) => {
      if (packId && left.id === packId) return -1
      if (packId && right.id === packId) return 1
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    })
  }, [accessibleWorkspaces, membershipWorkspaceIds, wacWorkspaceId, workspaceId, workspaceName])

  const pickerWorkspace = useMemo(
    () => workspaceGrantTargets.find((item) => item.id === grantPickerWorkspaceId) ?? null,
    [workspaceGrantTargets, grantPickerWorkspaceId],
  )

  const everyoneSelected = Boolean(
    pickerWorkspace && hasGrant(draft.accessGrants, 'workspace', pickerWorkspace.id),
  )

  const pickerHasSelectedMember = uniqueMembers.some((member) =>
    hasGrant(draft.accessGrants, 'user', member.subject_id),
  )
  const grantRosterLoadingLabel =
    grantBrowseMode === 'users'
      ? 'organization users'
      : `members of ${pickerWorkspace?.name || 'this workspace'}`
  const emptyMembersHint = grantRosterError
    ? 'Members could not be loaded.'
    : grantBrowseMode === 'users'
      ? 'No organization users found.'
      : `No active members in ${pickerWorkspace?.name || 'this workspace'}.`
  const showWorkspacePicker = grantBrowseMode === 'workspace'
  const showPickWorkspaceHint = showWorkspacePicker && !grantPickerWorkspaceId
  const showMemberRoster = grantBrowseMode === 'users' || Boolean(grantPickerWorkspaceId)
  const showEmptyMembers = !grantRosterLoading && uniqueMembers.length === 0
  const showEmptyRoles = !grantRosterLoading && pickerRoles.length === 0

  const chatLimitReady =
    draft.chatLimitKind === 'none'
    || (Number.isFinite(Number(draft.chatLimitValue)) && Number(draft.chatLimitValue) > 0)
  const canSave = !!workspaceId && draft.displayName.trim().length > 0 && chatLimitReady

  const handleSave = async () => {
    if (!workspaceId || !canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const corpus = { folder_ids: draft.folderIds, document_ids: draft.documentIds }
      const chatLimit = parseChatLimitDraft(draft.chatLimitKind, draft.chatLimitValue)
      if (draft.id) {
        await patchExplainerAssistant(draft.id, {
          display_name: draft.displayName.trim(),
          description: draft.description.trim() || null,
          avatar: draft.avatar,
          corpus,
          access_grants: draft.accessGrants,
          chat_limit_kind: chatLimit.chat_limit_kind,
          chat_limit_value: chatLimit.chat_limit_value,
          version: draft.version ?? undefined,
        })
      } else {
        await createExplainerAssistant({
          display_name: draft.displayName.trim(),
          workspace_id: workspaceId,
          description: draft.description.trim() || null,
          avatar: draft.avatar,
          corpus,
          access_grants: draft.accessGrants,
          chat_limit_kind: chatLimit.chat_limit_kind,
          chat_limit_value: chatLimit.chat_limit_value,
        })
      }
      setDrawerOpen(false)
      setDrawerFullscreen(false)
      await reload()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the assistant.')
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (assistant: ExplainerAssistant, action: 'publish' | 'archive') => {
    setBusyId(assistant.id)
    setError(null)
    try {
      if (action === 'publish') await publishExplainerAssistant(assistant.id)
      else await archiveExplainerAssistant(assistant.id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The action could not be completed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className={cn(
        'liquid-glass-enterprise-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        className,
      )}
      style={style}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-5">
        <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
              <h2 className="text-lg font-semibold text-foreground">Document Explainer Assistants</h2>
              <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Knowledge only
              </Badge>
            </div>
            <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">
              Assistants that only explain the documents bound to them. They carry no operational tooling — every
              answer is grounded in a citation from their own corpus. Questions outside that corpus are refused
              politely. You can cap usage by tokens, questions, or cost.
            </p>
          </div>
        </div>

        {error ? (
          <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!workspaceId ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              Select a workspace first to manage assistants.
            </p>
          ) : assistants.length === 0 && !loading ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              No assistants yet. Create one and bind it to the folders or documents it should explain.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assistants.map((assistant) => (
                <article
                  key={assistant.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailFor(assistant)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    setDetailFor(assistant)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setMenuFor({ assistant, x: event.clientX, y: event.clientY })
                  }}
                  className={cn(
                    'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl text-left',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    // Depth comes from three stacked layers: an ambient drop shadow, a
                    // 1px inner top highlight, and a tinted base — not a fake bevel.
                    'border border-white/60 bg-gradient-to-b from-white/90 via-white/70 to-slate-100/70',
                    'dark:border-white/10 dark:from-slate-900/70 dark:via-slate-900/50 dark:to-slate-950/60',
                    'shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset,0_10px_24px_-12px_rgba(15,23,42,0.35),0_2px_6px_-2px_rgba(15,23,42,0.18)]',
                    'dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_18px_40px_-18px_rgba(0,0,0,0.75)]',
                    'ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
                    'transition-[transform,box-shadow] duration-300 ease-out',
                    'hover:-translate-y-0.5 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_20px_38px_-16px_rgba(15,23,42,0.42),0_4px_10px_-3px_rgba(15,23,42,0.22)]',
                    'dark:hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_26px_54px_-20px_rgba(0,0,0,0.85)]',
                  )}
                >
                  {/* Status colour: a saturated left edge bleeding right into the card. */}
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b',
                      statusEdge(assistant.status),
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r',
                      statusWash(assistant.status),
                    )}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
                  />

                  <div className="relative flex items-start gap-3 p-4 pb-3">
                    <span className="relative shrink-0">
                      <span
                        aria-hidden
                        className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-400/35 via-sky-400/20 to-transparent blur-[6px]"
                      />
                      {assistant.avatar ? (
                        <img
                          src={AVATAR_SRC[assistant.avatar]}
                          alt=""
                          aria-hidden
                          className="relative h-12 w-12 rounded-full bg-muted object-cover shadow-[0_3px_8px_-2px_rgba(15,23,42,0.45)] ring-2 ring-white/80 dark:ring-white/15"
                        />
                      ) : (
                        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-2 ring-white/80 dark:ring-white/15">
                          <Bot className="h-5 w-5 text-muted-foreground" aria-hidden />
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                          {assistant.display_name}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] shadow-sm',
                            statusTone(assistant.status),
                          )}
                        >
                          {busyId === assistant.id ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
                          ) : null}
                          {busyId === assistant.id ? 'Working' : statusLabel(assistant.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {assistant.description || 'No description.'}
                      </p>
                    </div>
                  </div>

                  {/* Documents is the resolved total — folders expanded plus any directly
                      bound document — because that is what the assistant can answer from. */}
                  <div className="relative mx-4 mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/50 shadow-[0_1px_2px_rgba(15,23,42,0.08)_inset] ring-1 ring-black/[0.04] dark:bg-white/10 dark:ring-white/[0.06]">
                    <div className="flex flex-col items-center bg-background/85 px-2 py-2 dark:bg-slate-900/70">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {assistant.corpus.folder_ids.length}
                      </span>
                      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Folders
                      </span>
                    </div>
                    <div
                      className="flex flex-col items-center bg-background/85 px-2 py-2 dark:bg-slate-900/70"
                      title="Documents this assistant can answer from, including everything inside the bound folders."
                    >
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          assistant.resolved_document_count === 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-foreground',
                        )}
                      >
                        {assistant.resolved_document_count}
                      </span>
                      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Documents
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {typeof document !== 'undefined' && detailFor
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[1150] bg-black/20 backdrop-blur-sm"
                onClick={() => setDetailFor(null)}
                aria-hidden="true"
              />
              <div
                className={cn(
                  'fixed top-0 right-0 z-[1200] flex h-screen w-[460px] max-w-[92vw] flex-col',
                  'border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl',
                )}
                role="dialog"
                aria-modal="true"
                aria-label={`${detailFor.display_name} details`}
              >
                <div className="relative flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b',
                      statusEdge(detailFor.status),
                    )}
                  />
                  {detailFor.avatar ? (
                    <img
                      src={AVATAR_SRC[detailFor.avatar]}
                      alt=""
                      aria-hidden
                      className="h-12 w-12 shrink-0 rounded-full bg-muted object-cover ring-2 ring-white/80 dark:ring-white/15"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-5 w-5 text-muted-foreground" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold text-foreground">{detailFor.display_name}</h2>
                    <Badge
                      variant="outline"
                      className={cn(
                        'mt-1 text-[9px] font-semibold uppercase tracking-[0.08em]',
                        statusTone(detailFor.status),
                      )}
                    >
                      {statusLabel(detailFor.status)}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDetailFor(null)}
                    aria-label="Close assistant details"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                  <section className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Description
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">
                      {detailFor.description || 'No description.'}
                    </p>
                  </section>

                  <section className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Coverage
                    </p>
                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/50 ring-1 ring-black/[0.04] dark:bg-white/10">
                      <div className="flex flex-col items-center bg-background/85 px-2 py-2.5 dark:bg-slate-900/70">
                        <span className="text-base font-semibold tabular-nums text-foreground">
                          {detailFor.corpus.folder_ids.length}
                        </span>
                        <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          Folders
                        </span>
                      </div>
                      <div className="flex flex-col items-center bg-background/85 px-2 py-2.5 dark:bg-slate-900/70">
                        <span
                          className={cn(
                            'text-base font-semibold tabular-nums',
                            detailFor.resolved_document_count === 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-foreground',
                          )}
                        >
                          {detailFor.resolved_document_count}
                        </span>
                        <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          Documents
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Documents counts everything inside the bound folders plus any directly bound document. It is
                      the only material this assistant can answer from. Questions outside that corpus are refused.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Frequently asked questions
                    </p>
                    {detailInsightsLoading ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        Loading question stats…
                      </p>
                    ) : null}
                    {!detailInsightsLoading && (!detailInsights || detailInsights.frequently_asked.length === 0) ? (
                      <p className="text-xs text-muted-foreground">
                        No user questions recorded yet. Stats appear after people chat with this assistant.
                      </p>
                    ) : null}
                    {!detailInsightsLoading && detailInsights && detailInsights.frequently_asked.length > 0 ? (
                      <ol className="space-y-1.5">
                        {detailInsights.frequently_asked.map((item, index) => (
                          <li
                            key={`${item.question}-${index}`}
                            className="flex items-start justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 flex-1 text-foreground">{item.question}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {detailInsights ? (
                      <p className="text-[11px] text-muted-foreground">
                        Chat budget:{' '}
                        {detailInsights.limit_kind
                          ? `${chatLimitKindLabel(detailInsights.limit_kind)} ${formatUsageAmount(detailInsights.limit_kind, detailInsights.limit_value)} · remaining ${formatUsageAmount(detailInsights.limit_kind, detailInsights.remaining)}`
                          : 'Unlimited'}
                        {' · '}
                        {detailInsights.questions_asked} questions asked
                      </p>
                    ) : null}
                  </section>

                  <section className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Bound folders
                    </p>
                    {detailFor.corpus.folder_ids.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No folders bound.</p>
                    ) : (
                      <ul className="space-y-1">
                        {detailFor.corpus.folder_ids.map((folderId) => (
                          <li key={folderId} className="flex items-center gap-2 text-xs text-foreground">
                            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                            <span className="truncate">{folderNameById.get(folderId) ?? folderId}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Documents in scope
                    </p>
                    {detailFor.resolved_document_ids.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Nothing resolves yet — this assistant cannot be published.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {detailFor.resolved_document_ids.slice(0, 40).map((docId) => (
                          <li key={docId} className="flex items-center gap-2 text-xs text-foreground">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden />
                            <span className="truncate">{documentTitleById.get(docId) ?? docId}</span>
                          </li>
                        ))}
                        {detailFor.resolved_document_ids.length > 40 ? (
                          <li className="pl-5 text-[11px] text-muted-foreground">
                            +{detailFor.resolved_document_ids.length - 40} more
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Details
                    </p>
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Visibility</dt>
                        <dd className="text-foreground">{detailFor.visibility}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Version</dt>
                        <dd className="tabular-nums text-foreground">{detailFor.version}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="tabular-nums text-foreground">{formatModified(detailFor.created_date)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Updated</dt>
                        <dd className="tabular-nums text-foreground">{formatModified(detailFor.updated_date)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">Assistant ID</dt>
                        <dd className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-mono text-[10px] text-muted-foreground">{detailFor.id}</span>
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard?.writeText(detailFor.id)}
                            aria-label="Copy assistant ID"
                            title="Copy assistant ID"
                            className="shrink-0 rounded p-1 hover:bg-muted"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" aria-hidden />
                          </button>
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>

                <div className="shrink-0 border-t border-border px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(enterpriseSecondaryButtonClass(), 'w-full justify-center gap-2')}
                    onClick={() => {
                      const target = detailFor
                      setDetailFor(null)
                      openEdit(target)
                    }}
                  >
                    <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                    Edit assistant
                  </Button>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}

      {menuFor ? (
        <ContextMenu
          open
          x={menuFor.x}
          y={menuFor.y}
          onClose={() => setMenuFor(null)}
          zIndex={1400}
        >
          <ContextMenuItem
            onSelect={() => {
              openEdit(menuFor.assistant)
              setMenuFor(null)
            }}
          >
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Edit assistant
          </ContextMenuItem>

          {menuFor.assistant.status !== 'published' ? (
            <ContextMenuItem
              disabled={menuFor.assistant.resolved_document_count === 0 || busyId === menuFor.assistant.id}
              title={
                menuFor.assistant.resolved_document_count === 0
                  ? 'Empty corpus — an assistant with no documents cannot answer anything.'
                  : undefined
              }
              onSelect={() => {
                const target = menuFor.assistant
                setMenuFor(null)
                void runAction(target, 'publish')
              }}
            >
              <Send className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Publish
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              disabled={busyId === menuFor.assistant.id}
              onSelect={() => {
                const target = menuFor.assistant
                setMenuFor(null)
                void runAction(target, 'archive')
              }}
            >
              <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Archive
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onSelect={() => {
              void navigator.clipboard?.writeText(menuFor.assistant.id)
              setMenuFor(null)
            }}
          >
            <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Copy assistant ID
          </ContextMenuItem>
        </ContextMenu>
      ) : null}

      {typeof document !== 'undefined'
        ? createPortal(
            <>
              <div
                className={cn(
                  'fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm transition-opacity',
                  drawerOpen && !drawerFullscreen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
                onClick={closeDrawer}
                aria-hidden="true"
              />

              <div
                className={cn(
                  'fixed top-0 right-0 z-[1100] flex h-screen transform flex-col transition-all duration-300',
                  'border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl',
                  drawerFullscreen ? 'w-screen max-w-none border-l-0' : 'w-[460px] max-w-[92vw]',
                  drawerOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0',
                )}
                style={{
                  boxShadow: drawerFullscreen
                    ? '0 0 80px rgba(0, 0, 0, 0.35)'
                    : '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
                  margin: 0,
                  padding: 0,
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="explainer-assistant-drawer-title"
              >
                <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4 backdrop-blur-sm">
                  <div className="pr-3">
                    <h2
                      id="explainer-assistant-drawer-title"
                      className="flex items-center gap-2 text-xl font-semibold text-foreground"
                    >
                      <Plus className="h-5 w-5 text-primary" aria-hidden />
                      {draft.id ? 'Edit explainer assistant' : 'Add explainer assistant'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {drawerFullscreen
                        ? 'Full window view — press Esc or use Exit full window to return to the side panel.'
                        : 'The display name appears in the assistant picker in both chat clients. The corpus is the only source this assistant can answer from.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDrawerFullscreen((open) => !open)}
                      disabled={saving}
                      aria-label={drawerFullscreen ? 'Exit explainer editor full window' : 'Open explainer editor full window'}
                      title={drawerFullscreen ? 'Exit full window' : 'Full window'}
                    >
                      {drawerFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={closeDrawer}
                      disabled={saving}
                      aria-label="Close explainer assistant"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSave()
                  }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-5 py-5 scrollbar-hide">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Avatar</Label>
                      <div className="flex items-center gap-3">
                        <img
                          src={AVATAR_SRC[draft.avatar]}
                          alt=""
                          aria-hidden
                          className="h-14 w-14 shrink-0 rounded-full bg-muted object-cover"
                        />
                        <p className="min-w-0 text-[11px] text-muted-foreground">{AVATAR_LABEL[draft.avatar]}</p>
                      </div>
                      <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
                        {EXPLAINER_AVATARS.map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() => setDraft((prev) => ({ ...prev, avatar: token }))}
                            aria-label={AVATAR_LABEL[token]}
                            aria-pressed={draft.avatar === token}
                            title={AVATAR_LABEL[token]}
                            className={cn(
                              'aspect-square overflow-hidden rounded-full bg-muted transition-transform',
                              draft.avatar === token
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                                : 'opacity-80 hover:scale-105 hover:opacity-100',
                            )}
                          >
                            <img src={AVATAR_SRC[token]} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        The same avatar is rendered in the assistant picker of both chat clients.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="explainer-name" className="text-xs text-muted-foreground">
                        Display name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="explainer-name"
                        value={draft.displayName}
                        maxLength={120}
                        placeholder="Short and unique — e.g. Policy Explainer"
                        className="h-10 text-sm"
                        onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="explainer-description" className="text-xs text-muted-foreground">
                        Description
                      </Label>
                      <Textarea
                        id="explainer-description"
                        value={draft.description}
                        maxLength={500}
                        rows={4}
                        placeholder="Short scope: which documents this assistant can explain."
                        className="min-h-[88px] text-sm"
                        onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                      />
                      <p className="text-[10px] text-muted-foreground">{draft.description.length} / 500</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Chat limit</Label>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Choose one cap for all users of this assistant, or leave it unlimited. The runtime
                        enforces the budget before each LLM turn.
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {CHAT_LIMIT_OPTIONS.map((option) => {
                          const selected = draft.chatLimitKind === option.kind
                          return (
                            <button
                              key={option.kind}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  chatLimitKind: option.kind,
                                }))
                              }
                              className={cn(
                                'rounded-lg border px-3 py-2 text-left',
                                selected ? 'border-primary/40 bg-primary/5' : 'border-border/60',
                              )}
                            >
                              <span className="block text-xs font-medium text-foreground">{option.label}</span>
                              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                                {option.hint}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {draft.chatLimitKind !== 'none' ? (
                        <div className="space-y-1.5">
                          <Label htmlFor="explainer-chat-limit-value" className="text-xs text-muted-foreground">
                            Limit value <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="explainer-chat-limit-value"
                            type="number"
                            min={1}
                            step={draft.chatLimitKind === 'cost' ? '0.01' : '1'}
                            value={draft.chatLimitValue}
                            placeholder={chatLimitValuePlaceholder(draft.chatLimitKind)}
                            className="h-10 text-sm"
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, chatLimitValue: event.target.value }))
                            }
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="explainer-grant-workspace" className="text-xs text-muted-foreground">
                        Who can chat
                      </Label>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        This assistant is stored in{' '}
                        <span className="font-medium text-foreground">
                          {workspaceName?.trim() || 'the currently selected workspace'}
                        </span>
                        . Use <span className="font-medium text-foreground">By workspace</span> to grant
                        everyone or members of one workspace. Use{' '}
                        <span className="font-medium text-foreground">By all users</span> when you want
                        people from the organization, regardless of workspace. Roles appear after you
                        select a member. Grants combine with OR.
                      </p>
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setGrantBrowseMode('workspace')
                            setGrantQuery('')
                          }}
                          className={cn(
                            'rounded-md px-2 py-1.5 text-xs font-medium',
                            grantBrowseMode === 'workspace'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground',
                          )}
                        >
                          By workspace
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGrantBrowseMode('users')
                            setGrantQuery('')
                          }}
                          className={cn(
                            'rounded-md px-2 py-1.5 text-xs font-medium',
                            grantBrowseMode === 'users'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground',
                          )}
                        >
                          By all users
                        </button>
                      </div>
                      {draft.accessGrants.length === 0 ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          No grants selected. Publishing will still work, but chat will be denied for everyone.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {draft.accessGrants.map((grant) => {
                            let chipLabel = grant.label
                            if (!chipLabel) {
                              if (grant.kind === 'workspace') {
                                const workspaceLabel = workspaceGrantTargets.find((item) => item.id === grant.value)?.name
                                chipLabel = workspaceGrantLabel(workspaceLabel)
                              } else if (grant.kind === 'user') {
                                chipLabel = identityNameById.get(grant.value) || grant.value
                              } else {
                                chipLabel = grant.value
                              }
                            }
                            return (
                              <button
                                key={grantIdentity(grant)}
                                type="button"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    accessGrants: prev.accessGrants.filter(
                                      (item) => grantIdentity(item) !== grantIdentity(grant),
                                    ),
                                  }))
                                }
                                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-foreground"
                              >
                                <span className="truncate">{chipLabel}</span>
                                <X className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {showWorkspacePicker ? (
                      <select
                        id="explainer-grant-workspace"
                        value={grantPickerWorkspaceId || ''}
                        onChange={(event) => {
                          setGrantQuery('')
                          setGrantPickerWorkspaceId(event.target.value || null)
                        }}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Select a workspace...</option>
                        {workspaceGrantTargets.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                            {workspace.id === (wacWorkspaceId || workspaceId) ? ' (this assistant workspace)' : ''}
                          </option>
                        ))}
                      </select>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Showing people from the organization across workspaces you belong to.
                        </p>
                      )}
                      {showPickWorkspaceHint ? (
                        <p className="text-[11px] text-muted-foreground">
                          Choose a workspace to see its members.
                        </p>
                      ) : null}
                      {showMemberRoster ? (
                        <div className="space-y-2">
                          {grantRosterError ? (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">{grantRosterError}</p>
                          ) : null}
                          {showWorkspacePicker ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!pickerWorkspace) return
                              setDraft((prev) => ({
                                ...prev,
                                accessGrants: toggleAccessGrant(
                                  prev.accessGrants,
                                  defaultWorkspaceGrant(pickerWorkspace.id, pickerWorkspace.name),
                                ),
                              }))
                            }}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm',
                              everyoneSelected ? 'border-primary/40 bg-primary/5' : 'border-border/60',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                everyoneSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground/40 bg-background',
                              )}
                            >
                              {everyoneSelected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                            </span>
                            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0">
                              <span className="block truncate">
                                {workspaceGrantLabel(pickerWorkspace?.name)}
                              </span>
                              <span className="block text-[10px] font-normal text-muted-foreground">
                                Select all members in this workspace
                              </span>
                            </span>
                          </button>
                          ) : null}
                          <div className="relative">
                            <Search
                              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                              aria-hidden
                            />
                            <Input
                              value={grantQuery}
                              onChange={(event) => setGrantQuery(event.target.value)}
                              placeholder={pickerHasSelectedMember ? 'Search members or roles…' : 'Search members…'}
                              className="h-9 pl-8 text-sm"
                            />
                          </div>
                          {grantRosterLoading ? (
                            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                              Loading {grantRosterLoadingLabel}…
                            </p>
                          ) : null}
                          <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-border/60 p-2">
                            <div>
                              <p className="mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                <Users className="h-3 w-3" aria-hidden />
                                Members
                              </p>
                              {uniqueMembers
                                .filter((member) => {
                                  const q = grantQuery.trim().toLowerCase()
                                  if (!q) return true
                                  const name = (identityNameById.get(member.subject_id) || member.subject_id).toLowerCase()
                                  return (
                                    name.includes(q)
                                    || member.role_code.toLowerCase().includes(q)
                                  )
                                })
                                .map((member) => {
                                  const label = identityNameById.get(member.subject_id) || member.subject_id
                                  const selected = hasGrant(draft.accessGrants, 'user', member.subject_id)
                                  return (
                                    <button
                                      key={member.id}
                                      type="button"
                                      onClick={() =>
                                        setDraft((prev) => ({
                                          ...prev,
                                          accessGrants: toggleAccessGrant(prev.accessGrants, {
                                            kind: 'user',
                                            value: member.subject_id,
                                            label,
                                          }),
                                        }))
                                      }
                                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                                    >
                                      <span
                                        className={cn(
                                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                          selected
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-muted-foreground/40 bg-background',
                                        )}
                                      >
                                        {selected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate">{label}</span>
                                      <span className="max-w-[42%] shrink-0 truncate text-[10px] text-muted-foreground">
                                        {(member.workspaceNames ?? []).join(' · ')
                                          || member.role_display_name
                                          || member.role_code}
                                      </span>
                                    </button>
                                  )
                                })}
                              {showEmptyMembers ? (
                                <p className="px-2 py-1 text-[11px] text-muted-foreground">
                                  {emptyMembersHint}
                                </p>
                              ) : null}
                            </div>
                            {pickerHasSelectedMember ? (
                            <div>
                              <p className="mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                <Shield className="h-3 w-3" aria-hidden />
                                Roles
                              </p>
                              {pickerRoles
                                .filter((role) => {
                                  const q = grantQuery.trim().toLowerCase()
                                  if (!q) return true
                                  return (
                                    role.role_code.toLowerCase().includes(q) ||
                                    role.display_name.toLowerCase().includes(q)
                                  )
                                })
                                .map((role) => {
                                  const selected = hasGrant(draft.accessGrants, 'role', role.role_code)
                                  return (
                                    <button
                                      key={role.id}
                                      type="button"
                                      onClick={() =>
                                        setDraft((prev) => ({
                                          ...prev,
                                          accessGrants: toggleAccessGrant(prev.accessGrants, {
                                            kind: 'role',
                                            value: role.role_code,
                                            label: role.display_name,
                                          }),
                                        }))
                                      }
                                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                                    >
                                      <span
                                        className={cn(
                                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                          selected
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-muted-foreground/40 bg-background',
                                        )}
                                      >
                                        {selected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate">{role.display_name}</span>
                                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                        {role.role_code}
                                      </span>
                                    </button>
                                  )
                                })}
                              {showEmptyRoles ? (
                                <p className="px-2 py-1 text-[11px] text-muted-foreground">
                                  No workspace roles available yet.
                                </p>
                              ) : null}
                            </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">
                          Corpus <span className="text-red-500">*</span>
                        </Label>
                        <span className="text-[11px] text-muted-foreground">
                          {draft.folderIds.length} folders · {draft.documentIds.length} documents
                        </span>
                      </div>
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          value={corpusQuery}
                          onChange={(event) => setCorpusQuery(event.target.value)}
                          placeholder="Search folders or documents…"
                          className="h-10 pl-8 text-sm"
                        />
                      </div>

                      {/* Same navigation model as Document Repository: one folder at a
                          time, with a breadcrumb back to the root. */}
                      {!searching ? (
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => setCurrentFolderId(null)}
                            className={cn(
                              'rounded px-1.5 py-0.5 hover:bg-muted/60',
                              currentFolderId === null && 'font-semibold text-foreground',
                            )}
                          >
                            All documents
                          </button>
                          {breadcrumb.map((folder) => (
                            <span key={folder.id} className="flex items-center gap-1">
                              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                              <button
                                type="button"
                                onClick={() => setCurrentFolderId(folder.id)}
                                className={cn(
                                  'max-w-[160px] truncate rounded px-1.5 py-0.5 hover:bg-muted/60',
                                  currentFolderId === folder.id && 'font-semibold text-foreground',
                                )}
                              >
                                {folder.name}
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Searching the whole workspace — clear the search box to browse folders again.
                        </p>
                      )}

                      <div className="overflow-hidden rounded-lg border border-border/60">
                        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                          <span className="flex w-[72px] shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={toggleVisibleSelection}
                              disabled={visibleRowCount === 0}
                              aria-label={allVisibleSelected ? 'Clear selection in this view' : 'Select everything in this view'}
                              title={allVisibleSelected ? 'Clear selection in this view' : 'Select everything in this view'}
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border disabled:opacity-40',
                                allVisibleSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : someVisibleSelected
                                    ? 'border-primary bg-primary/25'
                                    : 'border-muted-foreground/40 bg-background',
                              )}
                            >
                              {allVisibleSelected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                            </button>
                            Select
                          </span>
                          <span className="min-w-0 flex-1">Name</span>
                          <span className="w-[124px] shrink-0">Date modified</span>
                        </div>
                        <div className={cn('overflow-y-auto', drawerFullscreen ? 'max-h-[52vh]' : 'max-h-[320px]')}>
                          {explorerGroups.every((group) => group.rows.length === 0) ? (
                            <p className="p-6 text-center text-[11px] text-muted-foreground">
                              {searching ? 'No matches in this workspace.' : 'This folder is empty.'}
                            </p>
                          ) : (
                            explorerGroups.map((group) =>
                              group.rows.length === 0 ? null : (
                                <div key={group.key}>
                                  <button
                                    type="button"
                                    onClick={() => toggleGroup(group.key)}
                                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-muted/50"
                                  >
                                    {collapsedGroups.includes(group.key) ? (
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                    )}
                                    {group.label}
                                    <span className="font-normal text-muted-foreground">({group.rows.length})</span>
                                  </button>

                                  {collapsedGroups.includes(group.key)
                                    ? null
                                    : group.rows.map((row) => {
                                        const selected = draft[group.stateKey].includes(row.id)
                                        const isFolder = group.key === 'folders'
                                        return (
                                          <div
                                            key={row.id}
                                            className={cn(
                                              'flex items-center gap-2 px-3 py-1.5 text-xs',
                                              selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/50',
                                            )}
                                          >
                                            {/* Selecting is separate from opening, so drilling into a
                                                folder never silently binds it to the corpus. */}
                                            <span className="flex w-[72px] shrink-0 items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => toggle(group.stateKey, row.id)}
                                                aria-pressed={selected}
                                                aria-label={`${selected ? 'Remove' : 'Add'} ${row.name}`}
                                                className={cn(
                                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                                  selected
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : 'border-muted-foreground/40 bg-background',
                                                )}
                                              >
                                                {selected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                                              </button>
                                              {isFolder ? (
                                                <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                                              ) : (
                                                <FileText className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
                                              )}
                                            </span>

                                            {isFolder ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setCorpusQuery('')
                                                  setCurrentFolderId(row.id)
                                                }}
                                                title={row.hint ? `Open — ${row.hint}` : 'Open folder'}
                                                className="min-w-0 flex-1 truncate text-left hover:underline"
                                              >
                                                {row.name}
                                                {row.hint ? (
                                                  <span className="ml-1.5 text-[10px] text-muted-foreground">{row.hint}</span>
                                                ) : null}
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => toggle(group.stateKey, row.id)}
                                                title={row.hint ?? row.name}
                                                className="min-w-0 flex-1 truncate text-left"
                                              >
                                                {row.name}
                                                {row.hint ? (
                                                  <span className="ml-1.5 text-[10px] text-muted-foreground">{row.hint}</span>
                                                ) : null}
                                              </button>
                                            )}

                                            <span className="w-[124px] shrink-0 tabular-nums text-[11px] text-muted-foreground">
                                              {row.modified}
                                            </span>
                                          </div>
                                        )
                                      })}
                                </div>
                              ),
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {saveError ? (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {saveError}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
                    <div className="flex w-full items-stretch gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 flex-1 basis-0 justify-center gap-2')}
                        onClick={closeDrawer}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="default"
                        className={cn(registerServicePrimaryButtonClass(), 'min-w-0 flex-1 basis-0 justify-center gap-2')}
                        disabled={!canSave || saving}
                      >
                        <Save className="h-4 w-4 shrink-0" aria-hidden />
                        {saving ? 'Saving...' : draft.id ? 'Update assistant' : 'Save assistant'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
})

export default ExplainerAssistantsPanel
