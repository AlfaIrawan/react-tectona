import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listenForDiagramMenuDismissal, orderDiagramNode } from './diagramContextMenuActions'

describe('diagram layer menu actions', () => {
  const nodes = [{ id: 'parent', zIndex: -2 }, { id: 'a', zIndex: 0 }, { id: 'b', zIndex: 0 }, { id: 'c', zIndex: 1 }]
  it.each([
    ['front', ['parent', 'a', 'c', 'b']],
    ['back', ['b', 'parent', 'a', 'c']],
    ['forward', ['parent', 'a', 'c', 'b']],
    ['backward', ['parent', 'b', 'a', 'c']],
  ] as const)('%s moves the intended node through tied and negative stacking values', (action, expected) => {
    const result = orderDiagramNode(nodes, 'b', action)
    expect([...result].sort((a, b) => a.zIndex! - b.zIndex!).map(node => node.id)).toEqual(expected)
    expect(result.map(node => node.id)).toEqual(nodes.map(node => node.id))
    expect(nodes[2].zIndex).toBe(0)
  })
  it('keeps bounds stable and ignores missing nodes', () => {
    expect(orderDiagramNode(nodes, 'missing', 'front')).toBe(nodes)
    expect(orderDiagramNode(nodes, 'parent', 'backward').map(node => node.zIndex)).toEqual([0, 1, 2, 3])
    expect(orderDiagramNode(nodes, 'c', 'forward').map(node => node.zIndex)).toEqual([0, 1, 2, 3])
  })
})

describe('diagram context menu dismissal', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => { cleanup?.(); document.body.innerHTML = '' })
  it('dismisses on Escape, outside pointer and blur but not menu interactions or other keys', () => {
    const close = vi.fn()
    cleanup = listenForDiagramMenuDismissal(close)
    document.body.innerHTML = '<div data-diagram-context-menu><button>Option</button></div>'
    document.querySelector('button')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(close).not.toHaveBeenCalled()
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    window.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    window.dispatchEvent(new Event('blur'))
    expect(close).toHaveBeenCalledTimes(3)
    cleanup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(close).toHaveBeenCalledTimes(3)
  })
})

describe('editor command wiring regressions', () => {
  const source = (name: string) => readFileSync(resolve(process.cwd(), `src/modules/project-management/components/${name}.tsx`), 'utf8')
  it.each(['EditableDiagramCanvas', 'EditableIntegrationArchitectureCanvas'])('%s clears only the insertion default, not existing node appearance', name => {
    const body = source(name).split('const clearDefaultStyle = useCallback(')[1].split('const paste')[0]
    expect(body).toContain('setDefaultElementStyle(null)')
    expect(body).not.toContain('setNodes')
    expect(body).not.toContain('markCustomized')
    expect(source(name)).toContain('orderDiagramNode(current, selectedNodeId, action)')
    expect(source(name)).toContain('listenForDiagramMenuDismissal(')
  })
  it('does not attach mutation context menus or render stale menus in a read-only preview', () => {
    const code = source('EditableDiagramCanvas')
    for (const target of ['Pane', 'Node', 'Edge']) expect(code).toContain(`on${target}ContextMenu={editable ? handle${target}ContextMenu : undefined}`)
    expect(code).toContain('{editable && canvasMenu ? (')
    expect(code).toContain('{editable && edgeContextMenu ? (')
    expect(code).toContain('{editable && c4NodeMenu && c4MenuNode &&')
  })
})
