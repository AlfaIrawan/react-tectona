import { describe, expect, it } from 'vitest'
import {
  composeUrdEmailBody,
  emailDocumentKindsFromTemplates,
  ideaAudienceMatches,
  matchEmailRecipients,
  matchUrdReviewHeads,
  normalizeJobTitle,
  parseIdeaEmailDocumentKind,
  templateEmailParts,
  urdReviewSummaryText,
} from '@/modules/project-management/lib/urdReviewHeads'
import type { IdentityUserDto } from '@/lib/api/identityAdminApi'

const user = (jobTitle: string, id: string): IdentityUserDto => ({
  id,
  email: `${id}@adira.co.id`,
  display_name: jobTitle,
  status_code: 'active',
  job_title: jobTitle,
})

describe('URD review heads', () => {
  it('matches the two job titles regardless of ampersand and case', () => {
    const result = matchUrdReviewHeads([
      user('HEAD OF IT DATA ANALYTICS', 'alfa'),
      user('Head of Business Project & research', 'research'),
      user('Head of Business Project Management Office', 'pmo'),
    ])
    expect(result.missing).toEqual([])
    expect(result.matched.map((item) => item.user.id)).toEqual(['research', 'pmo'])
    expect(normalizeJobTitle('Head of Business Project & research')).toBe('head of business project and research')
  })

  it('matches only the job titles chosen on the approval node', () => {
    const result = matchUrdReviewHeads(
      [user('Head of IT Data Analytics', 'alfa'), user('Head of PMO', 'pmo')],
      ['Head of IT Data Analytics'],
    )
    expect(result.matched.map((item) => item.user.id)).toEqual(['alfa'])
    expect(result.missing).toEqual([])
  })

  it('matches a badge by display name', () => {
    const result = matchEmailRecipients({
      users: [user('Head of IT Data Analytics', 'alfa')],
      by: 'name',
      values: ['Head of IT Data Analytics'],
    })
    expect(result.matched.map((item) => item.user.id)).toEqual(['alfa'])
    expect(result.missing).toEqual([])
  })

  it('reports a missing head', () => {
    const result = matchUrdReviewHeads([user('Head of Business Project & research', 'research')])
    expect(result.missing).toEqual(['Head of Business Project Management Office'])
  })

  it('joins the AI summary paragraphs', () => {
    expect(urdReviewSummaryText(['  Brief  ', '', 'Value'])).toBe('Brief\n\nValue')
  })

  it('keeps only the selected URD section and drops the cover', () => {
    const urd = [
      'User Requirement Document',
      'Confidentiality',
      'This document contains proprietary information.',
      'Section A',
      'Nama Proyek | Helpdesk',
      'Section B',
      'Problem Definition',
      'Masalah manual.',
    ].join('\n')
    const body = composeUrdEmailBody({
      config: { source: 'sections', documentKind: 'URD', sections: ['Problem Definition'], fixedText: '', includeCover: false },
      summary: 'Ringkasan',
      urdText: urd,
    })
    expect(body).toContain('Problem Definition')
    expect(body).toContain('Masalah manual.')
    expect(body).not.toContain('Confidentiality')
    expect(body).not.toContain('Section A')
  })

  it('takes one kind per template code, including kinds beyond URD', () => {
    expect(emailDocumentKindsFromTemplates([
      { template_code: 'urd-adirafinancews-requirement-v1', has_attachment: true },
      { template_code: 'urd-adirafinancews-requirement-v2', has_attachment: true },
      { template_code: 'srd-adirafinancews-simplified-v1', has_attachment: true },
      { template_code: 'brd-example', has_attachment: false },
    ])).toEqual(['SRD', 'URD'])
    expect(parseIdeaEmailDocumentKind('srd')).toBe('SRD')
    expect(parseIdeaEmailDocumentKind('not a kind')).toBe('URD')
  })

  it('lists template headings, including the cover, for the email picker', () => {
    const parts = templateEmailParts([
      'User Requirement Document',
      'PT Adira Dinamika Multifinance',
      'Confidentiality',
      'Company confidential.',
      'Problem Definition',
      'Masalah manual.',
    ].join('\n'))
    expect(parts.map((part) => part.heading)).toEqual([
      'User Requirement Document',
      'PT Adira Dinamika Multifinance',
      'Confidentiality',
      'Problem Definition',
    ])
    expect(parts.filter((part) => part.cover).map((part) => part.heading)).toEqual([
      'User Requirement Document',
      'PT Adira Dinamika Multifinance',
      'Confidentiality',
    ])
    expect(parts[3]?.preview).toContain('Masalah manual.')
  })

  it('lets an Idea trigger include everyone, or only a matching team', () => {
    const viewer = user('Analyst', 'alfa')
    expect(ideaAudienceMatches({ user: viewer, by: 'jobTitle', values: [] })).toBe(true)
    expect(ideaAudienceMatches({
      user: viewer,
      by: 'team',
      values: ['Business Relationship'],
      memberships: [{ subject_id: 'alfa', operational_team_display_name: 'Business Relationship' }],
    })).toBe(true)
    expect(ideaAudienceMatches({
      user: viewer,
      by: 'department',
      values: ['Finance'],
    })).toBe(false)
    expect(ideaAudienceMatches({
      user: viewer,
      by: 'workspace',
      values: ['Adira Finance WS'],
      workspaces: ['00000000-0000-0000-0001-000000000100', 'Adira Finance WS'],
    })).toBe(true)
    expect(ideaAudienceMatches({
      user: viewer,
      by: 'workspace',
      values: ['Operations'],
      workspaces: ['Adira Finance WS'],
    })).toBe(false)
  })
})
