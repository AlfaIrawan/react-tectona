import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SCHEMA_SYNC_UNAVAILABLE, type SchemaConnection, type SchemaInspection, type SchemaPlan, type SchemaSnapshot, type SchemaSyncAdapter } from '@/lib/api/schemaSyncApi'
import { canApplyPlan, canAutoApplyPlan, mergeReviewedSchema, previewSchemaMerge, type SchemaMergeChoice } from '../lib/schemaSync'

const emptySchema: SchemaSnapshot = { tables: [] }
const emptyConnection: SchemaConnection = { target: { host: '', port: 5432, database: '', schema: 'public' }, credentials: { username: '', password: '' } }
/** Production deliberately has no adapter. Injection supports isolated mock tests only.
 * Closing aborts reads and clears in-memory credentials; an issued write may still finish. */
export function SchemaSyncDialog({ onClose, adapter, localSchema = emptySchema, onImport }: {
  onClose: () => void; adapter?: SchemaSyncAdapter; localSchema?: SchemaSnapshot
  onImport?: (schema: SchemaSnapshot, source: SchemaInspection) => void
}) {
  const [connection, setConnection] = useState<SchemaConnection>(emptyConnection)
  const [inspection, setInspection] = useState<SchemaInspection | null>(null)
  const [baseline, setBaseline] = useState<SchemaInspection | null>(null)
  const [plan, setPlan] = useState<SchemaPlan | null>(null)
  const [choices, setChoices] = useState<Record<string, SchemaMergeChoice>>({})
  const [autoSafe, setAutoSafe] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const request = useRef(0), locked = useRef(false), abort = useRef<AbortController | null>(null)
  const session = useRef(crypto.randomUUID())
  const consumed = useRef(new Set<string>())
  const plannedSchema = useRef('')
  const currentSchema = useRef(localSchema)
  currentSchema.current = localSchema
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort() } }, [])
  function invalidate() { request.current++; abort.current?.abort(); locked.current = false; setBusy(false); setPlan(null); setConfirmed(false); setInspection(null); setChoices({}) }
  function close() { invalidate(); setConnection(emptyConnection); setAutoSafe(false); onClose() }
  function update(section: 'target' | 'credentials', key: string, value: string | number) {
    invalidate(); setBaseline(null); setAutoSafe(false); setConnection(current => ({ ...current, [section]: { ...current[section], [key]: value } }))
  }
  async function run(action: (signal: AbortSignal, valid: () => boolean) => Promise<void>) {
    if (!adapter || locked.current) return
    locked.current = true; setBusy(true); setMessage(''); const version = ++request.current
    const controller = new AbortController(); abort.current = controller
    const valid = () => mounted.current && request.current === version && !controller.signal.aborted
    try { await action(controller.signal, valid) }
    catch { if (valid()) setMessage('Request failed or was blocked. Connection details are not displayed. Refresh the schema before retrying; a submitted write may have completed.') }
    finally { if (valid()) { locked.current = false; setBusy(false) } }
  }
  async function apply(value: SchemaPlan, explicit: boolean, signal: AbortSignal, valid: () => boolean) {
    if (!adapter || !inspection || !canApplyPlan(value, inspection.fingerprint) || consumed.current.has(value.id)) return
    if (plannedSchema.current !== JSON.stringify(currentSchema.current)) { setPlan(null); setConfirmed(false); setMessage('Diagram changed. Review a new plan.'); return }
    consumed.current.add(value.id); setPlan(null); setConfirmed(false)
    const result = await adapter.apply({ ...connection, session_id: session.current, plan_id: value.id, confirmed: explicit }, signal)
    if (valid()) { setInspection(result); setBaseline(result); setMessage('Database operation completed. Review the latest schema before updating the diagram.') }
  }
  const changes = inspection ? previewSchemaMerge(baseline?.schema ?? null, localSchema, inspection.schema) : []
  const ready = !!adapter && !!connection.target.host.trim() && !!connection.target.database.trim() && !!connection.credentials.username.trim() && !!connection.credentials.password
  return <Dialog open onOpenChange={open => { if (!open) close() }}><DialogContent className="max-h-[85vh] w-[min(860px,94vw)] overflow-y-auto p-5" aria-describedby="schema-sync-help">
    <DialogTitle>Database schema sync</DialogTitle>
    <p id="schema-sync-help" className="my-2 text-sm">PostgreSQL only in the initial connector. The 16 SQL DDL export profiles are not live database connectors. Manual review is the default.</p>
    {!adapter && <p role="status" className="my-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{SCHEMA_SYNC_UNAVAILABLE} Use Import SQL DDL for a local, review-only schema import.</p>}
    <p className="my-2 text-xs">Initial scope: simple columns and isolated new tables. Keys, foreign keys, defaults, destructive changes and uncertain operations are blocked. Existing structures and dependencies require review. Closing ends this session; credentials are never saved in diagrams or browser storage.</p>
    <fieldset disabled={!adapter || busy} className="grid gap-2 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">Temporary connection</legend>
      {(['host', 'database', 'schema'] as const).map(key => <label key={key} className="text-sm">{key}<input aria-label={key} autoComplete="off" value={connection.target[key]} onChange={event => update('target', key, event.target.value)} className="block w-full rounded border p-2" /></label>)}
      <label className="text-sm">Port<input aria-label="Port" type="number" min="1" max="65535" value={connection.target.port} onChange={event => update('target', 'port', Number(event.target.value))} className="block w-full rounded border p-2" /></label>
      <label className="text-sm">Username<input aria-label="Username" autoComplete="off" value={connection.credentials.username} onChange={event => update('credentials', 'username', event.target.value)} className="block w-full rounded border p-2" /></label>
      <label className="text-sm">Password<input aria-label="Password" type="password" autoComplete="new-password" value={connection.credentials.password} onChange={event => update('credentials', 'password', event.target.value)} className="block w-full rounded border p-2" /></label>
    </fieldset>
    <label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={autoSafe} disabled={!adapter || busy} onChange={event => setAutoSafe(event.target.checked)} />Auto-apply only isolated new tables when I request a plan in this session. No scheduled or background sync.</label>
    <div className="my-3 flex gap-2"><Button disabled={!ready || busy} onClick={() => void run(async (signal, valid) => { setPlan(null); setConfirmed(false); const result = await adapter!.introspect(connection, signal); if (valid()) { setInspection(result); setChoices({}) } })}>Read database schema</Button>
    <Button variant="outline" disabled={!ready || !inspection || busy} onClick={() => void run(async (signal, valid) => {
      setPlan(null); setConfirmed(false); const captured = JSON.stringify(localSchema)
      const result = await adapter!.plan({ ...connection, session_id: session.current, baseline_fingerprint: inspection!.fingerprint, desired_schema: localSchema }, signal)
      if (!valid()) return
      if (captured !== JSON.stringify(currentSchema.current)) { setMessage('Diagram changed during planning. Review a new plan.'); return }
      plannedSchema.current = captured
      setPlan(result)
      if (canAutoApplyPlan(result, autoSafe)) await apply(result, false, signal, valid)
    })}>Review diagram to database plan</Button></div>
    {busy && <p role="status">Request in progress. Closing cancels local waiting, but cannot undo a submitted database write.</p>}
    {message && <p role="status" className="my-2 text-sm">{message}</p>}
    {inspection && <section aria-label="Database to diagram preview" className="my-3 rounded border p-3"><h3 className="font-medium">Database to diagram preview</h3><p className="text-xs">Local edits stay unchanged until explicitly selected. Deletions are blocked. Layout and visual labels must be preserved by the diagram merge.</p>
      {!changes.length && <p>No incoming schema changes.</p>}
      {changes.map(change => <label key={change.name} className="my-2 flex items-center gap-3 text-sm"><span>{change.name}: {change.kind}{change.safeAddition ? ' (isolated addition)' : ''}</span><select aria-label={`Resolve ${change.name}`} value={choices[change.name] ?? 'keep'} disabled={busy || !change.incoming || change.kind === 'remove'} onChange={event => setChoices(current => ({ ...current, [change.name]: event.target.value as SchemaMergeChoice }))}><option value="keep">Keep local</option><option value="database">Use database schema</option></select></label>)}
      <Button disabled={busy || !onImport || !changes.some(change => choices[change.name] === 'database' && change.kind !== 'remove')} onClick={() => { if (!inspection || !onImport) return; onImport(mergeReviewedSchema(localSchema, changes, choices), inspection); setBaseline(inspection); setChoices({}); setPlan(null); setConfirmed(false) }}>Apply reviewed diagram changes</Button>
    </section>}
    {plan && <section aria-label="Database change plan" className="rounded border p-3"><h3 className="font-medium">Database change plan</h3><p className="text-xs">Expires: {new Date(plan.expires_at * 1000).toLocaleString()}. Changes existing structures only after explicit confirmation. Repeated application is blocked.</p><pre className="my-2 overflow-x-auto whitespace-pre-wrap text-xs">{plan.operations.map(op => op.sql).join('\n')}</pre>{plan.blockers.map((blocker, index) => <p key={index} role="alert">{blocker}</p>)}<label className="my-2 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I reviewed these exact database changes and approve applying them.</label><Button disabled={busy || !confirmed || !inspection || !canApplyPlan(plan, inspection.fingerprint)} onClick={() => void run((signal, valid) => apply(plan, true, signal, valid))}>Apply confirmed database plan</Button></section>}
    <div className="mt-4 flex justify-end"><Button variant="outline" onClick={close}>Close</Button></div>
  </DialogContent></Dialog>
}




