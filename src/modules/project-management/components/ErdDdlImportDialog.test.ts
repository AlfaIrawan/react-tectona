import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ErdDdlImportDialog } from './ErdDdlImportDialog'
let host: HTMLDivElement, root: Root
const close = vi.fn(), apply = vi.fn()
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); vi.clearAllMocks() })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
async function mount() { await act(async () => root.render(createElement(ErdDdlImportDialog, { onClose: close, onApply: apply }))) }
function button(text: string) { return [...document.querySelectorAll('button')].find(b => b.textContent === text)! }
async function click(text: string) { await act(async () => button(text).click()) }
async function source(sql: string) { const input = document.querySelector('textarea')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, sql); input.dispatchEvent(new Event('input', { bubbles: true })) }) }
it('requires explicit preview and add, invalidates preview on edits, and applies only once', async () => {
 await mount(); expect(button('Add to diagram').disabled).toBe(true)
 await source('CREATE TABLE customer (id INTEGER PRIMARY KEY);'); expect(apply).not.toHaveBeenCalled(); await click('Preview import'); expect(document.body.textContent).toContain('1 entities and 0 relationships'); await click('Preview import'); expect(button('Add to diagram').disabled).toBe(false)
 await source('CREATE TABLE account (id INTEGER PRIMARY KEY);'); expect(button('Add to diagram').disabled).toBe(true); expect(document.querySelector('[aria-label="Import preview"]')).toBeNull()
 await click('Preview import'); await click('Add to diagram'); await click('Add to diagram'); expect(apply).toHaveBeenCalledOnce(); expect(apply.mock.calls[0][0].diagram.boxes[0].title).toBe('account')
})
it('blocks empty and malformed SQL and reports unsupported statements without executing SQL', async () => {
 const fetch = vi.spyOn(globalThis, 'fetch'); await mount(); await click('Preview import'); expect(button('Add to diagram').disabled).toBe(true)
 await source('CREATE TABLE broken ('); await click('Preview import'); expect(button('Add to diagram').disabled).toBe(true); expect(document.querySelector('[aria-label="Import errors"]')).toBeTruthy()
 await source('DROP TABLE customer;'); await click('Preview import'); expect(button('Add to diagram').disabled).toBe(true); expect(document.body.textContent).toMatch(/unsupported|ignored|not import/i); expect(fetch).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled()
})
it('clears preview on dialect changes and cancels with Escape without applying', async () => {
 await mount(); await source('CREATE TABLE customer (id INTEGER PRIMARY KEY);'); await click('Preview import')
 await act(async () => { const select = document.querySelector('select')!; select.value = 'mysql'; select.dispatchEvent(new Event('change', { bubbles: true })) }); expect(button('Add to diagram').disabled).toBe(true)
 await click('Cancel'); await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); expect(close).toHaveBeenCalledTimes(2); expect(apply).not.toHaveBeenCalled()
})
it('reads only local SQL files and rejects stale asynchronous file reads after typing', async () => {
 await mount(); let resolve!: (sql: string) => void
 const file = new File([''], 'schema.sql'); Object.defineProperty(file, 'text', { value: () => new Promise<string>(r => { resolve = r }) })
 const input = document.querySelector<HTMLInputElement>('input[type=file]')!
 await act(async () => { Object.defineProperty(input, 'files', { configurable: true, value: [file] }); input.dispatchEvent(new Event('change', { bubbles: true })) }); expect(button('Preview import').disabled).toBe(true)
 await source('CREATE TABLE newer (id INTEGER);'); await act(async () => resolve('CREATE TABLE stale (id INTEGER);')); expect(document.querySelector('textarea')!.value).toContain('newer')
 const wrong = new File(['text'], 'schema.exe'); await act(async () => { Object.defineProperty(input, 'files', { configurable: true, value: [wrong] }); input.dispatchEvent(new Event('change', { bubbles: true })) }); expect(document.body.textContent).toContain('Choose a .sql')
 const good = new File([''], 'schema.sql'); Object.defineProperty(good, 'text', { value: async () => 'CREATE TABLE loaded (id INTEGER);' }); await act(async () => { Object.defineProperty(input, 'files', { configurable: true, value: [good] }); input.dispatchEvent(new Event('change', { bubbles: true })) }); expect(document.querySelector('textarea')!.value).toContain('loaded'); expect(apply).not.toHaveBeenCalled()
})
it('reports oversized and unreadable files without applying, and traps keyboard focus', async () => {
 await mount(); const input = document.querySelector<HTMLInputElement>('input[type=file]')!
 const oversized = new File([''], 'huge.sql'); Object.defineProperty(oversized, 'size', { value: 1024 * 1024 + 1 })
 await act(async () => { Object.defineProperty(input, 'files', { configurable: true, value: [oversized] }); input.dispatchEvent(new Event('change', { bubbles: true })) }); expect(document.body.textContent).toContain('no larger than 1 MB')
 const broken = new File([''], 'broken.sql'); Object.defineProperty(broken, 'text', { value: async () => { throw new Error('unreadable') } })
 await act(async () => { Object.defineProperty(input, 'files', { configurable: true, value: [broken] }); input.dispatchEvent(new Event('change', { bubbles: true })) }); expect(document.body.textContent).toContain('Could not read this file'); expect(apply).not.toHaveBeenCalled()
 await act(async () => { button('Cancel').focus(); button('Cancel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) }); expect(document.activeElement).toBe(document.querySelector('select'))
})

it('enforces the paste limit in UTF-8 bytes, not character count', async () => {
 await mount()
 await source('--' + '\u00e9'.repeat(524288))
 await click('Preview import')
 expect(document.body.textContent).toContain('Paste no more than 1 MB')
 expect(button('Add to diagram').disabled).toBe(true)
})
