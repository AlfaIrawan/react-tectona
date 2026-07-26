/**
 * Mirror workspace-org rows into KB (source-upsert) and notify open KB UI to refetch.
 * Complements server-side sync in python-workspace-org-service-fastapi/api/kb_sync.py.
 */

import { deleteKbWorkspaceMirror, upsertKbSourceEntry } from '@/lib/api/tectonaKbApi'
import type { WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'

function escapeHtml(value: unknown): string {
  const text = value == null ? '' : String(value)
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function humanizeKey(key: string): string {
  const cleaned = key.replace(/^tectona_/, '').replace(/_/g, ' ').trim()
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase()) || key
}

function formatScalar(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '—'
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const parsed = new Date(trimmed)
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`
      }
    }
    return trimmed
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatScalar(item)).join(', ') : '—'
  }
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${humanizeKey(k)}: ${formatScalar(v)}`,
    )
    return parts.length ? parts.join('; ') : '—'
  }
  return String(value)
}

function listItem(label: string, value: unknown): string {
  return `<li><strong>${escapeHtml(label)}</strong> — ${escapeHtml(formatScalar(value))}</li>`
}

function section(title: string, items: string[]): string {
  if (!items.length) return ''
  return `<h3>${escapeHtml(title)}</h3><ul>${items.join('')}</ul>`
}

function groupMetadata(metadata: Record<string, unknown>): Array<{ title: string; fields: Array<[string, unknown]> }> {
  const ownershipKeys = new Set([
    'tectona_owner',
    'tectona_business_owner',
    'tectona_technical_owner',
    'tectona_owner_verification_status',
    'tectona_business_owner_verification_status',
    'tectona_technical_owner_verification_status',
    'tectona_ownership_identity_mode',
  ])
  const orgKeys = new Set([
    'tectona_primary_organization_label',
    'tectona_workspace_classification',
    'tectona_related_organization_ids',
  ])
  const statsKeys = new Set([
    'tectona_assets_count',
    'tectona_members_count',
    'tectona_projects_count',
    'tectona_integrations',
    'tectona_last_updated',
    'tectona_lifecycle_stage',
  ])

  const groups: Record<string, Array<[string, unknown]>> = {
    Kepemilikan: [],
    Governance: [],
    Organisasi: [],
    'Statistik & Integrasi': [],
    Lainnya: [],
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'tectona_governance' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        groups.Governance.push([humanizeKey(subKey), subValue])
      }
      continue
    }
    const field: [string, unknown] = [humanizeKey(key), value]
    if (ownershipKeys.has(key)) groups.Kepemilikan.push(field)
    else if (orgKeys.has(key)) groups.Organisasi.push(field)
    else if (statsKeys.has(key)) groups['Statistik & Integrasi'].push(field)
    else groups.Lainnya.push(field)
  }

  return Object.entries(groups)
    .filter(([, fields]) => fields.length > 0)
    .map(([title, fields]) => ({ title, fields }))
}

export function buildWorkspaceKbContentHtml(workspace: WorkspaceOrgWorkspaceDto): string {
  const orgLabel = `${workspace.organization_code || ''} - ${workspace.organization_name || ''}`.replace(/^ - | - $/g, '').trim()
  const summaryItems = [
    listItem('Workspace Key', workspace.workspace_key),
    listItem('Organization', orgLabel || '—'),
    listItem('Status', workspace.status_code),
  ]
  const parts = ['<h2>Profil Workspace</h2>', `<ul>${summaryItems.join('')}</ul>`]
  const description = (workspace.description ?? '').trim()
  if (description) parts.push(`<p>${escapeHtml(description)}</p>`)

  const metadata = workspace.metadata ?? {}
  if (metadata && typeof metadata === 'object') {
    for (const group of groupMetadata(metadata as Record<string, unknown>)) {
      const items = group.fields.map(([label, value]) => listItem(label, value))
      const block = section(group.title, items)
      if (block) parts.push(block)
    }
  }
  return parts.join('')
}

export function dispatchKbMirrorUpdated(workspaceId?: string): void {
  window.dispatchEvent(
    new CustomEvent('tectona:kb-updated', {
      detail: workspaceId ? { workspaceId } : {},
    }),
  )
}

/** Best-effort KB mirror upsert; always notifies listeners so KB UI can refetch. */
export async function syncWorkspaceOrgEntryToKb(workspace: WorkspaceOrgWorkspaceDto): Promise<void> {
  try {
    await upsertKbSourceEntry({
      source_system: 'workspace-org',
      source_entity_type: 'workspace',
      source_entity_ref: workspace.id,
      source_parent_ref: workspace.organization_id,
      category: 'org_structure',
      title: workspace.name || workspace.workspace_key || workspace.id,
      content: buildWorkspaceKbContentHtml(workspace),
      is_active: workspace.status_code === 'active',
      priority: 60,
      workspace_id: workspace.id,
      visibility_scope: 'internal',
    })
  } catch {
    // Server-side workspace-org PATCH also triggers KB sync; do not fail the caller.
  } finally {
    dispatchKbMirrorUpdated(workspace.id)
  }
}

/** Remove workspace-org mirror rows from KB (workspace profile + member mirrors). */
export async function deleteWorkspaceOrgKbMirror(workspaceId: string): Promise<void> {
  const wid = workspaceId.trim()
  if (!wid) return
  try {
    await deleteKbWorkspaceMirror(wid)
  } catch {
    // workspace-org DELETE also triggers server-side mirror delete; do not fail the caller.
  } finally {
    dispatchKbMirrorUpdated(wid)
    window.dispatchEvent(new CustomEvent('tectona:workspace-deleted', { detail: { id: wid } }))
  }
}
