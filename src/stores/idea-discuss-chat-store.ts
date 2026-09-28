import { create } from 'zustand'

export type IdeaDiscussChatBinding = {
  conversationId: string
  ideaId: string
  ideaTitle: string
  sectionKey: string
  sectionLabel: string
  ideaDescription: string
  currentSectionContent: string
  workspaceId?: string | null
  userId?: string | null
  isImpactSection: boolean
}

type IdeaDiscussChatState = {
  binding: IdeaDiscussChatBinding | null
  setBinding: (binding: IdeaDiscussChatBinding | null) => void
}

export const useIdeaDiscussChatStore = create<IdeaDiscussChatState>((set) => ({
  binding: null,
  setBinding: (binding) => set({ binding }),
}))

/**
 * Every "Discuss with AI" session for an idea starts with this prefix. The
 * session list only returns the signed-in user's sessions, so a prefix match is
 * always one of theirs (including legacy ids that were exactly this prefix).
 */
export function ideaDiscussSessionId(ideaId: string): string {
  return `genai-idea-${ideaId.trim()}`
}

/**
 * A new session id for an idea discussion. It carries the user and a creation
 * stamp: a bare per-idea id was shared by everyone discussing the idea (their
 * turns landed in one session, owned by whoever wrote last) and, once deleted,
 * silently swallowed every later message because the server keeps deleted
 * sessions deleted.
 */
export function newIdeaDiscussSessionId(ideaId: string, userId: string | null | undefined): string {
  const user = (userId ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'anon'
  return `${ideaDiscussSessionId(ideaId)}-${user}-${Date.now().toString(36)}`
}

export function isIdeaDiscussSessionFor(sessionId: string, ideaId: string): boolean {
  const prefix = ideaDiscussSessionId(ideaId)
  return sessionId === prefix || sessionId.startsWith(`${prefix}-`)
}

export function ideaDiscussComposerPrefill(sectionLabel: string, sectionKey?: string): string {
  // Scoring starts from the opening's suggestions (agent-runtime scoring_discussion):
  // "rewrite the section" would ask for the one thing chat must not do there.
  if (sectionKey === 'scoring') return ''
  return `Challenge the assumptions and rewrite the ${sectionLabel} section using only evidence available in Tectona and KB.`
}

/**
 * The section discussion as data for the chat UI context. agent-runtime builds
 * the instructions from it (agent/idea_section_discussion.py): prompts do not
 * live in the frontend, and page notes can be trimmed while these fields are not.
 */
export function buildIdeaDiscussUiFields(binding: IdeaDiscussChatBinding) {
  return {
    entity_type: 'idea',
    entity_id: binding.ideaId,
    entity_title: binding.ideaTitle,
    discussion_section_key: binding.sectionKey,
    discussion_section_label: binding.sectionLabel,
    discussion_section_content: binding.currentSectionContent.trim().slice(0, 12000),
    discussion_idea_description: binding.ideaDescription.trim().slice(0, 4000),
  }
}

/** Diagram-draft format note, for C4 diagram discussions only (pre-existing). */
export function buildIdeaDiscussExtraNotes(binding: IdeaDiscussChatBinding): string[] {
  const notes: string[] = []
  if (binding.sectionKey.startsWith('diagram:')) {
    notes.push(
      'For a requested C4 diagram change, include exactly one fenced `tectona-diagram-draft` JSON block. Its shape is {"diagramKey":"...","summary":"...","actions":[...]}. Allowed actions are add_node ({"type":"add_node","id":"unique_id","notation":"Person|System|System_Ext|SystemDb|Container|Container_Ext|ContainerDb|Component","title":"...","description":"..."}), update_node ({"type":"update_node","nodeId":"...", optional notation/title/description}), delete_node ({"type":"delete_node","nodeId":"..."}), add_edge ({"type":"add_edge","id":"unique_id","source":"...","target":"...","label":"..."}), and delete_edge ({"type":"delete_edge","edgeId":"..."}). Use only node and edge IDs present in the supplied diagram, except new unique IDs in add actions. The user must explicitly apply the draft before the canvas changes.',
    )
  }
  return notes
}
