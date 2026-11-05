import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { IdeaSectionVisibilityEditor } from './WorkflowBuilderCanvas'
import { DEFAULT_IDEA_NAV_SECTIONS, DEFAULT_IDEA_SECTION_AUDIENCE, type IdeaPanelKey } from '@/modules/project-management/lib/ideaPanelCatalog'

it('reorders hidden and visible rows, resets order, and opts out without changing visibility', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  let saved: IdeaPanelKey[] | undefined
  function Harness() {
    const [order, setOrder] = useState<IdeaPanelKey[]>()
    return createElement(IdeaSectionVisibilityEditor, {
      value: { document: 'hide' }, order, audience: DEFAULT_IDEA_SECTION_AUDIENCE,
      onChange: () => { throw new Error('Reordering must not change visibility') },
      onAudienceChange: () => { throw new Error('Reordering must not change audience') },
      onOrderChange: next => { saved = next; setOrder(next) },
    })
  }
  try {
    await act(async () => root.render(createElement(Harness)))
    const button = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
    await act(async () => button('Move Docs up').click())
    expect(saved?.slice(-2)).toEqual(['document', 'conversion'])
    const rows = [...host.querySelectorAll('li')]
    expect(rows[5].textContent).toContain('Docs')
    expect(rows[5].textContent).toContain('Hide')
    expect((host.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
    await act(async () => button('Reset section order').click())
    expect(saved).toEqual(DEFAULT_IDEA_NAV_SECTIONS)
    await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click())
    expect(saved).toBeUndefined()
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
