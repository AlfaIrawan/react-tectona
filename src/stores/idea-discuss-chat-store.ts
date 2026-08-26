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
  const description = binding.ideaDescription.trim()
  if (description) notes.push(`Idea description: ${description.slice(0, 4000)}`)
  const section = binding.currentSectionContent.trim() || 'No section analysis is available yet.'
  notes.push(`Current ${binding.sectionLabel} content:\n${section.slice(0, 12000)}`)
  return notes
}
