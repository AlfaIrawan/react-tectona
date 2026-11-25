// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { WorkspaceTypeFilter, WorkspaceReadNotice } from './WorkspaceManagementReadControls'
import { workspaceReadFailure } from '../lib/workspaceManagementReadState'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

it.each([
  { label: 'Filter asset types', menuTitle: 'Asset types', options: ['Policy', 'Template'] },
  { label: 'Filter workspace types', menuTitle: 'Workspace types', options: ['Division', 'Organization'] },
])('opens and applies the $menuTitle filter, clears it, and closes on Escape', async ({ label, menuTitle, options }) => {
  function Panel() {
    const [selected, setSelected] = useState(new Set<string>())
    return <>
      <WorkspaceTypeFilter label={label} menuTitle={menuTitle} options={options} selected={selected}
        onToggle={(type) => setSelected(new Set([type]))} onClear={() => setSelected(new Set())} />
      <output>{Array.from(selected).join(',') || 'all assets'}</output>
    </>
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => { root.render(<Panel />) })
  const trigger = host.querySelector('button')!
  expect(trigger.getAttribute('aria-label')).toBe(label)
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  await act(async () => { trigger.click() })
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  await act(async () => { host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click() })
  expect(host.querySelector('output')?.textContent).toBe(options[0])
  await act(async () => { [...host.querySelectorAll('button')].find((node) => node.textContent?.includes('Show all'))!.click() })
  expect(host.querySelector('output')?.textContent).toBe('all assets')
  await act(async () => { trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  expect(host.querySelector('input')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  await act(async () => { root.unmount() })
  host.remove()
})

it('shows a service-specific failure and invokes retry without submitting a surrounding form', async () => {
  let attempts = 0
  let submits = 0
  function Panel() {
    const [ready, setReady] = useState(false)
    return <form onSubmit={(e) => { e.preventDefault(); submits++ }}>
      {ready ? <select aria-label="Primary organization"><option>QA fixture</option></select>
      : <WorkspaceReadNotice title="Organizations could not be loaded"
          state={workspaceReadFailure('The organization directory', { status: 429 })}
          onRetry={() => { attempts++; setReady(true) }} />}
    </form>
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => { root.render(<Panel />) })
  expect(host.querySelector('[role=alert]')?.textContent).toContain('HTTP 429')
  await act(async () => { host.querySelector('button')!.click() })
  expect(attempts).toBe(1)
  expect(submits).toBe(0)
  expect(host.querySelector('select')?.textContent).toBe('QA fixture')
  await act(async () => { root.unmount() })
  host.remove()
})
