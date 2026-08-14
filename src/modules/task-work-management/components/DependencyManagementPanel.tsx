import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  GitBranch,
  Link2,
  Trash2,
  Unplug,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  createWorkItemDependency,
  deleteWorkItemDependency,
  listWorkItemDependencies,
  patchWorkItemDependency,
  type WorkDependencyState,
  type WorkDependencyType,
  type WorkItemDependencyApiModel,
} from '@/lib/api/workApi'

export type DependencyPanelWorkItem = {
  id: string
  title: string
  type: string
  assignee: string
  status: string
  dependencyStatus: WorkDependencyState | string
  dueDate: string
  project: string
}

type ViewFilter = 'all' | 'linked' | 'blocked' | 'at_risk' | 'clear'

const SIGNAL_CHIP: Record<string, string> = {
  Clear: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100',
  'At Risk': 'border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100',
  Blocked: 'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-100',
}

function humanizeDependencyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (!raw.trim()) return 'Dependency service unavailable.'

  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string }
      detail?: string | { message?: string }
      message?: string
    }
    const code = parsed.error?.code
    const message = parsed.error?.message || parsed.message
      || (typeof parsed.detail === 'string' ? parsed.detail : parsed.detail?.message)

    if (code === 404 || message === 'Not Found') {
      return 'Dependency API belum aktif. Restart work-management service agar migrasi dependencies terpasang.'
    }
    if (message) return message
  } catch {
    // not JSON
  }

  if (raw.includes('404') || raw.toLowerCase().includes('not found')) {
    return 'Dependency API belum aktif. Restart work-management service agar migrasi dependencies terpasang.'
  }
  return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw
}

type DependencyManagementPanelProps = {
  items: DependencyPanelWorkItem[]
  search?: string
  disabled?: boolean
  addOpenRequestToken?: number
  onOpenItem: (id: string) => void
  onDependenciesChanged?: () => void
}

export function DependencyManagementPanel({
  items,
  search = '',
  disabled = false,
  addOpenRequestToken = 0,
  onOpenItem,
  onDependenciesChanged,
}: DependencyManagementPanelProps) {
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [dependencies, setDependencies] = useState<WorkItemDependencyApiModel[]>([])
  const [loadingDeps, setLoadingDeps] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [blockingId, setBlockingId] = useState('')
  const [dependentId, setDependentId] = useState('')
  const [depType, setDepType] = useState<WorkDependencyType>('FS')
  const [depStatus, setDepStatus] = useState<WorkDependencyState>('Clear')
  const [delayDays, setDelayDays] = useState('0')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const itemIdsKey = useMemo(() => items.map((item) => item.id).sort().join('|'), [items])

  const reloadDependencies = async () => {
    setLoadingDeps(true)
    setLoadError(null)
    try {
      const response = await listWorkItemDependencies()
      const visibleIds = new Set(items.map((item) => item.id))
      setDependencies(
        (response.items ?? []).filter(
          (entry) => visibleIds.has(entry.blockingId) && visibleIds.has(entry.dependentId),
        ),
      )
    } catch (error) {
      setDependencies([])
      setLoadError(humanizeDependencyError(error))
    } finally {
      setLoadingDeps(false)
    }
  }

  useEffect(() => {
    void reloadDependencies()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when scoped ids change
  }, [itemIdsKey])

  useEffect(() => {
    if (addOpenRequestToken > 0) openComposer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpenRequestToken])

  const linksByItem = useMemo(() => {
    const map = new Map<string, { blockedBy: WorkItemDependencyApiModel[]; blocks: WorkItemDependencyApiModel[] }>()
    for (const item of items) {
      map.set(item.id, { blockedBy: [], blocks: [] })
    }
    for (const edge of dependencies) {
      map.get(edge.dependentId)?.blockedBy.push(edge)
      map.get(edge.blockingId)?.blocks.push(edge)
    }
    return map
  }, [dependencies, items])

  const query = search.trim().toLowerCase()

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const links = linksByItem.get(item.id)
      const linked = Boolean(links && (links.blockedBy.length > 0 || links.blocks.length > 0))
      const signal = String(item.dependencyStatus || 'Clear')

      if (viewFilter === 'linked' && !linked) return false
      if (viewFilter === 'blocked' && signal !== 'Blocked') return false
      if (viewFilter === 'at_risk' && signal !== 'At Risk') return false
      if (viewFilter === 'clear' && signal !== 'Clear') return false

      if (!query) return true
      const relatedTitles = [
        ...(links?.blockedBy.map((edge) => itemById.get(edge.blockingId)?.title) ?? []),
        ...(links?.blocks.map((edge) => itemById.get(edge.dependentId)?.title) ?? []),
      ]
      return [item.title, item.id, item.type, item.assignee, item.project, signal, ...relatedTitles]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [itemById, items, linksByItem, query, viewFilter])

  const linkedCount = useMemo(
    () => items.filter((item) => {
      const links = linksByItem.get(item.id)
      return Boolean(links && (links.blockedBy.length > 0 || links.blocks.length > 0))
    }).length,
    [items, linksByItem],
  )

  function openComposer(prefill?: { blockingId?: string; dependentId?: string }) {
    setComposerOpen(true)
    setFormError(null)
    setBlockingId(prefill?.blockingId || items[0]?.id || '')
    setDependentId(prefill?.dependentId || items[1]?.id || items[0]?.id || '')
    setDepType('FS')
    setDepStatus('Clear')
    setDelayDays('0')
  }

  async function handleCreate() {
    if (!blockingId || !dependentId) {
      setFormError('Pilih work item blocker dan dependent.')
      return
    }
    if (blockingId === dependentId) {
      setFormError('Blocker dan dependent harus berbeda.')
      return
    }
    const delay = Number.parseInt(delayDays, 10)
    if (!Number.isFinite(delay) || delay < 0) {
      setFormError('Delay days harus angka ≥ 0.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const created = await createWorkItemDependency({
        blockingId,
        dependentId,
        type: depType,
        status: depStatus,
        delayDays: delay,
      })
      setDependencies((current) => [created, ...current.filter((entry) => entry.id !== created.id)])
      setComposerOpen(false)
      setExpandedId(dependentId)
      onDependenciesChanged?.()
    } catch (error) {
      setFormError(humanizeDependencyError(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(dependencyId: string) {
    setSaving(true)
    try {
      await deleteWorkItemDependency(dependencyId)
      setDependencies((current) => current.filter((entry) => entry.id !== dependencyId))
      onDependenciesChanged?.()
    } catch (error) {
      setLoadError(humanizeDependencyError(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleEdgeStatus(dependencyId: string, status: WorkDependencyState) {
    try {
      const updated = await patchWorkItemDependency(dependencyId, { status })
      setDependencies((current) => current.map((entry) => (entry.id === dependencyId ? updated : entry)))
      onDependenciesChanged?.()
    } catch (error) {
      setLoadError(humanizeDependencyError(error))
    }
  }

  const filters: Array<{ id: ViewFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'linked', label: 'Linked' },
    { id: 'blocked', label: 'Blocked' },
    { id: 'at_risk', label: 'At Risk' },
    { id: 'clear', label: 'Clear' },
  ]

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <GitBranch className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
              <h2 className="text-lg font-semibold text-foreground">Dependencies</h2>
            </div>
            <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">
              Siapa memblokir siapa — lihat relasi per work item, lalu tautkan blocker → dependent.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{linkedCount}</span> linked ·{' '}
              <span className="font-semibold text-foreground">{dependencies.length}</span> edge
              {dependencies.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="inline-flex flex-wrap items-center rounded-lg border border-border bg-background/80 p-0.5 shadow-sm">
          {filters.map((filter) => {
            const active = viewFilter === filter.id
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setViewFilter(filter.id)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                  active ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        {loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
            <span>{loadError}</span>
            <button type="button" className="font-semibold underline" onClick={() => void reloadDependencies()}>
              Retry
            </button>
          </div>
        ) : null}

        {composerOpen ? (
          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                Link dependency
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setComposerOpen(false)}
                aria-label="Close composer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Blocking</p>
                <Select value={blockingId} onChange={(event) => setBlockingId(event.target.value)}>
                  {items.map((item) => (
                    <SelectItem key={`b-${item.id}`} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="flex items-center justify-center gap-2 xl:pb-2">
                <Select value={depType} onChange={(event) => setDepType(event.target.value as WorkDependencyType)} className="w-[88px]">
                  <SelectItem value="FS">FS</SelectItem>
                  <SelectItem value="SS">SS</SelectItem>
                  <SelectItem value="FF">FF</SelectItem>
                </Select>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Dependent</p>
                <Select value={dependentId} onChange={(event) => setDependentId(event.target.value)}>
                  {items.map((item) => (
                    <SelectItem key={`d-${item.id}`} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 xl:w-auto xl:min-w-[220px]">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                  <Select value={depStatus} onChange={(event) => setDepStatus(event.target.value as WorkDependencyState)}>
                    <SelectItem value="Clear">Clear</SelectItem>
                    <SelectItem value="At Risk">At Risk</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Delay (d)</p>
                  <Input value={delayDays} onChange={(event) => setDelayDays(event.target.value)} className="h-10" />
                </div>
              </div>

              <Button
                type="button"
                className="h-10 rounded-full px-4 text-xs"
                disabled={saving || disabled}
                onClick={() => void handleCreate()}
              >
                Save link
              </Button>
            </div>

            {formError ? <p className="mt-3 text-xs text-rose-600">{formError}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loadingDeps && dependencies.length === 0 && !loadError ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">Loading dependency links…</p>
        ) : visibleItems.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center px-6">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border/70">
                <Unplug className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">Tidak ada item di filter ini</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ubah filter, atau tautkan dua work item dengan Link items.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {visibleItems.map((item) => {
              const links = linksByItem.get(item.id) ?? { blockedBy: [], blocks: [] }
              const signal = String(item.dependencyStatus || 'Clear')
              const expanded = expandedId === item.id
              const hasLinks = links.blockedBy.length > 0 || links.blocks.length > 0

              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-2xl border border-border/60 bg-background/70 transition-colors',
                    expanded && 'border-border bg-card shadow-[0_10px_28px_rgba(15,23,42,0.05)]'
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-3 text-left sm:px-4"
                    onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground ring-1 ring-border/60">
                      <GitBranch className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] font-semibold">
                          {item.type}
                        </Badge>
                        <Badge variant="outline" className={cn('rounded-full px-2 py-0 text-[10px] font-medium', SIGNAL_CHIP[signal] ?? SIGNAL_CHIP.Clear)}>
                          {signal}
                        </Badge>
                        {hasLinks ? (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {links.blockedBy.length} blocked by · {links.blocks.length} blocks
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No links</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.assignee || 'Unassigned'} · {item.dueDate?.slice(0, 10) || 'No due date'}
                      </p>

                      {!expanded && hasLinks ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {links.blockedBy.slice(0, 2).map((edge) => (
                            <span
                              key={edge.id}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border border-rose-200/70 bg-rose-50/80 px-2 py-0.5 text-[10px] text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-100"
                            >
                              ← {itemById.get(edge.blockingId)?.title ?? edge.blockingId}
                            </span>
                          ))}
                          {links.blocks.slice(0, 2).map((edge) => (
                            <span
                              key={edge.id}
                              className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-sky-200/70 bg-sky-50/80 px-2 py-0.5 text-[10px] text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-100"
                            >
                              → {itemById.get(edge.dependentId)?.title ?? edge.dependentId}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </button>

                  {expanded ? (
                    <div className="space-y-3 border-t border-border/50 px-3 py-3 sm:px-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full px-3 text-xs"
                          onClick={() => onOpenItem(item.id)}
                        >
                          Open detail
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full px-3 text-xs"
                          disabled={disabled || items.length < 2}
                          onClick={() => openComposer({ blockingId: item.id })}
                        >
                          Blocks…
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full px-3 text-xs"
                          disabled={disabled || items.length < 2}
                          onClick={() => openComposer({ dependentId: item.id })}
                        >
                          Blocked by…
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <RelationColumn
                          title="Blocked by"
                          empty="Tidak diblokir item lain."
                          edges={links.blockedBy}
                          resolveTitle={(edge) => itemById.get(edge.blockingId)?.title ?? edge.blockingId}
                          onOpenRelated={(edge) => onOpenItem(edge.blockingId)}
                          onDelete={(edgeId) => void handleDelete(edgeId)}
                          onStatusChange={(edgeId, status) => void handleEdgeStatus(edgeId, status)}
                          disabled={disabled || saving}
                          tone="rose"
                        />
                        <RelationColumn
                          title="Blocks"
                          empty="Tidak memblokir item lain."
                          edges={links.blocks}
                          resolveTitle={(edge) => itemById.get(edge.dependentId)?.title ?? edge.dependentId}
                          onOpenRelated={(edge) => onOpenItem(edge.dependentId)}
                          onDelete={(edgeId) => void handleDelete(edgeId)}
                          onStatusChange={(edgeId, status) => void handleEdgeStatus(edgeId, status)}
                          disabled={disabled || saving}
                          tone="sky"
                        />
                      </div>

                      {hasLinks ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Flow
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {links.blockedBy.map((edge, index) => (
                              <div key={edge.id} className="contents">
                                {index > 0 ? <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                                <FlowChip
                                  label={itemById.get(edge.blockingId)?.title ?? edge.blockingId}
                                  meta={`${edge.type} · ${edge.status}`}
                                  onClick={() => onOpenItem(edge.blockingId)}
                                />
                              </div>
                            ))}
                            {links.blockedBy.length > 0 || links.blocks.length > 0 ? (
                              <>
                                {links.blockedBy.length > 0 ? <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                                <FlowChip label={item.title} meta="current" emphasis onClick={() => onOpenItem(item.id)} />
                              </>
                            ) : null}
                            {links.blocks.map((edge) => (
                              <div key={edge.id} className="contents">
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                <FlowChip
                                  label={itemById.get(edge.dependentId)?.title ?? edge.dependentId}
                                  meta={`${edge.type} · ${edge.status}`}
                                  onClick={() => onOpenItem(edge.dependentId)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function FlowChip({
  label,
  meta,
  emphasis,
  onClick,
}: {
  label: string
  meta: string
  emphasis?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'max-w-[220px] rounded-xl border px-2.5 py-1.5 text-left transition-colors hover:bg-background',
        emphasis
          ? 'border-foreground/20 bg-foreground text-background'
          : 'border-border bg-background text-foreground'
      )}
    >
      <span className="block truncate text-[11px] font-semibold">{label}</span>
      <span className={cn('block truncate text-[10px]', emphasis ? 'text-background/70' : 'text-muted-foreground')}>
        {meta}
      </span>
    </button>
  )
}

function RelationColumn({
  title,
  empty,
  edges,
  resolveTitle,
  onOpenRelated,
  onDelete,
  onStatusChange,
  disabled,
  tone,
}: {
  title: string
  empty: string
  edges: WorkItemDependencyApiModel[]
  resolveTitle: (edge: WorkItemDependencyApiModel) => string
  onOpenRelated: (edge: WorkItemDependencyApiModel) => void
  onDelete: (edgeId: string) => void
  onStatusChange: (edgeId: string, status: WorkDependencyState) => void
  disabled: boolean
  tone: 'rose' | 'sky'
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
      {edges.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {edges.map((edge) => (
            <li
              key={edge.id}
              className={cn(
                'rounded-xl border bg-background px-2.5 py-2',
                tone === 'rose' ? 'border-rose-200/60' : 'border-sky-200/60'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => onOpenRelated(edge)}
                >
                  <p className="truncate text-xs font-semibold text-foreground">{resolveTitle(edge)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {edge.type} · delay {edge.delayDays}d
                  </p>
                </button>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                  title="Remove link"
                  disabled={disabled}
                  onClick={() => onDelete(edge.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <select
                className="mt-2 h-7 w-full rounded-md border border-input bg-background px-1.5 text-[11px]"
                value={edge.status}
                disabled={disabled}
                onChange={(event) => onStatusChange(edge.id, event.target.value as WorkDependencyState)}
              >
                <option value="Clear">Clear</option>
                <option value="At Risk">At Risk</option>
                <option value="Blocked">Blocked</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
