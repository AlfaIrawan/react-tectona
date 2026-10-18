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

export type IdeaDiagramType = 'technical' | 'bpmn'

export const IDEA_DIAGRAM_TYPES: { key: IdeaDiagramType; label: string }[] = [
  { key: 'technical', label: 'C4, Sequence, ERD, Class, ArchiMate' },
  { key: 'bpmn', label: 'BPMN' },
]

/**
 * Who still sees what on Idea Detail, set on the workflow's Idea trigger node. Values are team or
 * role names, matched against the viewer's roles and operational teams in the workspace.
 */
export type IdeaSectionAudience = {
  /** Section → teams/roles that still see it while the workflow hides it. Empty: nobody. */
  alsoShowTo: Partial<Record<IdeaPanelKey, string[]>>
  /** Diagram type → teams/roles that see it inside Diagrams. Empty: everyone who sees Diagrams. */
  diagramTypes: Record<IdeaDiagramType, string[]>
}

/** The rule from before it moved into the workflow: applies until a workflow sets its own. */
export const DEFAULT_IDEA_SECTION_AUDIENCE: IdeaSectionAudience = {
  alsoShowTo: { diagrams: ['Architecture', 'Arsitektur', 'Business Relation', 'Business Partner'] },
  diagramTypes: {
    technical: ['Architecture', 'Arsitektur'],
    bpmn: ['Business Relation', 'Business Partner'],
  },
}

function readNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return Array.from(new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)))
}

/** The audience a workflow stored, or null when it stored none (the default then applies). */
export function readIdeaSectionAudience(value: unknown): IdeaSectionAudience | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { alsoShowTo?: unknown; diagramTypes?: unknown }
  const shown = (raw.alsoShowTo && typeof raw.alsoShowTo === 'object' ? raw.alsoShowTo : {}) as Record<string, unknown>
  const types = (raw.diagramTypes && typeof raw.diagramTypes === 'object' ? raw.diagramTypes : {}) as Record<string, unknown>
  const alsoShowTo: Partial<Record<IdeaPanelKey, string[]>> = {}
  for (const entry of IDEA_PANEL_CATALOG) {
    const names = readNames(shown[entry.key]) ?? DEFAULT_IDEA_SECTION_AUDIENCE.alsoShowTo[entry.key]
    if (names) alsoShowTo[entry.key] = [...names]
  }
  return {
    alsoShowTo,
    diagramTypes: {
      technical: readNames(types.technical) ?? [...DEFAULT_IDEA_SECTION_AUDIENCE.diagramTypes.technical],
      bpmn: readNames(types.bpmn) ?? [...DEFAULT_IDEA_SECTION_AUDIENCE.diagramTypes.bpmn],
    },
  }
}

/** A "Set Section Visibility" change from the idea's workflow run (workflowAutomationApi.ts). */
export type IdeaSectionOverride = {
  visibility: IdeaSectionVisibility
  audience?: string[]
  /** How audience is matched: name, jobTitle, department, team, role, workspace; empty: team/role names. */
  audience_by?: string
  diagram_types?: { technical?: string[]; bpmn?: string[] }
}

/**
 * The workflow's section map and audience with the idea's own changes laid over them: the run's
 * "Set Section Visibility" nodes. Show to everyone → shown; show to some teams → still hidden for
 * the rest, those teams added; hide → hidden, shown only to the teams the node names.
 */
export function applyIdeaSectionOverrides(
  visibility: IdeaSectionVisibilityMap,
  audience: IdeaSectionAudience | null,
  overrides: Record<string, IdeaSectionOverride | undefined> | null | undefined,
  /** For an audience matched by name, job title, department, team, role or workspace: the viewer's match. */
  viewerMatches?: (by: string, names: string[]) => boolean,
): { visibility: IdeaSectionVisibilityMap; audience: IdeaSectionAudience | null } {
  const entries = Object.entries(overrides ?? {}).filter(
    (entry): entry is [IdeaPanelKey, IdeaSectionOverride] =>
      Boolean(entry[1]) && IDEA_PANEL_CATALOG.some((item) => item.key === entry[0])
      && (entry[1]?.visibility === 'show' || entry[1]?.visibility === 'hide'),
  )
  if (entries.length === 0) return { visibility, audience }
  const base = audience ?? DEFAULT_IDEA_SECTION_AUDIENCE
  const nextVisibility: IdeaSectionVisibilityMap = { ...visibility }
  const alsoShowTo: Partial<Record<IdeaPanelKey, string[]>> = { ...base.alsoShowTo }
  const diagramTypes: Record<IdeaDiagramType, string[]> = { ...base.diagramTypes }
  for (const [key, change] of entries) {
    const names = readNames(change.audience) ?? []
    const by = (change.audience_by ?? '').trim()
    const decidedForViewer = Boolean(by) && names.length > 0
    const matched = decidedForViewer && viewerMatches ? viewerMatches(by, names) : false
    if (decidedForViewer) {
      // Decided for this viewer: Show only to / Hide but still show to the people matched.
      if (change.visibility === 'show') {
        if (matched) nextVisibility[key] = 'show'
        // Not matched: a section the workflow showed to everyone is limited to the matched people;
        // one it hid stays as the workflow set it.
        else if (visibility[key] !== 'hide') { nextVisibility[key] = 'hide'; alsoShowTo[key] = [] }
      } else {
        nextVisibility[key] = matched ? 'show' : 'hide'
        if (!matched) alsoShowTo[key] = []
      }
    } else if (change.visibility === 'show' && names.length === 0) {
      nextVisibility[key] = 'show'
    } else if (change.visibility === 'show') {
      nextVisibility[key] = 'hide'
      alsoShowTo[key] = Array.from(new Set([...(visibility[key] === 'hide' ? alsoShowTo[key] ?? [] : []), ...names]))
    } else {
      nextVisibility[key] = 'hide'
      alsoShowTo[key] = names
    }
    // A node limited to some people changes the diagram types for them only.
    if (key === 'diagrams' && change.diagram_types && (!decidedForViewer || matched)) {
      diagramTypes.technical = readNames(change.diagram_types.technical) ?? diagramTypes.technical
      diagramTypes.bpmn = readNames(change.diagram_types.bpmn) ?? diagramTypes.bpmn
    }
  }
  return { visibility: nextVisibility, audience: { alsoShowTo, diagramTypes } }
}

const compactName = (value: string) => value.toLowerCase().replace(/\s+/g, '')

/** True when one of the viewer's role/team labels contains one of the names (case and spaces ignored). */
export function audienceIncludes(viewerLabels: Array<string | null | undefined>, names: string[] | undefined): boolean {
  const wanted = (names ?? []).map(compactName).filter(Boolean)
  if (wanted.length === 0) return false
  return viewerLabels.some((label) => {
    const have = compactName(label ?? '')
    return have !== '' && wanted.some((name) => have.includes(name))
  })
}

/** Which diagram types the viewer sees inside Diagrams. */
export function ideaDiagramTypesFor(
  viewerLabels: Array<string | null | undefined>,
  audience: IdeaSectionAudience | null,
): Record<IdeaDiagramType, boolean> {
  const types = (audience ?? DEFAULT_IDEA_SECTION_AUDIENCE).diagramTypes
  return {
    technical: types.technical.length === 0 || audienceIncludes(viewerLabels, types.technical),
    bpmn: types.bpmn.length === 0 || audienceIncludes(viewerLabels, types.bpmn),
  }
}

/**
 * The Idea menu while a published workflow governs it: every section the workflow shows, plus a
 * hidden section for the teams/roles the workflow still shows it to, in the user's saved order.
 */
export function ideaMenuForWorkflowAudience(
  saved: IdeaPanelKey[] | undefined,
  visibility: IdeaSectionVisibilityMap | undefined,
  viewerLabels: Array<string | null | undefined>,
  audience: IdeaSectionAudience | null,
): IdeaPanelKey[] {
  const governed = Object.values(visibility ?? {}).some((value) => value === 'show' || value === 'hide')
  if (!governed) return visibleIdeaNavSections(saved, visibility)
  const rules = audience ?? DEFAULT_IDEA_SECTION_AUDIENCE
  const diagramTypes = ideaDiagramTypesFor(viewerLabels, audience)
  // In the user's saved order: a fixed list here put a dragged section straight back.
  return resolveIdeaNavSections(saved).filter((key) => {
    const seen = visibility?.[key] !== 'hide' || audienceIncludes(viewerLabels, rules.alsoShowTo[key])
    // Diagrams without a diagram type this viewer may see would be an empty page.
    return seen && (key !== 'diagrams' || diagramTypes.technical || diagramTypes.bpmn)
  })
}
