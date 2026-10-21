import { useMemo, useState, type DragEvent } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export const UML_PALETTE_MIME = 'application/tectona-uml-palette'

export type UmlPaletteNodeKind = 'class' | 'interface' | 'enumeration' | 'entity'
export type UmlPaletteRelation =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'dependency'
  | 'one-to-many'
  | 'one-to-one'
  | 'many-to-many'

export type UmlPaletteItem = {
  id: string
  group: 'element' | 'relation'
  label: string
  nodeKind?: UmlPaletteNodeKind
  relation?: UmlPaletteRelation
}

const CLASS_ITEMS: UmlPaletteItem[] = [
  { id: 'class', group: 'element', label: 'Class', nodeKind: 'class' },
  { id: 'interface', group: 'element', label: 'Interface', nodeKind: 'interface' },
  { id: 'enumeration', group: 'element', label: 'Enumeration', nodeKind: 'enumeration' },
  { id: 'association', group: 'relation', label: 'Association', relation: 'association' },
  { id: 'aggregation', group: 'relation', label: 'Aggregation', relation: 'aggregation' },
  { id: 'composition', group: 'relation', label: 'Composition', relation: 'composition' },
  { id: 'generalization', group: 'relation', label: 'Generalization', relation: 'generalization' },
  { id: 'dependency', group: 'relation', label: 'Dependency', relation: 'dependency' },
]

const ERD_ITEMS: UmlPaletteItem[] = [
  { id: 'entity', group: 'element', label: 'Entity', nodeKind: 'entity' },
  { id: 'one-to-many', group: 'relation', label: 'One to many', relation: 'one-to-many' },
  { id: 'one-to-one', group: 'relation', label: 'One to one', relation: 'one-to-one' },
  { id: 'many-to-many', group: 'relation', label: 'Many to many', relation: 'many-to-many' },
]

function NotationMark({ item }: { item: UmlPaletteItem }) {
  if (item.group === 'relation') {
    const dashed = item.relation === 'dependency'
    return (
      <span className="relative block h-4 w-8">
        <span
          className="absolute left-0 right-1 top-1/2 h-px -translate-y-1/2 bg-slate-700"
          style={dashed ? { background: 'repeating-linear-gradient(90deg,#334155 0 4px,transparent 4px 7px)' } : undefined}
        />
        <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-l-[6px] border-y-transparent border-l-slate-700" />
      </span>
    )
  }
  return (
    <span className="flex h-6 w-8 flex-col overflow-hidden rounded-[3px] border border-slate-500 bg-white">
      <span className="h-2 border-b border-slate-400 bg-amber-100" />
      <span className="flex-1 bg-white" />
    </span>
  )
}

export function UmlNotationPalette({
  view,
  selectedRelation,
  onDragStart,
  onSelectRelation,
  onAddNode,
}: {
  view: 'class' | 'erd'
  selectedRelation: string
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: UmlPaletteItem) => void
  onSelectRelation: (relation: UmlPaletteRelation) => void
  onAddNode: (item: UmlPaletteItem) => void
}) {
  const [query, setQuery] = useState('')
  const items = view === 'erd' ? ERD_ITEMS : CLASS_ITEMS
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => item.label.toLowerCase().includes(needle))
  }, [items, query])
  const elements = filtered.filter((item) => item.group === 'element')
  const relations = filtered.filter((item) => item.group === 'relation')

  const renderItem = (item: UmlPaletteItem) => {
    const selected = item.relation && item.relation === selectedRelation
    return (
      <button
        key={item.id}
        type="button"
        draggable={item.group === 'element'}
        title={item.label}
        aria-label={item.label}
        aria-pressed={selected || undefined}
        onDragStart={item.group === 'element' ? (event) => onDragStart(event, item) : undefined}
        onClick={() => {
          if (item.relation) onSelectRelation(item.relation)
          else onAddNode(item)
        }}
        className={cn(
          'flex items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-sky-50',
          item.group === 'element' && 'cursor-grab active:cursor-grabbing',
          selected && 'bg-sky-50 ring-1 ring-sky-300',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">
          <NotationMark item={item} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-slate-700">{item.label}</span>
      </button>
    )
  }

  return (
    <div className="enterprise-popover-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {view === 'erd' ? 'ERD notation' : 'UML notation'}
      </p>
      <p className="mb-1.5 text-[9px] leading-3 text-slate-500">
        Seret bentuk ke canvas, atau klik relasi lalu sambungkan dua kotak.
      </p>
      <label className="relative mb-1.5 block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notation"
          className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[11px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </label>
      {elements.length > 0 ? (
        <div className="mb-2">
          <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Elements</p>
          {elements.map(renderItem)}
        </div>
      ) : null}
      {relations.length > 0 ? (
        <div>
          <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Relationships</p>
          {relations.map(renderItem)}
        </div>
      ) : null}
      {filtered.length === 0 ? <p className="px-2 py-6 text-center text-[11px] text-slate-500">No notation found.</p> : null}
    </div>
  )
}
