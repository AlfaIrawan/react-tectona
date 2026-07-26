import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  actionRiskLabel,
  actionCategoryLabel,
  formatActionPayloadPreview,
  buildWorkspaceDetailMarkdown,
  type TectonaAgentActionExecution,
  type TectonaProposedAction,
} from '@/lib/chat/tectonaAgentActions'
import {
  fetchAllWorkspaceOrgWorkspaces,
  fetchWorkspaceOrgOrganizations,
  fetchWorkspaceOrgWorkspaceTypes,
} from '@/lib/api/workspaceOrgApi'
import { fetchGovernanceCatalogSnapshot } from '@/lib/api/governanceConfigurationApi'

const WORKSPACE_LIFECYCLE_STAGES = [
  'Draft',
  'Onboarding',
  'Active',
  'Scaling',
  'Suspended',
  'Archived',
] as const

// Action codes whose card is an editable FORM (choose mode → full form / guided stepper),
// not a read-only confirmation preview.
const FORM_ACTION_CODES = ['workspace.create', 'workspace.governance.apply']

type SelectOption = { value: string; label: string }
type FormFieldSpec = {
  key: string
  label: string
  required: boolean
  explain: string
  kind: 'text' | 'select'
  placeholder?: string
  options?: SelectOption[]
  /** When a select has no options yet loaded, fall back to a free-text input. */
  freeTextFallback?: boolean
  minLen?: number
}

const INPUT_CLASS =
  'mt-0.5 w-full rounded-md border border-[#d1d7db] bg-white px-2 py-1.5 text-sm text-[#111b21] outline-none focus:border-[#008069] dark:border-[#3b4a54] dark:bg-[#111b21] dark:text-[#e9edef]'
const SELECT_CLASS = INPUT_CLASS

export type AssistantActionCardProps = {
  action: TectonaProposedAction
  execution?: TectonaAgentActionExecution
  onConfirm?: (actionId: string, patch?: Record<string, unknown>) => void
  onCancel?: (actionId: string) => void
  className?: string
}

export function AssistantActionCard({
  action,
  execution,
  onConfirm,
  onCancel,
  className,
}: AssistantActionCardProps) {
  const status = execution?.status ?? 'pending'
  const preview = formatActionPayloadPreview(action)
  const isHighRisk = action.risk_level === 'high' || action.action_code === 'workspace.delete'
  const isTerminal = status === 'succeeded' || status === 'failed' || status === 'cancelled'

  const isCreate = action.action_code === 'workspace.create'
  const isGovernance = action.action_code === 'workspace.governance.apply'
  const isFormAction = FORM_ACTION_CODES.includes(action.action_code)
  // Navigation OFFER (requires_confirmation=true) — render as an "Buka" button, no route noise.
  const isNavigate = action.action_code === 'app.navigate'

  // Generic field values, seeded from the proposed payload.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const p = action.payload ?? {}
    const init: Record<string, string> = {}
    const seed = (k: string) => {
      const v = p[k]
      if (typeof v === 'string' && v.trim()) init[k] = v
    }
    seed('name')
    seed('organization_id')
    seed('workspace_type')
    seed('owner')
    seed('description')
    seed('workspace_id')
    seed('workspace_name')
    seed('governance_template_id')
    init.lifecycle_stage =
      typeof p.lifecycle_stage === 'string' && p.lifecycle_stage ? p.lifecycle_stage : 'Active'
    return init
  })
  const setValue = (k: string, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v }))
    // Once the user sets a value for a field we flagged as invalid, clear the warning.
    if (v.trim()) {
      setRejectedChoices((r) => {
        if (!(k in r)) return r
        const next = { ...r }
        delete next[k]
        return next
      })
    }
  }

  // Option sources (loaded per action).
  const [orgs, setOrgs] = useState<SelectOption[]>([])
  const [types, setTypes] = useState<SelectOption[]>([])
  const [typesLoaded, setTypesLoaded] = useState(false)
  const [workspaces, setWorkspaces] = useState<SelectOption[]>([])
  const [templates, setTemplates] = useState<SelectOption[]>([])
  const [optionsError, setOptionsError] = useState<string | null>(null)
  // Prefilled choice-field values the user gave inline that are NOT in the loaded options —
  // the agent informs about these and the field is cleared so the user picks a valid one.
  const [rejectedChoices, setRejectedChoices] = useState<Record<string, string>>({})

  const payloadHas = (k: string) =>
    Boolean(String((action.payload as Record<string, unknown>)[k] ?? '').toString().trim())
  // Data supplied inline: none → mode choice; some → jump into the form to complete it;
  // ALL required → skip straight to a read-only confirmation (no form).
  const createAnyProvided = payloadHas('name') || payloadHas('workspace_type') || payloadHas('owner')
  const govAnyProvided = payloadHas('workspace_id') || payloadHas('governance_template_id')
  // "Complete" only when the USER supplied every required field — Organization included.
  // Organization is NOT auto-decided into completeness: if the user didn't name it, the
  // agent must still show it for review (not jump straight to confirmation).
  const cameComplete = isCreate
    ? payloadHas('name') &&
      payloadHas('workspace_type') &&
      payloadHas('owner') &&
      payloadHas('organization_id')
    : isGovernance
      ? payloadHas('workspace_id') && payloadHas('governance_template_id')
      : false

  const [formMode, setFormMode] = useState<'choose' | 'full' | 'stepper'>(() => {
    if (isCreate && createAnyProvided) return 'full'
    if (isGovernance && govAnyProvided) return 'full'
    return 'choose'
  })
  const [stepIndex, setStepIndex] = useState(0)
  // User asked to tweak the confirmed data → reveal the editable form.
  const [forceEdit, setForceEdit] = useState(false)

  useEffect(() => {
    if (!isFormAction) return
    let cancelled = false
    ;(async () => {
      try {
        if (isCreate) {
          const [orgRes, typeRes] = await Promise.all([
            fetchWorkspaceOrgOrganizations({ page_size: 50 }),
            fetchWorkspaceOrgWorkspaceTypes(),
          ])
          if (cancelled) return
          const orgItems = orgRes.items ?? []
          const typeOpts = (typeRes.items ?? [])
            .filter((t) => t.is_active)
            .map((t) => ({ value: t.label, label: t.label }))
          setOrgs(orgItems.map((o) => ({ value: o.id, label: o.name })))
          setTypes(typeOpts)
          setTypesLoaded(true)
          // A prefilled Tipe that isn't in the catalog → inform + clear it.
          const providedType = String(action.payload.workspace_type ?? '').trim()
          const typeMatch =
            providedType && typeOpts.length > 0
              ? typeOpts.find((o) => o.value.toLowerCase() === providedType.toLowerCase())
              : undefined
          if (providedType && typeOpts.length > 0 && !typeMatch) {
            setRejectedChoices((r) => ({ ...r, workspace_type: providedType }))
          }
          setValues((prev) => {
            const next = { ...prev }
            if (!next.organization_id) {
              const def = orgItems.find((o) => o.status_code === 'active') ?? orgItems[0]
              if (def) next.organization_id = def.id
            }
            if (providedType && typeOpts.length > 0) {
              next.workspace_type = typeMatch ? typeMatch.value : '' // canonicalize or clear
            }
            return next
          })
        } else if (isGovernance) {
          const [wsRows, cat] = await Promise.all([
            fetchAllWorkspaceOrgWorkspaces(),
            fetchGovernanceCatalogSnapshot(),
          ])
          if (cancelled) return
          setWorkspaces(wsRows.map((w) => ({ value: w.id, label: w.name })))
          setTemplates((cat.templates ?? []).map((t) => ({ value: t.id, label: t.name })))
          // Backend may have pre-filled workspace_name (from chat text) — resolve to an id.
          setValues((prev) => {
            if (prev.workspace_id || !prev.workspace_name) return prev
            const byName = wsRows.find(
              (w) => w.name.toLowerCase() === prev.workspace_name.toLowerCase(),
            )
            return byName ? { ...prev, workspace_id: byName.id } : prev
          })
        }
      } catch (e) {
        if (!cancelled) setOptionsError(e instanceof Error ? e.message : 'Gagal memuat pilihan.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isFormAction, isCreate, isGovernance])

  // Per-action field specs, with the explanation the assistant gives for each field.
  const fields: FormFieldSpec[] = isCreate
    ? [
        {
          key: 'name',
          label: 'Nama workspace',
          required: true,
          kind: 'text',
          minLen: 2,
          placeholder: 'mis. Adira Finance Ops',
          explain: 'Nama yang tampil di Workspace Directory. Buat jelas & unik — mis. "Adira Finance Ops".',
        },
        {
          key: 'organization_id',
          label: 'Organization',
          required: true,
          kind: 'select',
          options: orgs,
          explain: 'Unit/organisasi induk tempat workspace bernaung. Menentukan konteks tata kelola & kepemilikan.',
        },
        {
          key: 'workspace_type',
          label: 'Tipe workspace',
          required: true,
          kind: 'select',
          options: types,
          freeTextFallback: typesLoaded && types.length === 0,
          placeholder: 'mis. Division',
          explain: 'Klasifikasi workspace (mis. Organization, Division) untuk pengelompokan & kebijakan governance.',
        },
        {
          key: 'owner',
          label: 'Owner',
          required: true,
          kind: 'text',
          placeholder: 'mis. Alfa Irawan',
          explain: 'Penanggung jawab utama workspace. Idealnya nama yang terdaftar di direktori orang.',
        },
        {
          key: 'lifecycle_stage',
          label: 'Lifecycle',
          required: false,
          kind: 'select',
          options: WORKSPACE_LIFECYCLE_STAGES.map((s) => ({ value: s, label: s })),
          explain: 'Tahap siklus hidup workspace. Pilih "Active" agar langsung bisa dipakai.',
        },
        {
          key: 'description',
          label: 'Deskripsi',
          required: false,
          kind: 'text',
          placeholder: 'Deskripsi singkat workspace',
          explain: 'Penjelasan singkat tujuan workspace. Opsional, tapi membantu anggota lain memahami konteks.',
        },
      ]
    : isGovernance
      ? [
          {
            key: 'workspace_id',
            label: 'Workspace',
            required: true,
            kind: 'select',
            options: workspaces,
            explain: 'Workspace yang akan diterapkan template governance-nya.',
          },
          {
            key: 'governance_template_id',
            label: 'Template governance',
            required: true,
            kind: 'select',
            options: templates,
            explain: 'Paket kebijakan (workflow, SLA, naming, approval) yang diterapkan sekaligus ke workspace.',
          },
        ]
      : []

  const minLenFor = (f: FormFieldSpec) => f.minLen ?? 1
  const isFieldFilled = (f: FormFieldSpec) => (values[f.key] ?? '').trim().length >= minLenFor(f)
  const formValid = fields.filter((f) => f.required).every(isFieldFilled)
  const confirmDisabled = status === 'executing' || (isFormAction && !formValid)

  const displayValue = (f: FormFieldSpec): string => {
    const v = (values[f.key] ?? '').trim()
    if (!v) return '—'
    if (f.kind === 'select' && !f.freeTextFallback) {
      return f.options?.find((o) => o.value === v)?.label ?? v
    }
    return v
  }

  // Rows summarising what was entered (review step + post-success confirmation list).
  const summaryRows = fields
    .filter((f) => (values[f.key] ?? '').trim())
    .map((f) => ({ label: f.label, value: displayValue(f) }))

  const successTitle = isGovernance ? '✅ Template governance diterapkan' : '✅ Workspace berhasil dibuat'

  // Choice fields whose inline value wasn't among the options — surfaced to the user.
  const rejectedEntries = Object.entries(rejectedChoices).map(([key, provided]) => {
    const f = fields.find((ff) => ff.key === key)
    return { key, label: f?.label ?? key, provided, options: (f?.options ?? []).map((o) => o.label) }
  })

  // Data came in fully + valid → show a read-only CONFIRMATION (no editable form) so the
  // user just Jalankan. If anything is missing/invalid, fall through to the form (= asking).
  const showConfirm =
    isFormAction && cameComplete && formValid && rejectedEntries.length === 0 && !forceEdit

  const handleConfirm = () => {
    if (!isFormAction) {
      onConfirm?.(action.action_id)
      return
    }
    const patch: Record<string, unknown> = {}
    for (const f of fields) {
      const v = (values[f.key] ?? '').trim()
      if (v) patch[f.key] = v
    }
    onConfirm?.(action.action_id, patch)
  }

  // Navigation OFFER with a choice: open in UI vs explain in chat.
  const explainEntityLabel =
    isNavigate && typeof action.payload.entity_label === 'string'
      ? action.payload.entity_label.trim()
      : ''
  const isNavigateChoice = isNavigate && explainEntityLabel.length > 0
  const handleExplainInChat = () => {
    // Build the workspace detail on the frontend (same data as the drawer) and inject it as
    // an assistant message — no backend round-trip, so it can't re-trigger this offer card.
    onCancel?.(action.action_id) // dismiss the offer
    void buildWorkspaceDetailMarkdown(explainEntityLabel)
      .then((text) => {
        window.dispatchEvent(new CustomEvent('tectona:chat-inject-assistant', { detail: { text } }))
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent('tectona:chat-inject-assistant', {
            detail: { text: `Aku belum bisa memuat detail Workspace "${explainEntityLabel}" sekarang.` },
          }),
        )
      })
  }

  const fieldControl = (f: FormFieldSpec) => {
    const busy = status === 'executing'
    const v = values[f.key] ?? ''
    const useSelect = f.kind === 'select' && !f.freeTextFallback
    if (useSelect) {
      const opts = f.options ?? []
      return (
        <select
          value={v}
          onChange={(e) => setValue(f.key, e.target.value)}
          disabled={busy || opts.length === 0}
          className={SELECT_CLASS}
        >
          {opts.length === 0 ? (
            <option value="">Memuat…</option>
          ) : (
            <option value="">{f.required ? 'Pilih…' : '—'}</option>
          )}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    return (
      <input
        value={v}
        onChange={(e) => setValue(f.key, e.target.value)}
        placeholder={f.placeholder}
        disabled={busy}
        className={INPUT_CLASS}
      />
    )
  }

  const fieldLabel = (f: FormFieldSpec) => `${f.label}${f.required ? ' *' : ''}`

  // Stepper: indices 0..N-1 are fields, the final index is the review step.
  const isReviewStep = stepIndex >= fields.length
  const currentField = isReviewStep ? null : fields[stepIndex]
  const stepBlocked = currentField != null && currentField.required && !isFieldFilled(currentField)

  const primaryBtnClass =
    'h-8 flex-1 bg-[#008069] text-white hover:bg-[#006e59] dark:bg-[#00a884] dark:hover:bg-[#008f6f]'

  return (
    <div
      className={cn(
        'mt-3 rounded-lg border p-3 text-sm',
        isHighRisk
          ? 'border-rose-300/80 bg-rose-50/90 dark:border-rose-900/50 dark:bg-rose-950/30'
          : 'border-[#d1d7db] bg-[#f0f2f5]/80 dark:border-[#3b4a54] dark:bg-[#1f2c34]/60',
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#008069] dark:text-[#00a884]">
          {actionCategoryLabel(action.action_code)}
        </span>
        <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-[#667781] dark:bg-white/10 dark:text-[#8696a0]">
          {action.action_code}
        </span>
        <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{actionRiskLabel(action.risk_level)}</span>
      </div>

      <p className="mb-2 font-medium text-[#111b21] dark:text-[#e9edef]">{action.summary}</p>

      {isFormAction && !isTerminal && rejectedEntries.length > 0 ? (
        <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-800/60 dark:bg-amber-950/30">
          {rejectedEntries.map((e) => (
            <p key={e.key} className="text-xs text-amber-800 dark:text-amber-300">
              ⚠️ <strong>{e.label}</strong> "{e.provided}" belum ada di pilihan.{' '}
              {e.options.length > 0
                ? `Pilih salah satu: ${e.options.join(', ')}.`
                : 'Silakan pilih dari daftar.'}
            </p>
          ))}
        </div>
      ) : null}

      {isFormAction ? (
        isTerminal ? (
          <>
            {status === 'succeeded' && summaryRows.length > 0 ? (
              <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50/70 p-2 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {successTitle}
                </p>
                <dl className="space-y-1">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[minmax(0,32%)_1fr] gap-2 text-xs">
                      <dt className="text-emerald-700/80 dark:text-emerald-300/70">{row.label}</dt>
                      <dd className="break-words font-medium text-emerald-900 dark:text-emerald-100">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {status === 'failed' && execution?.error ? (
              <p className="mb-2 text-xs text-rose-700 dark:text-rose-400">{execution.error}</p>
            ) : null}
            {status === 'cancelled' ? (
              <p className="mb-2 text-xs text-[#667781] dark:text-[#8696a0]">Aksi dibatalkan.</p>
            ) : null}
          </>
        ) : showConfirm ? (
          <>
            <dl className="mb-3 space-y-1 rounded-md bg-white/60 p-2 dark:bg-black/20">
              {summaryRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(0,32%)_1fr] gap-2 text-xs">
                  <dt className="text-[#667781] dark:text-[#8696a0]">{row.label}</dt>
                  <dd className="break-words font-medium text-[#111b21] dark:text-[#e9edef]">
                    {row.value}
                  </dd>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForceEdit(true)}
                className="mt-1 text-[10px] font-medium text-[#008069] underline dark:text-[#00a884]"
              >
                Ubah data
              </button>
            </dl>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 flex-1"
                disabled={status === 'executing'}
                onClick={() => onCancel?.(action.action_id)}
              >
                Batalkan
              </Button>
              <Button
                type="button"
                size="sm"
                className={primaryBtnClass}
                disabled={confirmDisabled}
                onClick={handleConfirm}
              >
                {status === 'executing' ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menjalankan…
                  </>
                ) : (
                  'Jalankan'
                )}
              </Button>
            </div>
          </>
        ) : formMode === 'choose' ? (
          <div className="space-y-2">
            <p className="text-xs text-[#667781] dark:text-[#8696a0]">
              Mau aku kasih <strong>formulir lengkap</strong> sekaligus, atau{' '}
              <strong>langkah demi langkah</strong> sambil aku jelaskan tiap field-nya?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFormMode('full')}
                className="rounded-md border border-[#d1d7db] bg-white p-2 text-left transition hover:border-[#008069] dark:border-[#3b4a54] dark:bg-[#111b21]"
              >
                <span className="block text-xs font-semibold text-[#111b21] dark:text-[#e9edef]">
                  📋 Formulir lengkap
                </span>
                <span className="block text-[10px] text-[#667781] dark:text-[#8696a0]">
                  Isi semua field sekaligus
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormMode('stepper')
                  setStepIndex(0)
                }}
                className="rounded-md border border-[#d1d7db] bg-white p-2 text-left transition hover:border-[#008069] dark:border-[#3b4a54] dark:bg-[#111b21]"
              >
                <span className="block text-xs font-semibold text-[#111b21] dark:text-[#e9edef]">
                  🪜 Langkah demi langkah
                </span>
                <span className="block text-[10px] text-[#667781] dark:text-[#8696a0]">
                  Aku pandu & jelaskan satu per satu
                </span>
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full"
              onClick={() => onCancel?.(action.action_id)}
            >
              Batalkan
            </Button>
          </div>
        ) : formMode === 'full' ? (
          <>
            <div className="mb-3 space-y-2 rounded-md bg-white/60 p-2 dark:bg-black/20">
              {fields.map((f) => (
                <label key={f.key} className="block text-xs">
                  <span className="text-[#667781] dark:text-[#8696a0]">{fieldLabel(f)}</span>
                  {fieldControl(f)}
                </label>
              ))}
              {isCreate && !payloadHas('organization_id') ? (
                <p className="text-[10px] text-[#008069] dark:text-[#00a884]">
                  ℹ️ Organization belum kamu sebut — aku pilih default. Cek & sesuaikan kalau perlu
                  sebelum Jalankan.
                </p>
              ) : null}
              {optionsError ? (
                <p className="text-[10px] text-rose-600 dark:text-rose-400">{optionsError}</p>
              ) : (
                <p className="text-[10px] text-[#667781] dark:text-[#8696a0]">
                  Field bertanda * wajib diisi.
                  {!formValid ? ' Lengkapi field wajib untuk lanjut.' : ''}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 flex-1"
                disabled={status === 'executing'}
                onClick={() => onCancel?.(action.action_id)}
              >
                Batalkan
              </Button>
              <Button
                type="button"
                size="sm"
                className={primaryBtnClass}
                disabled={confirmDisabled}
                onClick={handleConfirm}
              >
                {status === 'executing' ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menjalankan…
                  </>
                ) : (
                  'Jalankan'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 space-y-2 rounded-md bg-white/60 p-2 dark:bg-black/20">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#008069] dark:text-[#00a884]">
                {isReviewStep ? 'Tinjau & jalankan' : `Langkah ${stepIndex + 1}/${fields.length}`}
              </p>
              {isReviewStep ? (
                <dl className="space-y-1">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[minmax(0,32%)_1fr] gap-2 text-xs">
                      <dt className="text-[#667781] dark:text-[#8696a0]">{row.label}</dt>
                      <dd className="break-words font-medium text-[#111b21] dark:text-[#e9edef]">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : currentField ? (
                <label className="block text-xs">
                  <span className="font-medium text-[#111b21] dark:text-[#e9edef]">
                    {fieldLabel(currentField)}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[#667781] dark:text-[#8696a0]">
                    {currentField.explain}
                  </span>
                  {fieldControl(currentField)}
                </label>
              ) : null}
              {optionsError ? (
                <p className="text-[10px] text-rose-600 dark:text-rose-400">{optionsError}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={status === 'executing'}
                onClick={() =>
                  stepIndex === 0 ? setFormMode('choose') : setStepIndex((i) => Math.max(0, i - 1))
                }
              >
                {stepIndex === 0 ? 'Kembali' : 'Sebelumnya'}
              </Button>
              {isReviewStep ? (
                <Button
                  type="button"
                  size="sm"
                  className={primaryBtnClass}
                  disabled={confirmDisabled}
                  onClick={handleConfirm}
                >
                  {status === 'executing' ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Menjalankan…
                    </>
                  ) : (
                    'Jalankan'
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={primaryBtnClass}
                  disabled={stepBlocked}
                  onClick={() => setStepIndex((i) => i + 1)}
                >
                  Lanjut
                </Button>
              )}
            </div>
          </>
        )
      ) : (
        <>
          {preview.length > 0 && !isNavigate ? (
            <dl className="mb-3 space-y-1 rounded-md bg-white/60 p-2 dark:bg-black/20">
              {preview.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(0,38%)_1fr] gap-2 text-xs">
                  <dt className="text-[#667781] dark:text-[#8696a0]">{row.label}</dt>
                  <dd className="break-all font-medium text-[#111b21] dark:text-[#e9edef]">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {status === 'succeeded' && execution?.result_summary ? (
            <p className="mb-2 text-xs text-emerald-700 dark:text-emerald-400">{execution.result_summary}</p>
          ) : null}
          {status === 'failed' && execution?.error ? (
            <p className="mb-2 text-xs text-rose-700 dark:text-rose-400">{execution.error}</p>
          ) : null}
          {status === 'cancelled' ? (
            <p className="mb-2 text-xs text-[#667781] dark:text-[#8696a0]">
              {isNavigateChoice ? '💬 Oke, aku jelaskan di chat ya 👇' : 'Aksi dibatalkan.'}
            </p>
          ) : null}
          {!isTerminal && isNavigateChoice ? (
            <div className="space-y-2">
              <p className="text-xs text-[#667781] dark:text-[#8696a0]">
                Mau aku <strong>buka langsung di UI</strong> biar bisa kamu lihat, atau cukup{' '}
                <strong>aku jelaskan di chat</strong>?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-[#008069] text-white hover:bg-[#006e59] dark:bg-[#00a884] dark:hover:bg-[#008f6f]"
                  onClick={handleConfirm}
                >
                  🔎 Buka di UI
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={handleExplainInChat}
                >
                  💬 Jelaskan di chat
                </Button>
              </div>
            </div>
          ) : !isTerminal ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 flex-1"
                disabled={status === 'executing'}
                onClick={() => onCancel?.(action.action_id)}
              >
                Batalkan
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(
                  'h-8 flex-1 text-white',
                  isHighRisk
                    ? 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600'
                    : 'bg-[#008069] hover:bg-[#006e59] dark:bg-[#00a884] dark:hover:bg-[#008f6f]',
                )}
                disabled={confirmDisabled}
                onClick={handleConfirm}
              >
                {status === 'executing' ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menjalankan…
                  </>
                ) : isNavigate ? (
                  'Buka'
                ) : isHighRisk ? (
                  'Ya, hapus'
                ) : (
                  'Jalankan'
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
