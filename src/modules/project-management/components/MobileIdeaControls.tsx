import { useEffect, useRef, useState } from 'react'
import { Filter, Search, Plus, MoreHorizontal, FolderPlus, Upload, X, Check } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'

interface FilterGroup {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (values: Set<string>) => void
}
interface Props {
  query: string
  onQueryChange: (value: string) => void
  content: 'all' | 'folders' | 'ideas'
  onContentChange: (value: 'all' | 'folders' | 'ideas') => void
  folderCount: number
  ideaCount: number
  groups: FilterGroup[]
  onCreate: () => void
  onCreateFolder: () => void
  onUpload: () => void
}

export function MobileIdeaControls(props: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Set<string>[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const filterButton = useRef<HTMLButtonElement>(null)
  const active = props.groups.filter((group) => group.selected.size !== group.options.length).length
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    return () => dialog.current?.close()
  }, [open])
  function close() {
    setOpen(false)
    filterButton.current?.focus()
  }
  function apply() {
    // Existing filters treat an empty selection as unrestricted.
    props.groups.forEach((group, index) => group.onChange(draft[index]?.size ? draft[index] : new Set(group.options)))
    close()
  }
  return <section className="space-y-4" aria-label="Idea controls">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><h1 className="text-xl font-semibold">Idea &amp; Backlog</h1><p className="mt-1 text-sm text-muted-foreground">{props.ideaCount} ideas</p></div>
      <button type="button" onClick={props.onCreate} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />Create Idea</button>
    </div>
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
      <input aria-label="Search ideas and folders" type="search" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Search ideas and folders..." className="h-12 w-full min-w-0 rounded-md border border-input bg-background pl-10 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0" role="group" aria-label="Content type">
        {(['all', 'ideas', 'folders'] as const).map((value) => <button key={value} type="button" aria-pressed={props.content === value} onClick={() => props.onContentChange(value)} className={`min-h-11 border-b-2 px-2 text-sm font-medium ${props.content === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{value === 'all' ? 'All' : value === 'ideas' ? 'Ideas' : `Folders ${props.folderCount}`}</button>)}
      </div>
      <div className="flex shrink-0 gap-1">
        <button ref={filterButton} type="button" onClick={() => { setDraft(props.groups.map((group) => new Set(group.selected))); setOpen(true) }} aria-haspopup="dialog" aria-expanded={open} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm"><Filter className="h-4 w-4" />Filter{active > 0 ? ` (${active})` : ''}</button>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" title="More idea actions" aria-label="More idea actions" className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted"><MoreHorizontal className="h-5 w-5" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={props.onCreateFolder}><FolderPlus className="mr-2 h-4 w-4" />New folder</DropdownMenuItem><DropdownMenuItem onClick={props.onUpload}><Upload className="mr-2 h-4 w-4" />Upload Idea</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </div>
    <dialog ref={dialog} aria-labelledby="mobile-filter-title" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === event.currentTarget) close() }} className="mobile-idea-filter m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-lg border-0 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40">
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between border-b p-4"><h2 id="mobile-filter-title" className="text-lg font-semibold">Filter ideas</h2><button type="button" onClick={close} aria-label="Close filters" className="flex h-11 w-11 items-center justify-center"><X className="h-5 w-5" /></button></header>
        <div className="overflow-y-auto overscroll-contain px-4 py-2">{props.groups.map((group, index) => <fieldset key={group.label} className="py-3"><legend className="text-sm font-semibold">{group.label}</legend><div className="mt-2 space-y-1">{group.options.map((option) => <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-primary" checked={draft[index]?.has(option) ?? false} onChange={(event) => setDraft((prev) => prev.map((values, i) => { if (i !== index) return values; const next = new Set(values); if (event.target.checked) next.add(option); else next.delete(option); return next }))} />{option}</label>)}</div></fieldset>)}</div>
        <footer className="flex shrink-0 gap-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><button type="button" className="min-h-11 flex-1 rounded-md border text-sm" onClick={() => setDraft(props.groups.map((group) => new Set(group.options)))}>Reset</button><button type="button" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground" onClick={apply}><Check className="h-4 w-4" />Apply filters</button></footer>
      </div>
    </dialog>
  </section>
}
