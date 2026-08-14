import type { DragEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ARCHIMATE_PALETTE_MIME,
  type ArchimatePaletteItem,
} from '@/modules/project-management/lib/integrationArchimatePalette'
import {
  ARCHIMATE_PALETTE_SECTIONS,
  getArchimateNotationImageUrl,
  listArchimateNotationsBySection,
  type ArchimatePaletteSectionId,
} from '@/modules/project-management/lib/integrationArchimateNotationCatalog'

type ArchimateNotationPaletteProps = {
  generalItems: ArchimatePaletteItem[]
  scrollClassName?: string
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ArchimatePaletteItem) => void
}

function ArchimateNotationIconButton({
  item,
  onDragStart,
}: {
  item: ArchimatePaletteItem
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ArchimatePaletteItem) => void
}) {
  const imageUrl = item.notationId ? getArchimateNotationImageUrl(item.notationId) : undefined

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => onDragStart(event, item)}
      title={item.label}
      aria-label={item.label}
      className="group flex aspect-square min-h-[4.5rem] cursor-grab items-center justify-center rounded-lg border border-transparent bg-white/70 p-0.5 transition hover:border-slate-300 hover:bg-white active:cursor-grabbing"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="h-[3.25rem] w-[3.25rem] max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
        />
      ) : (
        <span className="text-[9px] font-semibold leading-tight text-slate-600">{item.label}</span>
      )}
    </button>
  )
}

function PaletteSection({
  sectionId,
  title,
  items,
  expanded,
  onToggle,
  onDragStart,
}: {
  sectionId: ArchimatePaletteSectionId
  title: string
  items: ArchimatePaletteItem[]
  expanded: boolean
  onToggle: (sectionId: ArchimatePaletteSectionId) => void
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ArchimatePaletteItem) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="border-b border-slate-200/70 pb-2 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 py-1.5 text-left text-[11px] font-semibold text-slate-700"
        onClick={() => onToggle(sectionId)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{title}</span>
      </button>
      {expanded ? (
        <div className="grid grid-cols-4 gap-2 px-0.5 pb-1.5">
          {items.map((item) => (
            <ArchimateNotationIconButton key={item.id} item={item} onDragStart={onDragStart} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function ArchimateNotationPalette({
  generalItems,
  scrollClassName,
  onDragStart,
}: ArchimateNotationPaletteProps) {
  const [expandedSections, setExpandedSections] = useState<Record<ArchimatePaletteSectionId, boolean>>({
    business: true,
    application: true,
    technology: true,
    general: true,
  })

  const sectionItems = useMemo(() => {
    const map: Record<ArchimatePaletteSectionId, ArchimatePaletteItem[]> = {
      business: [],
      application: [],
      technology: [],
      general: generalItems,
    }
    for (const section of ARCHIMATE_PALETTE_SECTIONS) {
      if (section.id === 'general') continue
      map[section.id] = listArchimateNotationsBySection(section.id).map((definition) => ({
        id: definition.id,
        kind: 'element' as const,
        label: definition.label,
        stereotype: definition.stereotype,
        layer: definition.layer,
        notationId: definition.id,
        defaultTitle: definition.label,
        defaultWidth: definition.defaultWidth,
      }))
    }
    return map
  }, [generalItems])

  const toggleSection = (sectionId: ArchimatePaletteSectionId) => {
    setExpandedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <p className="shrink-0 text-[11px] leading-5 text-slate-600">
        Tarik notasi ke canvas. Perubahan diagram otomatis direpresentasikan ke tab Source.
      </p>
      <div className={cn('mt-3 min-h-0 flex-1 pr-1', scrollClassName)}>
        {ARCHIMATE_PALETTE_SECTIONS.map((section) => (
          <PaletteSection
            key={section.id}
            sectionId={section.id}
            title={section.title}
            items={sectionItems[section.id]}
            expanded={expandedSections[section.id]}
            onToggle={toggleSection}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  )
}

export { ARCHIMATE_PALETTE_MIME }
