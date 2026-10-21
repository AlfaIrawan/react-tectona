import { getWorkflow, listWorkflows } from '@/lib/api/workflowAutomationApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  getDocumentRevisionText,
  listAllDocuments,
  listDocumentRevisions,
  type DocumentResponse,
} from '@/lib/api/documentKnowledgeApi'
import { IDENTITY_API_BASE } from '@/lib/api/gatewayBase'
import { apiFetch, tectonaServiceHeaders } from '@/lib/api/httpClient'
import { createNotification, TECTONA_APP_ID } from '@/lib/api/notificationApi'
import { fetchWorkspaceMembers, TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'

export const URD_REVIEW_HEADS = [
  {
    key: 'research',
    label: 'Head of Business Project & Research',
    normalized: 'head of business project and research',
  },
  {
    key: 'pmo',
    label: 'Head of Business Project Management Office',
    normalized: 'head of business project management office',
  },
] as const

export function normalizeJobTitle(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ReviewJobTitle = { key: string; label: string; normalized: string }

export function parseJobTitles(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/)
  const seen = new Set<string>()
  const titles: string[] = []
  for (const item of raw) {
    const label = String(item ?? '').trim()
    const key = normalizeJobTitle(label)
    if (!label || !key || seen.has(key)) continue
    seen.add(key)
    titles.push(label)
  }
  return titles
}

export type EmailRecipientBy = 'name' | 'jobTitle' | 'department' | 'role' | 'team' | 'workspace'

export type AudienceMembership = {
  subject_id: string
  role_code?: string | null
  role_display_name?: string | null
  operational_team_code?: string | null
  operational_team_display_name?: string | null
  operational_teams?: Array<{ team_code?: string | null; display_name?: string | null }>
}

export function parseEmailRecipientBy(value: unknown): EmailRecipientBy {
  const raw = String(value ?? '').trim()
  if (raw === 'name' || raw === 'department' || raw === 'role' || raw === 'jobTitle' || raw === 'team' || raw === 'workspace') return raw
  return 'jobTitle'
}

function membershipMatchesTeam(membership: AudienceMembership, key: string): boolean {
  const labels = [
    membership.operational_team_code,
    membership.operational_team_display_name,
    ...(membership.operational_teams ?? []).flatMap((team) => [team.team_code, team.display_name]),
  ]
  return labels.some((label) => normalizeJobTitle(label) === key)
}

export function matchEmailRecipients(input: {
  users: IdentityUserDto[]
  memberships?: AudienceMembership[]
  by: EmailRecipientBy
  values: string[]
}): { matched: Array<{ label: string; user: IdentityUserDto }>; missing: string[] } {
  const wanted = parseJobTitles(input.values)
  const matched: Array<{ label: string; user: IdentityUserDto }> = []
  const missing: string[] = []
  const used = new Set<string>()
  for (const label of wanted) {
    const key = normalizeJobTitle(label)
    const hits = input.users.filter((user) => {
      if (used.has(user.id)) return false
      if (input.by === 'name') return normalizeJobTitle(user.display_name) === key
      if (input.by === 'department') return normalizeJobTitle(user.organizational_unit) === key
      if (input.by === 'role') {
        return (input.memberships ?? []).some((membership) => (
          membership.subject_id === user.id
          && (normalizeJobTitle(membership.role_display_name) === key || normalizeJobTitle(membership.role_code) === key)
        ))
      }
      if (input.by === 'team') {
        return (input.memberships ?? []).some((membership) => membership.subject_id === user.id && membershipMatchesTeam(membership, key))
      }
      return normalizeJobTitle(user.job_title) === key
    })
    if (hits.length === 0) {
      missing.push(label)
      continue
    }
    for (const user of hits) {
      used.add(user.id)
      matched.push({ label, user })
    }
  }
  return { matched, missing }
}

/** Empty badges include everyone. A badge matches the viewer's name, job title, department, team, role, or workspace. */
export function ideaAudienceMatches(input: {
  user: IdentityUserDto | null | undefined
  memberships?: AudienceMembership[]
  workspaces?: Array<string | null | undefined>
  by: EmailRecipientBy
  values: string[]
}): boolean {
  const wanted = parseJobTitles(input.values)
  if (wanted.length === 0) return true
  if (input.by === 'workspace') {
    const keys = new Set(wanted.map((label) => normalizeJobTitle(label)))
    return (input.workspaces ?? []).some((label) => keys.has(normalizeJobTitle(label)))
  }
  if (!input.user) return false
  return matchEmailRecipients({
    users: [input.user],
    memberships: input.memberships,
    by: input.by,
    values: wanted,
  }).matched.length > 0
}

export function matchUrdReviewHeads(users: IdentityUserDto[], titles?: string[]): {
  matched: Array<{ head: ReviewJobTitle; user: IdentityUserDto }>
  missing: string[]
} {
  const requested = titles ?? URD_REVIEW_HEADS.map((head) => head.label)
  const heads: ReviewJobTitle[] = parseJobTitles(requested).map((label) => ({
    key: normalizeJobTitle(label),
    label,
    normalized: normalizeJobTitle(label),
  }))
  const matched: Array<{ head: ReviewJobTitle; user: IdentityUserDto }> = []
  const missing: string[] = []
  for (const head of heads) {
    const user = users.find((item) => normalizeJobTitle(item.job_title) === head.normalized)
    if (user) matched.push({ head, user })
    else missing.push(head.label)
  }
  return { matched, missing }
}

export function urdReviewSummaryText(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() ?? '').filter(Boolean).join('\n\n')
}

/** Same token written onto a generated file: the first segment of `template_code`. */
export type IdeaEmailDocumentKind = string

const EMAIL_DOCUMENT_KIND_RE = /^[A-Z][A-Z0-9]{0,15}$/

export function emailDocumentKindFromTemplateCode(templateCode: string | null | undefined): string | null {
  const kind = (templateCode ?? '').split('-', 1)[0]?.trim().toUpperCase() ?? ''
  return EMAIL_DOCUMENT_KIND_RE.test(kind) ? kind : null
}

export function emailDocumentKindsFromTemplates(
  templates: Array<{ template_code?: string | null; has_attachment?: boolean }>,
): string[] {
  const kinds = new Set<string>()
  for (const template of templates) {
    if (template.has_attachment === false) continue
    const kind = emailDocumentKindFromTemplateCode(template.template_code)
    if (kind) kinds.add(kind)
  }
  return [...kinds].sort((left, right) => left.localeCompare(right))
}

function isIdeaDocument(doc: DocumentResponse, kind: IdeaEmailDocumentKind): boolean {
  const metadata = doc.metadata ?? {}
  const candidates = [metadata.doc_type_label, metadata.template_code, doc.document_type_code, doc.title]
  return candidates.some((value) => String(value ?? '').trim().split(/[-_\s]/, 1)[0]?.toUpperCase() === kind)
}

export type UrdEmailBodySource = 'summary' | 'urd' | 'sections' | 'fixed'

export type UrdEmailConfig = {
  source: UrdEmailBodySource
  documentKind: IdeaEmailDocumentKind
  sections: string[]
  fixedText: string
  includeCover: boolean
}

export const DEFAULT_URD_EMAIL_CONFIG: UrdEmailConfig = {
  source: 'urd',
  documentKind: 'URD',
  sections: [],
  fixedText: '',
  includeCover: false,
}

export function parseIdeaEmailDocumentKind(value: unknown): IdeaEmailDocumentKind {
  const kind = String(value ?? 'URD').trim().toUpperCase()
  return EMAIL_DOCUMENT_KIND_RE.test(kind) ? kind : 'URD'
}

const COVER_HEADINGS = new Set([
  'user requirement document',
  'business requirement document',
  'functional specification document',
  'functional specification',
  'confidentiality',
  'related documents',
  'sign-off',
  'sign off',
  'created by',
  'approved by',
])

function isCoverLine(line: string): boolean {
  const stripped = line.trim()
  const lowered = stripped.toLowerCase().replace(/,$/, '')
  if (COVER_HEADINGS.has(lowered)) return true
  if (lowered.startsWith('pt adira dinamika')) return true
  if (lowered.startsWith('company confidential')) return true
  if ('☐□☑✓'.includes(stripped[0] ?? '')) return true
  if (lowered.startsWith('branch agent,')) return true
  if (lowered.startsWith('this document contains proprietary')) return true
  if (lowered.startsWith('belum ada dokumen sumber terlampir')) return true
  if (lowered.startsWith('by signing this document')) return true
  return false
}

function isDocumentHeading(line: string): boolean {
  const stripped = line.trim()
  if (!stripped || stripped.includes(' | ')) return false
  if (/^(page\s+\d+|copyright)$/i.test(stripped)) return false
  if (stripped.length > 72 || stripped.endsWith('.')) return false
  return stripped.split(/\s+/).length <= 10
}

export function isEmailCoverHeading(line: string): boolean {
  return isCoverLine(line)
}

export type TemplateEmailPart = {
  heading: string
  preview: string
  cover: boolean
}

/** Headings in a template, in order, including cover blocks the email can opt into. */
export function templateEmailParts(text: string): TemplateEmailPart[] {
  const parts: TemplateEmailPart[] = []
  let heading: string | null = null
  let previewLines: string[] = []
  const flush = () => {
    if (!heading) return
    const preview = previewLines.map((line) => line.trim()).filter(Boolean).slice(0, 3).join(' ').slice(0, 180)
    parts.push({ heading, preview, cover: isCoverLine(heading) })
    heading = null
    previewLines = []
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (isDocumentHeading(line)) {
      flush()
      heading = line
      continue
    }
    if (heading) previewLines.push(line)
  }
  flush()
  return parts
}

export function urdDocumentHeadings(text: string): string[] {
  const seen = new Set<string>()
  const headings: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!isDocumentHeading(line) || isCoverLine(line)) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    headings.push(line)
  }
  return headings
}

function stripCover(text: string): string {
  const kept: string[] = []
  let skipping = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      if (!skipping) kept.push('')
      continue
    }
    if (isCoverLine(line)) {
      skipping = true
      continue
    }
    const real = /^section\s+[a-z0-9]/i.test(line) || (line.includes(' | ') && !isCoverLine(line))
    if (skipping && !real) continue
    skipping = false
    kept.push(line)
  }
  return kept.join('\n').trim()
}

export function parseUrdEmailConfig(config: Record<string, unknown> | null | undefined): UrdEmailConfig {
  const source = String(config?.emailBodySource ?? 'urd')
  const normalized: UrdEmailBodySource = source === 'summary' || source === 'sections' || source === 'fixed' || source === 'urd'
    ? source
    : 'urd'
  const sections = String(config?.emailBodySections ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    source: normalized,
    sections,
    fixedText: String(config?.emailBodyText ?? ''),
    includeCover: String(config?.emailIncludeCover ?? 'no') === 'yes',
    documentKind: parseIdeaEmailDocumentKind(config?.emailDocumentKind),
  }
}

export function composeUrdEmailBody(input: {
  config: UrdEmailConfig
  summary: string
  urdText: string
}): string {
  const summary = input.summary.trim()
  const urd = input.urdText.trim()
  if (input.config.source === 'summary') return summary
  if (input.config.source === 'fixed') return input.config.fixedText.trim() || summary
  const document = input.config.includeCover ? urd : stripCover(urd)
  if (input.config.source === 'urd') return document || summary
  const wanted = new Set(input.config.sections.map((section) => section.trim().toLowerCase()))
  if (wanted.size === 0) return document || summary
  const chunks: Array<{ heading: string | null; lines: string[] }> = []
  let heading: string | null = null
  let lines: string[] = []
  const flush = () => {
    if (heading || lines.some((line) => line.trim())) chunks.push({ heading, lines })
  }
  for (const raw of document.split(/\r?\n/)) {
    const line = raw.trim()
    if (isDocumentHeading(line)) {
      flush()
      heading = line
      lines = [line]
      continue
    }
    lines.push(raw)
  }
  flush()
  const picked = chunks
    .filter((chunk) => chunk.heading && wanted.has(chunk.heading.toLowerCase()))
    .flatMap((chunk) => [...chunk.lines, ''])
  if (picked.length === 0) return `Bagian yang dipilih tidak ditemukan di ${input.config.documentKind}.`
  return picked.join('\n').trim()
}

export function urdEmailSourceLabel(source: UrdEmailBodySource, documentKind: IdeaEmailDocumentKind = 'URD'): string {
  if (source === 'summary') return 'Ringkasan AI'
  if (source === 'sections') return `Bagian tertentu · ${documentKind}`
  if (source === 'fixed') return 'Teks tetap'
  return `${documentKind} utuh`
}

export async function loadPublishedApprovalMail(workspaceId: string): Promise<{
  emailConfig: UrdEmailConfig
  jobTitles: string[]
  recipientBy: EmailRecipientBy
}> {
  const listed = await listWorkflows(workspaceId)
  const published = listed.filter((item) => item.is_published && item.status === 'Active')
  for (const item of published) {
    const workflow = await getWorkflow(item.id)
    const nodes = Array.isArray(workflow.definition?.nodes) ? workflow.definition.nodes : []
    for (const node of nodes) {
      const data = (node as { data?: { kind?: string; config?: Record<string, unknown> } }).data
      if (data?.kind !== 'approval' || !data.config) continue
      const recipientBy = parseEmailRecipientBy(data.config.emailRecipientBy)
      const explicit = parseJobTitles(data.config.emailRecipients)
      const jobTitles = explicit.length > 0 ? explicit : parseJobTitles(data.config.jobTitles ?? data.config.job_titles)
      const hasEmail = Boolean(data.config.emailBodySource)
      if (jobTitles.length === 0 && !hasEmail) continue
      return {
        emailConfig: parseUrdEmailConfig(data.config),
        jobTitles,
        recipientBy: explicit.length > 0 ? recipientBy : 'jobTitle',
      }
    }
  }
  return {
    emailConfig: DEFAULT_URD_EMAIL_CONFIG,
    jobTitles: URD_REVIEW_HEADS.map((head) => head.label),
    recipientBy: 'jobTitle' as EmailRecipientBy,
  }
}

export async function loadPublishedUrdEmailConfig(workspaceId: string): Promise<UrdEmailConfig> {
  const mail = await loadPublishedApprovalMail(workspaceId)
  return mail.emailConfig
}

/** Plain text of the idea's current file of the chosen kind. Empty when that file does not exist yet. */
export async function loadIdeaUrdEmailBody(ideaId: string, documentKind: IdeaEmailDocumentKind = 'URD'): Promise<string> {
  const page = await listAllDocuments({ idea_id: ideaId, page: 1, page_size: 100 })
  const document = page.items.find((item) => isIdeaDocument(item, documentKind))
  if (!document) return ''
  const revisions = await listDocumentRevisions(document.id)
  const current = revisions.find((revision) => revision.is_current) ?? revisions[0]
  if (!current) return (document.summary ?? '').trim()
  const text = await getDocumentRevisionText(document.id, current)
  return (text || document.summary || '').trim()
}

export async function loadIdentityUsersForJobTitles(): Promise<IdentityUserDto[]> {
  const users: IdentityUserDto[] = []
  const pageSize = 200
  for (let offset = 0; offset < 2000; offset += pageSize) {
    const page = await fetchIdentityUsers({ limit: pageSize, offset })
    users.push(...page.items)
    if (page.items.length < pageSize) break
  }
  return users
}

export async function sendUrdForBusinessReview(input: {
  ideaId: string
  ideaTitle: string
  summaryText: string
  linkUrl: string
  createdBy: string
  workspaceId?: string | null
  emailConfig?: UrdEmailConfig
}): Promise<{ notified: string[]; missing: string[]; mailErrors: string[] }> {
  const users = await loadIdentityUsersForJobTitles()
  const summary = input.summaryText.trim() || input.ideaTitle
  const published = input.workspaceId
    ? await loadPublishedApprovalMail(input.workspaceId).catch(() => null)
    : null
  const emailConfig = input.emailConfig ?? published?.emailConfig ?? DEFAULT_URD_EMAIL_CONFIG
  const jobTitles = published?.jobTitles ?? URD_REVIEW_HEADS.map((head) => head.label)
  const recipientBy = published?.recipientBy ?? 'jobTitle'
  const memberships = recipientBy === 'role' && input.workspaceId
    ? await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, input.workspaceId).then((page) => page.items).catch(() => [])
    : []
  const urdText = emailConfig.source === 'summary' || emailConfig.source === 'fixed'
    ? ''
    : await loadIdeaUrdEmailBody(input.ideaId, emailConfig.documentKind)
  const urdBody = composeUrdEmailBody({ config: emailConfig, summary, urdText }) || summary
  const subject = `${emailConfig.documentKind} review: ${input.ideaTitle}`
  const mailErrors: string[] = []
  const { matched, missing } = matchEmailRecipients({
    users,
    memberships,
    by: recipientBy,
    values: jobTitles,
  })
  if (matched.length === 0) {
    return { notified: [], missing, mailErrors: [] }
  }
  await Promise.all(matched.map(async ({ label, user }) => {
    await createNotification({
      app_id: TECTONA_APP_ID,
      user_id: user.id,
      type_code: 'todo',
      title: subject,
      body: summary,
      link_url: input.linkUrl,
      metadata: {
        idea_id: input.ideaId,
        document_kind: emailConfig.documentKind,
        job_title: label,
      },
      created_by: input.createdBy,
      created_from: 'tectona-urd-review',
    })
  }))
  try {
    const response = await apiFetch(`${IDENTITY_API_BASE.replace(/\/$/, '')}/v1/email/urd-review`, {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({
        subject,
        body: urdBody,
        recipient_by: recipientBy === 'role' ? 'name' : recipientBy,
        recipients: recipientBy === 'role' ? matched.map(({ user }) => user.display_name) : jobTitles,
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { detail?: string; error?: { message?: string } } | null
      const message = payload?.error?.message || payload?.detail
      mailErrors.push(typeof message === 'string' ? message : `Email gagal dikirim (${response.status}).`)
    }
  } catch (error) {
    mailErrors.push(error instanceof Error ? error.message : 'email failed')
  }
  return {
    notified: matched.map(({ label }) => label),
    missing,
    mailErrors,
  }
}
