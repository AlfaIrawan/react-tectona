import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  DollarSign,
  FileText,
  Gauge,
  Layers,
  TrendingUp,
  Workflow,
} from 'lucide-react'

export type IdeaPanelKey =
  | 'summary'
  | 'scoring'
  | 'impact'
  | 'diagrams'
  | 'integration'
  | 'process'
  | 'c4Level1'
  | 'c4Level2'
  | 'bpmnHigh'
  | 'costBenefit'
  | 'conversion'
  | 'document'

export type IdeaPanelCatalogEntry = {
  key: IdeaPanelKey
  label: string
  icon: LucideIcon
}

// `integration` and `process` stay valid `IdeaPanelKey` values (used internally by `confidence`,
// `regenerating`, and `renderSectionReviewWorkspace`'s per-section review history) even though
// they're no longer their own sidebar entries — they're now sub-sections inside the merged
// `diagrams` gallery panel.
export const IDEA_PANEL_CATALOG: IdeaPanelCatalogEntry[] = [
  { key: 'summary', label: 'Summary', icon: ClipboardList },
  { key: 'scoring', label: 'Scoring', icon: Gauge },
  { key: 'impact', label: 'Impact', icon: TrendingUp },
  { key: 'diagrams', label: 'Diagrams', icon: Workflow },
  { key: 'costBenefit', label: 'Cost Benefit', icon: DollarSign },
  { key: 'conversion', label: 'Conversion', icon: Layers },
  { key: 'document', label: 'Docs', icon: FileText },
]

export const DEFAULT_IDEA_NAV_SECTIONS: IdeaPanelKey[] = IDEA_PANEL_CATALOG.map((entry) => entry.key)

export function getIdeaPanelCatalogEntry(key: IdeaPanelKey): IdeaPanelCatalogEntry {
  return IDEA_PANEL_CATALOG.find((item) => item.key === key) ?? IDEA_PANEL_CATALOG[0]
}

export function resolveIdeaNavSections(saved?: IdeaPanelKey[]): IdeaPanelKey[] {
  if (!saved?.length) return [...DEFAULT_IDEA_NAV_SECTIONS]
  const known = new Set(DEFAULT_IDEA_NAV_SECTIONS)
  const ordered = saved.filter((key) => known.has(key))
  for (const key of DEFAULT_IDEA_NAV_SECTIONS) {
    if (!ordered.includes(key)) ordered.push(key)
  }
  return ordered
}

export type IdeaSectionVisibility = 'show' | 'hide'
export type IdeaSectionVisibilityMap = Partial<Record<IdeaPanelKey, IdeaSectionVisibility>>

export function readIdeaSectionVisibility(value: unknown): IdeaSectionVisibilityMap {
  if (!value || typeof value !== 'object') return {}
  const source = value as Record<string, unknown>
  const next: IdeaSectionVisibilityMap = {}
  for (const entry of IDEA_PANEL_CATALOG) {
    const raw = source[entry.key]
    if (raw === 'show' || raw === 'hide') next[entry.key] = raw
  }
  return next
}

/** Catalog order, minus sections a published workflow marked hide. An empty result keeps Summary. */
export function visibleIdeaNavSections(
  saved: IdeaPanelKey[] | undefined,
  visibility: IdeaSectionVisibilityMap | undefined,
): IdeaPanelKey[] {
  const hidden = new Set(
    IDEA_PANEL_CATALOG.map((entry) => entry.key).filter((key) => visibility?.[key] === 'hide'),
  )
  const visible = resolveIdeaNavSections(saved).filter((key) => !hidden.has(key))
  return visible.length > 0 ? visible : ['summary']
}

export type IdeaDiagramAudience = 'architecture' | 'business' | 'both' | 'none'

/** Architecture sees technical diagrams. Business Relationship / Business Partner sees BPMN. */
export function ideaDiagramAudienceFromLabels(labels: Array<string | null | undefined>): IdeaDiagramAudience {
  const architecture = labels.some((label) => /architecture|arsitektur/i.test(label ?? ''))
  const business = labels.some((label) => /business\s*relationship|business\s*partner|business\s*relation/i.test(label ?? ''))
  if (architecture && business) return 'both'
  if (architecture) return 'architecture'
  if (business) return 'business'
  return 'none'
}

/**
 * A published section map means the Idea document workflow is in force:
 * everyone sees Docs, and Diagrams returns only for Architecture or Business Relationship / Partner.
 */
export function ideaMenuForWorkflowAudience(
  saved: IdeaPanelKey[] | undefined,
  visibility: IdeaSectionVisibilityMap | undefined,
  audience: IdeaDiagramAudience,
): IdeaPanelKey[] {
  const governed = Object.values(visibility ?? {}).some((value) => value === 'show' || value === 'hide')
  if (!governed) return visibleIdeaNavSections(saved, visibility)
  const next: IdeaPanelKey[] = []
  if (audience !== 'none') next.push('diagrams')
  next.push('document')
  return next
}
