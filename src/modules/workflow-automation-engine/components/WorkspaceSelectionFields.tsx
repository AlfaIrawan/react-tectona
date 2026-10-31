import { useId, useState } from 'react'
import { ChevronDown, StickyNote, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const WORKSPACE_AVATAR_COLORS = [
  'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700', 'bg-cyan-100 text-cyan-700',
]

function WorkspaceAvatar({ id, name }: { id: string; name: string }) {
  const words = name.replace(/\s+(?:ws|workspace)$/i, '').trim().split(/\s+/).filter(Boolean)
  const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0]?.slice(0, 2) || '?'
  const hash = Array.from(id).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
  return <span aria-hidden="true" className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase ${WORKSPACE_AVATAR_COLORS[hash % WORKSPACE_AVATAR_COLORS.length]}`}>{initials.toUpperCase()}</span>
}

export function workspaceSelectionIds(value?: string): string[] {
  try {
    const ids: unknown = JSON.parse(value || '[]')
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))] : []
  } catch { return [] }
}

export function workspaceOptionDescriptions(value?: string): Record<string, string> {
  try {
    const descriptions: unknown = JSON.parse(value || '{}')
    if (!descriptions || typeof descriptions !== 'object' || Array.isArray(descriptions)) return {}
    return Object.fromEntries(Object.entries(descriptions).filter(([, description]) => typeof description === 'string'))
  } catch { return {} }
}

export function WorkspaceSelectionFields({ config, options, onChange }: {
  config: Record<string, string>
  options: Array<{ id: string; name: string }>
  onChange: (config: Record<string, string>) => void
}) {
  const [query, setQuery] = useState('')
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null)
  const accordionId = useId()
  const selected = workspaceSelectionIds(config.allowedWorkspaceIds)
  const descriptions = workspaceOptionDescriptions(config.optionDescriptions)
  const removeWorkspace = (id: string) => {
    if (expandedWorkspaceId === id) setExpandedWorkspaceId(null)
    const nextDescriptions = { ...descriptions }
    delete nextDescriptions[id]
    onChange({
      allowedWorkspaceIds: JSON.stringify(selected.filter((item) => item !== id)),
      optionDescriptions: JSON.stringify(nextDescriptions),
      ...(config.defaultWorkspaceId === id ? { defaultWorkspaceId: '' } : {}),
    })
  }
  const available = options.filter((option) => !selected.includes(option.id) && option.name.toLowerCase().includes(query.toLowerCase()))
  return <div className="space-y-3">
    <div className="space-y-2 text-xs text-muted-foreground">
      <p>Allowed Workspaces</p>
      <div className="space-y-1">
        {selected.map((id) => {
          const name = options.find((option) => option.id === id)?.name ?? id
          const expanded = expandedWorkspaceId === id
          const panelId = `${accordionId}-${id}-description`
          const triggerId = `${accordionId}-${id}-trigger`
          return (
            <div key={id} className="min-w-0">
              <div className="inline-flex max-w-full items-center rounded-md bg-muted pr-1 text-foreground">
                <button
                  type="button"
                  id={triggerId}
                  aria-label={`Edit description for ${name}`}
                  title={`Edit description for ${name}`}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setExpandedWorkspaceId(expanded ? null : id)}
                >
                  <WorkspaceAvatar id={id} name={name} />
                  <span className="truncate">{name}</span>
                  {descriptions[id]?.trim() ? <span title="Description added"><StickyNote className="h-3 w-3 shrink-0 text-cyan-700" aria-hidden="true" /></span> : null}
                  <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <button type="button" title="Remove workspace" aria-label={`Remove ${name}`} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => removeWorkspace(id)}><X className="h-3 w-3" /></button>
              </div>
              {expanded ? (
                <div id={panelId} role="region" aria-labelledby={triggerId} className="mb-2 mt-2 space-y-1.5 border-l border-border pl-3">
                  <label htmlFor={`${panelId}-input`} className="block text-xs text-muted-foreground">Option Description</label>
                  <Textarea
                    id={`${panelId}-input`}
                    aria-label={`Option Description for ${name}`}
                    placeholder="Description (optional)"
                    rows={3}
                    className="resize-y text-xs text-foreground"
                    value={descriptions[id] || ''}
                    onChange={(event) => onChange({ optionDescriptions: JSON.stringify({ ...descriptions, [id]: event.target.value }) })}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <Input aria-label="Search allowed workspaces" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces..." />
    </div>
    <div className="max-h-40 overflow-y-auto rounded-lg border border-border" role="group" aria-label="Available workspaces">
      {available.map((option) => <button key={option.id} type="button" className="flex w-full items-center gap-1.5 px-2.5 py-1 text-left text-xs hover:bg-muted" onClick={() => { onChange({ allowedWorkspaceIds: JSON.stringify([...selected, option.id]) }); setQuery('') }}>
        <WorkspaceAvatar id={option.id} name={option.name} />
        <span className="min-w-0 [overflow-wrap:anywhere]">{option.name}</span>
      </button>)}
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
