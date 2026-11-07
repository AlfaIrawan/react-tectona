import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Code2, Copy, Database, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ERD_SQL_DIALECTS } from '../lib/erdDdlDialects'
import { generateErdDdl, type ErdDdlSelection, type ErdSqlDialect } from '../lib/erdDdl'

export function ErdDdlDialog({ selection, onClose }: { selection: ErdDdlSelection; onClose: () => void }) {
  const [dialect, setDialect] = useState<ErdSqlDialect>('postgresql')
  const [status, setStatus] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; return () => previous?.focus() }, [])
  const result = useMemo(() => generateErdDdl(selection, dialect), [selection, dialect])
  async function copy() {
    try { await navigator.clipboard.writeText(result.sql); setStatus('SQL copied.') }
    catch { setStatus('Copy unavailable. Select and copy the SQL preview manually.') }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([result.sql], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `erd-selection-${dialect}.sql`
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus('SQL download prepared.')
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent ref={dialog} surface="solid" role="dialog" aria-modal="true" aria-labelledby="erd-ddl-title" aria-describedby="erd-ddl-description" className="flex w-[min(52rem,calc(100vw-2rem))] max-h-[85vh] flex-col overflow-hidden p-0" onKeyDown={event => {
      if (event.key !== 'Tab') return
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, select, summary, [tabindex="0"]') ?? [])].filter(element => !element.closest('details:not([open])') || element.tagName === 'SUMMARY')
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <DialogHeader className="mb-0 shrink-0 border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><span className="rounded-lg bg-sky-50 p-2 text-sky-700"><Database className="h-5 w-5" /></span><div><DialogTitle id="erd-ddl-title" className="text-base">Generate DDL for selection</DialogTitle><DialogDescription id="erd-ddl-description" className="mt-1 text-xs">{selection.nodes.length} selected entities / {selection.edges.filter(e => e.selected).length} selected relationships</DialogDescription></div></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close DDL preview" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </DialogHeader>
      <div tabIndex={0} aria-label="DDL preview content" className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800"><CheckCircle2 className="h-4 w-4 shrink-0" /><span>Preview only. Nothing is executed against a database.</span></div>
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid items-center gap-3 sm:grid-cols-[13rem_1fr]">
            <label className="block space-y-1.5 text-xs font-medium text-slate-700">SQL dialect<select aria-label="SQL dialect" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={dialect} onChange={e => { setDialect(e.target.value as ErdSqlDialect); setStatus('') }}>{Object.entries(ERD_SQL_DIALECTS).map(([id, profile]) => <option key={id} value={id}>{profile.label}</option>)}</select></label>
            <div className="text-xs text-slate-600"><span className="block font-medium text-slate-800">Target: {result.target}</span><span className="mt-1 block">Review compatibility with your server configuration.</span></div>
          </div>
          <details className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-slate-700">Dialect details and column syntax</summary><ul className="mt-2 list-disc space-y-1 pl-4">{ERD_SQL_DIALECTS[dialect].notes.map(note => <li key={note}>{note}</li>)}</ul><p className="mt-2">Columns use name : TYPE with optional NULL or NOT NULL. Mark primary keys with * or {'<<PK>>'} and foreign-key columns with {'<<FK>>'}. Only selected relationships can produce foreign keys.</p></details>
        </section>
        {result.errors.length > 0 && <section className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Generation issues ({result.errors.length})</p><ul aria-label="Generation errors" tabIndex={0} className="max-h-32 list-disc space-y-1 overflow-y-auto pl-4">{result.errors.map(e => <li key={e}>{e}</li>)}</ul></section>}
        {result.warnings.length > 0 && <details open className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><summary className="cursor-pointer font-semibold">Review notes ({result.warnings.length})</summary><ul tabIndex={0} aria-label="DDL review notes" className="mt-2 max-h-32 list-disc space-y-1 overflow-y-auto pl-4">{result.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/70 px-3 py-2 text-xs"><label htmlFor="erd-ddl-sql" className="flex items-center gap-2 font-semibold text-slate-700"><Code2 className="h-4 w-4" />SQL preview</label><span className="text-slate-500">Read only</span></div>
          <textarea id="erd-ddl-sql" aria-label="Generated SQL" readOnly value={result.sql} className="block h-56 w-full resize-y border-0 bg-white p-3 font-mono text-xs leading-5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring sm:h-64" spellCheck={false} />
        </section>
        <p className="text-xs leading-5 text-slate-500">Limited structural validation: quoted identifiers, supported types and key mappings checked. Not parsed by a database or tested against your schema. Review before running elsewhere.</p>
      </div>
      <DialogFooter className="shrink-0 flex-wrap border-t border-slate-200 bg-white px-5 py-3">
        <p role="status" className="mr-auto text-xs text-slate-600">{status}</p>
        <Button type="button" variant="outline" autoFocus onClick={onClose}>Close</Button>
        <Button type="button" variant="outline" className="gap-1.5" disabled={!result.sql} onClick={() => void copy()}><Copy className="h-3.5 w-3.5" />Copy SQL</Button>
        <Button type="button" className="gap-1.5" disabled={!result.sql} onClick={download}><Download className="h-3.5 w-3.5" />Download .sql</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
