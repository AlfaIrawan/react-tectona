import { describe, expect, it } from 'vitest'
import { parseDiagramChatDraft } from './diagramChatDraft'

describe('parseDiagramChatDraft', () => {
  it('accepts a valid structured C4 draft', () => {
    const draft = parseDiagramChatDraft(
      '```tectona-diagram-draft\n'
      + '{"diagramKey":"c4-level-1","actions":[{"type":"add_node","id":"chat","notation":"System","title":"Chat"},{"type":"add_edge","id":"rel_chat","source":"person","target":"chat","label":"uses"}]}\n'
      + '```',
    )
    expect(draft?.diagramKey).toBe('c4-level-1')
    expect(draft?.actions).toHaveLength(2)
  })

  it('rejects a draft with an unsupported notation or malformed actions', () => {
    expect(parseDiagramChatDraft('```tectona-diagram-draft\n{"diagramKey":"c4-level-1","actions":[{"type":"add_node","id":"x","notation":"Unknown","title":"X"}]}\n```')).toBeNull()
    expect(parseDiagramChatDraft('```tectona-diagram-draft\nnot json\n```')).toBeNull()
  })

  it('does not accept an edge that links a node to itself', () => {
    expect(parseDiagramChatDraft('```tectona-diagram-draft\n{"diagramKey":"c4-level-1","actions":[{"type":"add_edge","id":"self","source":"a","target":"a"}]}\n```')).toBeNull()
  })
})
