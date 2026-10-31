import { useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

const badgeColors = [
  'border-sky-200 bg-sky-50 text-sky-800',
  'border-emerald-200 bg-emerald-50 text-emerald-800',
  'border-amber-200 bg-amber-50 text-amber-800',
  'border-violet-200 bg-violet-50 text-violet-800',
  'border-rose-200 bg-rose-50 text-rose-800',
  'border-cyan-200 bg-cyan-50 text-cyan-800',
  'border-lime-200 bg-lime-50 text-lime-800',
  'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
]

type ScopeWorkspaceOption = {
  id: string
  name: string
  slug?: string | null
  tenant_mode?: string | null
  metadata?: Record<string, unknown> | null
}

function isPersonalWorkspace(option: ScopeWorkspaceOption): boolean {
  const classification = option.metadata?.tectona_workspace_classification
  return option.tenant_mode?.trim().toLowerCase() === 'personal'
    || (typeof classification === 'string' && classification.trim().toLowerCase() === 'personal')
}

export function ScopeWorkspacePicker({ selectedIds, options, onChange, children, searchEnabled = true }: {
  selectedIds: string[]
  options: ScopeWorkspaceOption[]
  onChange: (ids: string[]) => void
  children?: ReactNode
  searchEnabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const search = query.trim().toLowerCase()
  const matches = search ? options.filter((option) => !selectedIds.includes(option.id)
    && !isPersonalWorkspace(option)
    && option.name.toLowerCase().includes(search)) : []
  return <div className="space-y-2">
    {selectedIds.length ? <div className="space-y-1" role="group" aria-label="Selected scope workspaces">
      {selectedIds.map((id, index) => {
        const name = options.find((option) => option.id === id)?.name || id
        return <div key={id} className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-xs ${badgeColors[index % badgeColors.length]}`}>
          <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
          <button type="button" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-background focus-visible:ring-2 focus-visible:ring-primary" title="Remove workspace" aria-label={`Remove ${name} from scope`} onClick={() => onChange(selectedIds.filter((value) => value !== id))}><X className="h-3 w-3" aria-hidden="true" /></button>
        </div>
      })}
    </div> : null}
    {children}
    {searchEnabled ? <Input ref={input} aria-label="Search scope workspaces" placeholder="Search workspaces..." value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
    {searchEnabled && search ? <div className="max-h-48 overflow-y-auto rounded-lg border border-border" role="group" aria-label="Scope workspace search results">
      {matches.map((option) => <button key={option.id} type="button" className="block w-full px-2.5 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { onChange([...selectedIds, option.id]); setQuery(''); input.current?.focus() }}>
        <span className="block [overflow-wrap:anywhere]">{option.name}</span>
        {option.slug ? <span className="block truncate text-[10px] text-muted-foreground">{option.slug}</span> : null}
      </button>)}
      {!matches.length ? <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">No matching workspaces.</p> : null}
    </div> : null}
    {searchEnabled && !options.length ? <p className="text-[11px] text-slate-500">No workspaces found in this organization.</p> : null}
  </div>
}
