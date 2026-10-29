import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteIdeaFolder, fetchAllIdeaFolders, type IdeaFolderApi } from '@/lib/api/ideaFolderApi'
import { belongsToIdeaBacklogFolderScope, readActiveWorkspaceScope, resolveWorkspaceIdForIdeaFolderFetch } from '@/lib/tenantWorkspaceScope'
import { useIdeaFolderStore } from './ideaFolderStore'

vi.mock('@/lib/api/ideaFolderApi', () => ({
  fetchAllIdeaFolders: vi.fn(), createIdeaFolder: vi.fn(), updateIdeaFolder: vi.fn(), deleteIdeaFolder: vi.fn(),
}))
vi.mock('@/lib/tenantWorkspaceScope', () => ({
  readActiveWorkspaceScope: vi.fn(), belongsToIdeaBacklogFolderScope: vi.fn(), resolveWorkspaceIdForIdeaFolderFetch: vi.fn(),
  applyWorkspaceIdFromWrite: vi.fn(), resolveWorkspaceIdForWrite: vi.fn(),
}))

const folder = (id: string, workspace = 'workspace', parent: string | null = null): IdeaFolderApi => ({
  id, workspace_id: workspace, parent_id: parent, name: id, owner_id: 'owner', description: null,
  idea_count: 0, children_count: 0, created_by: 'owner', created_date: '2026-10-27', created_from: 'test',
  updated_by: null, updated_date: null, updated_from: null,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(() => {
  useIdeaFolderStore.getState().clearLocalCache()
  vi.resetAllMocks()
  vi.mocked(readActiveWorkspaceScope).mockReturnValue({ mode: 'single', workspaceId: 'workspace', tenantMode: null })
  vi.mocked(resolveWorkspaceIdForIdeaFolderFetch).mockImplementation(scope => scope.mode === 'single' ? scope.workspaceId : undefined)
  vi.mocked(belongsToIdeaBacklogFolderScope).mockImplementation((id, scope) => !id || scope.mode === 'all' || id === scope.workspaceId)
})

describe('authoritative idea folder inventory', () => {
  it('removes stale folders instead of merging them into a fresh snapshot', async () => {
    vi.mocked(fetchAllIdeaFolders).mockResolvedValueOnce([folder('2023')]).mockResolvedValueOnce([folder('Current')])
    await useIdeaFolderStore.getState().fetchFolders('owner')
    await useIdeaFolderStore.getState().fetchFolders('owner')
    expect(useIdeaFolderStore.getState().folders.map(row => row.id)).toEqual(['Current'])
  })
  it('clears the inventory when the server returns no folders', async () => {
    vi.mocked(fetchAllIdeaFolders).mockResolvedValueOnce([folder('2023')]).mockResolvedValueOnce([])
    await useIdeaFolderStore.getState().fetchFolders('owner')
    await useIdeaFolderStore.getState().fetchFolders('owner', null)
    expect(useIdeaFolderStore.getState().folders).toEqual([])
  })
  it('refreshes nested folders too and coalesces concurrent full and parent requests', async () => {
    const request = deferred<IdeaFolderApi[]>()
    vi.mocked(fetchAllIdeaFolders).mockReturnValue(request.promise)
    const first = useIdeaFolderStore.getState().fetchFolders('owner')
    const second = useIdeaFolderStore.getState().fetchFolders('owner', null)
    expect(first).toBe(second)
    expect(fetchAllIdeaFolders).toHaveBeenCalledTimes(1)
    expect(fetchAllIdeaFolders).toHaveBeenCalledWith({ owner_id: 'owner', workspace_id: 'workspace' })
    request.resolve([folder('root'), folder('nested', 'workspace', 'root')])
    await first
    expect(useIdeaFolderStore.getState().folders.map(row => row.id)).toEqual(['root', 'nested'])
  })
  it('ignores a response after the cache was cleared', async () => {
    const request = deferred<IdeaFolderApi[]>()
    vi.mocked(fetchAllIdeaFolders).mockReturnValue(request.promise)
    const pending = useIdeaFolderStore.getState().fetchFolders('owner')
    useIdeaFolderStore.getState().clearLocalCache()
    request.resolve([folder('2023')])
    await pending
    expect(useIdeaFolderStore.getState().folders).toEqual([])
  })
  it('never replaces a newer workspace inventory with an old workspace response', async () => {
    const old = deferred<IdeaFolderApi[]>()
    vi.mocked(fetchAllIdeaFolders).mockReturnValueOnce(old.promise).mockResolvedValueOnce([folder('New', 'other')])
    const pending = useIdeaFolderStore.getState().fetchFolders('owner')
    vi.mocked(readActiveWorkspaceScope).mockReturnValue({ mode: 'single', workspaceId: 'other', tenantMode: null })
    await useIdeaFolderStore.getState().fetchFolders('owner')
    old.resolve([folder('2023')])
    await pending
    expect(useIdeaFolderStore.getState().folders.map(row => row.id)).toEqual(['New'])
  })
  it('ignores a stale failure after a newer workspace request succeeded', async () => {
    const old = deferred<IdeaFolderApi[]>()
    vi.mocked(fetchAllIdeaFolders).mockReturnValueOnce(old.promise).mockResolvedValueOnce([folder('New', 'other')])
    const pending = useIdeaFolderStore.getState().fetchFolders('owner')
    vi.mocked(readActiveWorkspaceScope).mockReturnValue({ mode: 'single', workspaceId: 'other', tenantMode: null })
    await useIdeaFolderStore.getState().fetchFolders('owner')
    old.reject(new Error('Offline'))
    await pending
    expect(useIdeaFolderStore.getState().foldersError).toBeNull()
    expect(useIdeaFolderStore.getState().folders.map(row => row.id)).toEqual(['New'])
  })
  it('does not resurrect a successfully deleted folder from an older in-flight response', async () => {
    const old = deferred<IdeaFolderApi[]>()
    vi.mocked(fetchAllIdeaFolders).mockResolvedValueOnce([folder('2023')]).mockReturnValueOnce(old.promise)
    await useIdeaFolderStore.getState().fetchFolders('owner')
    const pending = useIdeaFolderStore.getState().fetchFolders('owner')
    vi.mocked(deleteIdeaFolder).mockResolvedValue(undefined)
    await useIdeaFolderStore.getState().deleteFolder('2023')
    old.resolve([folder('2023')])
    await pending
    expect(useIdeaFolderStore.getState().folders).toEqual([])
    expect(useIdeaFolderStore.getState().foldersLoading).toBe(false)
  })
})
