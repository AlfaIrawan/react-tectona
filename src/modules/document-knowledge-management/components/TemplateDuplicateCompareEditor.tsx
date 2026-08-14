import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRightLeft, Loader2, Minus, Plus, Server, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { downloadTemplateAttachmentBlob } from '@/lib/api/documentKnowledgeApi'
import { buildRevisionContentDiff, type RevisionDiffSegment } from '@/lib/documents/revisionContentHighlight'
import {
  extractCompareDocumentText,
  summarizeRevisionDiffSegments,
} from '@/modules/document-knowledge-management/lib/templateCompareText'
import { TemplateWordSideBySideCompareView } from '@/modules/document-knowledge-management/components/TemplateWordSideBySideCompareView'

export type TemplateDuplicateCompareSession = {
  templateId: string
  templateTitle: string
  pendingFile: File
  serverLabel: string
  uploadLabel: string
}

type TextDiffState = {
  status: 'loading' | 'ready' | 'identical' | 'error'
  message: string | null
  segments: RevisionDiffSegment[] | null
  serverBlob: Blob | null
  uploadBlob: Blob | null
}

type TemplateDuplicateCompareEditorProps = {
  open: boolean
  session: TemplateDuplicateCompareSession | null
  onClose: () => void
}

const compareTagBase =
  'inline-flex min-w-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm'

function compareStatTag(kind: 'removed' | 'added' | 'identical' | 'loading') {
  if (kind === 'removed') {
    return cn(
      compareTagBase,
      'border-rose-400/30 bg-gradient-to-r from-rose-500/15 to-red-500/15 text-rose-950 ring-1 ring-rose-500/20 dark:text-rose-100',
    )
  }
  if (kind === 'added') {
    return cn(
      compareTagBase,
      'border-sky-400/30 bg-gradient-to-r from-sky-500/15 to-cyan-500/15 text-sky-950 ring-1 ring-sky-500/20 dark:text-sky-100',
    )
  }
  if (kind === 'identical') {
    return cn(
      compareTagBase,
      'border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-950 ring-1 ring-emerald-500/20 dark:text-emerald-100',
    )
  }
  return cn(
    compareTagBase,
    'border-border/60 bg-background/80 text-muted-foreground',
  )
}

export function TemplateDuplicateCompareEditor({
  open,
  session,
  onClose,
}: TemplateDuplicateCompareEditorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [textDiff, setTextDiff] = useState<TextDiffState>({
    status: 'loading',
    message: null,
    segments: null,
    serverBlob: null,
    uploadBlob: null,
  })

  useEffect(() => {
    if (!open || !session) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setTextDiff({ status: 'loading', message: null, segments: null, serverBlob: null, uploadBlob: null })

    void (async () => {
      try {
        const serverFile = await downloadTemplateAttachmentBlob(session.templateId).catch(() => null)
        if (cancelled) return

        const uploadBlob = session.pendingFile
        const serverBlob = serverFile?.blob ?? null

        if (!serverBlob) {
          setError('Template di server tidak memiliki file lampiran untuk dibandingkan.')
          return
        }

        try {
          const [uploadText, serverText] = await Promise.all([
            extractCompareDocumentText(session.pendingFile),
            extractCompareDocumentText(
              new File([serverFile!.blob], serverFile!.fileName, { type: serverFile!.contentType }),
            ),
          ])

          if (cancelled) return
          const diff = buildRevisionContentDiff(serverText, uploadText)
          const summaryItems = summarizeRevisionDiffSegments(diff.segments)

          if (!diff.hasChanges) {
            setTextDiff({
              status: 'identical',
              message: 'Text content is identical — the warning was triggered by a matching file name or family, not different content.',
              segments: diff.segments,
              serverBlob,
              uploadBlob,
            })
            return
          }

          const removed = summaryItems.filter((item) => item.kind === 'removed').length
          const added = summaryItems.filter((item) => item.kind === 'added').length
          setTextDiff({
            status: 'ready',
            message: `${removed} section(s) removed (red), ${added} section(s) added (blue).`,
            segments: diff.segments,
            serverBlob,
            uploadBlob,
          })
        } catch (diffError) {
          if (cancelled) return
          setTextDiff({
            status: 'error',
            message: diffError instanceof Error ? diffError.message : 'Could not build comparison.',
            segments: null,
            serverBlob,
            uploadBlob,
          })
        }
      } catch (openError) {
        if (!cancelled) {
          setError(openError instanceof Error ? openError.message : 'Unable to open compare view.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, session])

  if (!open || !session || typeof document === 'undefined') return null

  const serverTitle = session.serverLabel
  const uploadTitle = session.uploadLabel

  const diffStats =
    textDiff.status === 'ready' && textDiff.segments
      ? (() => {
        const items = summarizeRevisionDiffSegments(textDiff.segments)
        return {
          removed: items.filter((item) => item.kind === 'removed').length,
          added: items.filter((item) => item.kind === 'added').length,
        }
      })()
      : null

  return createPortal(
    <div className="fixed inset-0 z-[1500] flex flex-col bg-background">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/25 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-4">
          <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-400">
            <ArrowRightLeft className="h-5 w-5" aria-hidden />
          </div>

          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Template validation
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Compare template before upload
            </h2>
            <p className="truncate text-sm text-muted-foreground">{session.templateTitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'gap-2')}
            onClick={onClose}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Close compare
          </Button>

          <div className="flex max-w-[calc(100vw-2.5rem)] flex-nowrap items-center justify-end gap-2 overflow-x-auto [scrollbar-width:thin]">
            <span
              className={cn(
                compareTagBase,
                'max-w-[14rem] shrink sm:max-w-[18rem]',
                'border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-950 ring-1 ring-emerald-500/20 dark:text-emerald-100',
              )}
              title={`Server · ${serverTitle}`}
            >
              <Server className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Server · {serverTitle}</span>
            </span>
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground" aria-hidden>vs</span>
            <span
              className={cn(
                compareTagBase,
                'max-w-[14rem] shrink sm:max-w-[18rem]',
                'border-indigo-400/30 bg-gradient-to-r from-indigo-500/15 to-blue-500/15 text-indigo-950 ring-1 ring-indigo-500/20 dark:text-indigo-100',
              )}
              title={`Upload · ${uploadTitle}`}
            >
              <Upload className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Upload · {uploadTitle}</span>
            </span>

            {diffStats ? (
              <>
                <span className="hidden h-4 w-px shrink-0 bg-border sm:inline" aria-hidden />
                <span className={cn(compareStatTag('removed'), 'shrink-0')}>
                  <Minus className="h-3 w-3 shrink-0" aria-hidden />
                  {diffStats.removed} removed
                </span>
                <span className={cn(compareStatTag('added'), 'shrink-0')}>
                  <Plus className="h-3 w-3 shrink-0" aria-hidden />
                  {diffStats.added} added
                </span>
              </>
            ) : null}

            {textDiff.status === 'identical' ? (
              <span className={cn(compareStatTag('identical'), 'shrink-0')}>Identical content</span>
            ) : null}

            {loading ? (
              <span className={cn(compareStatTag('loading'), 'shrink-0')}>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Loading…
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#F3F2F1]">
        {loading ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading comparison…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-x-0 top-0 z-[2] p-4">
            <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          </div>
        ) : null}

        {!loading ? (
          <TemplateWordSideBySideCompareView
            status={textDiff.status}
            message={textDiff.message}
            segments={textDiff.segments}
            serverBlob={textDiff.serverBlob}
            uploadBlob={textDiff.uploadBlob}
            serverTitle={serverTitle}
            uploadTitle={uploadTitle}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
