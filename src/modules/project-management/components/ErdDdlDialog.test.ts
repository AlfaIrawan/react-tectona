import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ErdDdlDialog } from './ErdDdlDialog'
let host: HTMLDivElement, root: Root
const close = vi.fn(), copy = vi.fn(async () => {})
beforeEach(() => {
 Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
 Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
 host = document.createElement('div'); document.body.append(host); root = createRoot(host); vi.clearAllMocks()
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks() })
async function mount() { await act(async () => root.render(createElement(ErdDdlDialog, { selection: { nodes: [{ id: 'a', type: 'erdEntity', position: { x: 0, y: 0 }, data: { kind: 'element', title: 'entity', description: ['*id : INT'] } }], edges: [] }, onClose: close }))) }
async function click(text: string) { await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text)!.click()) }
it('previews dialect changes and copies only on explicit action without a real clipboard', async () => {
 await mount(); expect(copy).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Nothing is executed'); expect(document.body.textContent).toContain('Limited structural validation')
 const select = document.querySelector('select')!; await act(async () => { select.value = 'mysql'; select.dispatchEvent(new Event('change', { bubbles: true })) }); await click('Copy SQL'); expect(copy).toHaveBeenCalledWith('-- Target: MySQL 8.4 LTS / InnoDB\n-- Review-only generated DDL. Structural checks only; not validated by a database.\nCREATE TABLE `entity` (\n  `id` INT NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB;')
 await click('Close'); expect(close).toHaveBeenCalledOnce()
})
it('reports denied clipboard access and supports Escape dismissal', async () => {
 await mount(); copy.mockRejectedValueOnce(new Error('denied')); await click('Copy SQL'); expect(document.body.textContent).toContain('Copy unavailable'); await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); expect(close).toHaveBeenCalledOnce()
})
it('downloads SQL through a local Blob only when requested', async () => {
 Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() }); const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
 await mount(); expect(URL.createObjectURL).not.toHaveBeenCalled(); await click('Download .sql'); expect(URL.createObjectURL).toHaveBeenCalledOnce(); expect(anchor).toHaveBeenCalledOnce()
})
it('offers every verified target profile and updates target-specific review help', async () => {
 await mount(); const select = document.querySelector('select')!
 expect([...select.options].map(o => o.textContent)).toEqual(['PostgreSQL', 'MySQL', 'MariaDB', 'Oracle', 'SQL Server', 'Sybase ASE', 'Sybase SQL Anywhere', 'IBM Db2 LUW', 'Ingres', 'OpenEdge', 'Informix', 'Firebird', 'SQLite', 'H2', 'InterSystems Cach\u00e9', 'HSQLDB / HyperSQL'])
 for (const [value, target] of [['mariadb', 'MariaDB 10.11'], ['oracle', 'Oracle Database 19c'], ['sqlserver', 'Microsoft SQL Server 2022']]) {
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) }); expect(document.body.textContent).toContain(target); expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toContain(target)
 }
 expect(copy).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Mark primary keys')
})
it('uses the shared solid dialog, themed actions, fixed header/footer and bounded preview layout', async () => {
 await mount(); const dialog = document.querySelector('[role="dialog"]')!
 expect(dialog.getAttribute('data-theme-surface')).toBe('dialog-solid'); expect(dialog.classList.contains('overflow-hidden')).toBe(true)
 const buttons = [...dialog.querySelectorAll('button')]
 expect(buttons.find(b => b.textContent === 'Copy SQL')?.getAttribute('data-theme-button')).toBe('outline')
 expect(buttons.find(b => b.textContent === 'Download .sql')?.getAttribute('data-theme-button')).toBe('default')
 expect(dialog.querySelector('[aria-label="SQL dialect"]')?.classList.contains('bg-background')).toBe(true)
 expect(dialog.querySelector('[aria-label="Generated SQL"]')?.hasAttribute('readonly')).toBe(true)
 await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Close DDL preview"]')!.click()); expect(close).toHaveBeenCalledOnce()
})
