import { summarizeVisibleMembers, workspaceStatusDistribution, workspaceOverviewDisplay } from './workspaceManagementReadState'
import { describe, expect, it } from 'vitest'
import {
  countWorkspaceMemberships,
  createWorkspaceReadQueue,
  workspaceReadFailure,
} from './workspaceManagementReadState'

describe('workspace management read state', () => {
  it('distinguishes onboarding, rate limiting, access denial, and network failures', () => {
    expect(workspaceReadFailure('Workspace Directory', Object.assign(
      new Error('workspace onboarding failed'), { status: 500 },
    )).reason).toBe('Workspace onboarding failed (HTTP 500).')
    expect(workspaceReadFailure('The governance service', new Error('HTTP 429')).reason).toContain('too many requests')
    expect(workspaceReadFailure('The organization directory', { status: 403 }).reason).toContain('permission')
    expect(workspaceReadFailure('Workspace Directory', new TypeError('Failed to fetch')).reason).toContain('could not be reached')
  })

  it('does not expose raw service details', () => {
    expect(workspaceReadFailure('Workspace Directory', Object.assign(
      new Error('private database details'), { status: 502 },
    )).reason).toBe('Workspace Directory could not complete the request (HTTP 502).')
  })

  it('counts unique workspace ids and leaves incomplete totals unknown rather than zero', () => {
    expect(countWorkspaceMemberships(['a', 'a', 'b'], { a: 4, b: 0, other: 100 })).toBe(4)
    expect(countWorkspaceMemberships(['a', 'b'], { a: 4 })).toBeNull()
    expect(countWorkspaceMemberships(['a'], { a: 0 })).toBe(0)
  })

  it('coalesces concurrent reads, bounds concurrency, and permits a fresh read after a failure', async () => {
    const releases = new Map<string, () => void>()
    const calls: string[] = []
    const read = createWorkspaceReadQueue((id) => new Promise<string>((resolve, reject) => {
      calls.push(id)
      releases.set(id, () => id === 'a' ? reject(new Error('offline')) : resolve(id))
    }), 1)
    const first = read('a')
    const failure = expect(first).rejects.toThrow('offline')
    expect(read('a')).toBe(first)
    const second = read('b')
    await Promise.resolve()
    expect(calls).toEqual(['a'])
    releases.get('a')?.()
    await failure
    await Promise.resolve()
    expect(calls).toEqual(['a', 'b'])
    releases.get('b')?.()
    await expect(second).resolves.toBe('b')
    const retried = read('a')
    const retryFailure = expect(retried).rejects.toThrow('offline')
    await Promise.resolve()
    expect(calls).toEqual(['a', 'b', 'a'])
    releases.get('a')?.()
    await retryFailure
  })
})

describe('Workspace Management overview parity', () => {
  it('shows the visible people count when some membership reads could not be verified', () => {
    expect(summarizeVisibleMembers(49, ['loaded', 'missing'], { loaded: 49 }, new Set()))
      .toEqual({ total: 49, partial: true, stale: false })
    expect(summarizeVisibleMembers(0, ['missing'], {}, new Set()).total).toBeNull()
    expect(summarizeVisibleMembers(0, ['loaded'], { loaded: 0 }, new Set()).total).toBe(0)
    expect(summarizeVisibleMembers(49, ['loaded'], { loaded: 49 }, new Set(['loaded'])))
      .toEqual({ total: 49, partial: false, stale: true })
  })

  it('uses Directory status counts and does not promote unconfigured workspaces to At Risk', () => {
    const distribution = workspaceStatusDistribution(new Map([['Active', 54], ['At Risk', 0]]))
    expect(distribution.map(({ name, value }) => [name, value]))
      .toEqual([['Active', 54], ['At Risk', 0], ['Archived', 0]])
  })
})

it('renders Overview when workspace rows are available, regardless of startup scheduling', () => {
  expect(workspaceOverviewDisplay({ status: 'loading' }, 0)).toBe('loading')
  expect(workspaceOverviewDisplay({ status: 'error' }, 0)).toBe('error')
  expect(workspaceOverviewDisplay({ status: 'ready' }, 0)).toBe('ready')
  expect(workspaceOverviewDisplay({ status: 'loading' }, 54)).toBe('ready')
  expect(workspaceOverviewDisplay({ status: 'error' }, 54)).toBe('ready')
})
