import { ideaDiscussSessionId } from '@/stores/idea-discuss-chat-store'

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
  const preferredId = ideaDiscussSessionId(ideaId)
  return (
    conversations.find((c) => c.mode === 'genai' && !c.archived && c.id === preferredId)
    ?? conversations.find((c) => c.mode === 'genai' && !c.archived && titlesMatchIdeaSession(c.title, ideaTitle))
  )
}
