import type { ContextUsageReport, RuntimeChatUiContext } from '@/lib/api/tectonaAgentRuntimeApi'

import { ChatContextUsageControls } from './ChatContextUsageControls'

export interface ChatComposerContextToolbarProps {
  workspaceId?: string | null
  userId?: string | null
  sessionId?: string | null
  carryoverFromSessionId?: string | null
  draftMessage?: string
  ui?: RuntimeChatUiContext | null
  lastResponseReport?: ContextUsageReport | null
  enabled?: boolean
}

export function ChatComposerContextToolbar(props: ChatComposerContextToolbarProps) {
  return <ChatContextUsageControls {...props} className="mr-0.5" />
}
