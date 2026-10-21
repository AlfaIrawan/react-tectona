import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  getIntegrationFacts,
  putIntegrationFacts,
  type AnalyzeIdeaIntegrationResponse,
  type IntegrationFacts,
  type IntegrationFactsResponse,
} from '@/lib/api/tectonaAgentRuntimeApi'

/**
 * The facts the AI Integration Recommendation is drawn from (agent-runtime
 * orchestrator/integration_facts.py), for a person to correct: which applications exist, who owns
 * which data, how applications are integrated, who does which step. Saving stores them as
 * corrected (kept on later generations) and redraws the view from them.
 */

const KIND_LABELS: Record<string, string> = { application: 'Aplikasi', engine: 'Mesin (AI/pemrosesan)', channel: 'Kanal/antarmuka' }
const LINK_LABELS: Record<string, string> = {
  embedded: 'ditempel (embedded) di',
  calls: 'memanggil',
  sends_data: 'mengirim data ke',
  serves: 'melayani',
}
const INFRA_TYPES = ['Node', 'System Software', 'Device', 'Communication Network']

function emptyFacts(): IntegrationFacts {
  return { applications: [], system_lanes: [], data: [], integrations: [], uses: [], actors: [], infrastructure: [] }
}

function normalizeFacts(raw: Partial<IntegrationFacts> | undefined): IntegrationFacts {
  const facts = { ...emptyFacts(), ...(raw ?? {}) }
  return {
    ...facts,
    applications: (facts.applications ?? []).map((item) => ({ name: item.name ?? '', kind: item.kind ?? 'application', role: item.role ?? '' })),
    system_lanes: facts.system_lanes ?? [],
    data: (facts.data ?? []).map((item) => ({ name: item.name ?? '', owner: item.owner ?? '', used_by: item.used_by ?? [], stored_as_file: Boolean(item.stored_as_file) })),
    integrations: facts.integrations ?? [],
    uses: facts.uses ?? [],
    actors: (facts.actors ?? []).map((item) => ({ name: item.name ?? '', role: item.role === true || item.kind === 'role', process_ids: item.process_ids ?? [] })),
    infrastructure: (facts.infrastructure ?? []).map((item) => ({ name: item.name ?? '', type: item.type ?? 'Node', hosts: item.hosts ?? [] })),
  }
}

const inputClass = 'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-sky-400 focus:outline-none'
const selectClass = `${inputClass} appearance-none pr-7`

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
}

function Section({ title, hint, onAdd, children }: { title: string; hint: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        {onAdd ? (
          <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={onClick} aria-label="Hapus">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

function MultiCheck({ options, value, onChange }: { options: Array<{ value: string; label: string }>; value: string[]; onChange: (next: string[]) => void }) {
  if (options.length === 0) return <span className="text-xs text-slate-400">-</span>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-1 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={value.includes(option.value)}
            onChange={(event) => onChange(event.target.checked ? [...value, option.value] : value.filter((item) => item !== option.value))}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export function IntegrationFactsDialog({
  open,
  onOpenChange,
  ideaId,
  workspaceId,
  userId,
  stale,
  onApplied,
  onRefreshSources,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ideaId: string
  workspaceId?: string | null
  userId?: string | null
  /** The sources changed since the facts were corrected. */
  stale?: boolean
  onApplied: (response: AnalyzeIdeaIntegrationResponse) => Promise<void> | void
  onRefreshSources: () => Promise<void> | void
}) {
  const [loaded, setLoaded] = useState<IntegrationFactsResponse | null>(null)
  const [facts, setFacts] = useState<IntegrationFacts>(emptyFacts())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getIntegrationFacts(ideaId)
      .then((response) => {
        if (cancelled) return
        setLoaded(response)
        setFacts(normalizeFacts(response.facts))
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Fakta tidak bisa dimuat.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ideaId, open])

  const appNames = useMemo(() => facts.applications.map((item) => item.name.trim()).filter(Boolean), [facts.applications])
  const appOptions = appNames.map((name) => ({ value: name, label: name }))
  const steps = loaded?.process_steps ?? []
  const stepOptions = steps.map((step) => ({ value: step.id, label: `${step.actor ? `${step.actor}: ` : ''}${step.label}` }))
  const lanes = loaded?.lanes ?? []

  const update = <K extends keyof IntegrationFacts>(key: K, rows: IntegrationFacts[K]) => setFacts((current) => ({ ...current, [key]: rows }))
  const patchRow = <K extends keyof IntegrationFacts>(key: K, index: number, patch: Record<string, unknown>) =>
    setFacts((current) => ({
      ...current,
      [key]: (current[key] as unknown as Array<Record<string, unknown>>).map((row, at) => (at === index ? { ...row, ...patch } : row)),
    }))
  const removeRow = <K extends keyof IntegrationFacts>(key: K, index: number) =>
    setFacts((current) => ({ ...current, [key]: (current[key] as unknown as unknown[]).filter((_row, at) => at !== index) }))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await putIntegrationFacts(ideaId, { ...facts, meta: loaded?.facts?.meta }, { workspace_id: workspaceId ?? null, user_id: userId ?? null })
      await onApplied(response)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fakta tidak bisa disimpan.')
    } finally {
      setSaving(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      await onRefreshSources()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sumber tidak bisa dibaca ulang.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="solid" className="flex w-[min(56rem,calc(100vw-2rem))] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base">Fakta integrasi</DialogTitle>
          <DialogDescription>
            Diagram ArchiMate digambar dari fakta ini. Koreksi faktanya, lalu simpan: diagram digambar ulang dan koreksi Anda dipakai di generate berikutnya.
          </DialogDescription>
          {loaded?.edited ? (
            <p className="mt-1 text-xs text-sky-700">Fakta sudah dikoreksi{loaded.updated_at ? ` (${new Date(loaded.updated_at).toLocaleString()})` : ''}.</p>
          ) : null}
          {stale ? (
            <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Sumber (deskripsi, brainstorm, URD/BRD) berubah sejak fakta dikoreksi. Pakai &quot;Baca ulang sumber&quot; untuk mengekstrak ulang (koreksi sebelumnya diganti).
            </p>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat fakta...</p> : null}
          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
          {!loading ? (
            <>
              <Section title="Aplikasi" hint="Aplikasi, platform, dan mesin yang terlibat." onAdd={() => update('applications', [...facts.applications, { name: '', kind: 'application', role: '' }])}>
                {facts.applications.map((item, index) => (
                  <div key={`app-${index}`} className="grid grid-cols-[1fr_12rem_1fr_auto] items-center gap-2">
                    <input className={inputClass} value={item.name} placeholder="Nama aplikasi" onChange={(event) => patchRow('applications', index, { name: event.target.value })} />
                    <Select value={item.kind} onChange={(next) => patchRow('applications', index, { kind: next })}>
                      {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                    <input className={inputClass} value={item.role ?? ''} placeholder="Peran (opsional)" onChange={(event) => patchRow('applications', index, { role: event.target.value })} />
                    <RemoveButton onClick={() => removeRow('applications', index)} />
                  </div>
                ))}
              </Section>

              {lanes.length > 0 ? (
                <Section title="Lane yang sebenarnya sistem" hint="Lane di diagram proses yang dijalankan aplikasi (mis. lane &quot;AI&quot;): langkahnya dilayani aplikasi itu, bukan aktor." onAdd={() => update('system_lanes', [...facts.system_lanes, { lane: lanes[0], application: appNames[0] ?? '' }])}>
                  {facts.system_lanes.map((item, index) => (
                    <div key={`lane-${index}`} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs">
                      <Select value={item.lane} onChange={(next) => patchRow('system_lanes', index, { lane: next })}>
                        {lanes.map((lane) => <option key={lane} value={lane}>{lane}</option>)}
                      </Select>
                      <span className="text-slate-500">adalah</span>
                      <Select value={item.application} onChange={(next) => patchRow('system_lanes', index, { application: next })}>
                        <option value="">-</option>
                        {appOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Select>
                      <RemoveButton onClick={() => removeRow('system_lanes', index)} />
                    </div>
                  ))}
                </Section>
              ) : null}

              <Section title="Data" hint="Pemilik = aplikasi yang menyimpan/mengelola data; pemakai lain mengaksesnya lewat pemilik." onAdd={() => update('data', [...facts.data, { name: '', owner: '', used_by: [], stored_as_file: false }])}>
                {facts.data.map((item, index) => (
                  <div key={`data-${index}`} className="space-y-1 rounded-md border border-slate-100 p-2">
                    <div className="grid grid-cols-[1fr_12rem_auto_auto] items-center gap-2">
                      <input className={inputClass} value={item.name} placeholder="Nama data" onChange={(event) => patchRow('data', index, { name: event.target.value })} />
                      <Select value={item.owner} onChange={(next) => patchRow('data', index, { owner: next })}>
                        <option value="">Pemilik: -</option>
                        {appOptions.map((option) => <option key={option.value} value={option.value}>Pemilik: {option.label}</option>)}
                      </Select>
                      <label className="flex items-center gap-1 text-xs text-slate-700">
                        <input type="checkbox" checked={item.stored_as_file} onChange={(event) => patchRow('data', index, { stored_as_file: event.target.checked })} /> File/dokumen
                      </label>
                      <RemoveButton onClick={() => removeRow('data', index)} />
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="shrink-0 pt-0.5">Dipakai oleh:</span>
                      <MultiCheck options={appOptions.filter((option) => option.value !== item.owner)} value={item.used_by} onChange={(next) => patchRow('data', index, { used_by: next })} />
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Integrasi antar aplikasi" hint="Mis. Gen AI Engine ditempel (embedded) di DigiLearn." onAdd={() => update('integrations', [...facts.integrations, { source: appNames[0] ?? '', target: appNames[1] ?? '', type: 'embedded' }])}>
                {facts.integrations.map((item, index) => (
                  <div key={`link-${index}`} className="grid grid-cols-[1fr_12rem_1fr_auto] items-center gap-2">
                    <Select value={item.source} onChange={(next) => patchRow('integrations', index, { source: next })}>
                      {appOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                    <Select value={item.type} onChange={(next) => patchRow('integrations', index, { type: next })}>
                      {Object.entries(LINK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                    <Select value={item.target} onChange={(next) => patchRow('integrations', index, { target: next })}>
                      {appOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                    <RemoveButton onClick={() => removeRow('integrations', index)} />
                  </div>
                ))}
              </Section>

              {steps.length > 0 ? (
                <Section title="Aplikasi yang mendukung langkah proses" hint="Langkah dari diagram proses brainstorm." onAdd={() => update('uses', [...facts.uses, { process_id: steps[0].id, application: appNames[0] ?? '' }])}>
                  {facts.uses.map((item, index) => (
                    <div key={`use-${index}`} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs">
                      <Select value={item.application} onChange={(next) => patchRow('uses', index, { application: next })}>
                        {appOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Select>
                      <span className="text-slate-500">mendukung</span>
                      <Select value={item.process_id} onChange={(next) => patchRow('uses', index, { process_id: next })}>
                        {stepOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Select>
                      <RemoveButton onClick={() => removeRow('uses', index)} />
                    </div>
                  ))}
                </Section>
              ) : null}

              <Section title="Aktor tambahan" hint="Pelaku di luar lane proses, dengan langkah yang mereka jalankan." onAdd={() => update('actors', [...facts.actors, { name: '', role: true, process_ids: [] }])}>
                {facts.actors.map((item, index) => (
                  <div key={`actor-${index}`} className="space-y-1 rounded-md border border-slate-100 p-2">
                    <div className="grid grid-cols-[1fr_10rem_auto] items-center gap-2">
                      <input className={inputClass} value={item.name} placeholder="Nama aktor/tim" onChange={(event) => patchRow('actors', index, { name: event.target.value })} />
                      <Select value={item.role ? 'role' : 'actor'} onChange={(next) => patchRow('actors', index, { role: next === 'role' })}>
                        <option value="role">Peran/tim</option>
                        <option value="actor">Aktor</option>
                      </Select>
                      <RemoveButton onClick={() => removeRow('actors', index)} />
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="shrink-0 pt-0.5">Menjalankan:</span>
                      <MultiCheck options={stepOptions} value={item.process_ids} onChange={(next) => patchRow('actors', index, { process_ids: next })} />
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Infrastruktur" hint="Server, platform, perangkat, atau jaringan tempat aplikasi berjalan." onAdd={() => update('infrastructure', [...facts.infrastructure, { name: '', type: 'Node', hosts: [] }])}>
                {facts.infrastructure.map((item, index) => (
                  <div key={`infra-${index}`} className="space-y-1 rounded-md border border-slate-100 p-2">
                    <div className="grid grid-cols-[1fr_12rem_auto] items-center gap-2">
                      <input className={inputClass} value={item.name} placeholder="Nama infrastruktur" onChange={(event) => patchRow('infrastructure', index, { name: event.target.value })} />
                      <Select value={item.type} onChange={(next) => patchRow('infrastructure', index, { type: next })}>
                        {INFRA_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </Select>
                      <RemoveButton onClick={() => removeRow('infrastructure', index)} />
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="shrink-0 pt-0.5">Menjalankan:</span>
                      <MultiCheck options={appOptions} value={item.hosts} onChange={(next) => patchRow('infrastructure', index, { hosts: next })} />
                    </div>
                  </div>
                ))}
              </Section>
            </>
          ) : null}
        </div>
        <DialogFooter className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 sm:justify-between">
          <Button type="button" variant="outline" className="gap-1.5" disabled={refreshing || saving} onClick={() => void refresh()}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Baca ulang sumber
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="button" disabled={saving || loading || refreshing} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Simpan &amp; gambar ulang
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
