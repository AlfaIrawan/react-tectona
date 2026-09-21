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

export function ideaDiscussSessionId(ideaId: string): string {
  return `genai-idea-${ideaId.trim()}`
}

export function ideaDiscussComposerPrefill(sectionLabel: string): string {
  return `Challenge the assumptions and rewrite the ${sectionLabel} section using only evidence available in Tectona and KB.`
}

export function buildIdeaDiscussExtraNotes(binding: IdeaDiscussChatBinding): string[] {
  const notes = [
    `You are reviewing the ${binding.sectionLabel} section for Idea & Backlog item "${binding.ideaTitle}".`,
    'Use Tectona data and knowledge-base evidence. Be explicit when evidence is missing. Never invent evidence, values, integrations, costs, or scores.',
    'Return a revised section narrative. Changes apply to the idea only after the user accepts the proposal card.',
  ]
  if (binding.isImpactSection) {
    notes.push(
      'Business Value, Effort, Risk, and ROI are official read-only scoring outputs. Do not propose or rewrite those score fields.',
    )
  }
  if (binding.sectionKey.startsWith('diagram:')) {
    notes.push(
      'For a requested C4 diagram change, include exactly one fenced `tectona-diagram-draft` JSON block. Its shape is {"diagramKey":"...","summary":"...","actions":[...]}. Allowed actions are add_node ({"type":"add_node","id":"unique_id","notation":"Person|System|System_Ext|SystemDb|Container|Container_Ext|ContainerDb|Component","title":"...","description":"..."}), update_node ({"type":"update_node","nodeId":"...", optional notation/title/description}), delete_node ({"type":"delete_node","nodeId":"..."}), add_edge ({"type":"add_edge","id":"unique_id","source":"...","target":"...","label":"..."}), and delete_edge ({"type":"delete_edge","edgeId":"..."}). Use only node and edge IDs present in the supplied diagram, except new unique IDs in add actions. The user must explicitly apply the draft before the canvas changes.',
    )
  }
  const description = binding.ideaDescription.trim()
  if (description) notes.push(`Idea description: ${description.slice(0, 4000)}`)
  const section = binding.currentSectionContent.trim() || 'No section analysis is available yet.'
  notes.push(`Current ${binding.sectionLabel} content:\n${section.slice(0, 12000)}`)
  return notes
}
