import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ERD_SQL_DIALECTS } from '../lib/erdDdlDialects'
import { parseErdDdl, type ErdDdlImportResult } from '../lib/erdDdlImport'

const MAX_SQL_BYTES = 1024 * 1024

/** Local review only: file contents never leave this component for a database. */
export function ErdDdlImportDialog({ onClose, onApply }: { onClose: () => void; onApply: (result: ErdDdlImportResult) => void }) {
  const [source, setSource] = useState('')
  const [dialect, setDialect] = useState('postgresql')
  const [preview, setPreview] = useState<ErdDdlImportResult | null>(null)
  const [fileError, setFileError] = useState('')
  const [reading, setReading] = useState(false)
  const readVersion = useRef(0)
  const applied = useRef(false)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    return () => { readVersion.current += 1; previous?.focus() }
  }, [])
  function changeSource(value: string) {
    readVersion.current += 1
    setReading(false); setSource(value); setPreview(null); setFileError('')
  }
  async function readFile(file?: File) {
    const version = ++readVersion.current
    setPreview(null); setFileError(''); setReading(false)
    if (!file) return
    if (!/\.sql$/i.test(file.name)) { setFileError('Choose a .sql text file.'); return }
    if (file.size > MAX_SQL_BYTES) { setFileError('Choose a SQL file no larger than 1 MB.'); return }
    setReading(true)
    try {
      const value = await file.text()
      if (readVersion.current === version) { setSource(value); setReading(false) }
    } catch {
      if (readVersion.current === version) { setFileError('Could not read this file. Try again or paste the SQL.'); setReading(false) }
    }
  }
  function parse() {
    setFileError('')
    if (new TextEncoder().encode(source).length > MAX_SQL_BYTES) { setPreview(null); setFileError('Paste no more than 1 MB of SQL.'); return }
    setPreview(parseErdDdl(source, dialect))
  }
  const canApply = !!preview?.diagram.boxes.length && !preview.errors.length && !reading
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent ref={dialog} role="dialog" aria-modal="true" aria-labelledby="erd-ddl-import-title" aria-describedby="erd-ddl-import-help" className="w-[min(900px,92vw)] max-h-[85vh] overflow-y-auto p-5" onKeyDown={event => {
      if (event.key !== 'Tab') return
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, select, input, summary') ?? [])]
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <DialogTitle id="erd-ddl-import-title">Import SQL DDL</DialogTitle>
      <p id="erd-ddl-import-help" className="my-2 text-sm">Paste schema SQL or open a local .sql file to review an ER diagram. Nothing is executed and no database connection is made.</p>
      <label className="my-3 block text-sm">Source SQL dialect <select aria-label="Source SQL dialect" className="ml-2 rounded border p-1" value={dialect} onChange={event => { setDialect(event.target.value); setPreview(null) }}>{Object.entries(ERD_SQL_DIALECTS).map(([id, profile]) => <option key={id} value={id}>{profile.label}</option>)}</select></label>
      <p className="my-2 text-xs text-muted-foreground">Limited structural import: CREATE TABLE columns, primary and unique keys, and foreign keys, including supported ALTER TABLE constraints. Dialect choices guide interpretation, not complete vendor syntax validation. Unsupported statements and lost semantics are reported for review.</p>
      <label className="my-3 block text-sm">Open .sql file (up to 1 MB)<input aria-label="Open SQL file" type="file" accept=".sql,text/plain,application/sql" className="mt-1 block w-full text-sm" onChange={event => { void readFile(event.target.files?.[0]); event.target.value = '' }} /></label>
      <label className="block text-sm" htmlFor="erd-ddl-import-source">SQL schema source</label>
      <textarea id="erd-ddl-import-source" autoFocus value={source} onChange={event => changeSource(event.target.value)} className="mt-1 h-48 w-full rounded border p-3 font-mono text-xs" spellCheck={false} placeholder="CREATE TABLE customer (id INTEGER PRIMARY KEY);" />
      {reading && <p role="status">Reading local file...</p>}
      {fileError && <p role="alert" className="my-2 text-sm text-red-700">{fileError}</p>}
      <Button type="button" variant="outline" className="my-2" disabled={reading} onClick={parse}>Preview import</Button>
      {preview && <section aria-label="Import preview" className="my-3 rounded border p-3">
        <p role="status" className="font-medium">{preview.diagram.boxes.length} entities and {preview.diagram.links.length} relationships found</p>
        {preview.errors.length > 0 && <ul aria-label="Import errors" className="my-2 list-disc pl-5 text-sm text-red-700">{preview.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
        {preview.warnings.length > 0 && <details open className="my-2 text-sm"><summary>Review warnings ({preview.warnings.length})</summary><ul className="list-disc pl-5">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{preview.diagram.boxes.map(box => <article key={box.id} className="min-w-0 rounded border bg-muted/30 p-2"><h3 className="break-words text-sm font-semibold">{box.title}</h3><ul className="mt-1 break-words font-mono text-xs">{box.members.map((member, index) => <li key={index}>{member}</li>)}</ul></article>)}</div>
        {preview.diagram.links.length > 0 && <ul aria-label="Imported relationships" className="mt-3 list-disc pl-5 text-xs">{preview.diagram.links.map((link, index) => <li key={index}>{preview.diagram.boxes.find(box => box.id === link.source)?.title} → {preview.diagram.boxes.find(box => box.id === link.target)?.title}{link.label ? `: ${link.label}` : ''}</li>)}</ul>}
      </section>}
      <p className="my-2 text-xs text-muted-foreground">Add appends new, selected entities and relationships below the existing diagram. Existing entities are kept; tables with the same name are not merged. Review warnings before adding and before generating DDL from the imported selection.</p>
      <div className="mt-3 flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" disabled={!canApply} onClick={() => { if (canApply && preview && !applied.current) { applied.current = true; onApply(preview) } }}>Add to diagram</Button></div>
    </DialogContent>
  </Dialog>
}
