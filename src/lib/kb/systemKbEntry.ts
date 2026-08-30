import { createKbEntry, patchKbEntry, type KbEntryResponse } from '@/lib/api/tectonaKbApi'

/** Canonical title shown in Document & Knowledge Management. */
export const IDEA_INTAKE_CHECKLIST_DEFAULT_TITLE = 'Idea Intake Checklist (Default)'

const SYSTEM_KB_TITLE_PATTERNS = [
  /^idea intake checklist(?: \(default\))?$/i,
]

export const DEFAULT_IDEA_INTAKE_CHECKLIST_CONTENT = JSON.stringify(
  {
    version: 1,
    questions: [
      { id: 'as_is_actors', prompt: 'Siapa yang terlibat di proses saat ini (AS-IS)?', required: true },
      { id: 'as_is_steps', prompt: 'Apa langkah utama AS-IS dari awal sampai akhir?', required: true },
      { id: 'as_is_systems', prompt: 'Sistem atau aplikasi apa yang dipakai hari ini?', required: false },
      { id: 'pain_points', prompt: 'Pain point atau bottleneck terbesar apa?', required: true },
      { id: 'to_be_process', prompt: 'Proses yang diharapkan (TO-BE) seperti apa?', required: true },
    ],
  },
  null,
  2,
)

export function isSystemKbEntryTitle(title: string): boolean {
  return SYSTEM_KB_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()))
}

/** Platform-managed KB rows that must stay visible (and non-deletable) for every Tectona user. */
export function isSystemKbEntry(entry: { title?: string | null; category?: string | null }): boolean {
  return isSystemKbEntryTitle(entry.title ?? '')
}

export function findIdeaIntakeChecklistDefaultEntry(entries: KbEntryResponse[]): KbEntryResponse | null {
  return entries.find((entry) => isSystemKbEntry(entry)) ?? null
}

/**
 * Ensure the default idea-intake checklist exists as a global (`workspace_id` null) system entry.
 * Existing Adira-scoped seed rows are promoted so every workspace sees the same System badge.
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
