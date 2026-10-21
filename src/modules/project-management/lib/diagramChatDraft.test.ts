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

// Alfa, 21 Oct 2026: "Ask Gen AI" on the ArchiMate integration canvas uses the same drafts.
const reply = (json: object) => `Berikut usulannya.\n\n\`\`\`tectona-diagram-draft\n${JSON.stringify(json)}\n\`\`\``

describe('ArchiMate diagram drafts', () => {
  it('accepts ArchiMate types for the integration view', () => {
    const draft = parseDiagramChatDraft(reply({
      diagramKey: 'integration',
      summary: 'Tambah layanan chat',
      actions: [
        { type: 'add_node', id: 'svc_chat', notation: 'Application Service', title: 'Layanan Chat' },
        { type: 'add_node', id: 'srv', notation: 'Technology Node', title: 'Server DigiLearn' },
        { type: 'update_node', nodeId: 'digilearn', notation: 'Application Component', title: 'DigiLearn' },
        { type: 'add_edge', id: 'e1', source: 'svc_chat', target: 'proc_tanya', label: 'Serving' },
      ],
    }))
    expect(draft?.diagramKey).toBe('integration')
    expect(draft?.actions.length).toBe(4)
  })

  it('drops an unknown notation and keeps the rest', () => {
    const draft = parseDiagramChatDraft(reply({
      diagramKey: 'integration',
      actions: [
        { type: 'add_node', id: 'p1', notation: 'Business Process', title: 'Tanya policy' },
        { type: 'add_node', id: 'x1', notation: 'Spaceship', title: 'Nope' },
      ],
    }))
    expect(draft?.actions.map((action) => action.type === 'add_node' ? action.id : '')).toEqual(['p1'])
  })
})
