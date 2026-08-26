import {
  createIdeaSectionRevision,
  getIdeaById,
  transitionIdeaSectionRevision,
  type IdeaSectionKey,
} from '@/lib/api/ideaBacklogApi'

export const IDEA_SECTION_REVISION_UPDATED_EVENT = 'tectona:idea-section-revision-updated'

const IDEA_SECTION_KEYS: readonly IdeaSectionKey[] = [
  'summary',
  'scoring',
  'impact',
  'integration',
  'process',
  'costBenefit',
  'conversion',
  'document',
]

const PROTECTED_IMPACT_SCORE_LINE = /^\s*(business\s+value|effort|risk|roi)\s*:/im

export function isIdeaSectionKey(value: string): value is IdeaSectionKey {
  return IDEA_SECTION_KEYS.includes(value as IdeaSectionKey)
}

export function dispatchIdeaSectionRevisionUpdated(ideaId: string, sectionKey: string) {
  window.dispatchEvent(
    new CustomEvent(IDEA_SECTION_REVISION_UPDATED_EVENT, {
      detail: { ideaId, sectionKey },
    }),
  )
}

export async function applyIdeaSectionRevisionFromChat(payload: {
  ideaId: string
  sectionKey: string
  content: string
  transition: 'accept' | 'reject'
  sourceSessionId?: string | null
  isImpactSection?: boolean
}): Promise<string> {
  const sectionKey = payload.sectionKey.trim()
  if (!isIdeaSectionKey(sectionKey)) {
    throw new Error(`Section "${payload.sectionKey}" cannot store a revision from chat.`)
  }
  const content = payload.content.trim()
  if (!content) throw new Error('No proposal content to apply.')
  if (payload.isImpactSection && PROTECTED_IMPACT_SCORE_LINE.test(content)) {
    throw new Error(
      'The AI proposal attempted to include protected scoring fields. Ask the agent to revise the Impact narrative without changing scores.',
    )
  }

  const idea = await getIdeaById(payload.ideaId)
  const body = {
    content_json: { text: content },
    source: 'ai' as const,
    base_idea_version: idea.version,
    source_session_id: payload.sourceSessionId ?? null,
  }

  let created
  try {
    created = await createIdeaSectionRevision(payload.ideaId, sectionKey, body)
  } catch (error) {
    if (!(error instanceof Error) || !/version conflict/i.test(error.message)) throw error
    const latest = await getIdeaById(payload.ideaId)
    created = await createIdeaSectionRevision(payload.ideaId, sectionKey, {
      ...body,
      base_idea_version: latest.version,
    })
  }

  await transitionIdeaSectionRevision(payload.ideaId, sectionKey, created.id, payload.transition)
  dispatchIdeaSectionRevisionUpdated(payload.ideaId, sectionKey)
  const label = payload.transition === 'accept' ? 'accepted' : 'rejected'
  return `The ${sectionKey} proposal was ${label}.`
}
