import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getWorkflowOverview, type WorkflowOverviewDto } from '@/lib/api/workflowAutomationApi'
import { useWorkflowOverview } from './useWorkflowOverview'

vi.mock('@/lib/api/workflowAutomationApi', () => ({ getWorkflowOverview: vi.fn() }))

const fetchOverview = vi.mocked(getWorkflowOverview)
const overview = (total: number): WorkflowOverviewDto => ({
  window: { days: 7, from: '2026-01-01', to: '2026-01-07' },
  kpis: {
    workflows_total: total, workflows_active: 0, runs_total: 0, runs_completed: 0,
    runs_failed: 0, runs_cancelled: 0, waiting_now: 0, success_rate: null,
    median_duration_seconds: null,
  },
  trend: [], funnel: [], triggers: [], status_mix: [], insights: [],
  approvals: { approved: 0, rejected: 0, cancelled: 0, pending: 0, median_decision_minutes: null },
  queue: { waiting_approval: 0, waiting_delay: 0, running: 0, pending_approvals: 0 },
})

let root: Root
let state: ReturnType<typeof useWorkflowOverview>

function Harness({ id, enabled }: { id?: string; enabled: boolean }) {
  const result = useWorkflowOverview(id, enabled)
  useEffect(() => { state = result }, [result])
  return null
}

const render = (id?: string, enabled = true) =>
  act(async () => root.render(createElement(Harness, { id, enabled })))

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  fetchOverview.mockReset()
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('does not retain workspace totals while a different scope loads or fails', async () => {
  let reject: (error: Error) => void
  fetchOverview.mockResolvedValueOnce(overview(12))
    .mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  await render('A')
  expect(state.overview?.kpis.workflows_total).toBe(12)
  await render('B')
  expect(state).toEqual({ overview: null, overviewState: 'loading' })
  await act(async () => reject(new Error('Unavailable')))
  expect(state).toEqual({ overview: null, overviewState: 'error' })
  expect(fetchOverview).toHaveBeenLastCalledWith({ workspaceId: 'B', days: 7 })
})

it('ignores a late response when leaving the dashboard and reloads the all-workspaces scope', async () => {
  let resolve: (data: WorkflowOverviewDto) => void
  fetchOverview.mockImplementationOnce(() => new Promise((finish) => { resolve = finish }))
    .mockResolvedValueOnce(overview(25))
  await render('A')
  await render(undefined, false)
  expect(fetchOverview).toHaveBeenCalledTimes(1)
  await render()
  await act(async () => resolve(overview(12)))
  expect(fetchOverview).toHaveBeenLastCalledWith({ workspaceId: undefined, days: 7 })
  expect(state.overviewState).toBe('ready')
  expect(state.overview?.kpis.workflows_total).toBe(25)
})
