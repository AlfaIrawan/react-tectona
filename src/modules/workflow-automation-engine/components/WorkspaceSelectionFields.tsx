import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function workspaceSelectionIds(value?: string): string[] {
  try {
    const ids: unknown = JSON.parse(value || '[]')
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))] : []
  } catch { return [] }
}

export function WorkspaceSelectionFields({ config, options, onChange }: {
  config: Record<string, string>
  options: Array<{ id: string; name: string }>
  onChange: (config: Record<string, string>) => void
}) {
  const [query, setQuery] = useState('')
  const selected = workspaceSelectionIds(config.allowedWorkspaceIds)
  const available = options.filter((option) => !selected.includes(option.id) && option.name.toLowerCase().includes(query.toLowerCase()))
  return <div className="space-y-3">
    <label className="block space-y-2 text-xs text-muted-foreground">
      <span>Allowed Workspaces</span>
      <div className="flex flex-wrap gap-1">
        {selected.map((id) => <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-foreground">
          <span className="truncate">{options.find((option) => option.id === id)?.name ?? id}</span>
          <button type="button" title="Remove workspace" aria-label={`Remove ${options.find((option) => option.id === id)?.name ?? id}`} onClick={() => onChange({ allowedWorkspaceIds: JSON.stringify(selected.filter((item) => item !== id)), ...(config.defaultWorkspaceId === id ? { defaultWorkspaceId: '' } : {}) })}><X className="h-3 w-3" /></button>
        </span>)}
      </div>
      <Input aria-label="Search allowed workspaces" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces..." />
    </label>
    <div className="max-h-40 overflow-y-auto rounded-lg border border-border" role="group" aria-label="Available workspaces">
      {available.map((option) => <button key={option.id} type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => { onChange({ allowedWorkspaceIds: JSON.stringify([...selected, option.id]) }); setQuery('') }}>{option.name}</button>)}
      {!available.length && <p className="px-3 py-2 text-xs text-muted-foreground">No workspaces available.</p>}
    </div>
    <label className="block space-y-2 text-xs text-muted-foreground">
      <span>Default Workspace</span>
      <select className="h-9 w-full rounded-lg border border-input bg-background px-2 text-foreground" value={config.defaultWorkspaceId || ''} onChange={(event) => onChange({ defaultWorkspaceId: event.target.value })}>
        <option value="">No default</option>
        {selected.map((id) => <option key={id} value={id}>{options.find((option) => option.id === id)?.name ?? id}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-xs text-foreground">
      <input type="checkbox" checked={config.selectionRequired !== 'No'} onChange={(event) => onChange({ selectionRequired: event.target.checked ? 'Yes' : 'No' })} />
      Selection Required
    </label>
  </div>
}
