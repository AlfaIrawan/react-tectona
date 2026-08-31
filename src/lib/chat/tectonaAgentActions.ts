/**
 * Tectona Assistant — proposed workspace & idea actions (client-side executor).
 */

import { getSession } from '@/auth/authService'
import { randomUuid } from '@/lib/randomId'
import {
  getIdeaById,
  getPersistentIdeaSummary,
  patchIdea,
  upsertPersistentIdeaSummary,
} from '@/lib/api/ideaBacklogApi'
import {
  createWorkspaceOrgWorkspace,
  deleteWorkspaceOrgWorkspace,
  fetchAllWorkspaceOrgWorkspaces,
  fetchWorkspaceOrgOrganizations,
  patchWorkspaceOrgWorkspace,
  type WorkspaceOrgWorkspaceDto,
} from '@/lib/api/workspaceOrgApi'
import {
  postApplyGovernanceTemplate,
  fetchWorkspaceGovernanceAssignmentByWorkspaceId,
} from '@/lib/api/workspaceGovernanceApi'
import { fetchGovernanceCatalogSnapshot } from '@/lib/api/governanceConfigurationApi'
import {
  createWorkspaceMembership,
  TECTONA_WAC_APP_ID,
} from '@/lib/api/workspaceAccessControlApi'
import { deleteWorkspaceOrgKbMirror, syncWorkspaceOrgEntryToKb } from '@/lib/kb/workspaceOrgKbSync'
import { applyDocumentChatEdit } from '@/lib/api/documentKnowledgeApi'
import { getKbEntry, patchKbEntry } from '@/lib/api/tectonaKbApi'
import { applyIdeaSectionRevisionFromChat } from '@/lib/chat/ideaSectionRevisionFromChat'

export type TectonaAgentActionCode =
  | 'workspace.create'
  | 'workspace.update'
  | 'workspace.delete'
  | 'workspace.governance.apply'
  | 'workspace.member.add'
  | 'idea.content.inject'
  | 'idea.section.revision'
  | 'app.navigate'
  | 'document.apply_chat_edit'
  | 'document.transform'
  | 'knowledge.person_alias.add'

export type TectonaIdeaContentUpdate = {
  target: string
  value: string
  mode?: 'replace' | 'append'
}

export type TectonaProposedAction = {
  action_id: string
  action_code: TectonaAgentActionCode
  summary: string
  payload: Record<string, unknown>
  risk_level?: 'low' | 'medium' | 'high'
  requires_confirmation?: boolean
}

export type TectonaAgentActionExecutionStatus = 'pending' | 'executing' | 'succeeded' | 'failed' | 'cancelled'

export type TectonaAgentActionExecution = {
  status: TectonaAgentActionExecutionStatus
  result_summary?: string
  error?: string
}

export type TectonaAgentActionState = {
  actions: TectonaProposedAction[]
  executions: Record<string, TectonaAgentActionExecution>
}

function slugifyWorkspaceKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `ws-${Date.now().toString(36)}`
}

function normalizeWorkspaceQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findWorkspaceByNameFuzzy(
  all: WorkspaceOrgWorkspaceDto[],
  name: string,
): WorkspaceOrgWorkspaceDto | undefined {
  const lower = name.trim().toLowerCase()
  if (!lower) return undefined
  const exact = all.find((w) => w.name.toLowerCase() === lower)
  if (exact) return exact

  const contains = all.filter(
    (w) => lower.includes(w.name.toLowerCase()) || w.name.toLowerCase().includes(lower),
  )
  if (contains.length === 1) return contains[0]

  const qTokens = new Set(normalizeWorkspaceQuery(name).split(' ').filter(Boolean))
  if (qTokens.size === 0) return undefined
  const scored = all
    .map((w) => {
      const wTokens = new Set(normalizeWorkspaceQuery(w.name).split(' ').filter(Boolean))
      const overlap = [...qTokens].filter((token) => wTokens.has(token)).length
      return { w, overlap }
    })
    .filter((row) => row.overlap >= Math.max(2, qTokens.size - 1))
    .sort((a, b) => b.overlap - a.overlap)
  if (scored.length === 1) return scored[0].w
  if (scored.length >= 2 && scored[0].overlap > scored[1].overlap) return scored[0].w
  return undefined
}

async function resolveWorkspaceRef(payload: Record<string, unknown>): Promise<WorkspaceOrgWorkspaceDto> {
  const workspaceId = typeof payload.workspace_id === 'string' ? payload.workspace_id.trim() : ''
  const all = await fetchAllWorkspaceOrgWorkspaces()
  if (workspaceId) {
    const found = all.find((w) => w.id === workspaceId)
    if (found) return found
    throw new Error(`Workspace id not found: ${workspaceId}`)
  }

  const key = typeof payload.workspace_key === 'string' ? payload.workspace_key.trim() : ''
  const name = typeof payload.workspace_name === 'string' ? payload.workspace_name.trim() : ''
  if (key) {
    const byKey = all.find((w) => w.workspace_key === key)
    if (byKey) return byKey
  }
  if (name) {
    const byName = findWorkspaceByNameFuzzy(all, name)
    if (byName) return byName
  }
  throw new Error('Workspace not found — specify the workspace name/code/id.')
}

/** Mirror of WorkspaceManagementPage.lifecycleStageToWorkspaceOrgStatusCode. */
function workspaceLifecycleToStatusCode(stage: string): 'active' | 'inactive' | 'archived' {
  if (stage === 'Archived') return 'archived'
  if (stage === 'Suspended') return 'inactive'
  return 'active'
}

function mergeTextValue(existing: string | null | undefined, incoming: string, mode: 'replace' | 'append'): string {
  const base = (existing ?? '').trim()
  const next = incoming.trim()
  if (!next) return base
  if (mode === 'append' && base) return `${base}\n\n${next}`
  return next
}

function dispatchIdeaUpdated(ideaId: string): void {
  window.dispatchEvent(new CustomEvent('tectona:idea-updated', { detail: { ideaId } }))
}

function dispatchDocumentEdited(documentId: string, attachmentId: string): void {
  window.dispatchEvent(
    new CustomEvent('tectona:document-edited', { detail: { documentId, attachmentId } }),
  )
}

function normalizeKnowledgeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export function addPersonAliasToKbHtml(content: string, alias: string): string {
  const normalizedAlias = normalizeKnowledgeText(alias)
  if (!normalizedAlias) throw new Error('Alias is required.')

  const doc = new DOMParser().parseFromString(content, 'text/html')
  const listItems = Array.from(doc.body.querySelectorAll('li'))
  const aliasItem = listItems.find((item) => {
    const label = item.querySelector('strong')?.textContent?.replace(/:\s*$/, '') ?? ''
    return ['nama panggilan', 'alias'].includes(normalizeKnowledgeText(label))
  })
  if (aliasItem) {
    if (normalizeKnowledgeText(aliasItem.textContent ?? '').includes(normalizedAlias)) {
      return doc.body.innerHTML
    }
    aliasItem.append(doc.createTextNode(`, ${alias}`))
    return doc.body.innerHTML
  }

  const nameItem = listItems.find((item) => {
    const label = item.querySelector('strong')?.textContent?.replace(/:\s*$/, '') ?? ''
    return normalizeKnowledgeText(label) === 'nama'
  })
  if (!nameItem) throw new Error('Canonical person name field was not found in the KB profile.')

  const newItem = doc.createElement('li')
  const label = doc.createElement('strong')
  label.textContent = 'Nama Panggilan:'
  newItem.append(label, doc.createTextNode(` ${alias}`))
  nameItem.insertAdjacentElement('afterend', newItem)
  return doc.body.innerHTML
}

async function applyPersonAliasKnowledge(payload: Record<string, unknown>): Promise<string> {
  const entryId = String(payload.entry_id ?? '').trim()
  const alias = String(payload.alias ?? '').trim()
  if (!entryId) throw new Error('KB entry id is required.')
  if (!alias) throw new Error('Alias is required.')

  const entry = await getKbEntry(entryId)
  const content = addPersonAliasToKbHtml(entry.content, alias)
  if (content !== entry.content) {
    await patchKbEntry(entryId, { content })
  }
  window.dispatchEvent(new CustomEvent('tectona:kb-updated', { detail: { entryId } }))
  return `Alias "${alias}" tersimpan pada profil "${entry.title}" dan tersedia untuk user lain.`
}

async function applyDocumentSectionEdit(payload: Record<string, unknown>): Promise<string> {
  const documentId = String(payload.document_id ?? '').trim()
  if (!documentId) throw new Error('document_id is required to apply this edit.')

  const location = payload.location as { table_index?: number; row_index?: number } | undefined
  if (!location || typeof location.table_index !== 'number' || typeof location.row_index !== 'number') {
    throw new Error('A precise document location is required to apply this edit.')
  }
  const proposedText = String(payload.proposed_text ?? '').trim()
  if (!proposedText) throw new Error('No proposed content to apply.')

  const result = await applyDocumentChatEdit(documentId, {
    location: { table_index: location.table_index, row_index: location.row_index },
    original_text: String(payload.original_text ?? ''),
    proposed_text: proposedText,
  })
  dispatchDocumentEdited(documentId, result.attachment_id)
  const sectionTitle = String(payload.section_title ?? 'Bagian').trim() || 'Bagian'
  return `"${sectionTitle}" di dokumen sudah diperbarui.`
}

async function applyIdeaContentInject(payload: Record<string, unknown>): Promise<string> {
  const ideaId = String(payload.idea_id ?? '').trim()
  if (!ideaId) throw new Error('idea_id is required to inject idea content.')

  const updates = Array.isArray(payload.updates) ? (payload.updates as TectonaIdeaContentUpdate[]) : []
  if (updates.length === 0) throw new Error('No fields to update.')

  let idea = await getIdeaById(ideaId)
  const ideaPatch: Parameters<typeof patchIdea>[1] = { version: idea.version }
  const summaryRecord = await getPersistentIdeaSummary(ideaId)
  const summaryJson: Record<string, unknown> = summaryRecord
    ? { ...(summaryRecord.summary_json as Record<string, unknown>) }
    : {}
  let summaryTouched = false

  for (const update of updates) {
    const target = String(update.target ?? '').trim()
    const value = String(update.value ?? '').trim()
    const mode = update.mode === 'append' ? 'append' : 'replace'
    if (!target || !value) continue

    if (target.startsWith('summary.')) {
      const key = target.slice('summary.'.length)
      summaryJson[key] = mergeTextValue(
        typeof summaryJson[key] === 'string' ? (summaryJson[key] as string) : '',
        value,
        mode,
      )
      summaryTouched = true
      continue
    }

    if (target === 'scope_summary') {
      ideaPatch.scope_summary = mergeTextValue(idea.scope_summary, value, mode)
    } else if (target === 'business_objective') {
      ideaPatch.business_objective = mergeTextValue(idea.business_objective, value, mode)
    } else if (target === 'risk_summary') {
      ideaPatch.risk_summary = mergeTextValue(idea.risk_summary, value, mode)
    } else if (target === 'description') {
      ideaPatch.description = mergeTextValue(idea.description, value, mode)
    } else if (target === 'title') {
      ideaPatch.title = value
    }
  }

  const patchKeys = Object.keys(ideaPatch).filter((key) => key !== 'version')
  if (patchKeys.length > 0) {
    try {
      idea = await patchIdea(ideaId, ideaPatch)
    } catch {
      const latest = await getIdeaById(ideaId)
      idea = await patchIdea(ideaId, { ...ideaPatch, version: latest.version })
    }
  }

  if (summaryTouched) {
    const session = getSession()
    await upsertPersistentIdeaSummary(ideaId, {
      summary_json: summaryJson,
      summary_mode: (summaryRecord?.summary_mode as 'llm_first') ?? 'llm_first',
      confidence_score: summaryRecord?.confidence_score ?? 0.85,
      generated_by: session?.user?.id ?? 'tectona-assistant',
      source_session_id: null,
      version: idea.version,
    })
  }

  dispatchIdeaUpdated(ideaId)
  const ideaTitle = String(payload.idea_title ?? idea.title ?? ideaId)
  return `Idea content "${ideaTitle}" was saved to the database successfully.`
}

/**
 * Build a chat-friendly markdown summary of a workspace's detail (same fields the
 * Workspace Details drawer shows) from the workspace-org record + governance assignment.
 * Used by the assistant's "Explain in chat" option so the explanation is the real detail,
 * not a backend stakeholder lookup.
 */
export async function buildWorkspaceDetailMarkdown(label: string): Promise<string> {
  const q = label.trim().toLowerCase()
  if (!q) return "I don't know which workspace you mean yet."
  const all = await fetchAllWorkspaceOrgWorkspaces()
  const ws =
    all.find(
      (w) => w.name.toLowerCase() === q || w.workspace_key.toLowerCase() === q || w.id.toLowerCase() === q,
    ) ?? all.find((w) => q.includes(w.name.toLowerCase()) || w.name.toLowerCase().includes(q))
  if (!ws) return `I couldn't find a Workspace "${label}" in the workspace directory.`

  const meta = ws.metadata && typeof ws.metadata === 'object' ? (ws.metadata as Record<string, unknown>) : {}
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string).trim() : '')
  const num = (k: string) => (typeof meta[k] === 'number' && !Number.isNaN(meta[k]) ? (meta[k] as number) : 0)

  let governance = 'Not configured'
  try {
    const assign = await fetchWorkspaceGovernanceAssignmentByWorkspaceId(ws.id)
    if (assign?.governance_template_id) {
      let tplName = ''
      try {
        const cat = await fetchGovernanceCatalogSnapshot()
        tplName = cat.templates.find((t) => t.id === assign.governance_template_id)?.name ?? ''
      } catch {
        /* catalog optional */
      }
      governance = tplName ? `Configured — template: ${tplName}` : 'Configured'
    }
  } catch {
    /* no assignment yet → keep "Not configured" */
  }

  const lines = [
    `**Workspace Detail ${ws.name}**`,
    '',
    `- **Name:** ${ws.name}`,
    `- **Code:** \`${ws.workspace_key}\``,
    `- **Organization:** ${ws.organization_name || '—'}`,
    `- **Type:** ${str('tectona_workspace_classification') || '—'}`,
    `- **Lifecycle/Status:** ${str('tectona_lifecycle_stage') || ws.status_code}`,
    `- **Owner:** ${str('tectona_owner') || '—'}`,
    `- **Governance:** ${governance}`,
    `- **Members:** ${num('tectona_members_count')}`,
    `- **Projects:** ${num('tectona_projects_count')}`,
  ]
  if (ws.description) lines.push(`- **Description:** ${ws.description}`)
  lines.push('', 'Would you like me to open it directly in the UI so you can see everything? Just say yes.')
  return lines.join('\n')
}

export async function executeTectonaAgentAction(action: TectonaProposedAction): Promise<string> {
  const session = getSession()
  const actorId = session?.user?.id
  const payload = action.payload ?? {}

  switch (action.action_code) {
    case 'workspace.create': {
      // Mandatory fields mirror the Workspace Management wizard: name, organization,
      // type (classification), owner. Lifecycle defaults to Active. The form card
      // collects these; we enforce them here so the directory row renders fully.
      const name = String(payload.name ?? '').trim()
      if (!name) throw new Error('Workspace name is required.')
      const workspaceType = String(payload.workspace_type ?? payload.classification ?? '').trim()
      if (!workspaceType) throw new Error('Workspace type/classification is required.')
      const owner = String(payload.owner ?? '').trim()
      if (!owner) throw new Error('Workspace owner is required.')
      const lifecycleStage = String(payload.lifecycle_stage ?? '').trim() || 'Active'

      // Resolve organization: explicit id if given+valid, else the default active org.
      const orgs = await fetchWorkspaceOrgOrganizations({ page_size: 50 })
      const explicitOrgId =
        typeof payload.organization_id === 'string' ? payload.organization_id.trim() : ''
      let org = explicitOrgId ? orgs.items.find((o) => o.id === explicitOrgId) : undefined
      if (!org) org = orgs.items.find((o) => o.status_code === 'active') ?? orgs.items[0]
      if (!org?.id) {
        throw new Error('No organization available — create one first in Workspace Management.')
      }

      const workspaceKey =
        typeof payload.workspace_key === 'string' && payload.workspace_key.trim()
          ? payload.workspace_key.trim()
          : slugifyWorkspaceKey(name)
      const description =
        typeof payload.description === 'string' && payload.description.trim()
          ? payload.description.trim()
          : null
      const idempotencyKey = randomUuid()

      const metadata: Record<string, unknown> = {
        tectona_workspace_classification: workspaceType,
        tectona_owner: owner,
        tectona_lifecycle_stage: lifecycleStage,
        tectona_primary_organization_label: org.name,
        tectona_related_organization_ids: [],
        tectona_ownership_identity_mode: 'local',
        tectona_owner_verification_status: 'unverified',
        tectona_business_owner_verification_status: 'not_set',
        tectona_technical_owner_verification_status: 'not_set',
        tectona_members_count: 0,
        tectona_projects_count: 0,
        tectona_integrations: [],
        tectona_assets_count: 0,
        tectona_last_updated: new Date().toISOString(),
      }

      const created = await createWorkspaceOrgWorkspace(
        {
          organization_id: org.id,
          workspace_key: workspaceKey,
          name,
          description,
          status_code: workspaceLifecycleToStatusCode(lifecycleStage),
          metadata,
        },
        { actorId, idempotencyKey },
      )
      // Let an open Workspace Management page refetch so the new row appears immediately.
      window.dispatchEvent(
        new CustomEvent('tectona:workspace-created', { detail: { id: created.id } }),
      )
      await syncWorkspaceOrgEntryToKb(created)
      return `Workspace "${created.name}" created (code: ${created.workspace_key}, id: ${created.id}).`
    }

    case 'workspace.update': {
      const ws = await resolveWorkspaceRef(payload)
      const patch: {
        name?: string
        description?: string | null
        version: number
      } = { version: ws.version }
      if (typeof payload.name === 'string' && payload.name.trim()) patch.name = payload.name.trim()
      if (payload.description !== undefined) {
        patch.description = typeof payload.description === 'string' ? payload.description : null
      }
      if (Object.keys(patch).length <= 1) throw new Error('No fields to update — specify a new name or description.')
      const updated = await patchWorkspaceOrgWorkspace(ws.id, patch, { actorId })
      window.dispatchEvent(
        new CustomEvent('tectona:workspace-updated', { detail: { id: updated.id } }),
      )
      await syncWorkspaceOrgEntryToKb(updated)
      return `Workspace "${updated.name}" updated (id: ${updated.id}).`
    }

    case 'workspace.delete': {
      const ws = await resolveWorkspaceRef(payload)
      const deletedId = ws.id
      const deletedName = ws.name
      await deleteWorkspaceOrgWorkspace(deletedId, { actorId })
      await deleteWorkspaceOrgKbMirror(deletedId)
      return `Workspace "${deletedName}" deleted.`
    }

    case 'workspace.governance.apply': {
      const ws = await resolveWorkspaceRef(payload)
      const templateId = String(payload.governance_template_id ?? '').trim()
      if (!templateId) throw new Error('A governance template is required.')
      await postApplyGovernanceTemplate(ws.id, templateId)
      // Refresh the Workspace Directory / Governance Matrix so the new status shows up.
      window.dispatchEvent(
        new CustomEvent('tectona:governance-updated', { detail: { workspaceId: ws.id } }),
      )
      return `Governance template applied to workspace "${ws.name}".`
    }

    case 'workspace.member.add': {
      const ws = await resolveWorkspaceRef(payload)
      const subjectId = String(payload.subject_id ?? '').trim()
      if (!subjectId) throw new Error('subject_id is required — specify a user id or email already registered in identity.')
      const roleCode = String(payload.role_code ?? 'member').trim() || 'member'
      const idempotencyKey = randomUuid()
      await createWorkspaceMembership(
        TECTONA_WAC_APP_ID,
        ws.id,
        {
          subject_id: subjectId,
          role_code: roleCode,
          status_code: 'active',
          participation_scope_code: 'project_only',
        },
        { actorId, idempotencyKey },
      )
      return `Member added to workspace "${ws.name}" (role: ${roleCode}).`
    }

    case 'idea.content.inject':
      return applyIdeaContentInject(payload)

    case 'idea.section.revision': {
      const transition = payload.transition === 'reject' ? 'reject' : 'accept'
      return applyIdeaSectionRevisionFromChat({
        ideaId: String(payload.idea_id ?? '').trim(),
        sectionKey: String(payload.section_key ?? '').trim(),
        content: String(payload.content ?? '').trim(),
        transition,
        sourceSessionId: typeof payload.source_session_id === 'string' ? payload.source_session_id : null,
        isImpactSection: Boolean(payload.is_impact_section),
      })
    }

    case 'document.apply_chat_edit':
      return applyDocumentSectionEdit(payload)

    case 'knowledge.person_alias.add':
      return applyPersonAliasKnowledge(payload)

    case 'app.navigate': {
      const pathname = String(payload.pathname ?? '').trim()
      if (!pathname.startsWith('/')) {
        throw new Error('Invalid navigation pathname.')
      }
      const search = typeof payload.search === 'string' ? payload.search : ''
      window.dispatchEvent(
        new CustomEvent('tectona:navigate', {
          detail: { pathname, search: search || null },
        }),
      )
      const label =
        typeof payload.module_label === 'string' && payload.module_label.trim()
          ? payload.module_label.trim()
          : pathname
      return `Opening ${label}.`
    }

    default:
      throw new Error(`Unsupported action: ${action.action_code}`)
  }
}

export function buildAgentActionState(actions: TectonaProposedAction[]): TectonaAgentActionState {
  return {
    actions,
    executions: Object.fromEntries(
      actions.map((action) => [action.action_id, { status: 'pending' as const }]),
    ),
  }
}

export function actionRiskLabel(level?: string): string {
  if (level === 'high') return 'High risk'
  if (level === 'low') return 'Low risk'
  return 'Medium risk'
}

export function actionCategoryLabel(actionCode: string): string {
  if (actionCode === 'app.navigate') return 'Navigation'
  if (actionCode.startsWith('idea.')) return 'Idea action'
  if (actionCode.startsWith('document.')) return 'Document action'
  if (actionCode.startsWith('knowledge.')) return 'Knowledge action'
  return 'Workspace action'
}

export function formatActionPayloadPreview(action: TectonaProposedAction): Array<{ label: string; value: string }> {
  const p = action.payload ?? {}
  const rows: Array<{ label: string; value: string }> = []
  const push = (label: string, key: string) => {
    const v = p[key]
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      rows.push({ label, value: String(v) })
    }
  }
  switch (action.action_code) {
    case 'workspace.create':
      push('Name', 'name')
      push('Code', 'workspace_key')
      push('Organization ID', 'organization_id')
      push('Description', 'description')
      break
    case 'workspace.update':
      push('Workspace', 'workspace_name')
      push('Workspace ID', 'workspace_id')
      push('New name', 'name')
      push('Description', 'description')
      break
    case 'workspace.delete':
      push('Workspace', 'workspace_name')
      push('Workspace ID', 'workspace_id')
      break
    case 'workspace.governance.apply':
      push('Workspace', 'workspace_name')
      push('Template ID', 'governance_template_id')
      break
    case 'workspace.member.add':
      push('Workspace', 'workspace_name')
      push('Subject ID', 'subject_id')
      push('Role', 'role_code')
      break
    case 'idea.content.inject': {
      push('Idea ID', 'idea_id')
      const updates = Array.isArray(p.updates) ? (p.updates as TectonaIdeaContentUpdate[]) : []
      for (const [index, update] of updates.slice(0, 3).entries()) {
        rows.push({ label: `Target ${index + 1}`, value: String(update.target ?? '') })
        rows.push({ label: `Mode ${index + 1}`, value: String(update.mode ?? 'replace') })
        rows.push({ label: `Content ${index + 1}`, value: String(update.value ?? '').slice(0, 240) })
      }
      break
    }
    case 'idea.section.revision':
      push('Section', 'section_label')
      push('Action', 'transition')
      if (typeof p.content === 'string' && p.content.trim()) {
        rows.push({ label: 'Proposal', value: p.content.slice(0, 240) })
      }
      break
    case 'app.navigate':
      push('Page', 'module_label')
      push('Route', 'pathname')
      break
    case 'document.apply_chat_edit':
      push('Section', 'section_title')
      if (typeof p.proposed_text === 'string' && p.proposed_text.trim()) {
        rows.push({ label: 'New content', value: p.proposed_text.slice(0, 240) })
      }
      break
    case 'knowledge.person_alias.add':
      push('Profil', 'canonical_name')
      push('Alias baru', 'alias')
      break
    default:
      break
  }
  return rows
}
