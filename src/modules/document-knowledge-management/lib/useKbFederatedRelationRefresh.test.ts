import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useKbFederatedRelationRefresh } from './useKbFederatedRelationRefresh'

it('refreshes once per committed federated scope or loader change, but not in focused mode', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const root = createRoot(document.createElement('div'))
  const calls: string[] = []
  const loadA = async () => { calls.push('workspace-id-a') }
  const loadB = async () => { calls.push('workspace-id-b') }

  function Harness({ enabled, scope, refresh }: { enabled: boolean; scope: string; refresh: () => Promise<void> }) {
    useKbFederatedRelationRefresh(enabled, scope, refresh)
    return null
  }
  const render = (enabled: boolean, scope: string, refresh: () => Promise<void>) =>
    act(async () => root.render(createElement(Harness, { enabled, scope, refresh })))

  try {
    await render(true, 'all', loadA)
    await render(true, 'all', loadA)
    expect(calls).toEqual(['workspace-id-a'])
    await render(true, 'Display label A', loadA)
    expect(calls).toEqual(['workspace-id-a', 'workspace-id-a'])
    await render(true, 'Display label B', loadB)
    expect(calls).toEqual(['workspace-id-a', 'workspace-id-a', 'workspace-id-b'])
    await render(false, 'Display label B', loadB)
    await render(false, 'all', loadA)
    expect(calls).toEqual(['workspace-id-a', 'workspace-id-a', 'workspace-id-b'])
    await render(true, 'all', loadA)
    expect(calls).toEqual(['workspace-id-a', 'workspace-id-a', 'workspace-id-b', 'workspace-id-a'])
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
