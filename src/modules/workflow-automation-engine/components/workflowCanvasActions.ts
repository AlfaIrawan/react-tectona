import { createContext, useContext } from 'react'

export type WorkflowWaypoint = { x: number; y: number }

type WorkflowCanvasActions = {
  setEdgeWaypoints: (edgeId: string, waypoints: WorkflowWaypoint[]) => void
  setEdgeAnchor: (edgeId: string, endpoint: 'source' | 'target', portId: string) => void
}

const WorkflowCanvasActionsContext = createContext<WorkflowCanvasActions | null>(null)

export const WorkflowCanvasActionsProvider = WorkflowCanvasActionsContext.Provider

export function useWorkflowCanvasActions(): WorkflowCanvasActions | null {
  return useContext(WorkflowCanvasActionsContext)
}
