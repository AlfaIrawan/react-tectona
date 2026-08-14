import type { WorkItemApiModel } from '@/lib/api/workApi'

let clipboardItem: WorkItemApiModel | null = null

export function setCalendarTaskClipboard(item: WorkItemApiModel) {
  clipboardItem = { ...item }
}

export function getCalendarTaskClipboard(): WorkItemApiModel | null {
  return clipboardItem
}

export function hasCalendarTaskClipboard(): boolean {
  return clipboardItem !== null
}

export function clearCalendarTaskClipboard() {
  clipboardItem = null
}
