export type KbWorkspaceOrgField = {
  label: string
  value: string
}

export type KbWorkspaceOrgSection = {
  title: string
  fields: KbWorkspaceOrgField[]
}

export type KbWorkspaceOrgDetailContent = {
  summaryFields: KbWorkspaceOrgField[]
  description?: string
  sections: KbWorkspaceOrgSection[]
}

const WORKSPACE_ORG_FIELD_NAMES = ['Workspace Key', 'Organization', 'Status', 'Description', 'Metadata'] as const
const WORKSPACE_MEMBER_FIELD_NAMES = ['Member', 'Identity Ref', 'Email', 'Workspace', 'Role', 'Status', 'Job Title', 'Department', 'Manager'] as const

function normalizeKbLabelledPlainText(content: string, fieldNames: readonly string[]): string {
  let normalized = content.replace(/\r/g, '\n').trim()
  for (const field of fieldNames) {
    const pattern = new RegExp(`\\s+(${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}):`, 'gi')
    normalized = normalized.replace(pattern, `\n$1:`)
  }
  return normalized
}

function parseLabelledPlainFields(content: string, fieldNames: readonly string[]): KbWorkspaceOrgField[] {
  const normalized = normalizeKbLabelledPlainText(content, fieldNames)
  const fields: KbWorkspaceOrgField[] = []
  const labelPattern = fieldNames.map((field) => field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const match = line.match(new RegExp(`^(${labelPattern}):\\s*(.*)$`, 'i'))
    if (!match?.[1] || match[2] == null) continue
    fields.push({ label: match[1].trim(), value: match[2].trim() })
  }
  return fields
}

function humanizeMetadataKey(key: string): string {
  const cleaned = key.replace(/^tectona_/, '').replace(/_/g, ' ').trim()
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function formatMetadataValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (Array.isArray(value)) return value.length ? value.map((item) => formatMetadataValue(item)).join(', ') : '—'
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${humanizeMetadataKey(key)}: ${formatMetadataValue(nested)}`)
      .join('; ')
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    }
  }
  const text = String(value).trim()
  return text || '—'
}

function groupWorkspaceMetadata(metadata: Record<string, unknown>): KbWorkspaceOrgSection[] {
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

  const groups: Record<string, KbWorkspaceOrgField[]> = {
    Kepemilikan: [],
    Governance: [],
    Organisasi: [],
    'Statistik & Integrasi': [],
    Lainnya: [],
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'tectona_governance' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        groups.Governance.push({ label: humanizeMetadataKey(subKey), value: formatMetadataValue(subValue) })
      }
      continue
    }
    const field = { label: humanizeMetadataKey(key), value: formatMetadataValue(value) }
    if (ownershipKeys.has(key)) groups.Kepemilikan.push(field)
    else if (orgKeys.has(key)) groups.Organisasi.push(field)
    else if (statsKeys.has(key)) groups['Statistik & Integrasi'].push(field)
    else groups.Lainnya.push(field)
  }

  return Object.entries(groups)
    .filter(([, fields]) => fields.length > 0)
    .map(([title, fields]) => ({ title, fields }))
}

export function parseKbWorkspaceOrgPlainContent(content: string): KbWorkspaceOrgDetailContent | null {
  const trimmed = content.trim()
  if (!trimmed || /^</.test(trimmed)) return null
  if (!/^Workspace Key:/im.test(trimmed)) return null

  const parsedFields = parseLabelledPlainFields(trimmed, WORKSPACE_ORG_FIELD_NAMES)
  const summaryFields: KbWorkspaceOrgField[] = []
  let description = ''
  let metadata: Record<string, unknown> | null = null

  for (const field of parsedFields) {
    if (/^description$/i.test(field.label)) {
      description = field.value
      continue
    }
    if (/^metadata$/i.test(field.label)) {
      try {
        const parsed = JSON.parse(field.value) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          metadata = parsed as Record<string, unknown>
        }
      } catch {
        summaryFields.push({ label: 'Metadata', value: field.value })
      }
      continue
    }
    summaryFields.push(field)
  }

  if (summaryFields.length === 0) return null
  return {
    summaryFields,
    description: description || undefined,
    sections: metadata ? groupWorkspaceMetadata(metadata) : [],
  }
}

export function parseKbWorkspaceMemberPlainContent(content: string): KbWorkspaceOrgDetailContent | null {
  const trimmed = content.trim()
  if (!trimmed || /^</.test(trimmed)) return null
  if (!/^Member:/im.test(trimmed)) return null

  const summaryFields = parseLabelledPlainFields(trimmed, WORKSPACE_MEMBER_FIELD_NAMES)
  if (summaryFields.length === 0) return null
  return { summaryFields, sections: [] }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function listItem(label: string, value: string): string {
  return `<li><strong>${escapeHtml(label)}</strong> — ${escapeHtml(value || '—')}</li>`
}

export function convertKbWorkspaceOrgPlainToHtml(content: string): string | null {
  const workspace = parseKbWorkspaceOrgPlainContent(content)
  if (workspace) {
    const parts = [
      '<h2>Profil Workspace</h2>',
      `<ul>${workspace.summaryFields.map((field) => listItem(field.label, field.value)).join('')}</ul>`,
    ]
    if (workspace.description) {
      parts.push(`<p>${escapeHtml(workspace.description)}</p>`)
    }
    for (const section of workspace.sections) {
      parts.push(`<h3>${escapeHtml(section.title)}</h3>`)
      parts.push(`<ul>${section.fields.map((field) => listItem(field.label, field.value)).join('')}</ul>`)
    }
    return parts.join('')
  }

  const member = parseKbWorkspaceMemberPlainContent(content)
  if (!member) return null
  return `<h2>Profil Anggota Workspace</h2><ul>${member.summaryFields.map((field) => listItem(field.label, field.value)).join('')}</ul>`
}

export function looksLikeKbWorkspaceOrgPlainContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed || kbLooksLikeHtmlContent(trimmed)) return false
  return /^Workspace Key:/im.test(trimmed) || /^Member:/im.test(trimmed)
}

export function kbLooksLikeHtmlContent(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content)
}

type KbWorkspaceOrgDetailViewProps = {
  content: KbWorkspaceOrgDetailContent
  heading: string
  workspaces?: Array<{ id: string; workspace_key: string; name?: string | null }>
  formatWorkspaceLabel?: (value: string) => string
}

export function KbWorkspaceOrgDetailView({
  content,
  heading,
  formatWorkspaceLabel,
}: KbWorkspaceOrgDetailViewProps) {
  const formatValue = (label: string, value: string) => {
    if (formatWorkspaceLabel && /^(workspace|workspace key)$/i.test(label)) {
      return formatWorkspaceLabel(value)
    }
    return value || '—'
  }

  return (
    <div className="space-y-4 font-sans text-sm leading-7 text-muted-foreground">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{heading}</h2>
        <ul className="mb-2 list-disc space-y-1 pl-6">
          {content.summaryFields.map((field) => (
            <li key={field.label}>
              <span className="font-medium text-foreground">{field.label}</span>
              {`: ${formatValue(field.label, field.value)}`}
            </li>
          ))}
        </ul>
        {content.description ? <p>{content.description}</p> : null}
      </section>

      {content.sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          <ul className="mb-2 list-disc space-y-1 pl-6">
            {section.fields.map((field) => (
              <li key={`${section.title}-${field.label}`}>
                <span className="font-medium text-foreground">{field.label}</span>
                {`: ${field.value || '—'}`}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
