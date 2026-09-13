import { useEffect, useRef, useState } from 'react'
import { fetchMicrosoftDriveChildren, mutateMicrosoftDriveItem, type MicrosoftDriveItem, type MicrosoftDriveListing } from '@/lib/api/microsoftGraphApi'
import { Folder, Home, X } from 'lucide-react'

export function OneDriveMutationDialog({ items, operation, onClose, onComplete }: { items: MicrosoftDriveItem[]; operation: 'delete' | 'move'; onClose: () => void; onComplete: () => void }) {
  const [listing, setListing] = useState<MicrosoftDriveListing | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Set<string>>(() => new Set())
  const cancelled = useRef(false)
  const [stopped, setStopped] = useState(false)
  useEffect(() => {
    if (operation !== 'move') return
    let active = true
    void fetchMicrosoftDriveChildren(folderId).then((value) => { if (active) setListing(value) }).catch((reason) => { if (active) setError(String(reason)) })
    return () => { active = false }
  }, [folderId, operation])
  const submit = async () => {
    cancelled.current = false
    setStopped(false)
    setBusy(true)
    setError('')
    const failures: string[] = []
    const completed = new Set(done)
    for (const item of items) {
      if (cancelled.current) break
      if (done.has(item.id)) continue
      try {
        await mutateMicrosoftDriveItem(item, operation, operation === 'move' ? listing?.folder.id : undefined)
        completed.add(item.id)
        setDone((previous) => new Set([...previous, item.id]))
      } catch (reason) { failures.push(`${item.name}: ${reason instanceof Error ? reason.message : 'Failed'}`) }
    }
    setError(failures.join('\n'))
    setStopped(cancelled.current)
    setBusy(false)
    onComplete()
    if (failures.length === 0 && completed.size === items.length) onClose()
  }
  return <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/30 p-4">
    <section role="dialog" aria-modal="true" aria-label={`${operation} OneDrive items`} className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border bg-background p-4 shadow-xl">
      <div className="flex justify-between"><h2 className="font-semibold">{operation === 'delete' ? 'Delete from OneDrive' : 'Move within OneDrive'}</h2><button disabled={busy} onClick={onClose} aria-label="Close" title="Close"><X className="h-4 w-4" /></button></div>
      <p className="my-3 text-sm">{done.size} of {items.length} completed{stopped ? ' · Cancelled' : ''}</p>
      {operation === 'delete' ? <p className="text-sm">Selected files and folders, including their contents, will be removed from OneDrive.</p> : <div className="min-h-0 overflow-auto">
        <button className="flex gap-2 py-2" onClick={() => setFolderId(null)} disabled={busy}><Home className="h-4 w-4" />Home</button>
        <p className="text-sm">Destination: {listing?.folder.name ?? 'Loading...'}</p>
        {listing?.items.filter((item) => item.kind === 'folder' && !items.some((selected) => selected.id === item.id)).map((item) => <button className="flex w-full gap-2 py-2 text-left text-sm" disabled={busy} key={item.id} onClick={() => setFolderId(item.id)}><Folder className="h-4 w-4" /><span className="truncate">{item.name}</span></button>)}
      </div>}
      {error ? <p role="alert" className="my-2 whitespace-pre-wrap text-xs text-destructive">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-3">
        {busy ? <button className="rounded-md border px-3 py-2 text-sm" onClick={() => { cancelled.current = true }}>Cancel after current item</button> : null}
        <button className="rounded-md border px-3 py-2 text-sm" disabled={busy || done.size === items.length || (operation === 'move' && !listing)} onClick={() => void submit()}>{busy ? 'Processing...' : done.size > 0 ? 'Retry remaining' : operation === 'delete' ? 'Confirm delete' : 'Move here'}</button>
      </div>
    </section>
  </div>
}
