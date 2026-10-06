import { useMemo, useState } from 'react'
import { UserRound, X } from 'lucide-react'

import { Input } from '@/components/ui/input'

export type ApprovalNamedApproverMember = { id: string; name: string; email: string }

type Props = {
  members: ApprovalNamedApproverMember[]
  value: string
  onChange: (value: string) => void
}

function selectedIds(value: string): string[] {
  return [...new Set(value.split(',').map((id) => id.trim()).filter(Boolean))]
}

/** Member picker that stores stable IDs while presenting people as removable badges. */
export function ApprovalNamedApproverField({ members, value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => selectedIds(value), [value])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const options = useMemo(
    () => members.filter((member) => {
      if (selected.includes(member.id)) return false
      if (!normalizedQuery) return true
      return [member.name, member.email, member.id].some((part) => part.toLocaleLowerCase().includes(normalizedQuery))
    }),
    [members, normalizedQuery, selected],
  )

  const addMember = (id: string) => {
    onChange([...selected, id].join(','))
    setQuery('')
    setOpen(false)
  }

  const removeMember = (id: string) => onChange(selected.filter((current) => current !== id).join(','))

  return (
    <div className="relative space-y-1.5">
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {selected.map((id) => {
          const member = members.find((candidate) => candidate.id === id)
          const label = member?.name || id
          return (
            <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-200 bg-sky-50 py-0.5 pl-2 pr-1 text-[10px] font-medium text-sky-800">
              <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate" title={member ? `${member.name} · ${member.email}` : id}>{label}</span>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                title={`Remove ${label}`}
                className="rounded-full p-0.5 text-sky-600 hover:bg-sky-100 hover:text-rose-600"
                onClick={() => removeMember(id)}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          )
        })}
        <Input
          value={query}
          placeholder={selected.length ? 'Search another member' : 'Search workspace members'}
          aria-label="Search named approvers"
          className="h-6 min-w-[120px] flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && options[0]) {
              event.preventDefault()
              addMember(options[0].id)
            }
            if (event.key === 'Backspace' && !query && selected.length > 0) removeMember(selected[selected.length - 1])
            if (event.key === 'Escape') setOpen(false)
          }}
        />
      </div>
      {open ? (
        <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {options.length > 0 ? options.map((member) => (
            <button
              key={member.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addMember(member.id)}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700"><UserRound className="h-3 w-3" /></span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-slate-800">{member.name}</span>
                <span className="block truncate text-[10px] text-slate-500">{member.email}</span>
              </span>
            </button>
          )) : (
            <p className="px-2 py-2 text-[11px] text-slate-500">No matching workspace members.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
