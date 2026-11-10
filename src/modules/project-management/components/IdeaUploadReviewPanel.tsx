import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { workspaceScopedPath, stripWorkspaceRoutePrefix } from '@/lib/workspaceRouting'
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
  extractIdeaPdfEvidence,
  extractRepositoryPptxStructure,
  startIdeaExtractionJob,
  getIdeaExtractionJob,
  cancelIdeaExtractionJob,
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
const MAX_DOCUMENT_TEXT_CHARS = 60_000
const MAX_CANDIDATE_TAGS = 5
const UPLOADED_DOCUMENT_TYPES = [
  { value: 'urd', label: 'URD' },
  { value: 'brd', label: 'BRD' },
  { value: 'fsd', label: 'FSD' },
] as const
const UPLOADED_DOCUMENT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'final', label: 'Final' },
] as const

type UploadedDocumentType = (typeof UPLOADED_DOCUMENT_TYPES)[number]['value']
type UploadedDocumentStatus = (typeof UPLOADED_DOCUMENT_STATUSES)[number]['value']

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
    _decision: candidate.overlap_analysis?.status === 'possible_duplicate' ? 'rejected' : 'accepted',
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
  allowImageOcr = false,
  signal?: AbortSignal,
): Promise<{ text: string; complete?: boolean; warnings?: string[] }> {
  if (method === 'pdf') {
    const result = await extractIdeaPdfEvidence(file, allowImageOcr, signal)
    return { text: result.text || '', complete: result.coverage.complete, warnings: result.coverage.warnings }
  }
  if (method === 'pptx') {
    const result = await extractRepositoryPptxStructure(file)
    return { text: result.text || '' }
  }
  try {
    const result = await extractRepositoryDocxStructure(file)
    if (result.text && result.text.trim()) return { text: result.text }
  } catch {
    /* fall back to client-side mammoth extraction below */
  }
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const raw = await mammoth.extractRawText({ arrayBuffer })
  return { text: (raw.value || '').trim() }
}

function friendlyExtractionError(rawMessage: string): string {
  if (rawMessage.includes('IDEA_EXTRACTION_EVIDENCE_REJECTED')) {
    return 'Kutipan pendukung atau kategori hasil analisis belum valid. Hasil AI perlu diperiksa sebelum ide dapat digunakan. Tidak ada ide yang dibuat.'
  }
  if (rawMessage.includes('PDF_OCR_DISABLED')) return 'Image OCR is disabled by the server. Provide a text-readable PDF or ask your administrator to enable OCR.'
  if (rawMessage.includes('PDF_OCR_INCOMPLETE')) return 'Image OCR could not read this PDF. Try again or provide a text-readable version.'
  if (rawMessage.includes('PDF_IMAGE_TEXT_REQUIRES_OCR')) return 'This PDF has no readable native text. Image OCR has not been run; provide an OCR-text version before analysis.'
  if (rawMessage.includes('PDF_ENCRYPTED')) return 'This PDF is password-protected. Upload an unlocked copy.'
  if (rawMessage.includes('DOC_TEXT_EMPTY') || rawMessage.includes('PDF_TEXT_EMPTY') || rawMessage.includes('PPTX_TEXT_EMPTY')) {
    return "Couldn't read any text from this file. It may be a scanned/image-only document — try a different file."
  }
  if (rawMessage.includes('FILE_TOO_LARGE')) {
    return 'This file is too large (max 25 MB).'
  }
  return rawMessage || 'Failed to read this file. Please try a different file.'
}

function uploadAnalysisWarning(code: string): string {
  if (code === 'PDF_IMAGE_TEXT_NOT_ANALYZED') return 'Text inside PDF images and screenshots has not been read. The analysis may miss features shown only in images.'
  if (code === 'PDF_OCR_TRANSCRIPTION_REQUIRES_REVIEW') return 'Image text was machine-transcribed. Review page references and excerpts for OCR mistakes.'
  if (code.startsWith('PDF_OCR_')) return 'Image OCR was incomplete or reached a limit. Some visual content remains unchecked.'
  if (code === 'PDF_PAGES_WITHOUT_NATIVE_TEXT') return 'Some PDF pages have no extractable text.'
  if (code === 'UPLOADED_DOCUMENT_COVERAGE_INCOMPLETE') return 'The uploaded document was only partly analyzed; novelty has not been established.'
  if (code.includes('TRUNCATED') || code.includes('LIMIT_REACHED')) return 'An analysis size or processing limit was reached. Some evidence remains unchecked.'
  if (code.includes('TIMEOUT') || code.includes('READ_FAILED') || code.includes('ANALYSIS_FAILED')) return 'Some existing sources could not be checked. Try again before treating this as a new idea.'
  if (code.includes('EVIDENCE_REJECTED')) return 'Unsupported generated evidence was removed. Review the remaining source excerpts.'
  if (code === 'CAPABILITY_EVIDENCE_INCOMPLETE') return 'Some capabilities could not be supported with source evidence.'
  return 'Some evidence could not be verified. Review the analysis coverage before creating ideas.'
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
  const location = useLocation()
  const routeSlug = stripWorkspaceRoutePrefix(location.pathname).slug
  const [stage, setStage] = useState<UploadStage>('idle')
  const [fileName, setFileName] = useState('')
  const [includeImageOcr, setIncludeImageOcr] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedDocumentType, setUploadedDocumentType] = useState<UploadedDocumentType>('brd')
  const [uploadedDocumentStatus, setUploadedDocumentStatus] = useState<UploadedDocumentStatus>('draft')
  const [readingMethod, setReadingMethod] = useState<'docx' | 'pdf' | 'pptx' | null>(null)
  const [fileError, setFileError] = useState('')
  const [jobError, setJobError] = useState('')
  const [jobStatus, setJobStatus] = useState<IdeaExtractionJobStatusResponse | null>(null)
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [lastRunSummary, setLastRunSummary] = useState<{ created: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const requestTokenRef = useRef(0)
  const activeJobRef = useRef<string | null>(null)
  const readingAbortRef = useRef<AbortController | null>(null)
  const cancelActiveJob = useCallback(() => {
    readingAbortRef.current?.abort()
    readingAbortRef.current = null
    const jobId = activeJobRef.current
    activeJobRef.current = null
    if (jobId) void cancelIdeaExtractionJob(jobId).catch(() => {
      setJobError('Could not confirm stopping the analysis. It may still be running.')
    })
  }, [])
  useEffect(() => {
    if (!isOpen) { requestTokenRef.current += 1; cancelActiveJob() }
  }, [isOpen, cancelActiveJob])
  useEffect(() => () => {
    readingAbortRef.current?.abort()
    requestTokenRef.current += 1
    const jobId = activeJobRef.current
    activeJobRef.current = null
    if (jobId) void cancelIdeaExtractionJob(jobId).catch(() => {})
  }, [])

  const reset = useCallback(() => {
    cancelActiveJob()
    requestTokenRef.current += 1
    setStage('idle')
    setFileName('')
    setIncludeImageOcr(false)
    setUploadedFile(null)
    setUploadedDocumentType('brd')
    setUploadedDocumentStatus('draft')
    setReadingMethod(null)
    setFileError('')
    setJobError('')
    setJobStatus(null)
    setCandidates([])
    setLastRunSummary(null)
  }, [cancelActiveJob])

  const analysisScopeRef = useRef({ workspaceId, currentUserId })
  useEffect(() => {
    const previous = analysisScopeRef.current
    if (previous.workspaceId !== workspaceId || previous.currentUserId !== currentUserId) {
      analysisScopeRef.current = { workspaceId, currentUserId }
      reset()
    }
  }, [workspaceId, currentUserId, reset])

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

      cancelActiveJob()
      const token = ++requestTokenRef.current
      setFileError('')
      setJobError('')
      setFileName(file.name)
      setUploadedFile(file)
      setReadingMethod(method)
      setStage('reading')

      let documentText = ''
      let coverageComplete: boolean | undefined
      let extractionWarnings: string[] = []
      const readingController = new AbortController()
      readingAbortRef.current = readingController
      try {
        const evidence = await extractIdeaUploadText(file, method, includeImageOcr, readingController.signal)
        documentText = evidence.text
        coverageComplete = evidence.complete
        extractionWarnings = evidence.warnings ?? []
        if (readingAbortRef.current === readingController) readingAbortRef.current = null
      } catch (err) {
        if (requestTokenRef.current !== token) return
        setStage('idle')
        setFileError(friendlyExtractionError(err instanceof Error ? err.message : String(err)))
        return
      }
      if (documentText.length > MAX_DOCUMENT_TEXT_CHARS) {
        if (requestTokenRef.current !== token) return
        setStage('idle')
        setFileError('This document exceeds the 60,000-character analysis limit. Split it into smaller documents before analysis.')
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
            extraction_coverage_complete: coverageComplete,
            extraction_warnings: extractionWarnings,
          },
          context: {
            workspace_id: workspaceId || null,
            user_id: currentUserId || null,
            session_id: null,
          },
        })

        if (requestTokenRef.current !== token) {
          await cancelIdeaExtractionJob(started.job_id).catch(() => {
            setJobError('Could not confirm stopping the analysis. It may still be running.')
          })
          return
        }
        activeJobRef.current = started.job_id
        let candidatesResult: IdeaExtractionCandidate[] = []
        let completed = false
        for (let attempt = 0; attempt < 720; attempt += 1) {
          if (requestTokenRef.current !== token) return
          const status = await getIdeaExtractionJob(started.job_id)
          if (requestTokenRef.current !== token) return
          setJobStatus(status)
          if (status.status === 'completed') {
            activeJobRef.current = null
            completed = true
            candidatesResult = status.result?.candidates ?? []
            break
          }
          if (status.status === 'failed') {
            activeJobRef.current = null
            throw new Error(status.error_message || 'Idea extraction failed.')
          }
          if (status.status === 'cancelled') {
            activeJobRef.current = null
            throw new Error('Idea extraction was cancelled.')
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 1250))
        }
        if (requestTokenRef.current !== token) return
        if (!completed) throw new Error('Idea analysis timed out. No ideas were created. Please retry.')
        setCandidates(candidatesResult.map(toCandidateRow))
        setStage('review')
      } catch (err) {
        if (requestTokenRef.current !== token) return
        setStage('idle')
        cancelActiveJob()
        setJobError(friendlyExtractionError(err instanceof Error ? err.message : 'Idea extraction failed.'))
      }
    },
    [currentUserId, workspaceId, cancelActiveJob, includeImageOcr],
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
        documentType: uploadedDocumentType,
        documentStatus: uploadedDocumentStatus,
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
            'Jelaskan masalah bisnis, nilai yang diharapkan, dan hasil yang dituju untuk peninjauan tata kelola.',
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
          'Jelaskan masalah bisnis, nilai yang diharapkan, dan hasil yang dituju untuk peninjauan tata kelola.',
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
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={includeImageOcr} onChange={(event) => setIncludeImageOcr(event.target.checked)} />
              <span>Read text inside PDF images with AI OCR.<span className="block text-xs text-muted-foreground">If selected, PDF pages containing images are sent to the configured AI service. Otherwise only local native text is extracted and image coverage is marked incomplete.</span></span>
            </label>
          )}
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
              {uploadedFile && !lastRunSummary && (
                <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Dokumen yang diupload</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={uploadedFile.name}>{uploadedFile.name}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor="uploaded-document-type">Jenis dokumen</Label>
                      <select
                        id="uploaded-document-type"
                        value={uploadedDocumentType}
                        disabled={stage === 'creating'}
                        onChange={(event) => setUploadedDocumentType(event.target.value as UploadedDocumentType)}
                        className="h-9 w-full rounded-lg border border-input/80 bg-background px-2.5 text-sm shadow-sm transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {UPLOADED_DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground" htmlFor="uploaded-document-status">Status dokumen</Label>
                      <select
                        id="uploaded-document-status"
                        value={uploadedDocumentStatus}
                        disabled={stage === 'creating'}
                        onChange={(event) => setUploadedDocumentStatus(event.target.value as UploadedDocumentStatus)}
                        className="h-9 w-full rounded-lg border border-input/80 bg-background px-2.5 text-sm shadow-sm transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {UPLOADED_DOCUMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                    </div>
                  </div>
                </section>
              )}
              {jobStatus?.result?.warnings && jobStatus.result.warnings.length > 0 && (
                <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Analysis has limitations. Review source coverage before creating ideas.
                  <ul>{jobStatus.result.warnings.map((warning) => <li key={warning}>{uploadAnalysisWarning(warning)}</li>)}</ul>
                </div>
              )}
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

                      <section className="space-y-2 rounded-lg border border-border p-3 text-sm" aria-label="Idea and capability comparison">
                        <p className="font-semibold">
                          {candidate.overlap_analysis?.status === 'possible_duplicate' ? 'Possible existing idea: review before creating' :
                            candidate.overlap_analysis?.status === 'partial_overlap' ? 'Feature or capability overlap found' :
                            candidate.overlap_analysis?.status === 'no_match_in_checked_sources' ? 'No overlap found in the checked sources' :
                            'Existing-idea comparison is incomplete'}
                        </p>
                        <p className="text-xs text-muted-foreground">Based on the uploaded source, not subsequent edits. No match does not prove this idea is globally new.</p>
                        {candidate.source_kind === 'existing_system' && <p>This document describes an existing system or capability.</p>}
                        <p className="text-xs">{candidate.overlap_analysis?.checked_sources ?? 0} sources checked in the selected workspace.</p>
                        {candidate.overlap_analysis?.coverage_complete === false && <p className="text-amber-700">Some sources or comparisons could not be checked.</p>}
                        {(candidate.capabilities ?? []).length > 0 && <ul className="list-disc pl-4">
                          {candidate.capabilities!.map((capability) => <li key={capability.name}><strong>{capability.name}</strong><p className="text-xs text-muted-foreground">{capability.source_pages?.length ? `Page ${capability.source_pages.join(", ")}: ` : ""}{capability.source_excerpt}</p></li>)}
                        </ul>}
                        {(candidate.overlap_analysis?.matches ?? []).map((match, matchIndex) => {
                          const ideaId = match.source_kind === 'idea' ? match.source_id.slice(5) : ''
                          const canLink = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ideaId)
                          return <div key={`${match.source_id}-${matchIndex}`} className="rounded border border-amber-200 p-2">
                            <p>{canLink ? <a className="underline" href={workspaceScopedPath(routeSlug, `/idea-backlog/${ideaId}`, workspaceId)}>{match.source_title}</a> : match.source_title}: {match.capability} ({match.relation})</p>
                            <p className="text-xs">Uploaded: {match.uploaded_excerpt}</p>
                            <p className="text-xs">Existing: {match.existing_excerpt}</p>
                          </div>
                        })}
                      </section>

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
