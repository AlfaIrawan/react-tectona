import { useMemo, useState, type DragEvent } from 'react'
import { AppWindow, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  C4_APPLICATION_CATALOG_MIME,
  type C4ApplicationCatalogItem,
} from '@/modules/project-management/lib/c4NotationPalette'

export function C4ApplicationCatalogPalette({
  applications,
  loading,
  existingNames,
  onAdd,
  onFocusExisting,
}: {
  applications: C4ApplicationCatalogItem[]
  loading: boolean
  existingNames: Set<string>
  onAdd: (application: C4ApplicationCatalogItem) => void
  onFocusExisting: (application: C4ApplicationCatalogItem) => void
}) {
  const [query, setQuery] = useState('')
  const [internalApplications, setInternalApplications] = useState<Set<string>>(() => new Set())
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return applications.filter((application) => {
      const matchesQuery = !normalizedQuery || [application.name, application.type, application.description]
        .some((value) => value.toLowerCase().includes(normalizedQuery))
      return matchesQuery
    })
  }, [applications, query])

  const withPlacementClassification = (application: C4ApplicationCatalogItem): C4ApplicationCatalogItem => ({
    ...application,
    classification: internalApplications.has(application.name.trim().toLowerCase()) ? 'System' : 'External System',
  })

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, application: C4ApplicationCatalogItem) => {
    event.dataTransfer.setData(C4_APPLICATION_CATALOG_MIME, JSON.stringify(withPlacementClassification(application)))
    event.dataTransfer.effectAllowed = 'copyMove'
  }

  return (
    <div className="enterprise-popover-scroll min-h-0 flex-1 overflow-y-auto p-2">
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Application Catalog</p>
        <p className="mt-0.5 text-[9px] leading-3 text-slate-500">Drag an application to the canvas or add it at the center.</p>
      </div>
      <label className="relative mb-2 block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search applications"
          className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[11px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </label>
      {loading ? <p className="px-2 py-6 text-center text-[11px] text-slate-500">Loading Application Catalog...</p> : null}
      {!loading && filtered.length === 0 ? <p className="px-2 py-6 text-center text-[11px] text-slate-500">No applications match this view.</p> : null}
      <div className="space-y-1.5">
        {filtered.map((application) => {
          const exists = existingNames.has(application.name.trim().toLowerCase())
          const applicationKey = application.name.trim().toLowerCase()
          const asExternalSystem = !internalApplications.has(applicationKey)
          return (
            <div
              key={application.name}
              className={cn(
                'flex items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-sky-50',
                application.isInactive && 'opacity-40',
              )}
              title={application.isInactive ? 'Inactive application' : undefined}
            >
              <button
                type="button"
                draggable={!exists}
                onDragStart={(event) => handleDragStart(event, application)}
                onClick={() => exists ? onFocusExisting(application) : onAdd(withPlacementClassification(application))}
                className={cn('flex min-w-0 flex-1 items-center gap-2 text-left', !exists && 'cursor-grab active:cursor-grabbing')}
                title={exists ? 'Select application already in this diagram' : 'Add application to the diagram'}
              >
                <span className={cn('flex h-5 w-6 shrink-0 rounded-[3px]', asExternalSystem ? 'bg-slate-400' : 'bg-[#1168BD]')} />
                <span className="flex min-w-0 flex-1 items-center gap-1.5"><strong className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{application.name}</strong><span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">{application.type || 'Application'}</span></span>
                {exists ? <span className="shrink-0 text-[9px] text-slate-500">Added</span> : <AppWindow className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={asExternalSystem}
                aria-label={`${application.name}: ${asExternalSystem ? 'External System' : 'Internal System'}`}
                title={asExternalSystem ? 'External System' : 'Internal System'}
                onClick={() => setInternalApplications((current) => {
                  const next = new Set(current)
                  if (next.has(applicationKey)) next.delete(applicationKey)
                  else next.add(applicationKey)
                  return next
                })}
                className={cn('relative h-4 w-7 shrink-0 rounded-full transition-colors', asExternalSystem ? 'bg-slate-500' : 'bg-blue-600')}
              >
                <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform', asExternalSystem ? 'translate-x-3.5' : 'translate-x-0.5')} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
