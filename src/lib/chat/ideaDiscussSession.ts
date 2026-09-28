import { ideaDiscussSessionId, isIdeaDiscussSessionFor } from '@/stores/idea-discuss-chat-store'

export function titlesMatchIdeaSession(title: string, ideaTitle: string): boolean {
  const left = title.trim().toLowerCase()
  const right = ideaTitle.trim().toLowerCase()
  return Boolean(left) && left === right
}

export function findGenAiConversationForIdea<T extends { id: string; mode: string; title: string; archived?: boolean }>(
  conversations: T[],
  ideaId: string,
  ideaTitle: string,
): T | undefined {
  // Local state may still hold a legacy bare per-idea id that belongs to someone
  // else on the server; only the (user-scoped) session list may confirm those.
  const legacyId = ideaDiscussSessionId(ideaId)
  const usable = (c: T) => c.mode === 'genai' && !c.archived && c.id !== legacyId
  return (
    conversations.find((c) => usable(c) && isIdeaDiscussSessionFor(c.id, ideaId))
    ?? conversations.find((c) => usable(c) && titlesMatchIdeaSession(c.title, ideaTitle))
  )
}
