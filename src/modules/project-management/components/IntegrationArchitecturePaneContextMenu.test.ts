import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ReactFlowProvider } from 'reactflow'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IntegrationArchitectureFlow } from './IntegrationArchitectureFlow'
// No renderer mock: verifies ReactFlow's actual pane/d3 context-menu dispatch.
let host: HTMLDivElement, root: Root
beforeEach(() => {
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
 vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
 vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600)
 vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
 vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('dispatches a stationary right-click on the actual pane, including after toggling pan mode', async () => {
 const onContext = vi.fn((event: React.MouseEvent) => event.preventDefault())
 await act(async () => root.render(createElement(ReactFlowProvider, null, createElement(IntegrationArchitectureFlow, { nodes: [], edges: [], showGrid: false, showRuler: false, defaultViewport: { x: 0, y: 0, zoom: 1 }, onPaneContextMenu: onContext }))))
 const pane = host.querySelector('.react-flow__pane')!
 expect(pane).toBeTruthy()
 const rightClick = async () => { for (const type of ['mousedown','mouseup','contextmenu']) await act(async () => pane.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 2, buttons: type === 'mousedown' ? 2 : 0, clientX: 320, clientY: 240 }))) }
 await rightClick(); expect(onContext).toHaveBeenCalledTimes(1)
 const pan = [...host.querySelectorAll('button')].find(b => /pan/i.test(b.title + b.getAttribute('aria-label')))
 if (!pan) throw new Error('Pan-mode toolbar button missing')
 await act(async () => pan.click()); await rightClick(); expect(onContext).toHaveBeenCalledTimes(2)
})
