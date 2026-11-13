import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { IdeaTriggerInputFields } from './IdeaTriggerInputFields'

it('saves the workspace and requirement into the existing trigger config and restores them', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const options = [{ id: 'bp', name: 'IT Business Partner WS' }, { id: 'portfolio', name: 'IT Portfolio WS' }]
  let config = { triggerEvent: 'Before Idea Creation', ideaTriggerInputs: '' }
  const render = () => root.render(createElement(IdeaTriggerInputFields, {
    options, value: config.ideaTriggerInputs, onChange: (patch) => {
      config = { ...config, ...patch }
      render()
    },
  }))
  try {
    await act(async () => render())
    await act(async () => container.querySelector('button')!.click())
    const change = async (index: number, value: string) => act(async () => {
      const control = container.querySelectorAll('select')[index]
      control.value = value
      control.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await change(0, 'portfolio')
    await change(1, 'mandatory')
    expect(config.triggerEvent).toBe('Before Idea Creation')
    const saved = JSON.parse(JSON.stringify({ nodes: [{ data: { kind: 'trigger', config } }] }))
    expect(JSON.parse(saved.nodes[0].data.config.ideaTriggerInputs)).toEqual([
      { key: 'ticket_number', label: 'Nomor Ticket', workspace_id: 'portfolio', requirement: 'mandatory' },
    ])
    config = saved.nodes[0].data.config
    await act(async () => render())
    expect(Array.from(container.querySelectorAll('select'), (select) => select.value)).toEqual(['portfolio', 'mandatory'])
    await change(1, 'optional')
    expect(JSON.parse(config.ideaTriggerInputs)[0].requirement).toBe('optional')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
