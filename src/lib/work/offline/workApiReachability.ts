import { WorkApiTransportError, WorkItemVersionConflictError } from '@/lib/api/workApi'

/** Browser "online" does not mean the work API is reachable (service stopped, proxy 502/500, etc.). */
export function isWorkApiUnavailableError(error: unknown): boolean {
  if (error instanceof WorkItemVersionConflictError) return false
  if (error instanceof WorkApiTransportError) return true

  if (error instanceof TypeError) return true

  if (error instanceof Error) {
    if (error.message === 'WORK_API_UNAVAILABLE') return true
    const msg = error.message.toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network error') ||
      msg.includes('load failed') ||
      msg.includes('econnrefused') ||
      msg.includes('work service unavailable') ||
      msg.includes('request failed (500)') ||
      msg.includes('request failed (502)') ||
      msg.includes('request failed (503)') ||
      msg.includes('request failed (504)') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('bad gateway') ||
      msg.includes('service unavailable') ||
      msg.includes('gateway timeout') ||
      msg.includes('internal server error')
    )
  }

  return false
}

export function isWorkDataOnline(browserOnline: boolean, apiReachable: boolean): boolean {
  return browserOnline && apiReachable
}
