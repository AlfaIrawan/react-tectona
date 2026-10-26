import { deleteGenAiChatSession, deleteIdeaDraftSession } from '@/lib/api/tectonaAgentRuntimeApi'
import { notifyEvent } from '@/lib/api/notificationApi'
import { pushGlobalToast } from '@/components/ui/toast'

type ChatDeletionTarget = {
  id: string
  mode: string
  isBrainstormPointer?: boolean
  brainstormJobId?: string
}

/** Local removal must wait until a saved session has actually been deleted. */
export async function deleteSavedChatSession(target: ChatDeletionTarget): Promise<void> {
  if (target.isBrainstormPointer) {
    if (!target.brainstormJobId) throw new Error('Missing idea draft session ID')
    await deleteIdeaDraftSession(target.brainstormJobId)
  } else if (target.mode === 'genai') {
    if (!await deleteGenAiChatSession(target.id)) throw new Error('Chat session was not deleted')
  }
}

export function notifyChatDeletion({ deleted, failed = 0, messagesOnly = false, localOnly = false, localDeleted = localOnly ? deleted : 0, title }: {
  deleted: number
  failed?: number
  messagesOnly?: boolean
  localOnly?: boolean
  localDeleted?: number
  title?: string
}): void {
  if (!deleted && !failed) return
  const noun = messagesOnly ? 'message' : 'chat'
  if (!deleted) {
    pushGlobalToast({ variant: 'error', title: 'Could not delete chat', description: 'Nothing was removed. Please try again.' })
    return
  }
  const heading = failed ? 'Some chats could not be deleted' : messagesOnly ? 'Messages removed' : deleted === 1 ? 'Chat deleted' : 'Chats deleted'
  const detail = messagesOnly
    ? `${deleted} ${noun}${deleted === 1 ? '' : 's'} removed from this chat view only. Other participants are not affected.`
    : localDeleted === deleted ? `${deleted === 1 && title ? `"${title}"` : `${deleted} chat${deleted === 1 ? '' : 's'}`} removed from your chat list only. Other participants keep their copies.`
      : localDeleted ? `${deleted - localDeleted} saved session${deleted - localDeleted === 1 ? '' : 's'} deleted. ${localDeleted} chat${localDeleted === 1 ? '' : 's'} removed from your list only; other participants keep their copies.`
      : `${deleted === 1 && title ? `"${title}"` : `${deleted} chat${deleted === 1 ? '' : 's'}`} deleted.`
  const body = detail + (failed ? ` ${failed} chat${failed === 1 ? '' : 's'} kept; please try again.` : '')
  pushGlobalToast({ variant: failed ? 'warning' : 'success', title: heading, description: body })
  notifyEvent({
    type_code: 'project', title: heading, body,
    // This is activity history, not an incoming-message link to the deleted conversation.
    metadata: { module: 'chat_activity', action: messagesOnly ? 'messages_removed' : 'chats_deleted', deleted_count: deleted, failed_count: failed, local_count: messagesOnly ? deleted : localDeleted, scope: messagesOnly ? 'local_view' : localDeleted === deleted ? 'chat_list' : localDeleted ? 'mixed' : 'saved_session' },
  })
}
