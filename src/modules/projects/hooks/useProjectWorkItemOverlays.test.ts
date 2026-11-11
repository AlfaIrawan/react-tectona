import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  listProjectArchivedWorkItems,
  listProjectInboxRoutes,
  type ProjectInboxListResponse,
} from '@/lib/api/workApi'
import { archiveWorkItemRecord } from '../lib/projectArchivedStore'
import { upsertInboxWorkItemRecord } from '../lib/projectInboxStore'
import { useProjectWorkItemOverlays } from './useProjectWorkItemOverlays'

vi.mock('@/lib/api/workApi', () => ({
  listProjectArchivedWorkItems: vi.fn(),
  listProjectInboxRoutes: vi.fn(),
}))

const inbox = vi.mocked(listProjectInboxRoutes)
const archived = vi.mocked(listProjectArchivedWorkItems)
const date = '2026-01-01T00:00:00Z'
const route = (businessKey: string): ProjectInboxListResponse => ({
  total: 1,
  items: [{ businessKey, routedAt: date, routedBy: 'qa', sourceTeam: 'QA', sourceChannel: 'team', status: 'pending' }],
})

let root: Root
let state: ReturnType<typeof useProjectWorkItemOverlays>

function Harness({ id, revision, api }: { id?: string; revision: number; api: boolean }) {
  const result = useProjectWorkItemOverlays(id, api, revision)
  useEffect(() => { state = result }, [result])
  return null
}

const render = (id?: string, revision = 0, api = true) =>
  act(async () => root.render(createElement(Harness, { id, revision, api })))

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  inbox.mockReset()
  archived.mockReset().mockImplementation(async (id) => ({
    total: 1,
    items: [{ businessKey: id + '-archived', archivedAt: date, archivedBy: 'qa', reason: 'manual' }],
  }))
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('never exposes a previous project or lets a late refresh overwrite the current project', async () => {
  let finishA: (value: ProjectInboxListResponse) => void
  let finishB: (value: ProjectInboxListResponse) => void
  inbox.mockResolvedValueOnce(route('A-first'))
    .mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve }))
    .mockImplementationOnce(() => new Promise((resolve) => { finishB = resolve }))

  await render('A')
  expect([...state.pendingInboxKeys]).toEqual(['A-first'])
  await render('A', 1)
  expect(state.loading).toBe(true)
  expect([...state.pendingInboxKeys]).toEqual(['A-first'])
  await render('B', 1)
  expect(state.loading).toBe(true)
  expect([...state.pendingInboxKeys, ...state.archivedWorkItemKeys]).toEqual([])

  await act(async () => finishB(route('B-current')))
  await act(async () => finishA(route('A-late')))
  expect([...state.pendingInboxKeys]).toEqual(['B-current'])
  expect([...state.archivedWorkItemKeys]).toEqual(['B-archived'])
  expect(state.usesDatabase).toBe(true)
  expect(state.loading).toBe(false)
})

it('uses only the current project fallback on failure and clears it when no project is selected', async () => {
  for (const id of ['A', 'B']) {
    upsertInboxWorkItemRecord(id, id + '-local', {
      routedAt: date, routedBy: 'qa', sourceTeam: 'QA', sourceChannel: 'team', status: 'pending',
    })
    archiveWorkItemRecord(id, id + '-local-archive', { archivedAt: date, archivedBy: 'qa', reason: 'manual' })
  }
  inbox.mockRejectedValueOnce(new Error('Unavailable'))
  await render('B')
  expect([...state.pendingInboxKeys]).toEqual(['B-local'])
  expect([...state.archivedWorkItemKeys]).toEqual(['B-local-archive'])
  expect(state.usesDatabase).toBe(false)
  expect(state.loading).toBe(false)
  await render()
  expect([...state.pendingInboxKeys, ...state.archivedWorkItemKeys]).toEqual([])
  expect(state.loading).toBe(false)
  expect(inbox).toHaveBeenCalledTimes(1)
})
