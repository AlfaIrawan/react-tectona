import { useMemo, useState, type DragEvent } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { C4_PALETTE_ITEMS, type C4PaletteItem } from '@/modules/project-management/lib/c4NotationPalette'

function C4PalettePreview({ item }: { item: C4PaletteItem }) {
  if (item.shape === 'person') {
    return (
      <div className="relative h-8 w-8">
        <span
          className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
          style={{ background: item.fill }}
        />
        <span
          className="absolute bottom-0 left-1/2 h-5 w-6 -translate-x-1/2 rounded-sm"
          style={{ background: item.fill }}
        />
      </div>
    )
  }
  if (item.shape === 'cylinder') {
    return (
      <div className="relative h-6 w-7">
        <span className="absolute inset-x-0 top-0 h-1.5 rounded-full" style={{ background: item.fill }} />
        <span className="absolute inset-x-0 bottom-1 top-[3px]" style={{ background: item.fill }} />
        <span
          className="absolute inset-x-0 bottom-0 h-1.5 rounded-full"
          style={{ background: item.fill, opacity: 0.9 }}
        />
      </div>
    )
  }
  if (item.shape === 'boundary') {
    return (
      <span className="h-5 w-7 rounded-[3px] border border-dashed border-slate-500 bg-white" />
    )
  }
  return (
    <span className="h-5 w-7 rounded-[3px]" style={{ background: item.fill }} />
  )
}

export function C4NotationPalette({
  onDragStart,
}: {
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: C4PaletteItem) => void
}) {
  const [query, setQuery] = useState('')
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return C4_PALETTE_ITEMS
    return C4_PALETTE_ITEMS.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
  }, [query])

  return (
    <div className="enterprise-popover-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">C4 notation</p>
      <p className="mb-1.5 text-[9px] leading-3 text-slate-500">Seret shape ke canvas, lalu sambungkan titik untuk Rel().</p>
      <label className="relative mb-1.5 block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notation"
          className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[11px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <div className="flex flex-col">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            type="button"
            draggable
            title={item.label}
            aria-label={item.label}
            onDragStart={(event) => onDragStart(event, item)}
            className={cn(
              'flex cursor-grab items-center gap-2 rounded-md px-1 py-0.5 text-left transition',
              'hover:bg-sky-50 active:cursor-grabbing',
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <C4PalettePreview item={item} />
            </div>
            <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-slate-700">{item.label}</span>
          </button>
        ))}
        {filteredItems.length === 0 ? <p className="px-2 py-6 text-center text-[11px] text-slate-500">No notation found.</p> : null}
      </div>
    </div>
  )
}
