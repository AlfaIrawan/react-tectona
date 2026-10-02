import { useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Pencil, Play, Plus, RotateCcw, Save, Search, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { enterprisePrimarySolidButtonClass, enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getSession } from '@/auth/authService'
import { recordTokenEvent } from '@/lib/tokenTelemetry'
import { getSystemKbTableSpec, serializeSystemKbTable, systemKbTablePlainLength, type SystemKbTableEditModel } from '@/lib/kb/systemKbTableEditor'
import { advanceAbbreviationScan, createAbbreviationScan, fetchAbbreviationScan, findLatestAbbreviationScan, pauseAbbreviationScan, saveAbbreviationReview, type AbbreviationCandidate, type AbbreviationScan } from '@/lib/api/abbreviationScanApi'

type Props = { model: SystemKbTableEditModel; onChange: (model: SystemKbTableEditModel) => void; workspaceId?: string; entryId?: string | null }
const empty = () => ({ abbr: '', expansion: '', domain: '', not_confused_with: '' })
const key = (row: { abbr?: string; expansion?: string; domain?: string }) => [row.abbr, row.expansion, row.domain].map((value) => (value || '').trim().replace(/\s+/g, ' ').toLowerCase()).join('|')
type ReviewCandidate = AbbreviationCandidate & { candidate_key: string; selected: boolean }
function reviewCandidates(state: AbbreviationScan, previous: ReviewCandidate[] = []): ReviewCandidate[] {
  return state.candidates.map((item) => {
    const identity = key(item)
    const saved = state.review?.find((row) => row.candidate_key === identity)
    const current = previous.find((row) => row.candidate_key === identity)
    return { ...item, ...saved, ...current, evidence: item.evidence, status: item.status, candidate_key: identity, selected: current?.selected ?? saved?.selected ?? false }
  })
}

export function AbbreviationTableEditor({ model, onChange, workspaceId, entryId }: Props) {
  const spec = getSystemKbTableSpec('singkatan')
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [editIndex, setEditIndex] = useState(-1)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [scan, setScan] = useState<AbbreviationScan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<'workspace' | 'accessible'>('workspace')
  const [useAi, setUseAi] = useState(true)
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const running = useRef(false)
  const scanId = useRef<string | null>(null)
  const mounted = useRef(true)
  const storageKey = `tectona:abbreviation-scan:${getSession()?.user.id}:${workspaceId}:${entryId || 'new'}`
  const currentStorageKey = useRef(storageKey)
  currentStorageKey.current = storageKey

  const acceptScan = (state: AbbreviationScan) => {
    if (!mounted.current || currentStorageKey.current !== storageKey) return
    setScan(state)
    setScope(state.scope)
    setUseAi(state.use_ai ?? true)
    scanId.current = state.scan_id
    localStorage.setItem(storageKey, state.scan_id)
    setCandidates((current) => reviewCandidates(state, current))
  }

  useEffect(() => {
    mounted.current = true
    let active = true
    setScan(null); setCandidates([]); scanId.current = null
    const saved = localStorage.getItem(storageKey)
    const restore = saved ? fetchAbbreviationScan(saved) : workspaceId ? findLatestAbbreviationScan(workspaceId, entryId) : Promise.resolve(null)
    void restore.then((state) => {
      if (active && state) { acceptScan(state) }
    }).catch(() => { if (active) localStorage.removeItem(storageKey) })
    return () => {
      mounted.current = false
      active = false
      running.current = false
      if (scanId.current) void pauseAbbreviationScan(scanId.current).catch(() => {})
    }
  }, [storageKey])

  const updateRows = (rows: Array<Record<string, string>>) => {
    const next = { ...model, rows }
    if (systemKbTablePlainLength(next) > 20_000 || serializeSystemKbTable(next).length > 50_000) {
      setFormError('KB content limit reached. Save a smaller selection; remaining suggestions stay in the scan.')
      return false
    }
    onChange(next)
    setFormError('')
    return true
  }
  const save = (addMore = false) => {
    if (!draft) return
    const normalized = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()]))
    if (!normalized.abbr || !normalized.expansion) { setFormError('Abbreviation and expanded form are required.'); return }
    if (model.rows.some((row, index) => index !== editIndex && key(row) === key(normalized))) { setFormError('This abbreviation, expansion, and domain already exist.'); return }
    const rows = editIndex < 0 ? [...model.rows, normalized] : model.rows.map((row, i) => i === editIndex ? normalized : row)
    if (!updateRows(rows)) return
    setEditIndex(-1)
    setDraft(addMore ? empty() : null)
  }
  const report = (state: AbbreviationScan) => {
    const user = getSession()?.user.id
    if (!user) return
    const telemetryBase = `tectona:abbreviation-telemetry:${user}:${state.scan_id}`
    const telemetryKey = `${telemetryBase}:${state.updated_at}`
    if (localStorage.getItem(telemetryKey)) return
    const previous = Number(localStorage.getItem(`${telemetryBase}:tokens`) || 0)
    const total = state.usage.total_tokens || 0
    recordTokenEvent(user, { category: 'llm', source: 'user', kind: 'used', event: 'Abbreviation Scan', trigger: 'Abbreviation Scan', interactionType: 'Abbreviation Scan',
      context: `${state.processed}/${state.total} sources; ${state.skipped.length} skipped; ${state.candidates.length} candidates; ${state.status}; ${state.warnings.length} warnings; ${Math.max(0, total-previous)} tokens since checkpoint. Token usage is recorded per model call.`,
      model: state.usage.model, provider: state.usage.provider, inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCostIdr: 0,
      performanceStatus: state.warnings.length ? 'failed' : 'success', latencyMs: Date.now()-Date.parse(state.created_at) })
    localStorage.setItem(telemetryKey, '1')
    localStorage.setItem(`${telemetryBase}:tokens`, String(total))
  }
  const execute = async (newScan = false) => {
    if (!workspaceId || running.current) return
    setBusy(true); setError(''); running.current = true
    let latest: AbbreviationScan | null = scan
    try {
      if (newScan) setCandidates([])
      latest = newScan || !scan ? await createAbbreviationScan({ workspace_id: workspaceId, scope, use_ai: useAi, existing_rows: model.rows, exclude_entry_id: entryId }) : scan
      acceptScan(latest)
      while (running.current && mounted.current && currentStorageKey.current === storageKey && latest.status !== 'completed') {
        latest = await advanceAbbreviationScan(latest.scan_id)
        acceptScan(latest)
        if (latest.status === 'paused') break
        if (latest.status === 'running') await new Promise((resolve) => window.setTimeout(resolve, 300))
      }
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Scan failed. Resume to retry.') }
    finally {
      running.current = false
      if (latest) report(latest)
      if (mounted.current && currentStorageKey.current === storageKey) setBusy(false)
    }
  }
  const pause = async () => {
    running.current = false
    if (scanId.current) {
      try { acceptScan(await pauseAbbreviationScan(scanId.current)) } catch (err) { setError(err instanceof Error ? err.message : 'Pause failed') }
    }
  }
  const persistReview = async () => {
    if (!scan || !candidates.length) return
    await saveAbbreviationReview(scan.scan_id, candidates.map(({ candidate_key, abbr, expansion, domain, not_confused_with, selected }) => ({ candidate_key, abbr, expansion, domain, not_confused_with, selected })))
  }
  const closeScan = async () => {
    await pause()
    try { await persistReview(); setOpen(false) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save review') }
  }
  const addSelected = async () => {
    const known = new Set(model.rows.map(key))
    const rows = candidates.filter((c) => c.selected && c.abbr.trim() && c.expansion.trim()).flatMap((c) => {
      const row = { abbr: c.abbr, expansion: c.expansion, domain: c.domain, not_confused_with: c.not_confused_with }
      if (known.has(key(row))) return []
      known.add(key(row)); return [row]
    })
    try {
      await persistReview()
      if (rows.length && updateRows([...model.rows, ...rows])) { setOpen(false); setCandidates((items) => items.map((i) => ({ ...i, selected: false }))) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save review') }
  }

  return <div className="space-y-3 rounded-lg border border-border bg-background p-3">
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Abbreviation List</p><span className="rounded border bg-muted px-2 py-0.5 text-[10px]">Structured KB</span></div>
    <label className="block space-y-1"><span className="text-xs text-muted-foreground">Framework notes</span><textarea value={model.intro} onChange={(e) => onChange({ ...model, intro: e.target.value })} rows={3} className="w-full rounded-md border bg-background p-2 text-sm" /></label>
    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input aria-label="Search abbreviations" placeholder="Search abbreviations" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9 text-sm" /></div>
    <div tabIndex={0} role="region" aria-label="Abbreviation table" className="kb-table-scroll-hover max-h-80 overflow-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><table className="w-full min-w-[36rem] text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{spec.columns.map((c) => <th key={c.key} className={`px-3 py-2 font-medium ${c.key === 'abbr' ? 'sticky left-0 z-10 bg-muted' : ''}`}>{c.label}</th>)}<th className="px-3 py-2">Actions</th></tr></thead><tbody>{model.rows.map((row, index) => Object.values(row).join(' ').toLowerCase().includes(search.toLowerCase()) ? <tr key={index} className="border-t">{spec.columns.map((c) => <td key={c.key} className={`max-w-52 break-words px-3 py-2 ${c.key === 'abbr' ? 'sticky left-0 bg-background' : ''}`}>{row[c.key] || '-'}</td>)}<td className="px-2"><div className="flex"><Button type="button" variant="ghost" size="icon" title="Edit abbreviation" aria-label={`Edit ${row.abbr}`} onClick={() => { setEditIndex(index); setDraft({ ...row }); setFormError('') }}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" title="Delete abbreviation" aria-label={`Delete ${row.abbr}`} onClick={() => updateRows(model.rows.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div></td></tr> : null)}</tbody></table>{!model.rows.length && <p className="py-8 text-center text-xs text-muted-foreground">No abbreviations yet.</p>}</div>
    {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
    <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" className="h-10 min-w-0 gap-1.5 rounded-lg border-border bg-background px-3 text-xs text-foreground shadow-none hover:bg-secondary hover:text-secondary-foreground" disabled={!workspaceId} onClick={() => setOpen(true)}><Sparkles className="h-4 w-4 shrink-0" />Scan suggestions</Button><Button type="button" variant="secondary" className="h-10 min-w-0 gap-1.5 rounded-lg border border-border px-3 text-xs shadow-none" onClick={() => { setEditIndex(-1); setDraft(empty()); setFormError('') }}><Plus className="h-4 w-4 shrink-0" />Add abbreviation</Button></div>
    <Dialog open={draft !== null} onOpenChange={(value) => { if (!value) setDraft(null) }}><DialogContent surface="solid" className="max-w-lg rounded-lg"><DialogHeader><DialogTitle className="text-base">{editIndex < 0 ? 'Add abbreviation' : 'Edit abbreviation'}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">{spec.columns.map((c) => <label key={c.key} className="space-y-1"><span className="text-xs text-muted-foreground">{c.label}{['abbr', 'expansion'].includes(c.key) ? ' *' : ''}</span><Input className="h-10 text-sm" aria-label={c.label} value={draft?.[c.key] || ''} onChange={(e) => setDraft((d) => d ? { ...d, [c.key]: e.target.value } : d)} /></label>)}</div>{formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}<DialogFooter><Button type="button" variant="outline" className="h-10" onClick={() => save(true)}><Save className="mr-2 h-4 w-4" />Save & add more</Button><Button type="button" className="h-10" onClick={() => save()}><Save className="mr-2 h-4 w-4" />Save & close</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={open} onOpenChange={(value) => { if (value) setOpen(true); else void closeScan() }}>
      <DialogContent surface="solid" className="abbreviation-scan-dialog flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 p-0 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]">
        <DialogHeader className="mb-0 shrink-0 border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">Abbreviation suggestions</DialogTitle>
              <DialogDescription>
                {scan ? `${scan.processed}/${scan.total} sources processed` : 'Review workspace evidence before adding abbreviations.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="abbreviation-scan-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
      <div className="flex flex-wrap items-center gap-3"><select aria-label="Scan scope" disabled={busy} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="workspace">Current workspace</option><option value="accessible">All accessible workspaces</option></select><label className="flex items-center gap-2 text-xs"><Switch checked={useAi} disabled={busy} onCheckedChange={setUseAi} />AI extraction</label>{busy ? <Button type="button" variant="outline" className="h-10" onClick={() => void pause()}><Pause className="mr-1 h-4 w-4" />Pause</Button> : <Button type="button" variant="secondary" className="h-10 gap-1.5 rounded-lg border border-border px-3 text-xs shadow-none" onClick={() => void execute()} disabled={scan?.status === 'completed'}><Play className="h-4 w-4 shrink-0" />{scan ? 'Resume scan' : 'Start scan'}</Button>}{scan && !busy && <Button type="button" variant="ghost" className="h-10" onClick={() => void execute(true)} title="Start new scan"><RotateCcw className="mr-1 h-4 w-4" />New scan</Button>}</div>
      {scan && <div className="space-y-2" role="status" aria-live="polite"><div className="flex min-w-0 items-center gap-2 text-xs">{busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}<span className="min-w-0 truncate" title={scan.label}>{scan.label}</span><span className="ml-auto shrink-0 tabular-nums">{scan.percent === null ? `${scan.total} sources` : `${scan.percent}%`}</span></div><div role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scan.percent ?? undefined} className="h-1.5 overflow-hidden rounded bg-muted"><div className={`h-full bg-primary ${scan.percent === null ? 'w-1/3 animate-pulse' : ''}`} style={scan.percent === null ? undefined : { width: `${scan.percent}%` }} /></div></div>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Input className="h-10 text-sm" aria-label="Search suggestions" placeholder="Search suggestions" value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} />
      <div className="space-y-3">{candidates.map((c, index) => `${c.abbr} ${c.expansion} ${c.domain}`.toLowerCase().includes(candidateSearch.toLowerCase()) ? <div key={index} className="rounded-xl border border-border bg-background/70 p-3"><div className="flex items-center gap-2"><input aria-label={`Select ${c.abbr}`} type="checkbox" disabled={!c.expansion.trim()} checked={c.selected} onChange={(e) => setCandidates((items) => items.map((item, i) => i === index ? { ...item, selected: e.target.checked } : item))} /><strong className="text-sm">{c.abbr}</strong><span className={`rounded border px-1.5 text-[10px] ${c.status === 'supported' ? 'text-emerald-700' : 'text-amber-700'}`}>{c.status === 'supported' ? 'Supported' : c.status === 'conflict' ? 'Conflict' : 'Needs review'}</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2">{spec.columns.map((column) => <label key={column.key} className="space-y-1"><span className="text-[10px] text-muted-foreground">{column.label}</span><Input className="h-10 text-sm" aria-label={`${c.abbr} ${column.label}`} value={c[column.key as keyof AbbreviationCandidate] as string} onChange={(e) => setCandidates((items) => items.map((item, i) => i === index ? { ...item, [column.key]: e.target.value, selected: column.key === 'expansion' && !e.target.value.trim() ? false : item.selected } : item))} /></label>)}</div><details className="mt-2 text-xs text-muted-foreground"><summary>Evidence ({c.evidence.length})</summary>{c.evidence.map((e, i) => <div key={i} className="mt-2 break-words"><p className="font-medium">{e.kind}: {e.title}</p><blockquote className="mt-1 border-l-2 pl-2">{e.quote}</blockquote></div>)}</details></div> : null)}{scan?.status === 'completed' && !candidates.length && <p className="py-6 text-center text-xs text-muted-foreground">No new abbreviations found.</p>}{scan && (scan.skipped.length > 0 || scan.warnings.length > 0) && <details className="text-xs text-muted-foreground"><summary>{scan.skipped.length} skipped sources; {scan.warnings.length} warnings</summary>{scan.skipped.map((s, i) => <p key={i}>{s.title}: {s.reason}</p>)}{scan.warnings.map((s, i) => <p key={i}>{s}</p>)}</details>}</div>
      {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
        </div>
        <DialogFooter className="shrink-0 gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 pt-4">
          <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')} onClick={() => void closeScan()}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Close
          </Button>
          <Button type="button" className={cn(enterprisePrimarySolidButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')} disabled={busy || !candidates.some((c) => c.selected)} onClick={() => void addSelected()}>
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            Add selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
