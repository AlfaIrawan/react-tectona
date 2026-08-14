import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ChevronDown, ChevronUp, Loader2, RefreshCw, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  patchTemplate,
  type DocumentTemplateResponse,
  type TemplateAgentSchema,
} from '@/lib/api/documentKnowledgeApi'
import {
  analyzeDkmTemplateSchema,
  type AnalyzeDkmTemplateSchemaResponse,
  type TemplateSchemaPlaceholderRecommendation,
  type TemplateSchemaSectionRecommendation,
} from '@/lib/api/tectonaAgentRuntimeApi'
import {
  mergeAgentSchemaIntoMetadata,
  parseTemplateAgentSchema,
} from '@/modules/document-knowledge-management/lib/templateAgentSchema'

type TemplateAgentSchemaPanelProps = {
  template: DocumentTemplateResponse
  onSaved?: () => void
}

type AnalysisPhase = 'idle' | 'loading' | 'ready' | 'error'

type PlaceholderSelection = TemplateSchemaPlaceholderRecommendation & { accepted: boolean }
type SectionSelection = TemplateSchemaSectionRecommendation & { accepted: boolean }

const FORMAT_LABELS: Record<string, string> = {
  formatted: 'Formatted',
  unformatted: 'Unformatted',
  mixed: 'Mixed structure',
}

function confidenceLabel(value: number | undefined): string {
  return `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%`
}

function schemaIsEmpty(schema: TemplateAgentSchema): boolean {
  return (schema.placeholders?.length ?? 0) === 0 && (schema.sections?.length ?? 0) === 0
}

function recommendationToSchema(
  analysis: AnalyzeDkmTemplateSchemaResponse,
  placeholders: PlaceholderSelection[],
  sections: SectionSelection[],
): TemplateAgentSchema {
  return {
    document_kind: analysis.document_kind,
    placeholders: placeholders
      .filter((item) => item.accepted)
      .map((item) => ({
        key: item.key,
        label: item.label ?? item.key,
        type: item.type ?? 'text',
        required: Boolean(item.required),
        location: item.location ?? null,
        instruction: item.instruction ?? null,
      })),
    sections: sections
      .filter((item) => item.accepted)
      .map((item) => ({
        id: item.id,
        heading: item.heading ?? item.id,
        kind: item.kind ?? 'paragraph',
        min_paragraphs: item.min_paragraphs ?? 1,
      })),
  }
}

function buildTemplateFileOnlySchema(
  template: DocumentTemplateResponse,
  analysis: AnalyzeDkmTemplateSchemaResponse | null,
): TemplateAgentSchema {
  const parsed = parseTemplateAgentSchema(template.metadata)
  return {
    document_kind: analysis?.document_kind ?? parsed.document_kind ?? 'general',
    placeholders: [],
    sections: [],
  }
}

function hasHeuristicsFallbackWarnings(warnings: string[] | undefined): boolean {
  return (warnings ?? []).some((item) => item.includes('HEURISTICS') || item.includes('JSON_REPAIRED'))
}

function resolveSchemaToSave(
  analysis: AnalyzeDkmTemplateSchemaResponse | null,
  analysisPhase: AnalysisPhase,
  savedSchema: TemplateAgentSchema,
  placeholderSelections: PlaceholderSelection[],
  sectionSelections: SectionSelection[],
): TemplateAgentSchema {
  if (analysis && analysisPhase === 'ready') {
    return recommendationToSchema(analysis, placeholderSelections, sectionSelections)
  }
  return savedSchema
}

export function TemplateAgentSchemaPanel({ template, onSaved }: TemplateAgentSchemaPanelProps) {
  const { addToast } = useToast()
  const [savedSchema, setSavedSchema] = useState<TemplateAgentSchema>(() => parseTemplateAgentSchema(template.metadata))
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle')
  const [analysis, setAnalysis] = useState<AnalyzeDkmTemplateSchemaResponse | null>(null)
  const [placeholderSelections, setPlaceholderSelections] = useState<PlaceholderSelection[]>([])
  const [sectionSelections, setSectionSelections] = useState<SectionSelection[]>([])
  const [analysisError, setAnalysisError] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const autoAnalyzeStartedRef = useRef<string | null>(null)

  const hasAttachment = Boolean(template.has_attachment || template.latest_attachment_id || template.latest_file_name)
  const savedSchemaEmpty = useMemo(() => schemaIsEmpty(savedSchema), [savedSchema])
  const isDraft = template.status_code !== 'active'

  useEffect(() => {
    const parsed = parseTemplateAgentSchema(template.metadata)
    setSavedSchema(parsed)
    setAnalysis(null)
    setPlaceholderSelections([])
    setSectionSelections([])
    setAnalysisPhase('idle')
    setAnalysisError('')
    setAdvancedOpen(false)
    autoAnalyzeStartedRef.current = null
  }, [template.id, template.metadata, template.version])

  const applyAnalysisSelections = useCallback((result: AnalyzeDkmTemplateSchemaResponse) => {
    setAnalysis(result)
    setPlaceholderSelections(
      (result.placeholders ?? []).map((item) => ({
        ...item,
        accepted: (item.confidence ?? 0) >= 0.55,
      })),
    )
    setSectionSelections(
      (result.sections ?? []).map((item) => ({
        ...item,
        accepted: (item.confidence ?? 0) >= 0.55,
      })),
    )
    setAnalysisPhase('ready')
    setAnalysisError('')
  }, [])

  const runAnalysis = useCallback(async () => {
    if (analysisPhase === 'loading') return
    setAnalysisPhase('loading')
    setAnalysisError('')
    try {
      const result = await analyzeDkmTemplateSchema({ template_id: template.id })
      applyAnalysisSelections(result)
    } catch (error) {
      setAnalysisPhase('error')
      setAnalysisError(error instanceof Error ? error.message : 'Template analysis failed.')
    }
  }, [analysisPhase, applyAnalysisSelections, template.id])

  useEffect(() => {
    if (!hasAttachment || !savedSchemaEmpty) return
    if (autoAnalyzeStartedRef.current === template.id) return
    autoAnalyzeStartedRef.current = template.id
    void runAnalysis()
  }, [hasAttachment, runAnalysis, savedSchemaEmpty, template.id])

  const pendingSchema = useMemo(
    () => resolveSchemaToSave(analysis, analysisPhase, savedSchema, placeholderSelections, sectionSelections),
    [analysis, analysisPhase, placeholderSelections, savedSchema, sectionSelections],
  )

  const persistSchema = useCallback(
    async (
      schemaToSave: TemplateAgentSchema,
      options?: { publish?: boolean; mode?: string; toastTitle?: string; toastDescription?: string },
    ) => {
      setBusy(true)
      try {
        await patchTemplate(template.id, {
          ...(options?.publish ? { status_code: 'active' } : {}),
          metadata: mergeAgentSchemaIntoMetadata(template.metadata, schemaToSave, {
            ...(options?.mode
              ? {
                  agent_schema_confirmation_mode: options.mode,
                  agent_schema_confirmed_at: new Date().toISOString(),
                }
              : {}),
          }),
        })
        setSavedSchema(schemaToSave)
        addToast({
          title: options?.toastTitle ?? (options?.publish ? 'Template published' : 'Schema saved'),
          description:
            options?.toastDescription
            ?? (options?.publish
              ? 'Template is active and ready to use.'
              : 'Agent contract updated.'),
          variant: 'success',
        })
        onSaved?.()
      } catch (error) {
        addToast({
          title: options?.publish ? 'Publish failed' : 'Save failed',
          description: error instanceof Error ? error.message : '',
          variant: 'error',
        })
      } finally {
        setBusy(false)
      }
    },
    [addToast, onSaved, template.id, template.metadata],
  )

  const handleSave = useCallback(async () => {
    if (busy) return
    const schemaToSave = pendingSchema
    const mode = analysis
      ? (hasHeuristicsFallbackWarnings(analysis.warnings) ? 'heuristics_confirmed' : 'ai_confirmed')
      : undefined
    await persistSchema(schemaToSave, { mode })
  }, [analysis, busy, pendingSchema, persistSchema])

  const handleSaveAndPublish = useCallback(async () => {
    if (busy) return
    const schemaToSave = pendingSchema
    const mode = analysis
      ? (hasHeuristicsFallbackWarnings(analysis.warnings) ? 'heuristics_confirmed' : 'ai_confirmed')
      : 'template_file_only'
    await persistSchema(schemaToSave, { publish: true, mode })
  }, [analysis, busy, pendingSchema, persistSchema])

  const handleSkipAgentContract = useCallback(async () => {
    if (busy) return
    await persistSchema(buildTemplateFileOnlySchema(template, analysis), {
      mode: 'template_file_only',
      toastTitle: 'Saved without agent mapping',
      toastDescription: 'Word file unchanged. Edit template and Use template still work; agent auto-fill is not configured.',
    })
  }, [analysis, busy, persistSchema, template])

  const acceptedPlaceholderCount = placeholderSelections.filter((item) => item.accepted).length
  const acceptedSectionCount = sectionSelections.filter((item) => item.accepted).length

  return (
    <div className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Bot className="h-4 w-4 text-violet-600" aria-hidden />
            Agent schema
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
            AI reads the Word file and suggests placeholders and sections. Uncheck anything you disagree with, then save.
            Use <strong>Edit template</strong> or <strong>Use template</strong> anytime — no schema required.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">
          {template.status_code}
        </span>
      </div>

      {!hasAttachment ? (
        <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300">
          Upload a Word attachment to run AI analysis.
        </p>
      ) : null}

      {analysisPhase === 'loading' ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-violet-800 dark:text-violet-200">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Analyzing template structure…
        </div>
      ) : null}

      {analysisError ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {analysisError}
        </div>
      ) : null}

      {analysis && analysisPhase === 'ready' ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-xs text-slate-700 dark:text-slate-200">{analysis.summary}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
              <span>
                <span className="font-medium text-slate-700 dark:text-slate-300">Kind:</span>{' '}
                {analysis.document_kind} ({confidenceLabel(analysis.document_kind_confidence)})
              </span>
              <span>
                <span className="font-medium text-slate-700 dark:text-slate-300">Format:</span>{' '}
                {FORMAT_LABELS[analysis.template_format] ?? analysis.template_format}
              </span>
            </p>
            {hasHeuristicsFallbackWarnings(analysis.warnings) ? (
              <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                Partial AI result — suggestions come from document structure heuristics.
              </p>
            ) : null}
          </div>

          {placeholderSelections.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Placeholders ({acceptedPlaceholderCount}/{placeholderSelections.length})
              </p>
              {placeholderSelections.map((row, index) => (
                <label
                  key={`${row.key}-${index}`}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={row.accepted}
                    onChange={(event) =>
                      setPlaceholderSelections((prev) => {
                        const next = [...prev]
                        next[index] = { ...next[index], accepted: event.target.checked }
                        return next
                      })
                    }
                  />
                  <span className="min-w-0 text-[11px] leading-5">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.label || row.key}</span>
                    <span className="ml-1 text-slate-400">· {row.key}</span>
                    {row.source === 'styled_table_cell' ? (
                      <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-300">· table instruction</span>
                    ) : row.source === 'bracket_notation' ? (
                      <span className="ml-1 text-[10px] text-sky-700 dark:text-sky-300">· bracket placeholder</span>
                    ) : row.source === 'angle_notation' ? (
                      <span className="ml-1 text-[10px] text-violet-700 dark:text-violet-300">· angle placeholder</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {sectionSelections.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Sections ({acceptedSectionCount}/{sectionSelections.length})
              </p>
              {sectionSelections.map((row, index) => (
                <label
                  key={`${row.id}-${index}`}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={row.accepted}
                    onChange={(event) =>
                      setSectionSelections((prev) => {
                        const next = [...prev]
                        next[index] = { ...next[index], accepted: event.target.checked }
                        return next
                      })
                    }
                  />
                  <span className="min-w-0 text-[11px] leading-5">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.heading || row.id}</span>
                    <span className="ml-1 text-slate-400">· {row.id}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!savedSchemaEmpty && analysisPhase !== 'ready' ? (
        <p className="mt-3 text-[11px] text-slate-600 dark:text-slate-400">
          Saved: {savedSchema.document_kind ?? 'general'} · {(savedSchema.placeholders?.length ?? 0)} placeholders ·{' '}
          {(savedSchema.sections?.length ?? 0)} sections
        </p>
      ) : null}

      <div className="mt-4 flex w-full flex-nowrap items-stretch gap-2">
        <Button
          type="button"
          size="sm"
          className="h-10 min-h-10 min-w-0 flex-1 whitespace-nowrap px-2 text-xs"
          disabled={busy}
          onClick={() => void handleSave()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          <span className="truncate">Save schema</span>
        </Button>
        {isDraft ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-10 min-h-10 min-w-0 flex-1 whitespace-nowrap px-2 text-xs"
            disabled={busy}
            onClick={() => void handleSaveAndPublish()}
          >
            <span className="truncate">Save & publish</span>
          </Button>
        ) : null}
        {hasAttachment ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 min-h-10 min-w-0 flex-1 whitespace-nowrap px-2 text-xs text-slate-600"
            disabled={busy || analysisPhase === 'loading'}
            onClick={() => void runAnalysis()}
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Re-analyze</span>
          </Button>
        ) : null}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">No agent auto-fill needed?</p>
        <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
          Saves only the document kind — no placeholder/section mapping. Your Word file stays as-is;{' '}
          <strong>Edit template</strong> and <strong>Use template</strong> work normally. Agent runtime will not know which cells to fill.
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 h-9 w-full whitespace-nowrap text-[11px] text-slate-600"
          disabled={busy}
          onClick={() => void handleSkipAgentContract()}
        >
          Save without agent mapping
        </Button>
      </div>

      <div className="mt-2">
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-0.5 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:hover:text-slate-300"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Advanced — view JSON schema
        </button>
      </div>

      {advancedOpen ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-[10px] leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {JSON.stringify(pendingSchema, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
