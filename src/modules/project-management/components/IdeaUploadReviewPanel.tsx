import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload,
  X,
  FileText,
  Loader2,
  Check,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { createIdea as apiCreateIdea, type IdeaApi } from '@/lib/api/ideaBacklogApi'
import { attachUploadedFileToIdeaDocs } from '@/modules/project-management/lib/attachUploadedFileToIdeaDocs'
import {
  extractRepositoryDocxStructure,
  extractRepositoryPdfText,
  extractRepositoryPptxStructure,
  startIdeaExtractionJob,
  getIdeaExtractionJob,
  type IdeaExtractionCandidate,
  type IdeaExtractionCategory,
  type IdeaExtractionJobStatusResponse,
} from '@/lib/api/tectonaAgentRuntimeApi'

const IDEA_EXTRACTION_TYPES: IdeaExtractionCategory[] = [
  'Innovation',
  'Improvement',
  'Request',
  'Transformation',
]
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB, matches the backend's cap
const MAX_CANDIDATE_TAGS = 5

type UploadStage = 'idle' | 'reading' | 'extracting' | 'review' | 'creating'

type CandidateRow = IdeaExtractionCandidate & {
  _localId: string
  _decision: 'accepted' | 'rejected'
  _createStatus: 'idle' | 'creating' | 'created' | 'error'
  _createError?: string
  _tagDraft: string
  _sourceOpen: boolean
}

function makeLocalId(): string {
  return `cand-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toCandidateRow(candidate: IdeaExtractionCandidate): CandidateRow {
  return {
    ...candidate,
    _localId: makeLocalId(),
    _decision: 'accepted',
    _createStatus: 'idle',
    _tagDraft: '',
    _sourceOpen: false,
  }
}

function detectExtractMethod(file: File): 'docx' | 'pdf' | 'pptx' | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) return 'docx'
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.pptx')) return 'pptx'
  return null
}

async function extractIdeaUploadText(
  file: File,
  method: 'docx' | 'pdf' | 'pptx',
): Promise<string> {
  if (method === 'pdf') {
    const result = await extractRepositoryPdfText(file)
    return result.text || ''
  }
  if (method === 'pptx') {
    const result = await extractRepositoryPptxStructure(file)
    return result.text || ''
  }
  try {
    const result = await extractRepositoryDocxStructure(file)
    if (result.text && result.text.trim()) return result.text
  } catch {
    /* fall back to client-side mammoth extraction below */
  }
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const raw = await mammoth.extractRawText({ arrayBuffer })
  return (raw.value || '').trim()
}

function friendlyExtractionError(rawMessage: string): string {
  if (rawMessage.includes('DOC_TEXT_EMPTY') || rawMessage.includes('PDF_TEXT_EMPTY') || rawMessage.includes('PPTX_TEXT_EMPTY')) {
    return "Couldn't read any text from this file. It may be a scanned/image-only document — try a different file."
  }
  if (rawMessage.includes('FILE_TOO_LARGE')) {
    return 'This file is too large (max 25 MB).'
  }
  return rawMessage || 'Failed to read this file. Please try a different file.'
}

interface IdeaUploadReviewPanelProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  currentUserId: string
  onIdeasCreated: (created: IdeaApi[]) => void
}

export function IdeaUploadReviewPanel({
  isOpen,
  onClose,
  workspaceId,
  currentUserId,
  onIdeasCreated,
}: IdeaUploadReviewPanelProps) {
  const [stage, setStage] = useState<UploadStage>('idle')
  const [fileName, setFileName] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [readingMethod, setReadingMethod] = useState<'docx' | 'pdf' | 'pptx' | null>(null)
  const [fileError, setFileError] = useState('')
  const [jobError, setJobError] = useState('')
  const [jobStatus, setJobStatus] = useState<IdeaExtractionJobStatusResponse | null>(null)
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [lastRunSummary, setLastRunSummary] = useState<{ created: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const requestTokenRef = useRef(0)

  const reset = useCallback(() => {
    requestTokenRef.current += 1
    setStage('idle')
    setFileName('')
    setUploadedFile(null)
    setReadingMethod(null)
    setFileError('')
    setJobError('')
    setJobStatus(null)
    setCandidates([])
    setLastRunSummary(null)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const processFile = useCallback(
    async (file: File) => {
      const method = detectExtractMethod(file)
      if (!method) {
        setFileError('Unsupported file type. Upload a Word (.docx), PDF, or PowerPoint (.pptx) file.')
        return
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setFileError('This file is too large (max 25 MB).')
        return
      }

      const token = ++requestTokenRef.current
      setFileError('')
      setJobError('')
      setFileName(file.name)
      setUploadedFile(file)
      setReadingMethod(method)
      setStage('reading')

      let documentText = ''
      try {
        documentText = await extractIdeaUploadText(file, method)
      } catch (err) {
        if (requestTokenRef.current !== token) return
        setStage('idle')
        setFileError(friendlyExtractionError(err instanceof Error ? err.message : String(err)))
        return
      }
      if (!documentText.trim()) {
        if (requestTokenRef.current !== token) return
        setStage('idle')
        setFileError(friendlyExtractionError('DOC_TEXT_EMPTY'))
        return
      }
      if (requestTokenRef.current !== token) return

      setStage('extracting')
      setJobStatus(null)
      try {
        const started = await startIdeaExtractionJob({
          document: {
            file_name: file.name,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
            extract_method: method,
            document_text: documentText,
          },
          context: {
            workspace_id: workspaceId || null,
            user_id: currentUserId || null,
            session_id: null,
          },
        })

        let candidatesResult: IdeaExtractionCandidate[] = []
        for (let attempt = 0; attempt < 240; attempt += 1) {
          if (requestTokenRef.current !== token) return
          const status = await getIdeaExtractionJob(started.job_id)
          if (requestTokenRef.current !== token) return
          setJobStatus(status)
          if (status.status === 'completed') {
            candidatesResult = status.result?.candidates ?? []
            break
          }
          if (status.status === 'failed') {
            throw new Error(status.error_message || 'Idea extraction failed.')
          }
          if (status.status === 'cancelled') {
            throw new Error('Idea extraction was cancelled.')
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 1250))
        }
        if (requestTokenRef.current !== token) return
        setCandidates(candidatesResult.map(toCandidateRow))
        setStage('review')
      } catch (err) {
        if (requestTokenRef.current !== token) return
        setStage('idle')
        setJobError(err instanceof Error ? err.message : 'Idea extraction failed.')
      }
    },
    [currentUserId, workspaceId],
  )

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void processFile(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  const updateCandidate = (localId: string, patch: Partial<CandidateRow>) => {
    setCandidates((prev) => prev.map((c) => (c._localId === localId ? { ...c, ...patch } : c)))
  }

  const removeCandidateTag = (localId: string, tag: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c._localId === localId ? { ...c, tags: c.tags.filter((t) => t !== tag) } : c)),
    )
  }

  const addCandidateTag = (localId: string, rawTag: string) => {
    const tag = rawTag.trim()
    setCandidates((prev) =>
      prev.map((c) => {
        if (c._localId !== localId) return c
        if (!tag || c.tags.length >= MAX_CANDIDATE_TAGS || c.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
          return { ...c, _tagDraft: '' }
        }
        return { ...c, tags: [...c.tags, tag].slice(0, MAX_CANDIDATE_TAGS), _tagDraft: '' }
      }),
    )
  }

  const acceptedCount = candidates.filter((c) => c._decision === 'accepted').length

  const attachSourceDocBestEffort = async (created: IdeaApi) => {
    if (!uploadedFile) return
    try {
      await attachUploadedFileToIdeaDocs({
        file: uploadedFile,
        ideaId: created.id,
        ideaTitle: created.title,
        ideaProjectId: created.project_id ?? null,
        workspaceId: created.workspace_id ?? workspaceId,
      })
    } catch (err) {
      console.warn('Failed to attach uploaded file to Idea Docs', err)
    }
  }

  const handleConfirmCreate = async () => {
    const accepted = candidates.filter((c) => c._decision === 'accepted')
    if (accepted.length === 0) return
    setJobError('')
    if (!workspaceId.trim()) {
      setJobError('Workspace is required to create ideas. Please select a workspace and try again.')
      return
    }

    setStage('creating')
    const createdIdeas: IdeaApi[] = []
    let createdCount = 0

    for (const candidate of accepted) {
      const localId = candidate._localId
      if (!candidate.title.trim()) {
        updateCandidate(localId, { _createStatus: 'error', _createError: 'Idea title is required.' })
        continue
      }
      updateCandidate(localId, { _createStatus: 'creating', _createError: undefined })
      try {
        const created = await apiCreateIdea({
          title: candidate.title.trim(),
          description:
            candidate.description.trim() ||
            'Define business problem, expected value, and target outcomes for governance review.',
          category: candidate.category,
          tags: candidate.tags.length > 0 ? candidate.tags : ['Uploaded'],
          workspace_id: workspaceId,
          owner_id: currentUserId || undefined,
        })
        createdIdeas.push(created)
        createdCount += 1
        setCandidates((prev) => prev.filter((c) => c._localId !== localId))
        await attachSourceDocBestEffort(created)
      } catch (err) {
        updateCandidate(localId, {
          _createStatus: 'error',
          _createError: err instanceof Error ? err.message : 'Failed to create idea.',
        })
      }
    }

    if (createdIdeas.length > 0) onIdeasCreated(createdIdeas)
    setLastRunSummary({ created: createdCount, total: accepted.length })
    setStage('review')
  }

  const retryCandidateCreate = async (localId: string) => {
    const candidate = candidates.find((c) => c._localId === localId)
    if (!candidate) return
    if (!candidate.title.trim()) {
      updateCandidate(localId, { _createStatus: 'error', _createError: 'Idea title is required.' })
      return
    }
    if (!workspaceId.trim()) {
      updateCandidate(localId, {
        _createStatus: 'error',
        _createError: 'Workspace is required to create ideas. Please select a workspace and try again.',
      })
      return
    }
    updateCandidate(localId, { _createStatus: 'creating', _createError: undefined })
    try {
      const created = await apiCreateIdea({
        title: candidate.title.trim(),
        description:
          candidate.description.trim() ||
          'Define business problem, expected value, and target outcomes for governance review.',
        category: candidate.category,
        tags: candidate.tags.length > 0 ? candidate.tags : ['Uploaded'],
        workspace_id: workspaceId,
        owner_id: currentUserId || undefined,
      })
      onIdeasCreated([created])
      setCandidates((prev) => prev.filter((c) => c._localId !== localId))
      await attachSourceDocBestEffort(created)
    } catch (err) {
      updateCandidate(localId, {
        _createStatus: 'error',
        _createError: err instanceof Error ? err.message : 'Failed to create idea.',
      })
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/20 backdrop-blur-sm z-[1050] transition-opacity',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={handleClose}
        aria-hidden="true"
        role="button"
        tabIndex={-1}
      />

      <div
        className={cn(
          'fixed top-0 right-0 flex h-screen w-[560px] max-w-[94vw] flex-col transform z-[1100] transition-all duration-300',
          'backdrop-blur-xl bg-background/95 border-l border-border shadow-2xl',
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none',
        )}
        style={{
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
          margin: 0,
          padding: 0,
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-border backdrop-blur-sm">
          <div className="pr-3">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Idea
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a Word, PDF, or PowerPoint file describing one or more ideas — review before creating.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close upload idea">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto scrollbar-hide px-5 py-5">
          {stage === 'idle' && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition',
                isDragOver ? 'border-primary/60 bg-primary/5' : 'border-input/70 hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Drop a file here, or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">Word (.docx), PDF, or PowerPoint (.pptx) — max 25 MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.pptx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          )}

          {(fileError || jobError) && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{fileError || jobError}</span>
            </div>
          )}

          {stage === 'reading' && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-muted/20 px-6 py-14 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Reading {fileName}…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {readingMethod === 'pdf'
                    ? 'Extracting text from the PDF on the server (pdfplumber)…'
                    : readingMethod === 'pptx'
                      ? 'Extracting slide titles, body text, and notes on the server (python-pptx)…'
                      : 'Extracting document text and headings on the server (python-docx)…'}
                  {' '}This can take a moment for large files.
                </p>
              </div>
            </div>
          )}

          {stage === 'extracting' && (
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 px-6 py-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <div
                role="progressbar"
                aria-valuenow={jobStatus?.progress_percent ?? 5}
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${jobStatus?.progress_percent ?? 5}%` }}
                />
              </div>
              <div className="space-y-2">
                {(jobStatus?.plan ?? []).map((step) => (
                  <div key={step.id} className="flex items-start gap-2 text-xs">
                    {step.status === 'completed' ? (
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : step.status === 'running' ? (
                      <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                    ) : step.status === 'failed' ? (
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                    ) : (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-border/70 bg-background" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'font-medium',
                          step.status === 'pending' || step.status === 'skipped'
                            ? 'text-muted-foreground/60'
                            : 'text-foreground',
                        )}
                      >
                        {step.label}
                      </p>
                      {step.detail && step.status !== 'pending' && (
                        <p className="mt-0.5 leading-4 text-muted-foreground">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(stage === 'review' || stage === 'creating') && (
            <div className="space-y-4">
              {lastRunSummary && (
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm',
                    lastRunSummary.created === lastRunSummary.total
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {lastRunSummary.created} of {lastRunSummary.total} ideas created
                  {lastRunSummary.created < lastRunSummary.total ? ' — 1 or more failed, see below.' : '.'}
                </div>
              )}

              {candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-6 py-14 text-center">
                  <Check className="h-8 w-8 text-emerald-600" />
                  <p className="text-sm text-muted-foreground">
                    {lastRunSummary ? 'All accepted ideas were created.' : 'No idea candidates could be identified in this document.'}
                  </p>
                  <button type="button" onClick={reset} className={enterpriseSecondaryButtonClass()}>
                    Upload another file
                  </button>
                </div>
              ) : (
                candidates.map((candidate, index) => {
                  const isRejected = candidate._decision === 'rejected'
                  return (
                    <div
                      key={candidate._localId}
                      className={cn(
                        'space-y-3 rounded-xl border p-4 shadow-sm transition',
                        isRejected ? 'border-border/40 bg-muted/20 opacity-60' : 'border-border/70 bg-background',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Candidate {index + 1} of {candidates.length}
                          {candidate.confidence ? ` · confidence ${Math.round(candidate.confidence * 100)}%` : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={candidate._createStatus === 'creating'}
                            onClick={() =>
                              updateCandidate(candidate._localId, {
                                _decision: isRejected ? 'accepted' : 'rejected',
                              })
                            }
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition',
                              isRejected
                                ? 'border-border/70 bg-background text-muted-foreground hover:border-emerald-300 hover:text-emerald-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                            )}
                          >
                            <Check className="h-3 w-3" />
                            {isRejected ? 'Rejected' : 'Accepted'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Title</Label>
                        <Input
                          value={candidate.title}
                          onChange={(e) => updateCandidate(candidate._localId, { title: e.target.value })}
                          placeholder="Idea title"
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Type</Label>
                          <select
                            value={candidate.category}
                            onChange={(e) =>
                              updateCandidate(candidate._localId, {
                                category: e.target.value as IdeaExtractionCategory,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-input/80 bg-background px-2.5 text-sm shadow-sm transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {IDEA_EXTRACTION_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Textarea
                          value={candidate.description}
                          onChange={(e) => updateCandidate(candidate._localId, { description: e.target.value })}
                          rows={3}
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Tags</Label>
                        <div className="min-h-[38px] w-full rounded-lg border border-input/80 bg-background px-2 py-1.5 shadow-sm">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {candidate.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeCandidateTag(candidate._localId, tag)}
                                  aria-label={`Remove tag ${tag}`}
                                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <input
                              value={candidate._tagDraft}
                              onChange={(e) => updateCandidate(candidate._localId, { _tagDraft: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault()
                                  addCandidateTag(candidate._localId, candidate._tagDraft)
                                }
                              }}
                              onBlur={() => {
                                if (candidate._tagDraft.trim()) addCandidateTag(candidate._localId, candidate._tagDraft)
                              }}
                              placeholder={candidate.tags.length === 0 ? 'Type tag then Enter' : 'Add tag'}
                              disabled={candidate.tags.length >= MAX_CANDIDATE_TAGS}
                              className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
                            />
                          </div>
                        </div>
                      </div>

                      {candidate.source_excerpt && (
                        <button
                          type="button"
                          onClick={() =>
                            updateCandidate(candidate._localId, { _sourceOpen: !candidate._sourceOpen })
                          }
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {candidate._sourceOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Source excerpt
                        </button>
                      )}
                      {candidate._sourceOpen && candidate.source_excerpt && (
                        <blockquote className="rounded-md border-l-2 border-border/70 bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground">
                          "{candidate.source_excerpt}"
                        </blockquote>
                      )}

                      {candidate._createStatus === 'error' && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          <span>{candidate._createError}</span>
                          <button
                            type="button"
                            onClick={() => void retryCandidateCreate(candidate._localId)}
                            className="inline-flex items-center gap-1 font-medium hover:underline"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </button>
                        </div>
                      )}
                      {candidate._createStatus === 'creating' && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Creating…
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {(stage === 'review' || stage === 'creating') && candidates.length > 0 && (
          <div className="shrink-0 border-t border-border px-5 py-4">
            <button
              type="button"
              disabled={acceptedCount === 0 || stage === 'creating'}
              onClick={() => void handleConfirmCreate()}
              className={cn(enterpriseCyanGradientActionButtonClass(), 'w-full justify-center', acceptedCount === 0 && 'pointer-events-none opacity-50')}
            >
              {stage === 'creating' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  Create {acceptedCount} accepted idea{acceptedCount === 1 ? '' : 's'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
