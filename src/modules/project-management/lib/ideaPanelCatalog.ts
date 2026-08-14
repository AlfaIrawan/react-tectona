import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  Cpu,
  DollarSign,
  FileText,
  Gauge,
  GitBranch,
  Layers,
  TrendingUp,
} from 'lucide-react'

export type IdeaPanelKey =
  | 'summary'
  | 'scoring'
  | 'impact'
  | 'integration'
  | 'process'
  | 'costBenefit'
  | 'conversion'
  | 'document'

export type IdeaPanelCatalogEntry = {
  key: IdeaPanelKey
  label: string
  icon: LucideIcon
}

export const IDEA_PANEL_CATALOG: IdeaPanelCatalogEntry[] = [
  { key: 'summary', label: 'Summary', icon: ClipboardList },
  { key: 'scoring', label: 'Scoring', icon: Gauge },
  { key: 'impact', label: 'Impact', icon: TrendingUp },
  { key: 'integration', label: 'Integration', icon: Cpu },
  { key: 'process', label: 'Process', icon: GitBranch },
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
