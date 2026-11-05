import { ArrowDown, ArrowUp } from 'lucide-react'
import { getIdeaPanelCatalogEntry, moveIdeaSection, type IdeaPanelKey } from '@/modules/project-management/lib/ideaPanelCatalog'

export function IdeaSectionOrderControls({ section, order, onChange }: {
  section: IdeaPanelKey
  order: IdeaPanelKey[]
  onChange: (order: IdeaPanelKey[]) => void
}) {
  const index = order.indexOf(section)
  const label = getIdeaPanelCatalogEntry(section).label
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {([-1, 1] as const).map((direction) => {
        const Icon = direction === -1 ? ArrowUp : ArrowDown
        const title = `Move ${label} ${direction === -1 ? 'up' : 'down'}`
        return <button
          key={direction}
          type="button"
          title={title}
          aria-label={title}
          disabled={index < 0 || (direction === -1 ? index === 0 : index === order.length - 1)}
          onClick={() => onChange(moveIdeaSection(order, section, direction))}
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
        ><Icon className="h-3.5 w-3.5" aria-hidden="true" /></button>
      })}
    </div>
  )
}
