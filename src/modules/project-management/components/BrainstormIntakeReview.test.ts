import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BrainstormIntakeReview, completedIntakeReviewAvailable } from './BrainstormIntakeReview'
import type { IdeaDraftChecklistItem, IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

async function render(onSend = vi.fn(), onGenerate = vi.fn(), disabled = false) {
  await act(async () => root.render(createElement(BrainstormIntakeReview, { indonesian: true, onSend, onGenerate, disabled })))
  return { onSend, onGenerate }
}
async function input(value: string) {
  await act(async () => {
    const area = container.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, value)
    area.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const button = (label: string) => [...container.querySelectorAll('button')].find(node => node.textContent?.includes(label))!

it('shows revision input, continued questions and generation without sending automatically', async () => {
  const { onSend, onGenerate } = await render()
  expect(container.querySelector('textarea')?.rows).toBe(3)
  expect(button('Kirim revisi').disabled).toBe(true)
  expect(button('Business')).toBeTruthy()
  expect(button('Technical')).toBeTruthy()
  expect(button('Generate draft')).toBeTruthy()
  expect(onSend).not.toHaveBeenCalled()
  expect(onGenerate).not.toHaveBeenCalled()
})

it('submits a scoped revision and keeps the typed text when the request fails', async () => {
  const onSend = vi.fn().mockRejectedValue(new Error('network unavailable'))
  await render(onSend)
  await input('Fase pertama belum terintegrasi dengan Ad1ForFlow.')
  expect(button('Generate draft').disabled).toBe(true)
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(onSend).toHaveBeenCalledWith('Revisi rangkuman pemahaman: Fase pertama belum terintegrasi dengan Ad1ForFlow.')
  expect(container.querySelector('textarea')!.value).toContain('belum terintegrasi')
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Teks tetap disimpan')
})

it('routes continue and generate to their existing distinct handlers', async () => {
  const { onSend, onGenerate } = await render()
  await act(async () => button('Business').click())
  await act(async () => button('Technical').click())
  await act(async () => button('Generate draft').click())
  expect(onSend.mock.calls.map(row => row[0])).toEqual(['Pertanyaan bisnis', 'Pertanyaan teknis'])
  expect(onGenerate).toHaveBeenCalledOnce()
})

it('blocks all actions while sending', async () => {
  await render(vi.fn(), vi.fn(), true)
  expect([...container.querySelectorAll('button')].every(node => node.disabled)).toBe(true)
})

it('disables a successfully requested track without blocking draft generation', async () => {
  const { onSend, onGenerate } = await render()
  await act(async () => button('Business').click())
  await act(async () => root.render(createElement(BrainstormIntakeReview, {
    indonesian: true, onSend, onGenerate,
    discoveryProgress: { covered: 0, total: 20, business_status: 'pending', technical_status: 'available' },
  })))
  expect(button('Business').disabled).toBe(true)
  await act(async () => button('Business').click())
  expect(onSend).toHaveBeenCalledOnce()
  expect(button('Technical').disabled).toBe(false)
  await act(async () => button('Generate draft').click())
  expect(onGenerate).toHaveBeenCalledOnce()
})

it.each(['pending', 'exhausted'] as const)('uses persisted %s track status after reopening', async status => {
  const onSend = vi.fn()
  await act(async () => root.render(createElement(BrainstormIntakeReview, {
    indonesian: true, onSend, onGenerate: vi.fn(),
    discoveryProgress: { covered: 4, total: 20, business_status: status, technical_status: 'available' },
  })))
  expect(button('Business').disabled).toBe(true)
  expect(button('Business').parentElement?.title).toBeTruthy()
  expect(button('Technical').disabled).toBe(false)
  expect(button('Generate draft').disabled).toBe(false)
  await act(async () => button('Business').click())
  expect(onSend).not.toHaveBeenCalled()
})

it('allows retrying the track when sending fails', async () => {
  const onSend = vi.fn().mockRejectedValue(new Error('offline'))
  await render(onSend)
  await act(async () => button('Business').click())
  expect(button('Business').disabled).toBe(false)
  expect(container.querySelector('[role=alert]')).toBeTruthy()
})

it('offers final review only at a completed and unblocked review boundary', () => {
  const core = [{ id: 'goal', required: true, status: 'answered' }] as IdeaDraftChecklistItem[]
  const message: IdeaDraftBrainstormMessage = { role: 'assistant', text: 'Review rangkuman.', intake_review_ready: true }
  expect(completedIntakeReviewAvailable([message], core, true)).toBe(true)
  expect(completedIntakeReviewAvailable([message], core, false)).toBe(false)
  expect(completedIntakeReviewAvailable([{ ...message, intake_review_ready: false }], core, true)).toBe(false)
  expect(completedIntakeReviewAvailable([{ ...message, confirmation_choices: ['Confirm'] }], core, true)).toBe(false)
  expect(completedIntakeReviewAvailable([message], [...core, { id: 'discovery_data', required: false, status: 'asked' } as IdeaDraftChecklistItem], true)).toBe(false)
})
