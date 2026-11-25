/** Stable ordering also works when adjacent nodes share a z-index or use negative values. */
export function orderDiagramNode<T extends { id: string; zIndex?: number }>(nodes: T[], nodeId: string, action: 'front' | 'back' | 'forward' | 'backward'): T[] {
  const ordered = [...nodes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  const index = ordered.findIndex(node => node.id === nodeId)
  if (index < 0) return nodes
  const [selected] = ordered.splice(index, 1)
  const destination = action === 'front' ? ordered.length : action === 'back' ? 0 : action === 'forward' ? Math.min(index + 1, ordered.length) : Math.max(index - 1, 0)
  ordered.splice(destination, 0, selected)
  // Preserve React Flow's parent-before-child array order; only update stacking values.
  const zIndexes = new Map(ordered.map((node, zIndex) => [node.id, zIndex]))
  return nodes.map(node => ({ ...node, zIndex: zIndexes.get(node.id)! }))
}

export function listenForDiagramMenuDismissal(close: () => void): () => void {
  const pointer = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest('[data-diagram-context-menu]')) return
    close()
  }
  const key = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    close()
  }
  window.addEventListener('pointerdown', pointer)
  window.addEventListener('keydown', key)
  window.addEventListener('blur', close)
  return () => {
    window.removeEventListener('pointerdown', pointer)
    window.removeEventListener('keydown', key)
    window.removeEventListener('blur', close)
  }
}
