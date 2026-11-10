import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BrainstormErrorNotice } from './BrainstormErrorNotice'
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
async function render(message: string, indonesian = true) {
  const props = Object.freeze({ message, indonesian, className: 'text-xs text-destructive' })
  await act(async () => root.render(createElement(BrainstormErrorNotice, props)))
  expect(props).toEqual({ message, indonesian, className: 'text-xs text-destructive' })
}
it.each([true, false])('localizes fidelity guidance (Indonesian=%s) and retains exact closed details', async indonesian => {
  const message = 'IDEA_DRAFT_FIDELITY: Invalid source-cited sections: INVALID_CITATION. Original details remain unchanged.'
  await render(message, indonesian)
  expect(container.querySelector('[role="alert"]')?.className).toContain('text-sm')
  expect(container.querySelector('[role="alert"]')?.className.split(' ')).not.toContain('text-xs')
  expect(container.querySelector('details')?.open).toBe(false)
  expect(container.querySelector('pre')?.textContent).toBe(message)
  expect(container.querySelector('summary')?.textContent).toBe(indonesian ? 'Detail teknis' : 'Technical details')
  expect(container.textContent).toContain(indonesian ? 'Draf baru belum disimpan.' : 'No new draft was saved.')
  expect(container.textContent).toContain(indonesian ? 'sebelum mencoba Generate draft lagi' : 'before trying Generate draft again')
})
it('keeps mixed known reasons distinct without repeating duplicate codes', async () => {
  await render('IDEA_DRAFT_FIDELITY: INVALID_CITATION, UNSUPPORTED_SCOPE_OR_CAUSAL_CLAIM, INVALID_CITATION')
  const reasons = [...container.querySelectorAll('li')].map(li => li.textContent)
  expect(reasons).toEqual(['Rujukan sumber pada sebagian isi draf tidak valid.', 'Sebagian pernyataan belum didukung bukti atau belum mempertahankan status asumsi dan ketidakpastian.'])
})
it.each([
  ['UNSUPPORTED_NUMBERS', 'Ada angka dalam draf yang belum didukung sumber.'],
  ['Missing current evidence coverage', 'Draf belum mencakup seluruh bukti yang masih berlaku.'],
  ['MISSING_CITATIONS', 'Sebagian isi draf belum menyertakan rujukan sumber.'],
  ['UNSUPPORTED_QUOTE_OR_SOURCE:UNKNOWN_SOURCE_ID', 'Ada rujukan ke sumber yang tidak dikenali.'],
  ['UNSUPPORTED_QUOTE_OR_SOURCE:QUOTE_MISMATCH', 'Ada kutipan yang tidak cocok dengan sumber yang dirujuk.'],
])('maps only the identified reason %s', async (code, expected) => {
  await render(`IDEA_DRAFT_FIDELITY: ${code}`)
  expect([...container.querySelectorAll('li')].map(li => li.textContent)).toEqual([expected])
})
it.each([true, false])('uses neutral unknown-reason fallback (Indonesian=%s)', async indonesian => {
  await render('IDEA_DRAFT_FIDELITY: NEW_UNKNOWN_REASON', indonesian)
  expect(container.querySelectorAll('li')).toHaveLength(0)
  expect(container.textContent).toContain(indonesian ? 'Hasil belum lolos pemeriksaan validasi.' : 'The result did not pass validation.')
  expect(container.textContent).not.toContain('Some draft citations are invalid.')
})
it('keeps ordinary errors and their existing paragraph styling unchanged', async () => {
  await render('Network request timed out. Try again.')
  expect(container.children).toHaveLength(1)
  expect(container.firstElementChild?.tagName).toBe('P')
  expect(container.firstElementChild?.className).toBe('text-xs text-destructive')
  expect(container.textContent).toBe('Network request timed out. Try again.')
  expect(container.querySelector('details')).toBeNull()
})
it('escapes markup-like details and preserves every original character', async () => {
  const message = 'IDEA_DRAFT_FIDELITY: Unknown <img src=x onerror="alert(1)">\n<script>bad()</script> & "quoted"'
  await render(message)
  expect(container.querySelector('pre')?.textContent).toBe(message)
  expect(container.querySelector('script,img')).toBeNull()
  await act(async () => { container.querySelector('details')!.open = true })
  expect(container.querySelector('pre')?.textContent).toBe(message)
})
it.each([true, false])('describes scope validation without assuming the specific cause (Indonesian=%s)', async indonesian => {
  const message = 'IDEA_DRAFT_FIDELITY: UNSUPPORTED_SCOPE_OR_CAUSAL_CLAIM'
  await render(message, indonesian)
  expect(container.querySelector('li')?.textContent).toBe(indonesian ? 'Sebagian pernyataan belum didukung bukti atau belum mempertahankan status asumsi dan ketidakpastian.' : 'Some statements are not supported by evidence or do not preserve assumptions and uncertainty.')
  expect(container.querySelector('pre')?.textContent).toBe(message)
})
