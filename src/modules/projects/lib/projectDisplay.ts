import { DEFAULT_ACCOUNTS, getSession } from '@/auth/authService'
import { extractPlainTextFromHtml, richHtmlEditorIsEmpty, sanitizeRichHtml } from '@/lib/richHtmlEditor'
import { getProjectTemplateById, PROJECT_TEMPLATES, type ProjectTemplate } from '../data/projectTemplates'

const PROJECT_TAG_BADGE_CLASSES = [
  'bg-violet-500/15 text-violet-700 ring-1 ring-inset ring-violet-500/25',
  'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/25',
  'bg-sky-500/15 text-sky-700 ring-1 ring-inset ring-sky-500/25',
  'bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-500/25',
  'bg-amber-500/15 text-amber-800 ring-1 ring-inset ring-amber-500/25',
  'bg-cyan-500/15 text-cyan-800 ring-1 ring-inset ring-cyan-500/25',
  'bg-indigo-500/15 text-indigo-700 ring-1 ring-inset ring-indigo-500/25',
  'bg-fuchsia-500/15 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-500/25',
] as const

function hashString(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash
}

export function formatProjectTagLabel(tag: string): string {
  const normalized = tag.trim().toLowerCase()
  if (normalized.startsWith('template:')) {
    return normalized.slice('template:'.length)
  }
  return normalized
}

export function isProjectTemplateTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase()
  if (normalized.startsWith('template:')) return true
  return PROJECT_TEMPLATES.some((template) => template.id === normalized)
}

export function getProjectTagBadgeClass(tag: string): string {
  const idx = hashString(formatProjectTagLabel(tag)) % PROJECT_TAG_BADGE_CLASSES.length
  return PROJECT_TAG_BADGE_CLASSES[idx]
}

const LEGACY_DUMMY_OWNER_ID = '00000000-0000-0000-0000-000000000001'

function sessionDisplayName(): string | null {
  const session = getSession()?.user
  if (!session) return null
  const account = DEFAULT_ACCOUNTS.find((entry) => entry.email === session.email)
  return account?.name ?? session.name ?? session.email
}

export function resolveProjectOwnerDisplay(project: {
  ownerId?: string
  ownerName?: string
  members?: { userId: string; displayName: string; roleCode: string }[]
}): string {
  const session = getSession()?.user
  const ownerMember = project.members?.find((member) => member.roleCode === 'owner')
  const ownerId = project.ownerId ?? ownerMember?.userId

  if (session && ownerId && session.id === ownerId) {
    return sessionDisplayName() ?? project.ownerName ?? 'Unknown'
  }

  if (session && ownerId === LEGACY_DUMMY_OWNER_ID) {
    return sessionDisplayName() ?? project.ownerName ?? 'Unknown'
  }

  if (ownerMember?.displayName && ownerMember.displayName !== 'Admin User') {
    return ownerMember.displayName
  }

  return project.ownerName ?? ownerMember?.displayName ?? 'Unknown'
}

function resolveProjectTemplate(project: { tags?: string[] }): ProjectTemplate | undefined {
  const templateTag = project.tags?.find((tag) => isProjectTemplateTag(tag))
  if (!templateTag) return undefined
  return getProjectTemplateById(formatProjectTagLabel(templateTag))
}

/** Rich HTML description for project header — user text, else template default. */
export function resolveProjectDescriptionHtml(project: {
  description?: string
  tags?: string[]
}): string {
  const userHtml = project.description?.trim()
  if (userHtml && !richHtmlEditorIsEmpty(userHtml)) {
    return sanitizeRichHtml(userHtml)
  }

  const template = resolveProjectTemplate(project)
  const fallback = template?.defaultDescription ?? template?.cardSummary ?? template?.summary
  if (!fallback) return ''

  return sanitizeRichHtml(`<p>${fallback.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
}

export function resolveProjectDescriptionPlain(project: {
  description?: string
  tags?: string[]
}): string {
  const html = resolveProjectDescriptionHtml(project)
  return extractPlainTextFromHtml(html).trim()
}
