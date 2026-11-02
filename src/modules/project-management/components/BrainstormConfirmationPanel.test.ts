import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrainstormConfirmationPanel } from './BrainstormConfirmationPanel'
import { BrainstormConfirmationOptions } from './BrainstormConfirmationOptions'
import { splitScopedConfirmation } from '../lib/brainstormMarkdown'

vi.mock('@/modules/core-shell/components/AssistantChatMarkdown', () => ({ AssistantChatMarkdown: () => null }))

const topic = 'Jelaskan tujuan utama dari project ini'
const answer = 'Membantu collector field menanyakan kebijakan secara aman melalui Gen AI.'
const text = `Beritahu aku kalau ada yang kurang tepat.\n\n**Yang ingin aku konfirmasi: ${topic}**\n\nPemahamanku untuk poin ini: ${answer}\n\nJika ada yang kurang atau keliru, tulis perbaikan atau tambahannya.`
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(onSubmit = vi.fn()) {
  await act(async () => root.render(createElement(BrainstormConfirmationPanel, {
    text, question: 'Apakah rangkuman tujuan ini sudah benar dan lengkap?', indonesian: true,
    renderText: (value: string) => createElement('p', null, value),
    children: createElement(BrainstormConfirmationOptions, {
      choices: ['Rangkuman tujuan sudah tepat', 'Perbaiki tujuan'],
      explanations: ['Hanya tujuan proyek.', 'Tulis perubahan tujuan.'],
      indonesian: true, onSubmit,
    }),
  })))
}

describe('confirmation presentation for existing transcripts', () => {
  it('groups the stored topic, answer, question and unchanged actions', async () => {
    const onSubmit = vi.fn()
    await render(onSubmit)
    const panel = container.querySelector('[data-brainstorm-confirmation]')!
    expect(panel.textContent).toContain('Konfirmasi Pemahaman')
    expect(panel.textContent!.split(topic)).toHaveLength(2)
    expect(panel.textContent!.split(answer)).toHaveLength(2)
    expect(panel.querySelectorAll('input[type=radio]')).toHaveLength(2)
    expect(onSubmit).not.toHaveBeenCalled()
    await act(async () => panel.querySelector<HTMLInputElement>('input[type=radio]')!.click())
    await render(onSubmit)
    expect(panel.querySelector<HTMLInputElement>('input[type=radio]')!.checked).toBe(true)
    await act(async () => panel.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith('Rangkuman tujuan sudah tepat')
  })

  it('does not modify saved text while extracting presentation fields', () => {
    const message = Object.freeze({ text, progress: 3, revision: 'unchanged' })
    expect(splitScopedConfirmation(message.text)).toEqual({
      before: 'Beritahu aku kalau ada yang kurang tepat.', question: topic, answer,
      after: 'Jika ada yang kurang atau keliru, tulis perbaikan atau tambahannya.',
    })
    expect(message).toEqual({ text, progress: 3, revision: 'unchanged' })
  })

  it('supports compact stored paragraphs and English without regenerating a message', () => {
    expect(splitScopedConfirmation(`**Please confirm: Project objective**\nMy understanding of this point: Faster policy lookup.\n\nPlease correct anything missing.`))
      .toEqual({ before: '', question: 'Project objective', answer: 'Faster policy lookup.', after: 'Please correct anything missing.' })
  })

  it('leaves legacy or incomplete messages intact for the existing prose renderer', async () => {
    const legacy = 'Untuk pertanyaan "Tujuan", dari ceritamu aku catat: akses kebijakan cepat.'
    expect(splitScopedConfirmation(legacy)).toBeNull()
    expect(splitScopedConfirmation('**Yang ingin aku konfirmasi: Tujuan**')).toBeNull()
    await act(async () => root.render(createElement(BrainstormConfirmationPanel, {
      text: legacy, question: 'Apakah sudah benar?', indonesian: true,
      renderText: (value: string) => createElement('p', null, value),
    })))
    expect(container.textContent).toContain(legacy)
  })
})
