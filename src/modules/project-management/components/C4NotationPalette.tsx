import type { DragEvent } from 'react'
import { cn } from '@/lib/utils'
import { C4_PALETTE_ITEMS, type C4PaletteItem } from '@/modules/project-management/lib/c4NotationPalette'

function isLightFill(hex: string): boolean {
  const value = hex.replace('#', '')
  if (value.length !== 6) return false
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 > 160
}

function PaletteLabel({ item, className }: { item: C4PaletteItem; className?: string }) {
  const light = item.shape === 'boundary' || isLightFill(item.fill)
  return (
    <span
      className={cn(
        'pointer-events-none absolute inset-x-0 flex items-center justify-center px-1 text-center text-[8px] font-semibold leading-[1.15]',
        light ? 'text-slate-800' : 'text-white',
        className,
      )}
    >
      {item.label}
    </span>
  )
}

function C4PalettePreview({ item }: { item: C4PaletteItem }) {
  if (item.shape === 'person') {
    return (
      <div className="relative h-full w-full">
        <span
          className="absolute left-1/2 top-0 h-[28%] w-[28%] -translate-x-1/2 rounded-full"
          style={{ background: item.fill }}
        />
        <span
          className="absolute bottom-0 left-1/2 h-[68%] w-[90%] -translate-x-1/2 rounded-sm"
          style={{ background: item.fill }}
        />
        <PaletteLabel item={item} className="bottom-0 h-[68%]" />
      </div>
    )
  }
  if (item.shape === 'cylinder') {
    return (
      <div className="relative h-full w-full">
        <span className="absolute inset-x-0 top-0 h-[22%] rounded-full" style={{ background: item.fill }} />
        <span className="absolute inset-x-0 bottom-[10%] top-[11%]" style={{ background: item.fill }} />
        <span
          className="absolute inset-x-0 bottom-0 h-[22%] rounded-full"
          style={{ background: item.fill, opacity: 0.9 }}
        />
        <PaletteLabel item={item} className="inset-y-0" />
      </div>
    )
  }
  if (item.shape === 'boundary') {
    return (
      <div className="relative h-full w-full rounded-[3px] border-2 border-dashed border-slate-500 bg-white">
        <PaletteLabel item={item} className="inset-y-0" />
      </div>
    )
  }
  return (
    <div className="relative h-full w-full rounded-[3px]" style={{ background: item.fill }}>
      <PaletteLabel item={item} className="inset-y-0" />
    </div>
  )
}

export function C4NotationPalette({
  onDragStart,
}: {
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: C4PaletteItem) => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">C4 notation</p>
      <p className="mb-1 text-[9px] leading-3 text-slate-500">Seret ke canvas, lalu sambungkan titik untuk Rel().</p>
      <div className="grid grid-cols-4 gap-1">
        {C4_PALETTE_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            draggable
            title={item.label}
            aria-label={item.label}
            onDragStart={(event) => onDragStart(event, item)}
            className={cn(
              'flex aspect-square w-full cursor-grab flex-col overflow-hidden rounded-md border border-slate-200 bg-white/90 p-0.5 text-center transition',
              'hover:border-sky-300 hover:bg-white active:cursor-grabbing',
            )}
          >
            <div className="h-full w-full p-0.5">
              <C4PalettePreview item={item} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
