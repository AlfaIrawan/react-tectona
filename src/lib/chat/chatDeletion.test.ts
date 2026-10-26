import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteGenAiChatSession, deleteIdeaDraftSession } from '@/lib/api/tectonaAgentRuntimeApi'
import { notifyEvent } from '@/lib/api/notificationApi'
import { pushGlobalToast } from '@/components/ui/toast'
import { deleteSavedChatSession, notifyChatDeletion } from './chatDeletion'

vi.mock('@/lib/api/tectonaAgentRuntimeApi', () => ({ deleteGenAiChatSession: vi.fn(), deleteIdeaDraftSession: vi.fn() }))
vi.mock('@/lib/api/notificationApi', () => ({ notifyEvent: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ pushGlobalToast: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(deleteGenAiChatSession).mockResolvedValue(true)
  vi.mocked(deleteIdeaDraftSession).mockResolvedValue(undefined)
})

describe('saved chat deletion', () => {
  it('waits for the draft API and uses the job ID, not the list row ID', async () => {
    let finish!: () => void
    vi.mocked(deleteIdeaDraftSession).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    let completed = false
    const pending = deleteSavedChatSession({ id: 'pointer-row', mode: 'genai', isBrainstormPointer: true, brainstormJobId: 'draft-job' }).then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)
    expect(deleteIdeaDraftSession).toHaveBeenCalledWith('draft-job')
    expect(deleteGenAiChatSession).not.toHaveBeenCalled()
    finish()
    await pending
    expect(completed).toBe(true)
  })

  it('rejects a failed draft request', async () => {
    vi.mocked(deleteIdeaDraftSession).mockRejectedValue(new Error('403'))
    await expect(deleteSavedChatSession({ id: 'draft', mode: 'genai', isBrainstormPointer: true, brainstormJobId: 'job' })).rejects.toThrow('403')
    expect(pushGlobalToast).not.toHaveBeenCalled()
    expect(notifyEvent).not.toHaveBeenCalled()
  })

  it('requires a draft job ID instead of deleting a different Gen AI session', async () => {
    await expect(deleteSavedChatSession({ id: 'draft', mode: 'genai', isBrainstormPointer: true })).rejects.toThrow('Missing')
    expect(deleteGenAiChatSession).not.toHaveBeenCalled()
  })

  it('treats a false API result as failure, not a successful delete', async () => {
    vi.mocked(deleteGenAiChatSession).mockResolvedValue(false)
    await expect(deleteSavedChatSession({ id: 'ai-session', mode: 'genai' })).rejects.toThrow('not deleted')
    expect(deleteGenAiChatSession).toHaveBeenCalledWith('ai-session')
  })

  it('propagates a Gen AI network failure', async () => {
    vi.mocked(deleteGenAiChatSession).mockRejectedValue(new Error('offline'))
    await expect(deleteSavedChatSession({ id: 'ai-session', mode: 'genai' })).rejects.toThrow('offline')
  })

  it.each(['team', 'group'])('does not delete shared server history for %s chats', async mode => {
    await deleteSavedChatSession({ id: 'shared-chat', mode })
    expect(deleteGenAiChatSession).not.toHaveBeenCalled()
    expect(deleteIdeaDraftSession).not.toHaveBeenCalled()
  })
})

describe('chat deletion feedback', () => {
  it('emits one success toast and one notification without a dead conversation link', () => {
    notifyChatDeletion({ deleted: 1, title: 'My draft' })
    expect(pushGlobalToast).toHaveBeenCalledTimes(1)
    expect(pushGlobalToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success', title: 'Chat deleted', description: '"My draft" deleted.' }))
    expect(notifyEvent).toHaveBeenCalledTimes(1)
    const event = vi.mocked(notifyEvent).mock.calls[0][0]
    expect(event.metadata).toEqual(expect.objectContaining({ module: 'chat_activity', deleted_count: 1, scope: 'saved_session' }))
    expect(event.link_url).toBeUndefined()
  })

  it('shows an error but no success notification when nothing was deleted', () => {
    notifyChatDeletion({ deleted: 0, failed: 1 })
    expect(pushGlobalToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', description: expect.stringContaining('Nothing was removed') }))
    expect(notifyEvent).not.toHaveBeenCalled()
  })

  it('aggregates partial bulk failures and distinguishes local removal', () => {
    notifyChatDeletion({ deleted: 3, failed: 2, localDeleted: 1 })
    expect(pushGlobalToast).toHaveBeenCalledTimes(1)
    expect(pushGlobalToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning', description: expect.stringContaining('2 chats kept') }))
    expect(notifyEvent).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('2 saved sessions deleted'), metadata: expect.objectContaining({ deleted_count: 3, failed_count: 2, local_count: 1, scope: 'mixed' }) }))
  })

  it('says team chat removal affects only the current user', () => {
    notifyChatDeletion({ deleted: 1, localOnly: true, title: 'Team chat' })
    expect(pushGlobalToast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('Other participants keep their copies') }))
    expect(notifyEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ scope: 'chat_list' }) }))
  })

  it('records local message deletion without copying message content', () => {
    notifyChatDeletion({ deleted: 2, messagesOnly: true })
    expect(pushGlobalToast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('2 messages removed from this chat view only') }))
    expect(notifyEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: { module: 'chat_activity', action: 'messages_removed', deleted_count: 2, failed_count: 0, local_count: 2, scope: 'local_view' } }))
  })

  it('does not emit feedback for stale or already-running selections', () => {
    notifyChatDeletion({ deleted: 0 })
    expect(pushGlobalToast).not.toHaveBeenCalled()
    expect(notifyEvent).not.toHaveBeenCalled()
  })
})
