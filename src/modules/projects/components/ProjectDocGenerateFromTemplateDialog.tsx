import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { fillDkmTemplate } from '@/lib/api/tectonaAgentRuntimeApi'
import {
  instantiateTemplateFromProject,
  listProjectDocuments,
  patchDocument,
  type DocumentTemplateResponse,
  type DocumentResponse,
  listTemplates,
} from '@/lib/api/documentKnowledgeApi'
import {
  enterpriseSecondaryButtonClass,
  registerServicePrimaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { extractPlainTextFromHtml } from '@/lib/richHtmlEditor'
import { ensureProjectDocumentFolder } from '../lib/ensureProjectDocumentFolder'

const GENERATE_STEPS = [
  { key: 'analyze', label: 'Analyzing template structure' },
  { key: 'plan', label: 'Planning content for each field' },
  { key: 'write', label: 'Writing document content' },
  { key: 'finish', label: 'Finalizing document' },
] as const

const GENERATE_STEP_INTERVAL_MS = 2200

type DuplicateDocumentPrompt = {
  title: string
  existingTitle: string
  resolve: (proceed: boolean) => void
}

export type ProjectDocGenerateFromTemplateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: {
    id: string
    name: string
    description?: string
    workspaceId?: string | null
  }
  linkedIdeaId?: string | null
  linkedIdeaTitle?: string | null
  linkedIdeaDescription?: string | null
  linkedIdeaWorkspaceId?: string | null
  targetFolderId?: string | null
  onGenerated?: (document: { id: string; title: string }) => void
}

/** Global templates plus any scoped to the project and/or linked idea workspace (same as Idea Docs). */
export function filterActiveDkmTemplatesForWorkspaces(
  items: DocumentTemplateResponse[],
  workspaceIds: Array<string | null | undefined>,
): DocumentTemplateResponse[] {
  const scopedIds = workspaceIds.filter((id): id is string => Boolean(id?.trim()))
  return items.filter((item) => {
    if (!item.has_attachment) return false
    if (!item.workspace_id) return true
    return scopedIds.some((id) => id === item.workspace_id)
  })
}

/** Match Idea Docs: linked idea description/title first; never mix project placeholder copy when an idea is linked. */
export function resolveProjectDocGenerateSourceContext(input: {
  linkedIdeaDescription?: string | null
  linkedIdeaTitle?: string | null
  projectDescription?: string
  projectName?: string
}): string {
  const ideaDescription = extractPlainTextFromHtml(input.linkedIdeaDescription ?? '').trim()
  const ideaTitle = input.linkedIdeaTitle?.trim() ?? ''

  if (ideaDescription || ideaTitle) {
    return (ideaDescription || ideaTitle).trim()
  }

  const projectDescription = extractPlainTextFromHtml(input.projectDescription ?? '').trim()
  return (projectDescription || input.projectName?.trim() || '').trim()
}

export function ProjectDocGenerateFromTemplateDialog({
  open,
  onOpenChange,
  project,
  linkedIdeaId,
  linkedIdeaTitle,
  linkedIdeaDescription,
  linkedIdeaWorkspaceId,
  targetFolderId,
  onGenerated,
}: ProjectDocGenerateFromTemplateDialogProps) {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState<DocumentTemplateResponse[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [busy, setBusy] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicateDocumentPrompt | null>(null)
  const stepTimerRef = useRef<number | null>(null)

  const selectedTemplate = templates.find((item) => item.id === templateId) ?? null
  const sourceChars = sourceText.trim().length

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      event.stopPropagation()
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [busy, onOpenChange, open])

  useEffect(() => {
    if (!open) {
      setSourceText('')
      setTemplateId('')
      return
    }

    const defaultSource = resolveProjectDocGenerateSourceContext({
      linkedIdeaDescription,
      linkedIdeaTitle,
      projectDescription: project.description,
      projectName: project.name,
    })

    setSourceText(defaultSource)
    setTemplatesLoading(true)

    let cancelled = false
    void listTemplates({ status: 'active' })
      .then((items) => {
        if (cancelled) return
        const filtered = filterActiveDkmTemplatesForWorkspaces(items, [
          project.workspaceId,
          linkedIdeaWorkspaceId,
        ])
        setTemplates(filtered)
        setTemplateId(filtered[0]?.id ?? '')
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    linkedIdeaDescription,
    linkedIdeaTitle,
    linkedIdeaWorkspaceId,
    open,
    project.description,
    project.name,
    project.workspaceId,
  ])

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) {
        window.clearInterval(stepTimerRef.current)
      }
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    const template = templates.find((item) => item.id === templateId)
    if (!template) {
      addToast({ title: 'Select a template', description: 'Pick a DKM master template first.', variant: 'error' })
      return
    }

    const trimmedSource = sourceText.trim()
    if (!trimmedSource) {
      addToast({
        title: 'Source context required',
        description: 'Provide project notes or requirements for the agent to fill the template.',
        variant: 'error',
      })
      return
    }

    if (busy) return

    // Check before the expensive AI fill and before creating a repository record.
    // Generated project documents are identified by both their deterministic title
    // and template metadata so an older record without metadata is still covered.
    const proposedTitle = `${template.name} — ${project.name}`.slice(0, 255)
    let existingDocument: DocumentResponse | null = null
    try {
      const response = await listProjectDocuments(project.id, { page: 1, page_size: 100 })
      existingDocument = response.items.find((document) => {
        const metadata = (document.metadata ?? {}) as Record<string, unknown>
        const sameTitle = document.title.trim().toLowerCase() === proposedTitle.trim().toLowerCase()
        const sameTemplate = metadata.template_code === template.template_code
          && metadata.storage_project_id === project.id
        return sameTitle || sameTemplate
      }) ?? null
    } catch {
      // Duplicate checking is best-effort; generation can continue if the
      // repository lookup is temporarily unavailable.
    }

    if (existingDocument) {
      const proceed = await new Promise<boolean>((resolve) => {
        setDuplicatePrompt({
          title: proposedTitle,
          existingTitle: existingDocument.title,
          resolve: (value) => {
            setDuplicatePrompt(null)
            resolve(value)
          },
        })
      })
      if (!proceed) return
    }

    setBusy(true)
    setStepIndex(0)
    let stepIdx = 0
    stepTimerRef.current = window.setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, GENERATE_STEPS.length - 1)
      setStepIndex(stepIdx)
    }, GENERATE_STEP_INTERVAL_MS)

    try {
      const folderId =
        targetFolderId
        ?? (await ensureProjectDocumentFolder({ id: project.id, name: project.name }))

      const filled = await fillDkmTemplate({
        template_id: template.id,
        source_text: trimmedSource.slice(0, 12000),
        context: { workspace_id: linkedIdeaWorkspaceId ?? project.workspaceId ?? null },
        options: { allow_llm: true },
      })

      const tags = ['from-template', 'ai-generated', 'project-docs', template.template_code]
      if (linkedIdeaId) tags.push(linkedIdeaId)

      const generatedMetadata = {
        ...(existingDocument?.metadata ?? {}),
        source: 'project-docs-ai-generate',
        template_code: template.template_code,
        ai_generated: true,
        fill_correlation_id: filled.correlation_id,
        storage_project_id: project.id,
        storage_project_name: project.name,
        ...(linkedIdeaId ? { idea_id: linkedIdeaId } : {}),
        // Keep the generated structured payload with the version metadata when
        // the existing document is revised through the generic document PATCH API.
        generated_fills: filled.payload.fills ?? {},
        generated_sections: filled.payload.sections ?? {},
        generated_collections: filled.payload.collections ?? {},
        generated_agent_schema: filled.agent_schema,
        generated_diagrams: filled.rendered_diagrams ?? {},
      }

      const created = existingDocument
        ? await patchDocument(existingDocument.id, {
          version: existingDocument.version,
          title: proposedTitle,
          summary: filled.payload.summary?.trim() || template.description || undefined,
          content: filled.payload.summary?.trim() || template.description || `Generated from ${template.name}`,
          metadata: generatedMetadata,
          version_notes: `Revised from template ${template.template_code} for project ${project.id}`,
        })
        : await instantiateTemplateFromProject(project.id, template.id, {
          title: proposedTitle,
          summary: filled.payload.summary?.trim() || template.description || undefined,
          workspace_id: linkedIdeaWorkspaceId ?? project.workspaceId ?? null,
          folder_id: folderId,
          document_type_code: template.document_type_code,
          category_code: template.category_code,
          status_code: 'draft',
          tags,
          access_scope_codes: ['project_team'],
          metadata: generatedMetadata,
          version_notes: `AI-generated from template ${template.template_code} for project ${project.id}`,
          fills: filled.payload.fills ?? {},
          sections: filled.payload.sections ?? {},
          collections: filled.payload.collections ?? {},
          agent_schema: filled.agent_schema,
          diagrams: filled.rendered_diagrams ?? {},
        })

      onOpenChange(false)
      onGenerated?.({ id: created.id, title: created.title })
      addToast({
        title: existingDocument ? 'Document revision committed' : 'Document generated',
        description: existingDocument
          ? `${created.title} was merged into the existing document as a new version.`
          : `${created.title} opened in the document editor.`,
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to generate document',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      if (stepTimerRef.current) {
        window.clearInterval(stepTimerRef.current)
        stepTimerRef.current = null
      }
      setBusy(false)
    }
  }, [
    addToast,
    busy,
    linkedIdeaId,
    linkedIdeaWorkspaceId,
    onGenerated,
    onOpenChange,
    project.id,
    project.name,
    project.workspaceId,
    sourceText,
    targetFolderId,
    templateId,
    templates,
  ])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close generate dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onOpenChange(false)
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-doc-generate-title"
        className="relative z-[1401] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/25">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h3 id="project-doc-generate-title" className="text-base font-semibold tracking-tight text-foreground">
                Generate document from template
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Agent fills placeholders from project context, saves to this project folder in Document Repository,
                then the new file appears in Project Docs.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label
              htmlFor="project-doc-template"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Template
            </Label>
            <Select
              id="project-doc-template"
              className="rounded-xl"
              value={templateId}
              disabled={busy || templatesLoading}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="" disabled>
                {templatesLoading ? 'Loading templates…' : 'Select template…'}
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
            {selectedTemplate ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-background text-blue-700 ring-1 ring-border">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{selectedTemplate.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {(selectedTemplate.document_type_code || 'document').toUpperCase()}
                    {' · '}
                    v{selectedTemplate.version}
                    {selectedTemplate.category_code ? ` · ${selectedTemplate.category_code}` : ''}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="project-doc-source"
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Source context
              </Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {sourceChars.toLocaleString('en-US')} chars
              </span>
            </div>
            <Textarea
              id="project-doc-source"
              rows={9}
              className="min-h-[180px] resize-none rounded-xl border-border/80 bg-muted/20 px-3.5 py-3 text-sm leading-relaxed shadow-none"
              value={sourceText}
              disabled={busy}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Project description / linked idea notes used to fill the template"
            />
          </div>

          {busy ? (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Agent progress
              </p>
              <ul className="space-y-1.5">
                {GENERATE_STEPS.map((step, index) => {
                  const isDone = index < stepIndex
                  const isRunning = index === stepIndex
                  return (
                    <li key={step.key} className="flex items-center gap-2.5 text-sm">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : isRunning ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
                      )}
                      <span
                        className={cn(
                          isDone && 'text-foreground',
                          isRunning && 'font-medium text-foreground',
                          !isDone && !isRunning && 'text-muted-foreground',
                        )}
                      >
                        {step.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Generated files are saved to this project&apos;s Document Repository folder
              {linkedIdeaId ? ' and stay linked to the source idea.' : '.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            disabled={busy || Boolean(duplicatePrompt)}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            disabled={busy || Boolean(duplicatePrompt) || !templateId || !sourceText.trim()}
            onClick={() => void handleGenerate()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {busy ? 'Generating…' : 'Generate document'}
          </Button>
        </div>
      </div>

      {duplicatePrompt ? (
        <div className="absolute inset-0 z-[1402] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/35" aria-hidden="true" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="project-doc-duplicate-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-amber-900/60 dark:bg-slate-900"
          >
            <div className="border-b border-slate-200/80 bg-amber-50/70 px-5 py-4 dark:border-slate-700/70 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-300/70 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h3 id="project-doc-duplicate-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Document already exists
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    This template has already generated a document in this project. Generate another copy anyway?
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2 px-5 py-4 text-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">New document</p>
              <p className="rounded-xl border border-border bg-muted/20 px-3 py-2 font-medium text-foreground">{duplicatePrompt.title}</p>
              <p className="text-xs text-muted-foreground">Existing: {duplicatePrompt.existingTitle}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-3">
              <Button
                type="button"
                variant="outline"
                className={cn(enterpriseSecondaryButtonClass(), 'h-9 px-3 text-xs')}
                onClick={() => duplicatePrompt.resolve(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={cn(registerServicePrimaryButtonClass(), 'h-9 px-3 text-xs')}
                onClick={() => duplicatePrompt.resolve(true)}
              >
                Generate anyway
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
