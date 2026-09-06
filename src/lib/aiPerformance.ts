export type PerformanceEvent = {
  id: string
  model: string
  provider: string
  provider_id?: string
  interaction: string
  status: 'success' | 'failed' | 'timeout' | 'rate_limited' | 'cancelled' | null
  latency_ms: number | null
  retry_count: number | null
  occurred_at: string
}
export const P95_HELP = '95% of your AI interactions completed within this response time.'
export function latencyValues(events: PerformanceEvent[]) {
  return events.flatMap(event => Number.isFinite(event.latency_ms) && event.latency_ms !== null && event.latency_ms >= 0 ? [event.latency_ms] : [])
}
export function summarizePerformance(events: PerformanceEvent[]) {
  const values = latencyValues(events).sort((a,b) => a-b)
  // Cancelled requests are not provider failures and have a separate diagnostic.
  const outcomes = events.filter(event => event.status && event.status !== 'cancelled')
  const retries = events.filter(event => event.retry_count !== null && event.retry_count >= 0)
  const percent = (status: string) => outcomes.length ? outcomes.filter(event => event.status === status).length / outcomes.length * 100 : null
  const average = values.length ? values.reduce((sum,value) => sum+value,0) / values.length : null
  const success = percent('success')
  return {
    average, p95: values.length >= 2 ? values[Math.ceil(values.length * .95)-1] : null,
    success, failed: outcomes.length ? outcomes.filter(event => event.status !== 'success').length / outcomes.length * 100 : null,
    failedCount: outcomes.filter(event => event.status !== 'success').length,
    error: percent('failed'), timeout: percent('timeout'), rateLimited: percent('rate_limited'),
    retried: retries.length ? retries.filter(event => (event.retry_count ?? 0) > 0).length / retries.length * 100 : null,
    cancelled: events.length ? events.filter(event => event.status === 'cancelled').length / events.length * 100 : null,
    health: success === null ? null : success < 97 ? 'Critical' : success < 99 ? 'Degraded' : 'Healthy',
  }
}
export function performancePeriods(events: PerformanceEvent[], days: number, now: number) {
  const boundary = now-days*86400000
  return {
    current: events.filter(event => { const at=Date.parse(event.occurred_at); return at >= boundary && at <= now }),
    previous: events.filter(event => { const at=Date.parse(event.occurred_at); return at >= boundary-days*86400000 && at < boundary }),
  }
}
export function responseComparison(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) return 'Not enough previous-period data'
  const delta=(current-previous)/previous*100
  return `${delta < 0 ? '↓' : delta > 0 ? '↑' : '—'} ${Math.abs(delta).toFixed(1)}% vs previous period`
}
