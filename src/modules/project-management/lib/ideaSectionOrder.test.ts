import { createElement, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IDEA_NAV_SECTIONS, ideaMenuForWorkflowAudience, moveIdeaSection,
  readIdeaSectionOrder, resolveIdeaNavSections, applyIdeaSectionOverrides,
} from './ideaPanelCatalog'
import { ideaSectionOrderFromGraph } from './ideaDocumentWorkflowGate'
import { IdeaSectionOrderControls } from '@/modules/workflow-automation-engine/components/IdeaSectionOrderControls'

describe('workflow section order', () => {
  it('normalizes known keys without duplicates and appends missing sections', () => {
    expect(readIdeaSectionOrder('["document","bad","document","diagrams",null]')).toEqual([
      'document', 'diagrams', 'summary', 'scoring', 'impact', 'costBenefit', 'conversion',
    ])
    expect(resolveIdeaNavSections(['document', 'document'])).toHaveLength(7)
  })

  it.each([undefined, null, '', 'bad JSON', '{}', '[]', ['unknown'], 42])('keeps legacy order for absent or invalid config %s', (raw) => {
    expect(readIdeaSectionOrder(raw)).toBeUndefined()
  })

  it('uses the configured order before visibility and audience filtering', () => {
    const map = Object.fromEntries(DEFAULT_IDEA_NAV_SECTIONS.map(key => [key, key === 'document' ? 'show' : 'hide']))
    const order = readIdeaSectionOrder(['document', 'diagrams'])!
    expect(ideaMenuForWorkflowAudience(['diagrams', 'document'], map, ['Business Partner'], null, order)).toEqual(['document', 'diagrams'])
    expect(ideaMenuForWorkflowAudience(undefined, map, [], null, order)).toEqual(['document'])
    // Without a configured order, existing browser preferences remain valid.
    expect(ideaMenuForWorkflowAudience(['diagrams', 'document'], map, ['Business Partner'], null)).toEqual(['diagrams', 'document'])
  })

  it('keeps section positions after a runtime show/hide change', () => {
    const order = readIdeaSectionOrder(['document', 'summary', 'diagrams'])!
    const { visibility, audience } = applyIdeaSectionOverrides({}, null, { document: { visibility: 'hide' } })
    expect(ideaMenuForWorkflowAudience(undefined, visibility, ['Business Partner'], audience, order)[0]).toBe('summary')
    const shown = applyIdeaSectionOverrides(visibility, audience, { document: { visibility: 'show' } })
    expect(ideaMenuForWorkflowAudience(undefined, shown.visibility, ['Business Partner'], shown.audience, order)[0]).toBe('document')
  })

  it('moves one position without mutating input or crossing list boundaries', () => {
    const before = [...DEFAULT_IDEA_NAV_SECTIONS]
    expect(moveIdeaSection(before, 'document', -1).slice(-2)).toEqual(['document', 'conversion'])
    expect(moveIdeaSection(before, 'document', 1)).toEqual(before)
    expect(moveIdeaSection(before, 'summary', -1)).toEqual(before)
    expect(before).toEqual(DEFAULT_IDEA_NAV_SECTIONS)
  })

  it('reads persisted trigger config without treating action or disabled nodes as policy', () => {
    const config = { triggerType: 'Event', triggerDomain: 'AI Idea & Prioritization', triggerEntity: 'Idea', ideaSectionOrder: JSON.stringify(['document', 'diagrams']) }
    const graph = { nodes: [{ id: 'start', data: { kind: 'trigger', config } }], edges: [] }
    const reloaded = JSON.parse(JSON.stringify(graph))
    expect(ideaSectionOrderFromGraph(reloaded)?.slice(0, 2)).toEqual(['document', 'diagrams'])
    reloaded.nodes[0].data.disabled = true
    expect(ideaSectionOrderFromGraph(reloaded)).toBeUndefined()
    reloaded.nodes[0].data.disabled = false
    reloaded.nodes[0].data.kind = 'action'
    expect(ideaSectionOrderFromGraph(reloaded)).toBeUndefined()
  })

  it('updates from the arrow controls and disables unavailable moves', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let saved = [...DEFAULT_IDEA_NAV_SECTIONS]
    function Harness() {
      const [order, setOrder] = useState(saved)
      return createElement('div', {}, ...order.map(section => createElement(IdeaSectionOrderControls, {
        key: section, section, order,
        onChange: next => { saved = next; setOrder(next) },
      })))
    }
    try {
      await act(async () => root.render(createElement(Harness)))
      const button = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
      expect(button('Move Summary up').disabled).toBe(true)
      expect(button('Move Docs down').disabled).toBe(true)
      await act(async () => button('Move Docs up').click())
      expect(saved.slice(-2)).toEqual(['document', 'conversion'])
      expect(button('Move Docs down').disabled).toBe(false)
      await act(async () => button('Move Docs down').click())
      expect(saved).toEqual(DEFAULT_IDEA_NAV_SECTIONS)
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})
