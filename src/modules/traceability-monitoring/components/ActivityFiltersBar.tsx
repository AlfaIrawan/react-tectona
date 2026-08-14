import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import type { ActivityFilters } from '@/modules/traceability-monitoring/lib/activityMappers'

const ENTITY_TYPE_OPTIONS = ['idea', 'project', 'work_item', 'document', 'approval', 'workspace']

interface ActivityFiltersBarProps {
  filters: ActivityFilters
  onChange: (next: ActivityFilters) => void
}

export function ActivityFiltersBar({ filters, onChange }: ActivityFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card/60 p-3">
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
        Actor
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-7"
            placeholder="actor id or email"
            value={filters.actorId}
            onChange={(e) => onChange({ ...filters, actorId: e.target.value })}
          />
        </div>
      </label>

      <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
        Action
        <Input
          placeholder="e.g. work_item.updated"
          value={filters.action}
          onChange={(e) => onChange({ ...filters, action: e.target.value })}
        />
      </label>

      <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-muted-foreground">
        Entity type
        <Select
          value={filters.entityType}
          onChange={(e) => onChange({ ...filters, entityType: e.target.value })}
        >
          <SelectItem value="">All entity types</SelectItem>
          {ENTITY_TYPE_OPTIONS.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        From
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        To
        <Input type="date" value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
      </label>
    </div>
  )
}
