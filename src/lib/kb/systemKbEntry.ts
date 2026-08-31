import { createKbEntry, deleteKbEntry, patchKbEntry, type KbEntryResponse } from '@/lib/api/tectonaKbApi'
import { isAdiraFinanceWorkspaceId } from '@/lib/kb/adiraApplicationGlossary'
import { readConfiguredApmWorkspaceIds } from '@/lib/kb/apmWorkspaceConfig'
import { defaultSystemKbTableHtml } from '@/lib/kb/systemKbTableEditor'

/** Canonical title shown in Document & Knowledge Management. */
export const IDEA_INTAKE_CHECKLIST_DEFAULT_TITLE = 'Idea Intake Checklist (Default)'
export const LIST_ISTILAH_DEFAULT_TITLE = 'Glossary (Default)'
export const LIST_SINGKATAN_DEFAULT_TITLE = 'Abbreviation List (Default)'
export const KATALOG_APLIKASI_DEFAULT_TITLE = 'Application Catalog (Default)'
export const STAKEHOLDER_RACI_DEFAULT_TITLE = 'Stakeholder & RACI (Default)'
export const DAFTAR_PROSES_AS_IS_DEFAULT_TITLE = 'AS-IS Process List (Default)'
export const ATURAN_PENYEBUTAN_DEFAULT_TITLE = 'Naming Rules (Default)'
export const ORG_CONTEXT_DEFAULT_TITLE = 'Org Context (Default)'
export const APPLICATION_NOTES_DEFAULT_TITLE = 'Application Notes (Default)'

const CHECKLIST_TITLE_PATTERN = /^idea intake checklist(?: \(default\))?$/i
const LIST_ISTILAH_TITLE_PATTERN = /^(?:list istilah|glossary|list of terms)(?: \(default\))?$/i
const LIST_SINGKATAN_TITLE_PATTERN = /^(?:list singkatan|abbreviation list)(?: \(default\))?$/i
const KATALOG_APLIKASI_TITLE_PATTERN = /^(?:katalog aplikasi|application catalog)(?: \(default\))?$/i
const STAKEHOLDER_RACI_TITLE_PATTERN = /^stakeholder & raci(?: \(default\))?$/i
const DAFTAR_PROSES_AS_IS_TITLE_PATTERN = /^(?:daftar proses as-is|as-is process list)(?: \(default\))?$/i
const ATURAN_PENYEBUTAN_TITLE_PATTERN = /^(?:aturan penyebutan|naming rules)(?: \(default\))?$/i
const ORG_CONTEXT_TITLE_PATTERN = /^(?:org context|konteks org)(?: \(default\))?$/i
const APPLICATION_NOTES_TITLE_PATTERN = /^(?:application notes|catatan aplikasi)(?: \(default\))?$/i

const SYSTEM_KB_TITLE_PATTERNS = [
  CHECKLIST_TITLE_PATTERN,
  LIST_ISTILAH_TITLE_PATTERN,
  LIST_SINGKATAN_TITLE_PATTERN,
  KATALOG_APLIKASI_TITLE_PATTERN,
  STAKEHOLDER_RACI_TITLE_PATTERN,
  DAFTAR_PROSES_AS_IS_TITLE_PATTERN,
  ATURAN_PENYEBUTAN_TITLE_PATTERN,
  ORG_CONTEXT_TITLE_PATTERN,
  APPLICATION_NOTES_TITLE_PATTERN,
]

const SYSTEM_KB_TITLE_DISPLAY: Array<{ pattern: RegExp; display: string }> = [
  { pattern: CHECKLIST_TITLE_PATTERN, display: IDEA_INTAKE_CHECKLIST_DEFAULT_TITLE },
  { pattern: LIST_ISTILAH_TITLE_PATTERN, display: LIST_ISTILAH_DEFAULT_TITLE },
  { pattern: LIST_SINGKATAN_TITLE_PATTERN, display: LIST_SINGKATAN_DEFAULT_TITLE },
  { pattern: KATALOG_APLIKASI_TITLE_PATTERN, display: KATALOG_APLIKASI_DEFAULT_TITLE },
  { pattern: STAKEHOLDER_RACI_TITLE_PATTERN, display: STAKEHOLDER_RACI_DEFAULT_TITLE },
  { pattern: DAFTAR_PROSES_AS_IS_TITLE_PATTERN, display: DAFTAR_PROSES_AS_IS_DEFAULT_TITLE },
  { pattern: ATURAN_PENYEBUTAN_TITLE_PATTERN, display: ATURAN_PENYEBUTAN_DEFAULT_TITLE },
  { pattern: ORG_CONTEXT_TITLE_PATTERN, display: ORG_CONTEXT_DEFAULT_TITLE },
  { pattern: APPLICATION_NOTES_TITLE_PATTERN, display: APPLICATION_NOTES_DEFAULT_TITLE },
]

export const DEFAULT_IDEA_INTAKE_CHECKLIST_CONTENT = JSON.stringify(
  {
    version: 1,
    questions: [
      { id: 'as_is_actors', prompt: 'Who is involved in the current (AS-IS) process?', required: true },
      { id: 'as_is_steps', prompt: 'What are the main AS-IS steps from start to finish?', required: true },
      { id: 'as_is_systems', prompt: 'Which systems or applications are used today?', required: false },
      { id: 'pain_points', prompt: 'What is the biggest pain point or bottleneck?', required: true },
      { id: 'to_be_process', prompt: 'What should the expected (TO-BE) process look like?', required: true },
    ],
  },
  null,
  2,
)

export const DEFAULT_LIST_ISTILAH_HTML = defaultSystemKbTableHtml('istilah')
export const DEFAULT_LIST_SINGKATAN_HTML = defaultSystemKbTableHtml('singkatan')
export const DEFAULT_KATALOG_APLIKASI_HTML = defaultSystemKbTableHtml('aplikasi')
export const DEFAULT_STAKEHOLDER_RACI_HTML = defaultSystemKbTableHtml('raci')
export const DEFAULT_DAFTAR_PROSES_AS_IS_HTML = defaultSystemKbTableHtml('proses_as_is')
export const DEFAULT_ATURAN_PENYEBUTAN_HTML = defaultSystemKbTableHtml('penyebutan')
export const DEFAULT_ORG_CONTEXT_HTML = defaultSystemKbTableHtml('org_overlay')
export const DEFAULT_APPLICATION_NOTES_HTML = defaultSystemKbTableHtml('app_notes')

type WorkspaceSystemKbSpec = {
  title: string
  titlePattern: RegExp
  category: string
  priority: number
  content: string
  kind: 'glossary' | 'abbreviation' | 'application_catalog' | 'stakeholders' | 'as_is_process' | 'naming' | 'org_overlay' | 'app_notes'
}

const WORKSPACE_SYSTEM_KB_SPECS: WorkspaceSystemKbSpec[] = [
  {
    title: LIST_ISTILAH_DEFAULT_TITLE,
    titlePattern: LIST_ISTILAH_TITLE_PATTERN,
    category: 'domain_glossary',
    priority: 85,
    content: DEFAULT_LIST_ISTILAH_HTML,
    kind: 'glossary',
  },
  {
    title: LIST_SINGKATAN_DEFAULT_TITLE,
    titlePattern: LIST_SINGKATAN_TITLE_PATTERN,
    category: 'domain_glossary',
    priority: 84,
    content: DEFAULT_LIST_SINGKATAN_HTML,
    kind: 'abbreviation',
  },
  {
    title: KATALOG_APLIKASI_DEFAULT_TITLE,
    titlePattern: KATALOG_APLIKASI_TITLE_PATTERN,
    category: 'application_catalog',
    priority: 83,
    content: DEFAULT_KATALOG_APLIKASI_HTML,
    kind: 'application_catalog',
  },
  {
    title: STAKEHOLDER_RACI_DEFAULT_TITLE,
    titlePattern: STAKEHOLDER_RACI_TITLE_PATTERN,
    category: 'stakeholders',
    priority: 82,
    content: DEFAULT_STAKEHOLDER_RACI_HTML,
    kind: 'stakeholders',
  },
  {
    title: DAFTAR_PROSES_AS_IS_DEFAULT_TITLE,
    titlePattern: DAFTAR_PROSES_AS_IS_TITLE_PATTERN,
    category: 'business_rules',
    priority: 81,
    content: DEFAULT_DAFTAR_PROSES_AS_IS_HTML,
    kind: 'as_is_process',
  },
  {
    title: ATURAN_PENYEBUTAN_DEFAULT_TITLE,
    titlePattern: ATURAN_PENYEBUTAN_TITLE_PATTERN,
    category: 'platform_context',
    priority: 80,
    content: DEFAULT_ATURAN_PENYEBUTAN_HTML,
    kind: 'naming',
  },
  {
    title: ORG_CONTEXT_DEFAULT_TITLE,
    titlePattern: ORG_CONTEXT_TITLE_PATTERN,
    category: 'org_structure',
    priority: 79,
    content: DEFAULT_ORG_CONTEXT_HTML,
    kind: 'org_overlay',
  },
  {
    title: APPLICATION_NOTES_DEFAULT_TITLE,
    titlePattern: APPLICATION_NOTES_TITLE_PATTERN,
    category: 'application_catalog',
    priority: 78,
    content: DEFAULT_APPLICATION_NOTES_HTML,
    kind: 'app_notes',
  },
]

export function isSystemKbEntryTitle(title: string): boolean {
  return SYSTEM_KB_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()))
}

/** English label for System templates; keeps matching stored Indonesian titles. */
export function displaySystemKbEntryTitle(title: string): string {
  const trimmed = title.trim()
  return SYSTEM_KB_TITLE_DISPLAY.find((item) => item.pattern.test(trimmed))?.display ?? title
}

export function isApplicationCatalogDefaultTitle(title: string): boolean {
  return KATALOG_APLIKASI_TITLE_PATTERN.test(title.trim())
}

export function isOrgContextTitle(title: string): boolean {
  return ORG_CONTEXT_TITLE_PATTERN.test(title.trim())
}

export function isIdeaIntakeChecklistTitle(title: string): boolean {
  return CHECKLIST_TITLE_PATTERN.test(title.trim())
}

/** Global system rows (checklist) that must appear in every workspace catalog. */
export function isPlatformWideSystemKbEntry(entry: { title?: string | null; workspace_id?: string | null }): boolean {
  return isIdeaIntakeChecklistTitle(entry.title ?? '')
}

/** Platform + per-workspace starter templates: badge System, tidak boleh dihapus. */
export function isSystemKbEntry(entry: { title?: string | null; category?: string | null }): boolean {
  return isSystemKbEntryTitle(entry.title ?? '')
}

export function findIdeaIntakeChecklistDefaultEntry(entries: KbEntryResponse[]): KbEntryResponse | null {
  return entries.find((entry) => isIdeaIntakeChecklistTitle(entry.title)) ?? null
}

function sameWorkspaceId(left: string | null | undefined, right: string): boolean {
  return (left ?? '').trim().toLowerCase() === right.trim().toLowerCase()
}

function findWorkspaceSystemEntries(
  entries: KbEntryResponse[],
  spec: WorkspaceSystemKbSpec,
  workspaceId: string,
): KbEntryResponse[] {
  return entries.filter(
    (entry) => spec.titlePattern.test(entry.title.trim()) && sameWorkspaceId(entry.workspace_id, workspaceId),
  )
}

function findWorkspaceSystemEntry(
  entries: KbEntryResponse[],
  spec: WorkspaceSystemKbSpec,
  workspaceId: string,
): KbEntryResponse | null {
  return findWorkspaceSystemEntries(entries, spec, workspaceId)[0] ?? null
}

function pickWorkspaceSystemKbKeeper(rows: KbEntryResponse[], canonicalTitle: string): KbEntryResponse {
  return [...rows].sort((left, right) => {
    const contentDelta = (right.content ?? '').length - (left.content ?? '').length
    if (contentDelta !== 0) return contentDelta
    const titleDelta = Number(right.title === canonicalTitle) - Number(left.title === canonicalTitle)
    if (titleDelta !== 0) return titleDelta
    return (right.updated_at || '').localeCompare(left.updated_at || '')
  })[0]
}

export type WorkspaceSystemKbDedupePlan = {
  keeper: KbEntryResponse
  extras: KbEntryResponse[]
  canonicalTitle: string
}

/** Duplicate System templates for the same workspace (old Indonesian title + new English title, or double-create). */
export function planWorkspaceSystemKbDedupe(entries: KbEntryResponse[]): WorkspaceSystemKbDedupePlan[] {
  const workspaceIds = [...new Set(
    entries.map((entry) => (entry.workspace_id ?? '').trim()).filter(Boolean),
  )]
  const plans: WorkspaceSystemKbDedupePlan[] = []
  const seenWorkspaceKeys = new Set<string>()

  for (const workspaceId of workspaceIds) {
    const key = workspaceId.toLowerCase()
    if (seenWorkspaceKeys.has(key)) continue
    seenWorkspaceKeys.add(key)
    for (const spec of WORKSPACE_SYSTEM_KB_SPECS) {
      const matches = findWorkspaceSystemEntries(entries, spec, workspaceId)
      if (matches.length < 2) continue
      const keeper = pickWorkspaceSystemKbKeeper(matches, spec.title)
      plans.push({
        keeper,
        extras: matches.filter((entry) => entry.id !== keeper.id),
        canonicalTitle: spec.title,
      })
    }
  }
  return plans
}

export function withoutDuplicateWorkspaceSystemKbEntries(entries: KbEntryResponse[]): KbEntryResponse[] {
  const extraIds = new Set(planWorkspaceSystemKbDedupe(entries).flatMap((plan) => plan.extras.map((entry) => entry.id)))
  return extraIds.size === 0 ? entries : entries.filter((entry) => !extraIds.has(entry.id))
}

export async function dedupeWorkspaceSystemKbTemplates(entries: KbEntryResponse[]): Promise<KbEntryResponse[]> {
  const plans = planWorkspaceSystemKbDedupe(entries)
  if (plans.length === 0) return entries

  const removed = new Set<string>()
  const patched: KbEntryResponse[] = []
  for (const plan of plans) {
    for (const extra of plan.extras) {
      try {
        await deleteKbEntry(extra.id)
        removed.add(extra.id)
      } catch {
        removed.add(extra.id)
      }
    }
    if (plan.keeper.title !== plan.canonicalTitle) {
      try {
        patched.push(await patchKbEntry(plan.keeper.id, { title: plan.canonicalTitle }))
      } catch {
        // Display mapping still shows the English title.
      }
    }
  }

  return mergeEnsuredKbEntries(
    entries.filter((entry) => !removed.has(entry.id)),
    patched,
  )
}

function workspaceHasAdiraApplicationCatalog(entries: KbEntryResponse[], workspaceId: string): boolean {
  if (!isAdiraFinanceWorkspaceId(workspaceId)) return false
  return entries.some((entry) => (
    entry.title.trim().toLowerCase() === 'katalog aplikasi adira finance'
    && sameWorkspaceId(entry.workspace_id, workspaceId)
  ))
}

export function mergeEnsuredKbEntries(
  items: KbEntryResponse[],
  ensured: Array<KbEntryResponse | null | undefined>,
): KbEntryResponse[] {
  let next = items
  for (const entry of ensured) {
    if (!entry) continue
    const existingIndex = next.findIndex((item) => item.id === entry.id)
    if (existingIndex >= 0) {
      next = next.slice()
      next[existingIndex] = entry
    } else {
      next = [entry, ...next]
    }
  }
  return next
}

/**
 * Ensure the default idea-intake checklist exists as a global (`workspace_id` null) system entry.
 * Existing Adira-scoped seed rows are promoted so every workspace sees the same System badge.
 * Never patches `is_active` — a user who turned off "Use for AI" must stay off.
 */
export async function ensureIdeaIntakeChecklistDefaultEntry(
  entries: KbEntryResponse[],
): Promise<KbEntryResponse | null> {
  const existing = findIdeaIntakeChecklistDefaultEntry(entries)
  if (existing) {
    if (existing.workspace_id) {
      try {
        return await patchKbEntry(existing.id, { workspace_id: null })
      } catch {
        return existing
      }
    }
    return existing
  }

  try {
    return await createKbEntry({
      category: 'idea_intake_checklist',
      title: IDEA_INTAKE_CHECKLIST_DEFAULT_TITLE,
      content: DEFAULT_IDEA_INTAKE_CHECKLIST_CONTENT,
      is_active: true,
      priority: 100,
      workspace_id: null,
      visibility_scope: 'internal',
    })
  } catch {
    return null
  }
}

/**
 * Create missing per-workspace starter templates. Never overwrites content or re-enables `is_active`.
 * Skip generic application catalog when a stronger portfolio/APM source already exists.
 */
export async function ensureWorkspaceSystemKbTemplates(
  entries: KbEntryResponse[],
  workspaceIds: string[],
): Promise<KbEntryResponse[]> {
  const created: KbEntryResponse[] = []
  const seenWorkspaceKeys = new Set<string>()
  const uniqueIds: string[] = []
  for (const rawId of workspaceIds) {
    const workspaceId = rawId.trim()
    const key = workspaceId.toLowerCase()
    if (!workspaceId || seenWorkspaceKeys.has(key)) continue
    seenWorkspaceKeys.add(key)
    uniqueIds.push(workspaceId)
    if (uniqueIds.length >= 20) break
  }

  for (const workspaceId of uniqueIds) {
    for (const spec of WORKSPACE_SYSTEM_KB_SPECS) {
      if (
        spec.kind === 'application_catalog'
        && (
          readConfiguredApmWorkspaceIds().has(workspaceId)
          || workspaceHasAdiraApplicationCatalog(entries, workspaceId)
        )
      ) {
        continue
      }
      const existing = findWorkspaceSystemEntry(entries, spec, workspaceId)
        ?? findWorkspaceSystemEntry(created, spec, workspaceId)
      if (existing) {
        if (existing.title !== spec.title) {
          try {
            created.push(await patchKbEntry(existing.id, { title: spec.title }))
          } catch {
            // Keep the stored title; UI still maps it to English.
          }
        }
        continue
      }

      try {
        const entry = await createKbEntry({
          category: spec.category,
          title: spec.title,
          content: spec.content,
          is_active: true,
          priority: spec.priority,
          workspace_id: workspaceId,
          visibility_scope: 'internal',
        })
        created.push(entry)
      } catch {
        // Best-effort: another session may have created the row concurrently.
      }
    }
  }

  return created
}
