import { useEffect, useRef, useState } from 'react'
import { AppWindow, Check, ChevronDown, Loader2, Pencil, Plus, Save, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  addSystemKbTableRow,
  getSystemKbTableSpec,
  type SystemKbTableEditModel,
} from '@/lib/kb/systemKbTableEditor'

export type ApplicationCatalogSuggestion = {
  name: string
  type: string
  description: string
  tags: string
  owner: string
  status: 'Active' | 'Inactive'
  evidence: string
  confidence: number
}

export type ApplicationCatalogScanProgress = {
  percent: number
  label: string
}

type SystemKbTableEditorFormProps = {
  model: SystemKbTableEditModel
  onChange: (next: SystemKbTableEditModel) => void
  onScanApplications?: (
    existingRows: Array<Record<string, string>>,
    onProgress: (progress: ApplicationCatalogScanProgress) => void,
  ) => Promise<ApplicationCatalogSuggestion[]>
}

const APPLICATION_TYPE_OPTIONS = ['Mobile', 'Web', 'Desktop'] as const
const APPLICATION_REQUIRED_FIELDS = new Set(['name', 'type', 'description'])

function createApplicationDraft(columns: Array<{ key: string }>) {
  return { ...Object.fromEntries(columns.map((column) => [column.key, ''])), status: 'Active' }
}

function parseApplicationTypes(value: string | undefined): Set<string> {
  return new Set((value || '').split(',').map((item) => item.trim()).filter(Boolean))
}

function parseApplicationTags(value: string | undefined): string[] {
  const seen = new Set<string>()
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function SystemKbTableEditorForm({ model, onChange, onScanApplications }: SystemKbTableEditorFormProps) {
  const spec = getSystemKbTableSpec(model.specId)
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [rowDraft, setRowDraft] = useState<Record<string, string> | null>(null)
  const [applicationTypeMenuOpen, setApplicationTypeMenuOpen] = useState(false)
  const [applicationTagInput, setApplicationTagInput] = useState('')
  const [applicationValidationAttempted, setApplicationValidationAttempted] = useState(false)
  const [applicationScanBusy, setApplicationScanBusy] = useState(false)
  const [applicationScanError, setApplicationScanError] = useState<string | null>(null)
  const [applicationSuggestions, setApplicationSuggestions] = useState<Array<ApplicationCatalogSuggestion & { selected: boolean }>>([])
  const [applicationScanCompleted, setApplicationScanCompleted] = useState(false)
  const [applicationScanOpen, setApplicationScanOpen] = useState(false)
  const [applicationScanProgress, setApplicationScanProgress] = useState<ApplicationCatalogScanProgress>({ percent: 0, label: '' })
  const applicationTypeMenuRef = useRef<HTMLDivElement | null>(null)
  const isApplicationCatalog = model.specId === 'aplikasi'

  const closeRowDialog = () => {
    setEditingRowIndex(null)
    setRowDraft(null)
    setApplicationTypeMenuOpen(false)
    setApplicationTagInput('')
    setApplicationValidationAttempted(false)
  }

  const openAddApplication = () => {
    setEditingRowIndex(-1)
    setRowDraft(createApplicationDraft(spec.columns))
    setApplicationValidationAttempted(false)
  }

  const openEditApplication = (index: number) => {
    setEditingRowIndex(index)
    setRowDraft({ ...createApplicationDraft(spec.columns), ...model.rows[index] })
    setApplicationValidationAttempted(false)
  }

  const saveApplication = (addMore = false) => {
    if (!rowDraft || editingRowIndex === null) return
    const pendingTag = applicationTagInput.trim().replace(/,+$/g, '')
    const draftToSave = pendingTag && !parseApplicationTags(rowDraft.tags).some((tag) => tag.toLowerCase() === pendingTag.toLowerCase())
      ? { ...rowDraft, tags: [...parseApplicationTags(rowDraft.tags), pendingTag].join(', ') }
      : rowDraft
    const hasMissingRequiredField = [...APPLICATION_REQUIRED_FIELDS].some((field) => !draftToSave[field]?.trim())
    if (hasMissingRequiredField) {
      setApplicationValidationAttempted(true)
      return
    }
    const nextRows = editingRowIndex === -1
      ? [...model.rows, draftToSave]
      : model.rows.map((row, index) => index === editingRowIndex ? draftToSave : row)
    if (addMore) {
      onChange({ ...model, rows: nextRows })
      setEditingRowIndex(-1)
      setRowDraft(createApplicationDraft(spec.columns))
      setApplicationTagInput('')
      return
    }
    closeRowDialog()
    onChange({ ...model, rows: nextRows })
  }

  const addApplicationTag = () => {
    const tag = applicationTagInput.trim().replace(/,+$/g, '')
    if (!tag) return
    setRowDraft((current) => {
      if (!current) return current
      const tags = parseApplicationTags(current.tags)
      if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return current
      return { ...current, tags: [...tags, tag].join(', ') }
    })
    setApplicationTagInput('')
  }

  const scanApplications = async () => {
    if (!onScanApplications) return
    setApplicationScanOpen(true)
    setApplicationScanBusy(true)
    setApplicationScanError(null)
    setApplicationSuggestions([])
    setApplicationScanCompleted(false)
    setApplicationScanProgress({ percent: 5, label: 'Preparing the Application Catalog scan...' })
    try {
      const suggestions = await onScanApplications(model.rows, setApplicationScanProgress)
      setApplicationSuggestions(suggestions.map((suggestion) => ({ ...suggestion, selected: true })))
      setApplicationScanCompleted(true)
      setApplicationScanProgress({ percent: 100, label: suggestions.length > 0 ? 'Suggestions are ready for review.' : 'Scan completed.' })
    } catch (error) {
      setApplicationScanError(error instanceof Error ? error.message : 'Application scan failed.')
    } finally {
      setApplicationScanBusy(false)
    }
  }

  const addSelectedApplicationSuggestions = () => {
    const selected = applicationSuggestions.filter((suggestion) => suggestion.selected)
    if (selected.length === 0) return
    const existingNames = new Set(model.rows.map((row) => (row.name || '').trim().toLowerCase()))
    const rowsToAdd = selected
      .filter((suggestion) => !existingNames.has(suggestion.name.trim().toLowerCase()))
      .map(({ selected: _selected, evidence: _evidence, confidence: _confidence, ...suggestion }) => suggestion)
    if (rowsToAdd.length > 0) onChange({ ...model, rows: [...model.rows, ...rowsToAdd] })
    setApplicationSuggestions([])
    setApplicationScanOpen(false)
  }

  useEffect(() => {
    if (!applicationTypeMenuOpen) return
    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!applicationTypeMenuRef.current?.contains(event.target as Node)) setApplicationTypeMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsidePointer)
    return () => document.removeEventListener('mousedown', closeOnOutsidePointer)
  }, [applicationTypeMenuOpen])

  const applicationFieldHasError = (field: string) => (
    applicationValidationAttempted
    && APPLICATION_REQUIRED_FIELDS.has(field)
    && !rowDraft?.[field]?.trim()
  )

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{spec.title.replace(/ \(Default\)$/i, '')}</p>
          <p className="text-[11px] text-muted-foreground">Locked columns. Add or delete rows without changing the table structure.</p>
        </div>
        <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          Structured KB
        </span>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">Framework notes</span>
        <textarea
          value={model.intro}
          onChange={(event) => onChange({ ...model, intro: event.target.value })}
          rows={3}
          className="w-full resize-y rounded-md border border-border/70 bg-background px-2.5 py-2 text-sm leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      {isApplicationCatalog ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-border/70 bg-background">
            <table className="w-full min-w-[44rem] text-left text-xs">
              <thead className="border-b border-border/70 bg-muted/35 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  {spec.columns.map((column) => <th key={column.key} className="px-3 py-2">{column.label}</th>)}
                  <th className="w-20 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {model.rows.map((row, index) => (
                  <tr key={`application-catalog-row-${index}`} className="hover:bg-muted/25">
                    {spec.columns.map((column) => (
                      <td key={column.key} className="max-w-[13rem] truncate px-3 py-2.5 text-foreground" title={row[column.key] ?? ''}>
                        {column.key === 'tags' ? (
                          <div className="flex flex-wrap gap-1">
                            {parseApplicationTags(row.tags).map((tag) => (
                              <span key={tag} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
                            ))}
                          </div>
                        ) : row[column.key] || <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditApplication(index)} aria-label={`Edit application ${index + 1}`} title="Edit application">
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onChange({ ...model, rows: model.rows.filter((_, rowIndex) => rowIndex !== index) })}
                          aria-label={`Delete application ${index + 1}`}
                          title="Delete application"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {model.rows.length === 0 ? (
              <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">No applications yet.</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" size="sm" className="h-10 w-full justify-center gap-1.5 text-xs" onClick={() => void scanApplications()} disabled={!onScanApplications || applicationScanBusy}>
              {applicationScanBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
              Scan suggestions
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-10 w-full justify-center gap-1.5 text-xs" onClick={openAddApplication}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add application
            </Button>
          </div>
          <Dialog open={applicationScanOpen} onOpenChange={setApplicationScanOpen}>
            <DialogContent surface="solid" className="w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]">
              <DialogHeader className="border-b border-border/70 bg-muted/25 px-6 py-5">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25"><Sparkles className="h-4 w-4" aria-hidden /></div>
                  <div className="space-y-1"><DialogTitle className="text-base">Application suggestions</DialogTitle><DialogDescription>Review candidates found from accessible workspace knowledge and documents.</DialogDescription></div>
                </div>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto px-6 py-5">
                {applicationScanBusy ? (
                  <div className="space-y-2 py-8" aria-live="polite">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> <span>{applicationScanProgress.label}</span><span className="ml-auto text-xs tabular-nums">{applicationScanProgress.percent}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${applicationScanProgress.percent}%` }} /></div>
                  </div>
                ) : null}
                {applicationScanError ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{applicationScanError}</p> : null}
                {applicationScanCompleted && !applicationScanError && applicationSuggestions.length === 0 ? <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">No new applications were found in the accessible workspace evidence.</p> : null}
                {applicationSuggestions.map((suggestion, index) => (
                  <label key={`${suggestion.name}-${index}`} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background p-3">
                    <input type="checkbox" checked={suggestion.selected} onChange={() => setApplicationSuggestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, selected: !item.selected } : item))} className="mt-0.5 h-4 w-4" />
                    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><strong className="text-sm text-foreground">{suggestion.name}</strong><span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{suggestion.type}</span><span className="text-[10px] text-muted-foreground">{Math.round(suggestion.confidence * 100)}%</span></span><span className="mt-1 block text-xs text-muted-foreground">{suggestion.description}</span>{suggestion.evidence ? <span className="mt-1 block text-[11px] text-muted-foreground">Evidence: {suggestion.evidence}</span> : null}</span>
                  </label>
                ))}
              </div>
              <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4"><Button type="button" variant="outline" className="h-10 flex-1" onClick={() => setApplicationScanOpen(false)}>Close</Button><Button type="button" className="h-10 flex-1 gap-1.5" onClick={addSelectedApplicationSuggestions} disabled={applicationScanBusy || applicationSuggestions.every((suggestion) => !suggestion.selected)}><Plus className="h-3.5 w-3.5" aria-hidden /> Add selected</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={editingRowIndex !== null} onOpenChange={(open) => !open && closeRowDialog()}>
            <DialogContent surface="solid" className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 p-0 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]">
              <DialogHeader className="mb-0 border-b border-border/70 bg-muted/25 px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                    <AppWindow className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-base font-semibold tracking-tight">
                      {editingRowIndex === -1 ? 'Add application' : 'Edit application'}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                      Complete the application details, then save the row to the catalog.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-x-3 gap-y-3 px-6 py-5 sm:grid-cols-2">
                {spec.columns.map((column) => (
                  <label key={column.key} className={column.key === 'notes' || column.key === 'description' || column.key === 'tags' ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
                    <span className="text-xs font-medium text-muted-foreground">
                      {column.key === 'owner' ? 'Business Owner' : column.label}
                      {APPLICATION_REQUIRED_FIELDS.has(column.key) ? <span className="ml-0.5 text-destructive">*</span> : null}
                    </span>
                    {column.key === 'type' ? (
                      <div ref={applicationTypeMenuRef} className="relative">
                        <button
                          type="button"
                          className={`flex h-9 w-full items-center justify-between rounded-md border bg-background px-2.5 text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${applicationFieldHasError('type') ? 'border-destructive' : 'border-border/70'}`}
                          onClick={() => setApplicationTypeMenuOpen((open) => !open)}
                          aria-expanded={applicationTypeMenuOpen}
                          aria-haspopup="listbox"
                        >
                          <span className={rowDraft?.type ? '' : 'text-muted-foreground'}>{rowDraft?.type || 'Select type'}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                        {applicationTypeMenuOpen ? (
                          <div role="listbox" aria-label="Application types" className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-lg">
                            {APPLICATION_TYPE_OPTIONS.map((option) => {
                              const selected = parseApplicationTypes(rowDraft?.type).has(option)
                              return (
                                <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => setRowDraft((current) => {
                                      if (!current) return current
                                      const next = parseApplicationTypes(current.type)
                                      if (next.has(option)) next.delete(option)
                                      else next.add(option)
                                      return { ...current, type: APPLICATION_TYPE_OPTIONS.filter((item) => next.has(item)).join(', ') }
                                    })}
                                    className="sr-only"
                                  />
                                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'}`}>
                                    {selected ? <Check className="h-3 w-3" aria-hidden /> : null}
                                  </span>
                                  {option}
                                </label>
                              )
                            })}
                          </div>
                        ) : null}
                        {applicationFieldHasError('type') ? <span className="mt-1 block text-[11px] text-destructive">Type is required.</span> : null}
                      </div>
                    ) : column.key === 'status' ? (
                      <div className="flex h-9 items-center justify-between px-0.5">
                        <span className="text-sm font-medium text-foreground">{rowDraft?.status === 'Active' ? 'Active' : 'Inactive'}</span>
                        <Switch
                          checked={rowDraft?.status === 'Active'}
                          onCheckedChange={(checked) => setRowDraft((current) => current ? { ...current, status: checked ? 'Active' : 'Inactive' } : current)}
                          aria-label="Application status"
                        />
                      </div>
                    ) : column.key === 'tags' ? (
                      <div className="rounded-md border border-border/70 bg-background p-2">
                        <div className="flex min-h-7 flex-wrap items-center gap-1.5">
                          {parseApplicationTags(rowDraft?.tags).map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {tag}
                              <button
                                type="button"
                                className="rounded-full text-primary/70 hover:text-primary"
                                onClick={() => setRowDraft((current) => current ? { ...current, tags: parseApplicationTags(current.tags).filter((item) => item !== tag).join(', ') } : current)}
                                aria-label={`Remove tag ${tag}`}
                              >
                                <X className="h-3 w-3" aria-hidden />
                              </button>
                            </span>
                          ))}
                          <Input
                            value={applicationTagInput}
                            onChange={(event) => setApplicationTagInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ',') return
                              event.preventDefault()
                              addApplicationTag()
                            }}
                            onBlur={addApplicationTag}
                            className="h-7 min-w-28 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                            placeholder="Add tag"
                          />
                        </div>
                      </div>
                    ) : column.key === 'notes' || column.key === 'description' ? (
                      <textarea
                        value={rowDraft?.[column.key] ?? ''}
                        onChange={(event) => setRowDraft((current) => current ? { ...current, [column.key]: event.target.value } : current)}
                        rows={3}
                        className={`w-full resize-y rounded-md border bg-background px-2.5 py-2 text-sm leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${applicationFieldHasError(column.key) ? 'border-destructive' : 'border-border/70'}`}
                        required={APPLICATION_REQUIRED_FIELDS.has(column.key)}
                      />
                    ) : (
                      <Input
                        value={rowDraft?.[column.key] ?? ''}
                        onChange={(event) => setRowDraft((current) => current ? { ...current, [column.key]: event.target.value } : current)}
                        className={`h-9 text-sm ${applicationFieldHasError(column.key) ? 'border-destructive' : ''}`}
                        required={APPLICATION_REQUIRED_FIELDS.has(column.key)}
                      />
                    )}
                  </label>
                ))}
              </div>
              <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4 pt-4">
                <Button type="button" variant="outline" className="h-10 min-w-0 basis-0 flex-1 justify-center" onClick={() => saveApplication(true)}>
                  <Save className="mr-2 h-4 w-4" aria-hidden />
                  Save & add more
                </Button>
                <Button type="button" className="h-10 min-w-0 basis-0 flex-1 justify-center" onClick={() => saveApplication()}>
                  <Save className="mr-2 h-4 w-4" aria-hidden />
                  Save & close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
      <div className="space-y-2">
        {model.rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-[12px] text-muted-foreground">
            No rows yet. Add a row to fill {spec.columns.map((column) => column.label).join(', ')}.
          </p>
        ) : null}
        {model.rows.map((row, index) => (
          <div key={`system-kb-row-${index}`} className="space-y-2 rounded-lg border border-border/70 bg-background px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Row {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                onClick={() => onChange({ ...model, rows: model.rows.filter((_, itemIndex) => itemIndex !== index) })}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                Delete
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
              {spec.columns.map((column) => (
                <label key={column.key} className="block space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">{column.label}</span>
                  <Input
                    value={row[column.key] ?? ''}
                    onChange={(event) => {
                      const nextRows = model.rows.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, [column.key]: event.target.value } : item
                      ))
                      onChange({ ...model, rows: nextRows })
                    }}
                    className="h-9 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-center gap-1.5 text-xs"
        onClick={() => onChange(addSystemKbTableRow(model))}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add row
      </Button>
        </>
      )}
    </div>
  )
}
