import { useEffect, useRef, useState } from 'react'
import { Archive, CheckCircle2, Download, Info, Loader2, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { fetchMicrosoftDriveChildren, fetchMicrosoftDriveItemContent, type MicrosoftDriveItem } from '@/lib/api/microsoftGraphApi'

type Entry = { id: string; path: string; kind: 'file' | 'folder'; state: 'pending' | 'done' | 'failed'; error?: string; bytes?: Uint8Array }
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024

export function OneDriveZipDownload({ items, onClose }: { items: MicrosoftDriveItem[]; onClose: () => void }) {
  const entries = useRef<Entry[]>([])
  const cancelled = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const runRef = useRef<() => Promise<void>>(async () => undefined)
  const runSequence = useRef(0)
  const [rows, setRows] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stopped, setStopped] = useState(false)
  const [archiveState, setArchiveState] = useState<'idle' | 'creating' | 'downloaded'>('idle')
  const publish = () => setRows(entries.current.map((entry) => ({ ...entry, bytes: undefined })))
  const safeName = (name: string) => Array.from(name, (char) => char.charCodeAt(0) < 32 || char === '/' || char === '\\' ? '_' : char).join('').replace(/^\.+$/, '_') || 'unnamed'
  const uniquePath = (requested: string) => {
    if (!entries.current.some((entry) => entry.path.toLocaleLowerCase() === requested.toLocaleLowerCase())) return requested
    const slash = requested.lastIndexOf('/')
    const directory = slash >= 0 ? requested.slice(0, slash + 1) : ''
    const name = slash >= 0 ? requested.slice(slash + 1) : requested
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const extension = dot > 0 ? name.slice(dot) : ''
    let index = 2
    while (entries.current.some((entry) => entry.path.toLocaleLowerCase() === `${directory}${stem} (${index})${extension}`.toLocaleLowerCase())) index += 1
    return `${directory}${stem} (${index})${extension}`
  }

  const downloadArchive = async () => {
    setArchiveState('creating')
    setError('')
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (const entry of entries.current) {
        if (entry.kind === 'folder') zip.folder(entry.path)
        else if (entry.bytes) zip.file(entry.path, entry.bytes)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'OneDrive.zip'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      setArchiveState('downloaded')
    } catch (reason) {
      setArchiveState('idle')
      setError(reason instanceof Error ? reason.message : 'Could not create ZIP')
    }
  }

  const run = async () => {
    if (busy) return
    const runId = ++runSequence.current
    cancelled.current = false
    controller.current = new AbortController()
    setStopped(false)
    setBusy(true)
    setError('')
    setArchiveState('idle')
    try {
      for (let index = 0; index < entries.current.length; index += 1) {
        if (cancelled.current) break
        const entry = entries.current[index]
        if (entry.state === 'done') continue
        entry.state = 'pending'
        entry.error = undefined
        publish()
        try {
          if (entry.kind === 'folder') {
            if (entry.path.split('/').length > 12) throw new Error('Folder depth limit reached')
            const listing = await fetchMicrosoftDriveChildren(entry.id, controller.current.signal)
            if (entries.current.length + listing.items.length > 500) throw new Error('Selection exceeds 500 items; select a smaller folder')
            for (const child of listing.items) {
              if (entries.current.some((existing) => existing.id === child.id)) continue
              const path = uniquePath(`${entry.path}/${safeName(child.name)}`)
              entries.current.push({ id: child.id, path, kind: child.kind, state: 'pending' })
            }
          } else {
            const blob = await fetchMicrosoftDriveItemContent(entry.id, controller.current.signal)
            const downloadedBytes = entries.current.reduce((total, existing) => total + (existing.bytes?.byteLength ?? 0), 0)
            if (downloadedBytes + blob.size > MAX_ARCHIVE_BYTES) throw new Error('Archive exceeds the 256 MB download limit')
            entry.bytes = new Uint8Array(await blob.arrayBuffer())
          }
          entry.state = 'done'
        } catch (reason) {
          if (cancelled.current) break
          entry.state = 'failed'
          entry.error = reason instanceof Error ? reason.message : 'Download failed'
        }
        publish()
      }
    } finally {
      // An earlier invocation can finish after a newer one has already started
      // (notably during React Strict Mode effect replay). It must not reset the
      // active run's busy state or expose retry actions prematurely.
      if (runId === runSequence.current) {
        setStopped(cancelled.current)
        setBusy(false)
        const hasFinished = !cancelled.current && entries.current.length > 0 && entries.current.every((entry) => entry.state === 'done' || entry.state === 'failed')
        if (hasFinished) await downloadArchive()
      }
    }
  }

  runRef.current = run

  useEffect(() => {
    entries.current = []
    for (const item of items) {
      if (entries.current.some((entry) => entry.id === item.id)) continue
      entries.current.push({ id: item.id, path: uniquePath(safeName(item.name)), kind: item.kind, state: 'pending' })
    }
    publish()
    void runRef.current()
    return () => { cancelled.current = true; controller.current?.abort() }
  }, [items])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const done = rows.filter((entry) => entry.state === 'done').length
  const failed = rows.filter((entry) => entry.state === 'failed').length
  const pending = rows.length - done - failed
  const progressPercent = Math.round(((done + failed) / Math.max(rows.length, 1)) * 100)
  const hasFinalResult = !busy && (stopped || pending === 0) && archiveState !== 'creating'
  const canRetry = hasFinalResult && (pending > 0 || failed > 0)
  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
      <section role="dialog" aria-modal="true" aria-label="Download OneDrive ZIP" className="relative flex max-h-[min(680px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]">
        <header className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className={cn('mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', busy || archiveState === 'creating' ? 'bg-primary/10 text-primary ring-primary/20' : failed > 0 || error ? 'bg-amber-500/10 text-amber-700 ring-amber-500/25' : 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25')}>
              {busy || archiveState === 'creating' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : failed > 0 || error ? <Info className="h-5 w-5" aria-hidden /> : <Archive className="h-5 w-5" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Download OneDrive ZIP</h2>
              <p role="status" className="text-sm text-muted-foreground">
                {busy ? 'Collecting selected files and folders.' : archiveState === 'creating' ? 'Creating your ZIP download.' : archiveState === 'downloaded' ? 'ZIP download has started.' : stopped ? 'Transfer cancelled before completion.' : failed > 0 ? 'Some items could not be included.' : 'Preparing selected items.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="absolute right-5 top-5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 scrollbar-hide">
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/70 bg-muted/15">
            <div className="border-r border-border/70 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Completed</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{done}<span className="text-xs font-medium text-muted-foreground"> / {rows.length}</span></p></div>
            <div className="border-r border-border/70 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pending</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{pending}</p></div>
            <div className="px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Failed</p><p className={cn('mt-1 text-lg font-semibold tabular-nums', failed > 0 ? 'text-destructive' : 'text-foreground')}>{failed}</p></div>
          </div>
          <div><div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>Download progress</span><span className="font-medium tabular-nums text-foreground">{progressPercent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-[width] duration-300', failed > 0 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${progressPercent}%` }} /></div></div>
          <ul className="max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-background/60 scrollbar-hide">
            {rows.map((entry) => <li key={entry.path} className="flex items-start gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0"><span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', entry.state === 'done' ? 'bg-emerald-500' : entry.state === 'failed' ? 'bg-destructive' : 'bg-amber-400')} aria-hidden /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-foreground" title={entry.path}>{entry.path}</p>{entry.error ? <p className="mt-0.5 truncate text-[11px] text-destructive" title={entry.error}>{entry.error}</p> : null}</div><span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', entry.state === 'done' ? 'bg-emerald-500/10 text-emerald-700' : entry.state === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-800')}>{entry.state === 'done' ? 'Completed' : entry.state === 'failed' ? 'Failed' : 'Pending'}</span></li>)}
          </ul>
          {error ? <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          {busy ? <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), 'w-full justify-center gap-2')} onClick={() => { cancelled.current = true; controller.current?.abort() }}><X className="h-4 w-4" aria-hidden />Cancel after current item</Button> : archiveState === 'creating' ? <div className="flex w-full items-center justify-center gap-2 text-sm font-medium text-primary"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Creating ZIP download</div> : canRetry ? <Button type="button" className={cn(registerServicePrimaryButtonClass(), 'w-full justify-center gap-2')} onClick={() => void run()}><RotateCcw className="h-4 w-4" aria-hidden />Retry failed and pending items</Button> : error ? <Button type="button" className={cn(registerServicePrimaryButtonClass(), 'w-full justify-center gap-2')} onClick={() => void downloadArchive()}><Download className="h-4 w-4" aria-hidden />Retry ZIP download</Button> : <div className="flex w-full items-center justify-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden />{archiveState === 'downloaded' ? 'ZIP download started' : 'Download ready'}</div>}
        </footer>
      </section>
    </div>
  )
}
