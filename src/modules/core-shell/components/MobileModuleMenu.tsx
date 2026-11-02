import { useEffect, useRef, useState, type ComponentType } from 'react'
import { ChevronRight, Grid3x3, Search, X } from 'lucide-react'

interface ModuleItem {
  label: string
  description: string
  path: string
  icon: ComponentType<{ className?: string }>
}

export function MobileModuleMenu({ items, isActive, onSelect }: {
  items: ModuleItem[]
  isActive: (path: string) => boolean
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const filtered = items.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  useEffect(() => {
    if (!open) return
    const element = dialog.current
    element?.showModal()
    search.current?.focus({ preventScroll: true })
    return () => element?.close()
  }, [open])

  function close() {
    setOpen(false)
    setQuery('')
    trigger.current?.focus()
  }

  return <>
    <button ref={trigger} type="button" className="topbar-action-btn flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted" aria-label="Open app launcher" title="Modules" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <Grid3x3 className="h-5 w-5 text-gray-700" />
    </button>
    <dialog ref={dialog} aria-labelledby="mobile-module-title" className="mobile-module-menu rounded-lg border border-border bg-background p-0 text-foreground shadow-xl" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <h2 id="mobile-module-title" className="text-lg font-semibold">Modules</h2>
          <button type="button" aria-label="Close modules" title="Close modules" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted"><X className="h-5 w-5" /></button>
        </header>
        <div className="relative mx-4 my-3 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input ref={search} type="search" aria-label="Search modules" placeholder="Search modules..." value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <nav aria-label="Modules" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
          {filtered.length === 0 && <p role="status" className="px-3 py-8 text-center text-sm text-muted-foreground">No modules found</p>}
          {filtered.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return <button key={item.path} type="button" aria-current={active ? 'page' : undefined} onClick={() => { onSelect(item.path); close() }} className={`flex min-h-16 w-full items-center gap-3 rounded-md p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${active ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium leading-5">{item.label}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{item.description}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          })}
        </nav>
      </div>
    </dialog>
  </>
}
