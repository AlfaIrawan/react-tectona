import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IdeaSectionRevisionApi } from '@/lib/api/ideaBacklogApi'

const list = vi.fn()
const create = vi.fn()
const transition = vi.fn()
const listThreads = vi.fn()
const createThread = vi.fn()
const replyThread = vi.fn()
const closeThread = vi.fn()
vi.mock('@/lib/api/ideaBacklogApi', () => ({
  listIdeaSectionRevisions: (...args: unknown[]) => list(...args),
  createIdeaSectionRevision: (...args: unknown[]) => create(...args),
  transitionIdeaSectionRevision: (...args: unknown[]) => transition(...args),
  listIdeaSectionThreads: (...args: unknown[]) => listThreads(...args),
  createIdeaSectionThread: (...args: unknown[]) => createThread(...args),
  replyToIdeaSectionThread: (...args: unknown[]) => replyThread(...args),
  closeIdeaSectionThread: (...args: unknown[]) => closeThread(...args),
}))

const suggest = vi.fn()
vi.mock('@/lib/api/tectonaAgentRuntimeApi', () => ({
  suggestIdeaSummaryField: (...args: unknown[]) => suggest(...args),
}))

import { IdeaSummaryFieldReviewProvider, SummaryInlineField } from './IdeaSummaryInlineField'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const AI = 'Eskalasi manual lewat email.'

function revision(overrides: Partial<IdeaSectionRevisionApi>): IdeaSectionRevisionApi {
  return {
    id: 'rev-1', idea_id: 'idea-1', section_key: 'summary', revision_number: 1, base_idea_version: 1,
    status: 'approved', source: 'human', author_id: 'user-1', created_date: '2026-09-26T08:00:00Z',
    evidence_json: [], content_json: {}, ...overrides,
  } as IdeaSectionRevisionApi
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  list.mockReset(); create.mockReset(); transition.mockReset(); suggest.mockReset()
  listThreads.mockReset(); createThread.mockReset(); replyThread.mockReset(); closeThread.mockReset()
  listThreads.mockResolvedValue([])
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const field = () => createElement(SummaryInlineField, {
  field: 'core_pressure', aiValue: AI,
  render: (value: string) => createElement('p', { 'data-testid': 'card' }, value),
})

async function render(withProvider = true) {
  await act(async () => {
    root.render(withProvider
      ? createElement(IdeaSummaryFieldReviewProvider, {
          ideaId: 'idea-1', currentContent: 'AI summary text', userId: 'user-1', userName: 'Alfa',
          people: [{ id: 'user-2', name: 'Ricky' }], ideaOwnerId: 'owner-1', children: field(),
        })
      : field())
  })
}

const card = () => host.querySelector('[data-testid="card"]')?.textContent
const pencil = () => host.querySelector<HTMLButtonElement>('button[aria-label="Edit Core Pressure"]')

async function typeInto(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function typeIntoInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('SummaryInlineField', () => {
  it('shows the AI wording when nothing was edited', async () => {
    list.mockResolvedValue([])
    await render()
    expect(card()).toBe(AI)
    expect(host.textContent).not.toContain('Edited by')
  })

  it('shows the approved human wording in the same card, with its editor', async () => {
    list.mockResolvedValue([revision({ content_json: { fields: { core_pressure: 'SLA 2 hari' }, _review: { field_authors: { core_pressure: 'user-1' } } } })])
    await render()
    expect(card()).toBe('SLA 2 hari')
    expect(host.textContent).toContain('Edited by Alfa')
  })

  it('saves only the edited card and leaves it pending review', async () => {
    list.mockResolvedValue([])
    create.mockResolvedValue({ id: 'rev-2' })
    transition.mockResolvedValue({})
    await render()
    await act(async () => { pencil()!.click() })
    await typeInto(host.querySelector('textarea')!, 'SLA 2 hari untuk eskalasi')
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save'))!
    await act(async () => { save.click() })
    expect(create).toHaveBeenCalledWith('idea-1', 'summary', expect.objectContaining({
      source: 'human',
      content_json: { fields: { core_pressure: 'SLA 2 hari untuk eskalasi' } },
      base_revision_id: null,
    }))
    expect(transition).toHaveBeenCalledWith('idea-1', 'summary', 'rev-2', 'accept')
    expect(host.querySelector('textarea')).toBeNull()
  })

  it('shows the server rejection and keeps the draft open', async () => {
    list.mockResolvedValue([])
    create.mockRejectedValue(new Error('Skor resmi tidak dapat diubah lewat narasi summary.'))
    await render()
    await act(async () => { pencil()!.click() })
    await typeInto(host.querySelector('textarea')!, 'skor 9/10')
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save'))!
    await act(async () => { save.click() })
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Skor resmi')
    expect(host.querySelector('textarea')).not.toBeNull()
  })

  it("is read-only while another reviewer's edit awaits approval", async () => {
    list.mockResolvedValue([revision({ id: 'rev-9', revision_number: 2, status: 'accepted', author_id: 'someone-else', content_json: { fields: { core_pressure: 'Versi lain' } } })])
    await render()
    expect(pencil()!.disabled).toBe(true)
    expect(card()).toBe(AI)
    expect(host.textContent).toContain('awaiting approval')
  })

  it('continuing my own pending edit folds it into the new revision', async () => {
    list.mockResolvedValue([revision({ id: 'rev-9', revision_number: 2, status: 'accepted', content_json: { fields: { value_thesis: 'Nilai baru', core_pressure: 'Draft saya' } } })])
    create.mockResolvedValue({ id: 'rev-10' })
    transition.mockResolvedValue({})
    await render()
    await act(async () => { pencil()!.click() })
    expect(host.querySelector('textarea')!.value).toBe('Draft saya')
    await typeInto(host.querySelector('textarea')!, 'Draft saya, final')
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save'))!
    await act(async () => { save.click() })
    expect(create.mock.calls[0][2].content_json).toEqual({ fields: { value_thesis: 'Nilai baru', core_pressure: 'Draft saya, final' } })
  })

  it('Suggest AI fills the draft, and the saved revision records the assist', async () => {
    list.mockResolvedValue([])
    suggest.mockResolvedValue({ field: 'core_pressure', text: 'Eskalasi manual memperlambat respons cabang.', notes: 'Lebih ringkas.', model_id: 'gemma' })
    create.mockResolvedValue({ id: 'rev-2' })
    transition.mockResolvedValue({})
    await render()
    await act(async () => { pencil()!.click() })
    await typeIntoInput(host.querySelector<HTMLInputElement>('input[aria-label="AI instruction for Core Pressure"]')!, 'lebih ringkas')
    const suggestButton = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Suggest AI'))!
    await act(async () => { suggestButton.click() })
    expect(suggest).toHaveBeenCalledWith({ idea_id: 'idea-1', field: 'core_pressure', current_text: AI, instruction: 'lebih ringkas' })
    expect(host.querySelector('textarea')!.value).toBe('Eskalasi manual memperlambat respons cabang.')
    expect(host.textContent).toContain('AI draft: Lebih ringkas.')
    expect(create).not.toHaveBeenCalled() // a suggestion is never saved on its own
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save'))!
    await act(async () => { save.click() })
    expect(create.mock.calls[0][2]).toEqual(expect.objectContaining({
      model_id: 'gemma',
      evidence_json: [{ type: 'ai_suggestion', field: 'core_pressure', instruction: 'lebih ringkas' }],
    }))
  })

  it('"Kembalikan teks saya" restores the draft and drops the AI marker', async () => {
    list.mockResolvedValue([])
    suggest.mockResolvedValue({ field: 'core_pressure', text: 'Versi AI', notes: '', model_id: 'gemma' })
    create.mockResolvedValue({ id: 'rev-2' })
    transition.mockResolvedValue({})
    await render()
    await act(async () => { pencil()!.click() })
    await typeInto(host.querySelector('textarea')!, 'Teks saya')
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Suggest AI'))!.click() })
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Restore my text'))!.click() })
    expect(host.querySelector('textarea')!.value).toBe('Teks saya')
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save'))!.click() })
    expect(create.mock.calls[0][2].model_id).toBeUndefined()
  })

  it('a failed suggestion keeps the reviewer draft untouched', async () => {
    list.mockResolvedValue([])
    suggest.mockRejectedValue(new Error('AI sedang tidak dapat dihubungi. Coba lagi.'))
    await render()
    await act(async () => { pencil()!.click() })
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Suggest AI'))!.click() })
    expect(host.querySelector('textarea')!.value).toBe(AI)
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('tidak dapat dihubungi')
  })

  it('shows the reviewer request on the author card and lets them revise it', async () => {
    list.mockResolvedValue([
      revision({ id: 'rev-active', revision_number: 1, status: 'approved', content_json: { fields: {} } }),
      revision({
        id: 'rev-2', revision_number: 2, status: 'changes_requested', author_id: 'user-1',
        content_json: { fields: { core_pressure: 'Draft saya' } },
        comments: [{ id: 'c1', action: 'request_changes', body: 'Sebutkan target SLA-nya.', author_id: 'checker-9', created_at: '2026-09-27T01:00:00Z' }],
      }),
    ])
    create.mockResolvedValue({ id: 'rev-3' })
    transition.mockResolvedValue({})
    await render()
    const box = host.querySelector('[aria-label="Changes requested"]')!
    expect(box.textContent).toContain('checker-9 requested changes')
    expect(box.textContent).toContain('Sebutkan target SLA-nya.')
    const revise = [...box.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Revise')!
    await act(async () => { revise.click() })
    expect(host.querySelector('textarea')!.value).toBe('Draft saya')
    await typeInto(host.querySelector('textarea')!, 'Draft saya, SLA 4 jam')
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save'))!.click() })
    expect(create.mock.calls[0][2]).toEqual(expect.objectContaining({
      content_json: { fields: { core_pressure: 'Draft saya, SLA 4 jam' } },
      base_revision_id: 'rev-active',
    }))
    expect(transition).toHaveBeenCalledWith('idea-1', 'summary', 'rev-3', 'accept')
  })

  it("keeps the card read-only while someone else's edit is being revised", async () => {
    list.mockResolvedValue([revision({
      id: 'rev-2', revision_number: 2, status: 'changes_requested', author_id: 'someone-else',
      content_json: { fields: { core_pressure: 'Draft orang lain' } },
      comments: [{ id: 'c1', action: 'request_changes', body: 'Perjelas.', author_id: 'user-1', created_at: '2026-09-27T01:00:00Z' }],
    })])
    await render()
    expect(pencil()!.disabled).toBe(true)
    const box = host.querySelector('[aria-label="Changes requested"]')!
    expect(box.textContent).toContain('Alfa requested changes')
    expect(box.textContent).toContain("to someone-else's edit")
    expect([...box.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Revise')).toBe(false)
  })

  it('starts a discussion on the card without touching any revision', async () => {
    list.mockResolvedValue([])
    createThread.mockResolvedValue({ id: 't1', kind: 'discussion', comments: [] })
    await render()
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Discussion on Core Pressure"]')!.click() })
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Start discussion'))!.click() })
    await typeInto(document.querySelector<HTMLTextAreaElement>('#thread-composer-discussion')!, 'Sudah dikonfirmasi cabang?')
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Post')!.click() })
    expect(createThread).toHaveBeenCalledWith('idea-1', 'summary', { kind: 'discussion', body: 'Sudah dikonfirmasi cabang?', field_key: 'core_pressure', assignee_id: null })
    expect(create).not.toHaveBeenCalled()
    expect(transition).not.toHaveBeenCalled()
  })

  it('requests a revision of an approved card, defaulting to its last editor', async () => {
    list.mockResolvedValue([revision({ content_json: { fields: { core_pressure: 'SLA 2 hari' }, _review: { field_authors: { core_pressure: 'user-2' } } } })])
    createThread.mockResolvedValue({ id: 't2', kind: 'revision_request', comments: [] })
    await render()
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Discussion on Core Pressure"]')!.click() })
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Request revision'))!.click() })
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Assign revision to"]')!.value).toBe('user-2')
    await typeInto(document.querySelector<HTMLTextAreaElement>('#thread-composer-revision_request')!, 'Tambahkan target SLA.')
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Send request'))!.click() })
    expect(createThread).toHaveBeenCalledWith('idea-1', 'summary', {
      kind: 'revision_request', body: 'Tambahkan target SLA.', field_key: 'core_pressure', assignee_id: 'user-2',
    })
  })

  it('shows an open revision request on the card and lets the assignee revise', async () => {
    list.mockResolvedValue([])
    listThreads.mockResolvedValue([{
      id: 't3', idea_id: 'idea-1', section_key: 'summary', field_key: 'core_pressure', kind: 'revision_request', status: 'open',
      assignee_id: 'user-1', created_by: 'user-2', created_at: '2026-09-27T01:00:00Z',
      comments: [{ id: 'c', body: 'Tambahkan target SLA.', author_id: 'user-2', created_at: '2026-09-27T01:00:00Z' }],
    }])
    await render()
    const banner = host.querySelector<HTMLButtonElement>('button[aria-label="Revision requested"]')!
    expect(banner.textContent).toContain('assigned to Alfa')
    expect(banner.textContent).toContain('Tambahkan target SLA.')
    await act(async () => { banner.click() })
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Revise')!.click() })
    expect(host.querySelector('textarea[aria-label="Edit Core Pressure"]')).not.toBeNull()
    // One open request per card: no second "Request revision".
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Request revision'))).toBe(false)
  })

  it('mentions a member with @ and stores the mention so they can be notified', async () => {
    list.mockResolvedValue([])
    createThread.mockResolvedValue({ id: 't5', kind: 'discussion', comments: [] })
    await render()
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Discussion on Core Pressure"]')!.click() })
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Start discussion'))!.click() })
    const box = document.querySelector<HTMLTextAreaElement>('#thread-composer-discussion')!
    await typeInto(box, 'Tolong cek @Ri')
    const option = [...document.querySelectorAll('[role="listbox"] button')].find((b) => b.textContent?.includes('Ricky'))!
    expect(option).toBeTruthy()
    await act(async () => { option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(box.value).toBe('Tolong cek @Ricky ')
    await typeInto(box, 'Tolong cek @Ricky ya')
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Post')!.click() })
    expect(createThread.mock.calls[0][2].body).toBe('Tolong cek @[Ricky](user-2) ya')
  })

  it('keeps the member list open across a space while the name still matches', async () => {
    list.mockResolvedValue([])
    await render()
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Discussion on Core Pressure"]')!.click() })
    await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Start discussion'))!.click() })
    const box = document.querySelector<HTMLTextAreaElement>('#thread-composer-discussion')!
    const options = () => [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((o) => o.textContent)
    await typeInto(box, 'cc @Ricky')
    expect(options().some((t) => t?.includes('Ricky'))).toBe(true)
    await typeInto(box, 'cc @Ricky ')
    expect(options().some((t) => t?.includes('Ricky'))).toBe(false) // "ricky " is no longer a name prefix
    await typeInto(box, 'hubungi @Ricky dan tim')
    expect(options()).toEqual([])
  })

  it('opens the comment popover on hover and closes it after the pointer leaves', async () => {
    vi.useFakeTimers()
    try {
      list.mockResolvedValue([])
      listThreads.mockResolvedValue([{
        id: 't4', idea_id: 'idea-1', section_key: 'summary', field_key: 'core_pressure', kind: 'discussion', status: 'open',
        created_by: 'user-2', created_at: '2026-09-27T01:00:00Z',
        comments: [{ id: 'c', body: 'Masih kurang jelas konteksnya.', author_id: 'user-2', created_at: '2026-09-27T01:00:00Z' }],
      }])
      await render()
      await act(async () => { await vi.runOnlyPendingTimersAsync() })
      const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Discussion on Core Pressure"]')!
      expect(trigger.textContent).toContain('1')
      const popover = () => document.querySelector('[role="dialog"][aria-label]')
      await act(async () => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
      await act(async () => { await vi.advanceTimersByTimeAsync(200) })
      expect(popover()?.textContent).toContain('Masih kurang jelas konteksnya.')
      // The comment list lives in the popover, not in the card.
      expect(host.textContent).not.toContain('Masih kurang jelas konteksnya.')
      await act(async () => { trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })) })
      await act(async () => { await vi.advanceTimersByTimeAsync(400) })
      expect(popover()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a Governance Readiness signal can be discussed but never edited or sent for revision', async () => {
    list.mockResolvedValue([])
    await act(async () => {
      root.render(createElement(IdeaSummaryFieldReviewProvider, {
        ideaId: 'idea-1', currentContent: 'AI summary text', userId: 'user-1', userName: 'Alfa', children:
          createElement(SummaryInlineField, {
            field: 'governance_readiness:kontrol_delivery', label: 'Governance Readiness · Kontrol delivery', aiValue: 'Risiko sudah dimitigasi.',
            commentOnly: true, render: (value: string) => createElement('p', { 'data-testid': 'card' }, value),
          }),
      }))
    })
    expect(host.querySelector('button[aria-label^="Edit "]')).toBeNull()
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Discussion on Governance Readiness · Kontrol delivery"]')!.click() })
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim())
    expect(buttons).toContain('Start discussion')
    expect(buttons).not.toContain('Request revision')
  })

  it('renders the plain card outside the summary provider', async () => {
    await render(false)
    expect(card()).toBe(AI)
    expect(pencil()).toBeNull()
  })
})
