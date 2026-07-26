import { useEffect, useState } from 'react'
import type { WorkStatus } from '@/lib/api/workApi'

/** Canonical workflow statuses — Board columns & List Status field. */
export const WORK_STATUS_VALUES: WorkStatus[] = [
  'Backlog',
  'To Do',
  'In Progress',
  'In Review',
  'Done',
]

export type BoardColumnLabels = Partial<Record<WorkStatus, string>>

let boardColumnLabelsMemory: BoardColumnLabels = {}

export function loadBoardColumnLabels(): BoardColumnLabels {
  return { ...boardColumnLabelsMemory }
}

export function persistBoardColumnLabels(labels: BoardColumnLabels) {
  if (typeof window === 'undefined') return
  const payload: BoardColumnLabels = {}
  for (const status of WORK_STATUS_VALUES) {
    const value = labels[status]?.trim()
    if (value && value !== status) payload[status] = value
  }
  boardColumnLabelsMemory = payload
  window.dispatchEvent(new CustomEvent('tectona:board-column-labels-changed'))
}

/** Display label for status — uses Board rename if set, else canonical status. */
export function resolveWorkStatusDisplayLabel(
  status: WorkStatus,
  labels: BoardColumnLabels = loadBoardColumnLabels()
): string {
  return labels[status]?.trim() || status
}

export function isCustomWorkStatusLabel(
  status: WorkStatus,
  labels: BoardColumnLabels = loadBoardColumnLabels()
): boolean {
  return Boolean(labels[status]?.trim())
}

/** Reactive Board column labels — List view stays in sync after Board rename. */
export function useBoardColumnLabels(): BoardColumnLabels {
  const [labels, setLabels] = useState<BoardColumnLabels>(() => loadBoardColumnLabels())

  useEffect(() => {
    const refresh = () => setLabels(loadBoardColumnLabels())
    window.addEventListener('tectona:board-column-labels-changed', refresh)
    return () => window.removeEventListener('tectona:board-column-labels-changed', refresh)
  }, [])

  return labels
}
