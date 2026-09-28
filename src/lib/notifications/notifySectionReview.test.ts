import { beforeEach, describe, expect, it, vi } from 'vitest'

const createNotification = vi.fn()
vi.mock('@/lib/api/notificationApi', () => ({
  TECTONA_APP_ID: 'app',
  createNotification: (...args: unknown[]) => createNotification(...args),
}))

import { notifySectionReview, type SectionReviewNotifyContext } from './notifySectionReview'

const ctx: SectionReviewNotifyContext = {
  ideaId: 'idea-1', ideaTitle: 'Aplikasi Helpdesk', linkUrl: '/w/ws/idea-backlog/idea-1',
  reviewerIds: ['ricky'], actorId: 'alfa', actorName: 'Alfa Irawan',
}

beforeEach(() => { createNotification.mockReset(); createNotification.mockResolvedValue({ id: 'n' }) })

describe('notifySectionReview', () => {
  it('tells the reviewer about a new edit, linking straight to Version history', () => {
    notifySectionReview(ctx, { kind: 'submitted', sectionKey: 'summary', sectionLabel: 'Summary', revisionId: 'r1', changedLabels: ['Executive Brief'] })
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'ricky',
      title: 'Summary: perubahan menunggu approval',
      body: 'Aplikasi Helpdesk — Alfa Irawan mengubah Executive Brief',
      link_url: '/w/ws/idea-backlog/idea-1?review=summary',
    }))
  })

  it('tells the author about a revision request, with the comment', () => {
    notifySectionReview({ ...ctx, actorId: 'ricky', actorName: 'Ricky Gunawan' },
      { kind: 'request_changes', sectionKey: 'summary', sectionLabel: 'Summary', revisionId: 'r1', authorId: 'alfa', comment: 'Sebutkan SLA.' })
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'alfa', title: 'Summary: diminta revisi', body: 'Aplikasi Helpdesk — Ricky Gunawan: "Sebutkan SLA."',
    }))
  })

  it('never notifies the actor about their own action', () => {
    notifySectionReview({ ...ctx, reviewerIds: ['alfa'] }, { kind: 'submitted', sectionKey: 'summary', sectionLabel: 'Summary', revisionId: 'r1', changedLabels: [] })
    notifySectionReview(ctx, { kind: 'approve', sectionKey: 'summary', sectionLabel: 'Summary', revisionId: 'r1', authorId: 'alfa' })
    expect(createNotification).not.toHaveBeenCalled()
  })
})
