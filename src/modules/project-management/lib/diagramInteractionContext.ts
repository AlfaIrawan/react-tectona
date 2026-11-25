import { createContext, useContext } from 'react'

export type DiagramResizeConstraints = { minWidth: number; minHeight: number; keepAspectRatio: boolean }

export const DiagramInteractionContext = createContext<{
  showConnectionArrows: boolean
  showConnectionPoints: boolean
  beginResize: (nodeId: string, constraints: DiagramResizeConstraints) => void
  endResize: () => void
}>({
  showConnectionArrows: true,
  showConnectionPoints: true,
  beginResize: () => {},
  endResize: () => {},
})

export const useDiagramInteractions = () => useContext(DiagramInteractionContext)
