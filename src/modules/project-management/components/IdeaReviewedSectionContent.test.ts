import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IdeaSectionRevisionApi } from '@/lib/api/ideaBacklogApi'

const getActive = vi.fn()
vi.mock('@/lib/api/ideaBacklogApi', () => ({
  getActiveIdeaSectionRevision: (...args: unknown[]) => getActive(...args),
}))

import { IdeaReviewedSectionContent } from './IdeaReviewedSectionContent'

// React 19 only flushes act() when this flag is set.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const AI_TEXT = 'Ringkasan AI: cabang membuat tiket di Ivanti'

function revision(overrides: Partial<IdeaSectionRevisionApi> & { review?: Record<string, unknown> }): IdeaSectionRevisionApi {
  const { review, ...rest } = overrides
  return {
    id: 'rev-1',
    idea_id: 'idea-1',
    section_key: 'summary',
    status: 'approved',
    source: 'ai',
    author_id: 'user-1',
    created_date: '2026-09-26T08:00:00Z',
    content_json: { text: 'Flattened copy of the section', _review: review ?? { ai_text_at_edit: AI_TEXT } },
    ...rest,
  } as IdeaSectionRevisionApi
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  getActive.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

async function render(sectionKey: 'summary' | 'scoring', currentContent = AI_TEXT) {
  await act(async () => {
    root.render(createElement(IdeaReviewedSectionContent, {
      ideaId: 'idea-1',
      sectionKey,
      currentContent,
      userId: 'user-1',
      userName: 'Alfa',
      keepOriginal: true,
      children: createElement('div', { 'data-testid': 'rich' }, 'RICH AI VIEW'),
    }))
  })
}

const rich = () => host.querySelector('[data-testid="rich"]')
const insideDetails = () => Boolean(rich()?.closest('details'))

describe('IdeaReviewedSectionContent', () => {
  it('shows the AI view when the section has no approved revision', async () => {
    getActive.mockResolvedValue(null)
    await render('summary')
    expect(rich()).not.toBeNull()
    expect(host.textContent).not.toContain('Approved by')
  })

  it('never blanks the section while the revision is loading', async () => {
    getActive.mockReturnValue(new Promise(() => {}))
    await render('summary')
    expect(rich()).not.toBeNull()
    expect(host.textContent).not.toContain('Memuat versi section')
  })

  it('keeps the AI view when the lookup fails, with a non-blocking note', async () => {
    getActive.mockRejectedValue(new Error('idea-backlog down'))
    await render('summary')
    expect(rich()).not.toBeNull()
    expect(host.textContent).toContain('The approved version could not be loaded')
  })

  it('approving the AI output as-is keeps the rich view instead of plain text', async () => {
    // The regression: Approve created a flattened AI copy, and the page swapped
    // the cards/charts/scores for that plain text inside a collapsed panel.
    getActive.mockResolvedValue(revision({ source: 'ai' }))
    await render('scoring')
    expect(rich()).not.toBeNull()
    expect(insideDetails()).toBe(false)
    // Approval is shown in the section toolbar, not as a line above the cards.
    expect(host.textContent).not.toContain('Approved by')
    expect(host.textContent).not.toContain('Flattened copy of the section')
  })

  it('the badge names the approver, not the revision author', async () => {
    // AI revisions are created by the summary pipeline; the badge must name who
    // approved, never the creator.
    getActive.mockResolvedValue(revision({
      source: 'ai', author_id: 'summary-pipeline', approved_by: 'user-1',
      content_json: { text: 'Versi AI lama', _review: { ai_text_at_edit: 'older AI output' } },
    }))
    await render('summary', 'newer AI output')
    expect(host.textContent).toContain('AI version approved by Alfa')
    expect(host.textContent).not.toContain('summary-pipeline')
  })

  it('a human edit approved by a checker names both people', async () => {
    getActive.mockResolvedValue(revision({ source: 'human', author_id: 'user-1', approved_by: 'checker-9', content_json: { text: 'Koreksi manusia', _review: {} } }))
    await render('summary')
    expect(host.textContent).toContain('Edited by Alfa · approved by checker-9')
  })

  it('inline field edits keep the rich view, since the cards carry the edits', async () => {
    getActive.mockResolvedValue(revision({ source: 'human', content_json: { text: 'Flattened merged summary', fields: { core_pressure: 'SLA 2 hari' }, _review: {} } }))
    await render('summary', 'different AI output')
    expect(rich()).not.toBeNull()
    expect(insideDetails()).toBe(false)
    expect(host.textContent).not.toContain('Flattened merged summary')
    expect(host.textContent).not.toContain('card edited') // counted in the section toolbar instead
  })

  it('a human edit leads, with the AI analysis tucked away on ordinary sections', async () => {
    getActive.mockResolvedValue(revision({ source: 'human', content_json: { text: 'Koreksi manusia: SLA 4 jam', _review: { original_ai_text: AI_TEXT } } }))
    await render('summary')
    expect(host.textContent).toContain('Koreksi manusia: SLA 4 jam')
    expect(host.textContent).toContain('Edited by Alfa')
    expect(insideDetails()).toBe(true)
  })

  it('a human edit never hides the official scores', async () => {
    getActive.mockResolvedValue(revision({ section_key: 'scoring', source: 'human', content_json: { text: 'Narasi skor dari reviewer', _review: {} } }))
    await render('scoring')
    expect(host.textContent).toContain('Narasi skor dari reviewer')
    expect(rich()).not.toBeNull()
    expect(insideDetails()).toBe(false)
  })

  it('an approved AI version that no longer matches the current AI output leads', async () => {
    // AI re-ran after approval: the approved version stays authoritative until
    // someone approves the new one.
    getActive.mockResolvedValue(revision({ source: 'ai', content_json: { text: 'Versi AI lama yang disetujui', _review: { ai_text_at_edit: 'older AI output' } } }))
    await render('summary', 'newer AI output')
    expect(host.textContent).toContain('Versi AI lama yang disetujui')
    expect(host.textContent).toContain('AI version approved by Alfa')
  })

  it('a content refresh does not blank an approved section', async () => {
    getActive.mockResolvedValue(revision({ source: 'ai' }))
    await render('summary')
    expect(rich()).not.toBeNull()
    // Summary refresh streaming in: new content, refetch still in flight. The
    // old component reset to a "Memuat versi section..." line on every change.
    getActive.mockReturnValue(new Promise(() => {}))
    await render('summary', `${AI_TEXT} (streamed update)`)
    expect(rich()).not.toBeNull()
    expect(host.textContent).not.toContain('Memuat versi section')
  })
})
