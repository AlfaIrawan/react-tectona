import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SchemaSyncDialog } from './SchemaSyncDialog'
import type { SchemaInspection, SchemaSyncAdapter } from '@/lib/api/schemaSyncApi'
let host: HTMLDivElement, root: Root
const close = vi.fn(), imported = vi.fn()
const inspected: SchemaInspection = { fingerprint: 'f', schema: { tables: [{ name: 'new_table', columns: [{ name: 'label', data_type: 'text', nullable: true }], dependencies: [] }] } }
const adapter: SchemaSyncAdapter = { introspect: vi.fn(async () => inspected), plan: vi.fn(async () => ({ id: 'p', expires_at: 4070908800, baseline_fingerprint: 'f', operations: [{ kind: 'create_table' as const, table: 'new_table', sql: 'CREATE TABLE new_table (label text)' }], requires_confirmation: false, blockers: [] })), apply: vi.fn(async () => inspected) }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); vi.clearAllMocks() })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
async function mount(enabled = true) { await act(async () => root.render(createElement(SchemaSyncDialog, { onClose: close, onImport: imported, adapter: enabled ? adapter : undefined }))) }
async function click(text: string) { await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text)!.click()) }
async function fill(label: string, value: string) { const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) }) }
async function connect() { await fill('host', 'approved.example'); await fill('database', 'test'); await fill('Username', 'test'); await fill('Password', 'do-not-store'); await click('Read database schema') }
it('fails closed in production with no requests and a masked disabled password', async () => {
 const fetchSpy = vi.spyOn(globalThis, 'fetch'); await mount(false)
 expect(document.body.textContent).toContain('Live database sync is unavailable'); expect(document.body.textContent).toContain('16 SQL DDL export profiles are not live database connectors')
 expect(document.querySelector<HTMLInputElement>('input[aria-label="Password"]')!.type).toBe('password')
 expect(document.querySelector('fieldset')!.disabled).toBe(true)
 await click('Read database schema'); expect(adapter.introspect).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled()
})
it('does not apply plans or diagram changes without review and never persists credentials', async () => {
 const storage = vi.spyOn(Storage.prototype, 'setItem'); await mount(); await connect()
 expect(adapter.introspect).toHaveBeenCalledOnce(); expect(imported).not.toHaveBeenCalled()
 await click('Review diagram to database plan'); expect(adapter.plan).toHaveBeenCalledOnce(); expect(adapter.apply).not.toHaveBeenCalled()
 await click('Apply confirmed database plan'); expect(adapter.apply).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled()
 const confirmation = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][1]; await act(async () => confirmation.click()); await click('Apply confirmed database plan')
 expect(adapter.apply).toHaveBeenCalledOnce(); expect(document.body.textContent).not.toContain('do-not-store')
})
it('ignores a late read after close and aborts its signal', async () => {
 let resolve!: (value: SchemaInspection) => void
 vi.mocked(adapter.introspect).mockImplementationOnce(() => new Promise(done => { resolve = done }))
 await mount(); await connect(); const signal = vi.mocked(adapter.introspect).mock.calls[0][1]
 await click('Close'); expect(signal.aborted).toBe(true); expect(close).toHaveBeenCalledOnce()
 await act(async () => resolve(inspected)); expect(document.body.textContent).not.toContain('new_table: add'); expect(imported).not.toHaveBeenCalled()
})
it('explicitly opted-in safe plans apply once in the foreground', async () => {
 await mount(); await connect(); await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
 await click('Review diagram to database plan'); expect(adapter.apply).toHaveBeenCalledOnce()
 await click('Review diagram to database plan'); expect(adapter.apply).toHaveBeenCalledOnce()
})
it('rejects a reviewed plan when the diagram changes before confirmation', async () => {
 await mount(); await connect(); await click('Review diagram to database plan')
 await act(async () => root.render(createElement(SchemaSyncDialog, { onClose: close, adapter, localSchema: inspected.schema })))
 const confirmation = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][1]; await act(async () => confirmation.click()); await click('Apply confirmed database plan')
 expect(adapter.apply).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Diagram changed. Review a new plan.')
})
it('redacts server errors rather than reflecting connection strings', async () => {
 vi.mocked(adapter.introspect).mockRejectedValueOnce(new Error('postgres://test:do-not-store@approved.example/test'))
 await mount(); await connect(); expect(document.body.textContent).toContain('Request failed or was blocked'); expect(document.body.textContent).not.toContain('postgres://'); expect(document.body.textContent).not.toContain('do-not-store')
})

