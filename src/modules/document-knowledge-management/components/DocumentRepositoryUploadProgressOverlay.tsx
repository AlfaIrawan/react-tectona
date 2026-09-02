import { Loader2, Upload } from 'lucide-react'

export type RepositoryUploadProgress = {
  total: number
  index: number
  fileName: string
  succeeded: number
  failed: number
}

export function DocumentRepositoryUploadProgressOverlay({
  progress,
}: {
  progress: RepositoryUploadProgress
}) {
  const percent = Math.min(100, Math.round(((progress.index - 1) / Math.max(progress.total, 1)) * 100))
  const label = progress.total > 1
    ? `Uploading file ${progress.index} of ${progress.total}`
    : 'Uploading document'

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-slate-950/35 p-4 backdrop-blur-[1px]">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-md rounded-2xl border border-border bg-card px-5 py-4 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/25">
            <Upload className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={progress.fileName}>
              {progress.fileName}
            </p>
          </div>
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" aria-hidden />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
            style={{ width: `${Math.max(percent, 8)}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {progress.succeeded} uploaded
          {progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
          {progress.total > 1 ? ` · ${progress.total} files` : ''}
        </p>
      </div>
    </div>
  )
}
