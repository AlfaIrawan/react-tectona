import { describe, expect, it } from 'vitest'
import { performancePeriods, responseComparison, summarizePerformance, type PerformanceEvent } from './aiPerformance'

const event=(overrides:Partial<PerformanceEvent>={}):PerformanceEvent=>({id:'1',model:'exact/model',provider:'test',interaction:'AI Assistant',status:'success',latency_ms:2000,retry_count:0,occurred_at:'2026-09-06T00:00:00Z',...overrides})
describe('AI performance calculations',()=>{
  it('uses unknown values instead of invented KPIs',()=>{
    expect(summarizePerformance([])).toMatchObject({average:null,p95:null,success:null,retried:null,health:null})
    expect(responseComparison(2000,null)).toBe('Not enough previous-period data')
  })
  it('counts retried invocations, not number of retries',()=>{
    const result=summarizePerformance([event({retry_count:5}),event()])
    expect(result.retried).toBe(50)
    expect(result.p95).toBe(2000)
  })
  it('includes failures without latency and excludes cancellation from success denominator',()=>{
    const result=summarizePerformance([event(),event({status:'timeout',latency_ms:null}),event({status:'cancelled'})])
    expect(result.success).toBe(50)
    expect(result.timeout).toBe(50)
    expect(result.health).toBe('Critical')
  })
  it('preserves zero response time and leaves a single-sample P95 unknown',()=>{
    expect(summarizePerformance([event({latency_ms:0})])).toMatchObject({average:0,p95:null})
    expect(summarizePerformance([event({latency_ms:0}),event({latency_ms:0})]).p95).toBe(0)
  })
  it('filters all metrics and partitions the previous period without overlap',()=>{
    const now=Date.parse('2026-09-06T00:00:00Z')
    const rows=[event(),event({occurred_at:'2026-08-29T00:00:00Z'}),event({occurred_at:'2026-08-01T00:00:00Z'})]
    const periods=performancePeriods(rows,7,now)
    expect(periods.current).toHaveLength(1)
    expect(periods.previous).toHaveLength(1)
    expect(responseComparison(2000,2500)).toBe('↓ 20.0% vs previous period')
  })
})
