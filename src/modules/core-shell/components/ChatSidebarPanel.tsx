import { Fragment, useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { getSession } from '@/auth/authService'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  Send,
  Users,
  Sparkles,
  X,
  Search,
  MessageSquare,
  MessageSquarePlus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Archive,
  Inbox,
  Trash2,
  Mail,
  Lock,
  EyeOff,
  Star,
  Ban,
  Eraser,
  Pencil,
  UsersRound,
  Folder,
  Image,
  Paperclip,
  Mic,
  Download,
  CheckCheck,
  Check,
  Plus,
  Smile,
  FileText,
  Images,
  Headphones,
  User,
  UserPlus,
  BarChart2,
  CalendarDays,
  Calendar,
  CalendarPlus,
  MapPin,
  Info,
  CheckSquare,
  Timer,
  Heart,
  ListPlus,
  XCircle,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseTimePicker } from '@/components/ui/enterprise-time-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { TeamChatContactInfoPanel, type ContactMediaItem } from './TeamChatContactInfoPanel'
import { PeopleChatComposer } from './PeopleChatComposer'
import { PeopleChatMessageSelectionBar } from './PeopleChatMessageSelectionBar'
import { TeamChatLockPanel, type ChatLockPanelMode } from './TeamChatLockPanel'
import { DisappearingMessagesAvatarBadge } from './DisappearingMessagesAvatarBadge'
import { DisappearingMessagesThreadNotice } from './DisappearingMessagesThreadNotice'
import { TeamChatDisappearingMessagesPanel } from './TeamChatDisappearingMessagesPanel'
import { TeamChatSearchMessagesPanel } from './TeamChatSearchMessagesPanel'
import {
  clearChatLockPassword,
  enableChatLock,
  hasChatLockPassword,
  isConversationChatLockActive,
  saveChatLockPassword,
  verifyChatLockPassword,
} from '@/lib/chat/chatLockStorage'
import {
  applyClearHistoryFilter,
  isChannelPreviewCleared,
  recordChatHistoryCleared,
} from '@/lib/chat/chatClearHistoryStorage'
import {
  applyDisappearingExpiryFilter,
  getChannelDisappearingDuration,
  parseDisappearingMessagesDuration,
  setChannelDisappearingDuration,
  formatDisappearingDurationLabel,
  type DisappearingMessagesDuration,
} from '@/lib/chat/chatDisappearingMessagesStorage'
import {
  getChannelDisappearingNotices,
  recordDisappearingNoticeForActor,
  type DisappearingNoticeKind,
} from '@/lib/chat/chatDisappearingNoticesStorage'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  buildChoiceSubmitUserMessage,
  resolveAssistantChoiceUiState,
  type AssistantChoiceUiState,
  type ChoiceOfferRecord,
} from '@/lib/chat/assistantMessageContent'
import {
  apiGenAiSessionToConversation,
  sortGenAiSessionsByUpdatedAt,
} from '@/lib/chat/genAiSessionMapper'
import {
  buildTectonaUiContextForChat,
  type TectonaUiContextPayload,
} from '@/lib/chat/tectonaChatUiContext'
import {
  buildDynamicUiSurfaceNotes,
  buildEvidenceFocusCandidates,
  html2CanvasOptionsForPlan,
  resolveEvidenceCapturePlan,
  resolveEvidenceCaptureRoot,
} from '@/lib/chat/pageEvidenceCapture'
import {
  buildAgentActionState,
  executeTectonaAgentAction,
  type TectonaAgentActionState,
  type TectonaProposedAction,
} from '@/lib/chat/tectonaAgentActions'
import { AssistantChatMarkdown, TECTONA_ASSISTANT_LABEL } from './AssistantChatMarkdown'
import { AssistantActionCard } from './AssistantActionCard'
import { ChatComposerContextToolbar } from './chat/ChatComposerContextToolbar'
import {
  TECTONA_CHAT_WORKSPACE_ID,
  fetchGenAiChatSessionMessages,
  deleteGenAiChatSession,
  listGenAiChatSessions,
  sendTectonaAgentRuntimeMessage,
  uploadChatAttachment,
  type ContextUsageReport,
  type GenAiChatSessionSummary,
  type RuntimeChatEvidence,
} from '@/lib/api/tectonaAgentRuntimeApi'
import { AssistantEvidenceFootnotes } from './AssistantEvidenceFootnotes'
import { useTectonaVoiceWake } from '@/hooks/useTectonaVoiceWake'
import { speak as speakReply, stopSpeaking, isTtsSupported } from '@/lib/voice/tts'
import {
  canPickContactForGroupChat,
  CHAT_PRESENCE_FALLBACK_POLL_MS,
  getCurrentChatActorId,
  buildTeamChatContactForUserId,
  loadChatContactDirectory,
  mergeRealtimePresenceStore,
  syncWorkspacePresenceStore,
  TECTONA_ASSISTANT_CONTACT,
  type ChatContact,
  type ChatMode,
} from '@/lib/chat/chatContactDirectory'
import {
  addHiddenFromConversation,
  isHiddenPeopleConversation,
  unhideOpenChatRequest,
  loadHiddenChannelIds,
  loadHiddenContactIds,
  unhideChatForContact,
} from '@/lib/chat/chatHiddenConversations'
import {
  maxInboundMessageSequence,
  maxVisibleMessageSequence,
  resolveOutboundDeliveryStatus,
} from '@/lib/chat/messageDeliveryStatus'
import { useCollaborationPresenceStore } from '@/stores/collaboration-presence-store'
import { useMyPresenceStore } from '@/stores/my-presence-store'
import { PresenceDot, presenceStatusLabel, type PresenceUiStatus } from '@/lib/chat/presenceUi'
import {
  createDirectChannel,
  createGroupChannel,
  fetchCollaborationChannel,
  listChannelMessages,
  listWorkspaceChannels,
  mapCollaborationMessagesToUi,
  markChannelDelivered,
  markChannelRead,
  patchChannelDisappearingMessages,
  sendChannelMessage,
  type CollaborationChannelApi,
} from '@/lib/api/collaborationContextApi'
import { useChatPanelStore } from '@/stores/chat-panel-store'
import { useChatNotificationTargetStore } from '@/stores/chat-notification-target-store'
import { useChatNavigationStore, type OpenChatThreadRequest } from '@/stores/chat-navigation-store'
import { useUiOverlayStore } from '@/stores/ui-overlay-store'
import { pushGlobalToast } from '@/components/ui/toast'
import {
  CHAT_CHANNEL_RECEIPT_EVENT,
  CHAT_MESSAGE_RECEIVED_EVENT,
  type ChatChannelReceiptPayload,
  toCollaborationMessageApi,
  type ChatMessageRealtimePayload,
} from '@/lib/chat/chatRealtimeEvents'
import {
  isChatMessageSoundEnabled,
  setChatMessageSoundEnabled,
} from '@/lib/notifications/chatMessageNotificationSound'

type ChatScreen = 'home' | 'newChatContacts' | 'thread'

/** dnd-kit: drop target for archive icon (inbox when viewing archived) */
const CHAT_DND_ARCHIVE_ID = 'tilia-chat-archive'

const AI_FOLDER_LABELS_STORAGE_KEY = 'tectona.chat.aiFolderLabels.v1'
const LEGACY_AI_FOLDER_LABELS_STORAGE_KEY = 'tilia.chat.aiFolderLabels.v1'
const ASSISTANT_TYPING_SPEED_STORAGE_KEY = 'tectona.chat.assistantTypingSpeed.v1'
const LEGACY_ASSISTANT_TYPING_SPEED_STORAGE_KEY = 'tilia.chat.assistantTypingSpeed.v1'
const ASSISTANT_AUTOSCROLL_STORAGE_KEY = 'tectona.chat.assistantAutoScrollWhileTyping.v1'
const LEGACY_ASSISTANT_AUTOSCROLL_STORAGE_KEY = 'tilia.chat.assistantAutoScrollWhileTyping.v1'
const ASSISTANT_TYPING_SOUND_STORAGE_KEY = 'tectona.chat.assistantTypingDoneSound.v1'
const LEGACY_ASSISTANT_TYPING_SOUND_STORAGE_KEY = 'tilia.chat.assistantTypingDoneSound.v1'
const ASSISTANT_SPEED_PROFILE_STORAGE_KEY = 'tectona.chat.assistantSpeedProfile.v1'
const LEGACY_ASSISTANT_SPEED_PROFILE_STORAGE_KEY = 'tilia.chat.assistantSpeedProfile.v1'

function readChatPreferenceStorage(primaryKey: string, legacyKey: string): string | null {
  try {
    return localStorage.getItem(primaryKey) ?? localStorage.getItem(legacyKey)
  } catch {
    return null
  }
}

type AssistantTypingSpeed = 'normal' | 'fast' | 'instant'
type AssistantSpeedProfile = 'uniform' | 'greeting_fast'

const CHAT_DND_AI_FOLDER_PREFIX = 'tilia-chat-ai-folder:'

function chatConvDndId(conversationId: string): string {
  return `tilia-chat-conv:${conversationId}`
}

function parseChatConvDndId(activeId: string | number): string | null {
  const s = String(activeId)
  if (!s.startsWith('tilia-chat-conv:')) return null
  return s.slice('tilia-chat-conv:'.length)
}

function aiFolderDropId(folderKey: string): string {
  const key = (folderKey ?? '').trim()
  if (!key) return `${CHAT_DND_AI_FOLDER_PREFIX}__ungrouped`
  return `${CHAT_DND_AI_FOLDER_PREFIX}${encodeURIComponent(key)}`
}

function parseAiFolderDropId(id: string | number): string | null {
  const s = String(id)
  if (!s.startsWith(CHAT_DND_AI_FOLDER_PREFIX)) return null
  const raw = s.slice(CHAT_DND_AI_FOLDER_PREFIX.length)
  if (!raw || raw === '__ungrouped') return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Emoji grid for Create event dialog (name & description pickers). */
const EVENT_FORM_EMOJI_CHOICES = [
  '😊',
  '👍',
  '❤️',
  '🎉',
  '🙏',
  '😂',
  '🔥',
  '✨',
  '📅',
  '⏰',
  '✅',
  '📌',
  '💼',
  '🤝',
  '☕',
  '🎁',
] as const

const SCREENSHOT_EVIDENCE_REQUEST_RE = /\b(screenshot|screen\s*shot|capture\s+layar|tangkapan\s+layar|evidence\s+visual)\b/i
const CONTEXT_CONTENT_REQUEST_RE =
  /\b(ringkasan\s+ide|summary|ringkasan|konten\s+halaman|isi\s+halaman|halaman\s+ini|page\s+ini|this\s+page|tab\s+ini|this\s+tab|bagian\s+ini|section\s+ini|detailkan|lebih\s+detail|jelaskan|review|analisis)\b/i
const DETAIL_REQUEST_RE =
  /\b(detail|lebih\s+detail|jelaskan|elaborate|break\s*down|analy[sz]e|review|improve|perbaiki|rapikan|refine)\b/i

function isLikelySummaryContext(ui: TectonaUiContextPayload | null): boolean {
  if (!ui) return false
  const page = (ui.page_title ?? '').toLowerCase()
  const view = (ui.view_label ?? '').toLowerCase()
  return /ringkasan|summary/.test(page) || /ringkasan|summary/.test(view)
}

function shouldAutoCaptureContextEvidence(options: {
  convMode: ChatMode
  text: string
  hasImageAttachment: boolean
  pathname: string
  uiContext: TectonaUiContextPayload | null
}): boolean {
  const text = options.text.trim()
  if (options.convMode !== 'genai' || !text || options.hasImageAttachment) return false
  if (SCREENSHOT_EVIDENCE_REQUEST_RE.test(text)) return true

  const onNonHomePage = options.pathname !== '/' && options.pathname !== '/home'
  if (!onNonHomePage) return false

  const asksContextContent = CONTEXT_CONTENT_REQUEST_RE.test(text)
  const asksDetail = DETAIL_REQUEST_RE.test(text)

  if (asksContextContent && asksDetail) return true
  if (isLikelySummaryContext(options.uiContext) && asksDetail) return true
  return false
}

function cropFocusedEvidenceCanvas(canvas: HTMLCanvasElement, target: HTMLElement): HTMLCanvasElement {
  void target
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return canvas

  const { width, height } = canvas
  if (width <= 0 || height <= 0) return canvas

  const data = ctx.getImageData(0, 0, width, height).data
  const colInk = new Uint32Array(width)
  const rowInk = new Uint32Array(height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const alpha = data[index + 3]
      if (alpha < 16) continue
      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]

      // Keep only visually meaningful pixels (text/icons/strong content),
      // ignore light gray cards/borders that make the crop look left-biased.
      const maxCh = Math.max(red, green, blue)
      const minCh = Math.min(red, green, blue)
      const saturation = maxCh - minCh
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      const hasInk = luminance < 198 || saturation > 26
      if (!hasInk) continue
      colInk[x] += 1
      rowInk[y] += 1
    }
  }

  const colThreshold = Math.max(2, Math.floor(height * 0.01))
  const rowThreshold = Math.max(2, Math.floor(width * 0.01))

  let minX = 0
  while (minX < width && colInk[minX] < colThreshold) minX += 1
  let maxX = width - 1
  while (maxX >= 0 && colInk[maxX] < colThreshold) maxX -= 1
  let minY = 0
  while (minY < height && rowInk[minY] < rowThreshold) minY += 1
  let maxY = height - 1
  while (maxY >= 0 && rowInk[maxY] < rowThreshold) maxY -= 1

  if (maxX < minX || maxY < minY) return canvas

  const paddingX = 32
  const paddingY = 28
  const contentCenterX = (minX + maxX) / 2
  const desiredWidth = Math.min(width, Math.max(1, maxX - minX + paddingX * 2))
  const desiredHalfWidth = desiredWidth / 2
  let cropX = Math.max(0, Math.floor(contentCenterX - desiredHalfWidth))
  if (cropX + desiredWidth > width) cropX = Math.max(0, width - desiredWidth)
  const cropY = Math.max(0, minY - paddingY)
  const cropRight = Math.min(width, cropX + desiredWidth)
  const cropBottom = Math.min(height, maxY + paddingY)
  const cropWidth = Math.max(1, cropRight - cropX)
  const cropHeight = Math.max(1, cropBottom - cropY)

  if (cropWidth >= width * 0.98 && cropHeight >= height * 0.98) return canvas

  const extracted = document.createElement('canvas')
  extracted.width = cropWidth
  extracted.height = cropHeight
  const extractedCtx = extracted.getContext('2d')
  if (!extractedCtx) return canvas
  extractedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  const centered = document.createElement('canvas')
  centered.width = cropWidth + paddingX * 2
  centered.height = cropHeight + paddingY * 2
  const centeredCtx = centered.getContext('2d')
  if (!centeredCtx) return extracted
  centeredCtx.fillStyle = '#ffffff'
  centeredCtx.fillRect(0, 0, centered.width, centered.height)
  centeredCtx.drawImage(extracted, paddingX, paddingY)
  return centered
}

function recenterCanvasByInk(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const srcCtx = canvas.getContext('2d', { willReadFrequently: true })
  if (!srcCtx) return canvas
  const { width, height } = canvas
  if (width <= 0 || height <= 0) return canvas

  const data = srcCtx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < 16) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if (!(lum < 198 || sat > 26)) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) return canvas

  const inkCenterX = (minX + maxX) / 2
  const targetCenterX = width / 2
  const shiftX = Math.round(targetCenterX - inkCenterX)
  if (Math.abs(shiftX) <= 2) return canvas

  const pad = Math.abs(shiftX) + 24
  const out = document.createElement('canvas')
  out.width = width + pad * 2
  out.height = height
  const outCtx = out.getContext('2d')
  if (!outCtx) return canvas
  outCtx.fillStyle = '#ffffff'
  outCtx.fillRect(0, 0, out.width, out.height)
  outCtx.drawImage(canvas, pad + shiftX, 0)
  return out
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result.startsWith('data:')) {
        reject(new Error('Failed to encode attachment payload as data URL.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Failed to read attachment payload.'))
    reader.readAsDataURL(blob)
  })
}

async function attachmentUrlToDataUrl(url: string, mimeType?: string): Promise<string> {
  const trimmed = (url || '').trim()
  if (trimmed.startsWith('data:')) return trimmed
  if (!trimmed) {
    throw new Error('Attachment URL is empty.')
  }

  const res = await fetch(trimmed)
  if (!res.ok) {
    throw new Error(`Failed to read attachment payload (HTTP ${res.status}).`)
  }
  const blob = await res.blob()
  const fixed = mimeType && blob.type !== mimeType ? new Blob([blob], { type: mimeType }) : blob
  return blobToDataUrl(fixed)
}

type ChatAttachmentKind = 'image' | 'document' | 'audio' | 'video' | 'contact' | 'poll' | 'event'

interface ChatAttachment {
  id: string
  kind: ChatAttachmentKind
  name: string
  /** Object URL for local preview / playback (mock UI). */
  url: string
  mimeType?: string
  /** Secondary line (poll options, event time, contact role). */
  subtitle?: string
  /** Event attachment: optional details (Create event dialog). */
  eventDescription?: string
  eventLocation?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  at: number
  /** Collaboration-context sequence (outbound delivery ticks). */
  sequenceNo?: number
  /** When set, message is removed from UI after this timestamp (disappearing messages). */
  expiresAt?: number
  /** True while waiting for backend/LLM response; rendered as typing dots. */
  isLoading?: boolean
  /** Optional action button (assistant/system). */
  action?: { kind: 'retry_greet'; label: string }
  attachments?: ChatAttachment[]
  /** Group chat: maps to chat contact directory for avatar beside bubble. */
  senderContactId?: string
  /** Local-only disappearing-messages notice (visible to this browser user). */
  disappearingNotice?: {
    kind: DisappearingNoticeKind
    duration: DisappearingMessagesDuration
  }
  /** Gen AI: assistant message with checkbox/radio choices — set after user confirms. */
  choiceOffer?: ChoiceOfferRecord
  /** Gen AI: proposed workspace actions awaiting user confirmation. */
  agentActionState?: TectonaAgentActionState
  /** Gen AI: KB / index citations returned by agent runtime. */
  evidence?: RuntimeChatEvidence[]
}

interface Conversation {
  id: string
  mode: ChatMode
  /** For Gen AI: session title. For Team: a fallback title. */
  title: string
  /** Stable identifier for team contacts (non-session). */
  contactId?: string
  /** For Team: person's name to show in header/list. */
  contactName?: string
  /** People chat: optional profile photo; initials shown when missing or failed to load. */
  contactAvatarSrc?: string
  /** Group chat: distinct contact ids and display names (from merged 1:1 threads). */
  groupMemberContactIds?: string[]
  groupMemberNames?: string[]
  /** Gen AI: optional folder label for grouping sessions in the sidebar. */
  aiFolderName?: string
  /** People/Group: backend channel id from collaboration-context-service. */
  channelId?: string
  /** People/Group: last message sequence from inbox API (preview after clear). */
  lastSequenceNo?: number
  /** People/Group: disappearing messages timer for this channel. */
  disappearingMessagesTtl?: DisappearingMessagesDuration
  /** DM: peer read watermark (for blue ticks on outbound messages). */
  peerLastReadSequence?: number
  /** DM: peer delivery watermark (for gray double ticks). */
  peerLastDeliveredSequence?: number
  preview: string
  updatedAt: number
  unreadCount: number
  archived?: boolean
  isFavorite?: boolean
  isLocked?: boolean
  /** Secret code configured on server for this channel (current user). */
  hasChatLockPassword?: boolean
  isBlurred?: boolean
  isBlocked?: boolean
}

function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatListTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (sameDay) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function parseSessionUpdatedAt(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function parseCollaborationTimestamp(value: string | null | undefined): number {
  if (!value) return Date.now()
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function truncatePreview(text: string, maxLen = 72): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

function collaborationChannelToConversation(
  ch: CollaborationChannelApi,
  contacts: ChatContact[],
): Conversation | null {
  const updatedAt = parseCollaborationTimestamp(ch.last_message_at)
  const lastSequenceNo = ch.last_sequence_no ?? 0
  const previewSource =
    ch.last_message_preview?.trim() || (ch.last_message_at ? 'Pesan baru' : 'Belum ada pesan')
  const preview = isChannelPreviewCleared(ch.id, lastSequenceNo)
    ? 'Belum ada pesan'
    : truncatePreview(previewSource)
  const unreadCount = ch.unread_count ?? 0

  if (ch.channel_type === 'direct') {
    const peerId = ch.peer_user_id
    if (!peerId) return null
    const contact = contacts.find((c) => c.id === peerId)
    const peerReceipt = safePeerReceiptFromChannel(ch)
    return {
      id: `conv-channel-${ch.id}`,
      mode: 'team',
      title: contact?.name ?? peerId,
      contactId: peerId,
      contactName: contact?.name ?? peerId,
      contactAvatarSrc: contact?.avatarSrc,
      channelId: ch.id,
      lastSequenceNo,
      disappearingMessagesTtl: parseDisappearingMessagesDuration(ch.disappearing_messages_ttl),
      peerLastReadSequence: peerReceipt.peerLastReadSequence,
      peerLastDeliveredSequence: peerReceipt.peerLastDeliveredSequence,
      preview,
      updatedAt,
      unreadCount,
      isLocked: ch.is_chat_locked ?? false,
      hasChatLockPassword: ch.has_chat_lock_password ?? false,
    }
  }

  if (ch.channel_type === 'group') {
    return {
      id: `conv-channel-${ch.id}`,
      mode: 'group',
      title: ch.title?.trim() || 'Grup chat',
      channelId: ch.id,
      lastSequenceNo,
      disappearingMessagesTtl: parseDisappearingMessagesDuration(ch.disappearing_messages_ttl),
      preview,
      updatedAt,
      unreadCount,
      groupMemberContactIds: [],
      groupMemberNames: [],
    }
  }

  return null
}

function mergeLocalDisappearingNotices(
  messages: ChatMessage[],
  channelId: string | undefined,
): ChatMessage[] {
  if (!channelId) return messages
  const notices = getChannelDisappearingNotices(channelId)
  if (notices.length === 0) return messages
  const virtual: ChatMessage[] = notices.map((n) => ({
    id: n.id,
    role: 'system',
    text: '',
    at: n.at,
    disappearingNotice: { kind: n.kind, duration: n.duration },
  }))
  return mergeMessageLists(messages, virtual).sort((a, b) => a.at - b.at)
}

function channelConversationId(channelId: string): string {
  return `conv-channel-${channelId}`
}

function resolveConversationDisappearingDuration(
  conv: Conversation | null | undefined,
): DisappearingMessagesDuration {
  if (!conv?.channelId) return 'off'
  if (conv.disappearingMessagesTtl) return conv.disappearingMessagesTtl
  return getChannelDisappearingDuration(conv.channelId)
}

/** Messages may live under conv-channel-{id} while list row keeps merged local id. */
function resolveThreadMessages(
  conversationId: string | null | undefined,
  channelId: string | undefined,
  messagesById: Record<string, ChatMessage[]>,
  conversations: Conversation[],
): ChatMessage[] {
  if (!conversationId) return []
  const conv = conversations.find((c) => c.id === conversationId)
  const effectiveChannelId = channelId ?? conv?.channelId
  const direct = messagesById[conversationId]
  if (direct && direct.length > 0) {
    return applyDisappearingExpiryFilter(
      applyClearHistoryFilter(direct, effectiveChannelId, conversationId),
    )
  }
  if (channelId) {
    const byChannelKey = messagesById[channelConversationId(channelId)]
    if (byChannelKey && byChannelKey.length > 0) {
      return applyDisappearingExpiryFilter(
        applyClearHistoryFilter(byChannelKey, channelId, conversationId),
      )
    }
    for (const c of conversations) {
      if (c.channelId !== channelId) continue
      const msgs = messagesById[c.id]
      if (msgs && msgs.length > 0) {
        return applyDisappearingExpiryFilter(
          applyClearHistoryFilter(msgs, channelId, conversationId),
        )
      }
    }
  }
  const raw = direct ?? []
  return applyDisappearingExpiryFilter(
    applyClearHistoryFilter(raw, effectiveChannelId, conversationId),
  )
}

function mergeMessageLists(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>()
  for (const m of [...a, ...b]) byId.set(m.id, m)
  return [...byId.values()].sort((x, y) => x.at - y.at)
}

function sameMessageThread(a: ChatMessage[], b: ChatMessage[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.id !== y.id || x.at !== y.at || x.text !== y.text || x.role !== y.role) return false
  }
  return true
}

/**
 * Recipient: update own read cursor + tell peer we received their messages.
 * `visibleSeq` = all messages shown in thread; `inboundSeq` = peer messages only (read receipt).
 */
async function acknowledgeChannelAsViewed(
  channelId: string,
  visibleSeq: number,
  inboundSeq?: number,
): Promise<void> {
  const readThrough = Math.max(visibleSeq, 0)
  const deliveredThrough = Math.max(inboundSeq ?? 0, 0)
  if (deliveredThrough > 0) {
    await markChannelDelivered(channelId, deliveredThrough).catch(() => undefined)
  }
  if (readThrough > 0) {
    await markChannelRead(channelId, readThrough).catch(() => undefined)
  }
}

function safePeerReceiptFromChannel(
  ch: CollaborationChannelApi,
  previous?: { peerLastReadSequence?: number; peerLastDeliveredSequence?: number },
): { peerLastReadSequence: number; peerLastDeliveredSequence: number } {
  const ownRead = ch.last_read_sequence ?? 0
  let peerRead = ch.peer_last_read_sequence ?? 0
  let peerDelivered = ch.peer_last_delivered_sequence ?? 0
  if (peerRead > 0 && peerRead === ownRead) peerRead = previous?.peerLastReadSequence ?? 0
  if (peerDelivered > 0 && peerDelivered === ownRead) {
    peerDelivered = previous?.peerLastDeliveredSequence ?? 0
  }
  return {
    peerLastReadSequence: Math.max(previous?.peerLastReadSequence ?? 0, peerRead),
    peerLastDeliveredSequence: Math.max(previous?.peerLastDeliveredSequence ?? 0, peerDelivered),
  }
}

/** Keep highest peer receipt watermarks — inbox refresh must not wipe WS/local updates. */
function mergePeerReceiptState(local: Conversation, api: Conversation): Conversation {
  const lastSeq = Math.max(local.lastSequenceNo ?? 0, api.lastSequenceNo ?? 0)
  const clearedPreview =
    api.channelId != null &&
    isChannelPreviewCleared(api.channelId, lastSeq)
  return {
    ...api,
    id: local.id,
    preview: clearedPreview ? 'Belum ada pesan' : api.preview,
    lastSequenceNo: lastSeq,
    disappearingMessagesTtl: api.disappearingMessagesTtl ?? local.disappearingMessagesTtl,
    isFavorite: local.isFavorite ?? api.isFavorite,
    isLocked: api.isLocked ?? local.isLocked,
    hasChatLockPassword: api.hasChatLockPassword ?? local.hasChatLockPassword,
    isBlurred: local.isBlurred ?? api.isBlurred,
    isBlocked: local.isBlocked ?? api.isBlocked,
    peerLastReadSequence: Math.max(local.peerLastReadSequence ?? 0, api.peerLastReadSequence ?? 0),
    peerLastDeliveredSequence: Math.max(
      local.peerLastDeliveredSequence ?? 0,
      api.peerLastDeliveredSequence ?? 0,
    ),
  }
}

function mergeCollaborationInbox(existing: Conversation[], apiConversations: Conversation[]): Conversation[] {
  const apiByChannel = new Map(
    apiConversations.filter((c) => c.channelId).map((c) => [c.channelId!, c] as const),
  )
  const apiByContact = new Map(
    apiConversations
      .filter((c) => c.mode === 'team' && c.contactId)
      .map((c) => [c.contactId!, c] as const),
  )
  const consumedChannels = new Set<string>()
  const merged: Conversation[] = []

  for (const local of existing) {
    if (local.mode !== 'team' && local.mode !== 'group') continue
    if (local.archived) {
      merged.push(local)
      continue
    }
    if (local.channelId && apiByChannel.has(local.channelId)) {
      merged.push(mergePeerReceiptState(local, apiByChannel.get(local.channelId)!))
      consumedChannels.add(local.channelId)
      continue
    }
    if (local.contactId && apiByContact.has(local.contactId)) {
      const api = apiByContact.get(local.contactId)!
      merged.push(mergePeerReceiptState(local, api))
      if (api.channelId) consumedChannels.add(api.channelId)
      continue
    }
    if (!local.channelId) merged.push(local)
  }

  for (const api of apiConversations) {
    if (api.channelId && consumedChannels.has(api.channelId)) continue
    if (isHiddenPeopleConversation(api)) continue
    merged.push(api)
  }

  return merged
}

function genAiSessionToConversation(
  session: GenAiChatSessionSummary,
  folderLabels: Record<string, string>,
): Conversation {
  const rawTitle = (session.title ?? '').trim()
  const rawPreview = (session.preview ?? '').trim()
  const safeTitle = isInternalOpeningGreetingMarker(rawTitle)
    ? 'Percakapan baru'
    : rawTitle || 'Percakapan baru'
  const safePreview = isInternalOpeningGreetingMarker(rawPreview)
    ? 'Belum ada pesan'
    : rawPreview || 'Belum ada pesan'

  return {
    id: session.session_id,
    mode: 'genai',
    title: safeTitle,
    aiFolderName: folderLabels[session.session_id],
    preview: safePreview,
    updatedAt: parseSessionUpdatedAt(session.updated_at),
    unreadCount: 0,
  }
}

function isInternalOpeningGreetingMarker(text: string | null | undefined): boolean {
  const normalized = (text ?? '').trim()
  if (!normalized) return false
  return (
    normalized === BACKEND_OPENING_GREETING_TOKEN ||
    normalized === '(auto) contextual opening greeting requested by sidebar'
  )
}

function genAiThreadNeedsOpeningGreeting(messages: Array<{ role: string; text?: string }>): boolean {
  if (messages.length === 0) return true
  return !messages.some((m) => m.role === 'assistant' && Boolean(m.text?.trim()))
}

function genAiGreetLoadingMessageId(convId: string): string {
  return `greet-loading-${convId}`
}

function genAiThreadHasPendingGreeting(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.isLoading && m.id.startsWith('greet-loading-'))
}

function genAiThreadHasCompletedAssistantGreeting(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) => m.role === 'assistant' && !m.isLoading && Boolean(m.text?.trim()) && !m.action?.kind,
  )
}

function isOpeningGreetingBubble(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return false
  if (t.startsWith('konteks aktif:')) return true
  return (
    (t.startsWith('halo') || t.startsWith('selamat pagi') || t.startsWith('selamat siang') || t.startsWith('selamat sore') || t.startsWith('selamat malam'))
    && (t.includes('aku bisa bantu') || t.includes('saya bisa bantu'))
  )
}

function mapGenAiApiMessagesToUi(
  rows: Array<{
    id: string
    role: ChatMessage['role']
    text: string
    at: number
    attachments?: ChatAttachment[]
  }>,
): ChatMessage[] {
  const mapped = rows
    .filter((m) => !(m.role === 'user' && isInternalOpeningGreetingMarker(m.text)))
    .map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      at: m.at,
      ...(Array.isArray(m.attachments) && m.attachments.length > 0
        ? {
            attachments: m.attachments.map((a) => ({
              id: a.id,
              kind: a.kind,
              name: a.name,
              url: a.url,
              ...(a.mimeType ? { mimeType: a.mimeType } : {}),
              ...(a.subtitle ? { subtitle: a.subtitle } : {}),
              ...(a.eventDescription ? { eventDescription: a.eventDescription } : {}),
              ...(a.eventLocation ? { eventLocation: a.eventLocation } : {}),
            })),
          }
        : {}),
    }))

  if (mapped.length <= 1) return mapped

  // Defensive UI dedupe for legacy/race data: keep only one opening greeting
  // before the first user turn so users never see duplicated contextual greet.
  const firstUserIdx = mapped.findIndex((m) => m.role === 'user')
  const openingRegionEnd = firstUserIdx >= 0 ? firstUserIdx : mapped.length
  const openingGreetingIdxs: number[] = []
  for (let i = 0; i < openingRegionEnd; i += 1) {
    const text = (mapped[i]?.text ?? '').trim()
    if (mapped[i]?.role === 'assistant' && isOpeningGreetingBubble(text)) {
      openingGreetingIdxs.push(i)
    }
  }
  if (openingGreetingIdxs.length <= 1) return mapped

  const keepIdx = openingGreetingIdxs[openingGreetingIdxs.length - 1]
  return mapped.filter((_, idx) => !openingGreetingIdxs.includes(idx) || idx === keepIdx)
}

function extendUiContextWithAttachmentNotes(
  uiContext: TectonaUiContextPayload,
  options: {
    manualAttachmentCount: number
    hasAutoEvidence: boolean
    userMessage?: string
  },
): TectonaUiContextPayload {
  const notes = [...(uiContext.extra_notes ?? [])]
  if (options.manualAttachmentCount > 0) {
    notes.push(`turn.attachment.user_count=${options.manualAttachmentCount}`)
  }
  if (options.hasAutoEvidence) {
    notes.push('turn.attachment.auto_screenshot=true')
  }
  if (options.userMessage?.trim()) {
    notes.push(...buildDynamicUiSurfaceNotes(options.userMessage.trim()))
  }
  return notes.length > 0 ? { ...uiContext, extra_notes: notes.slice(0, 8) } : uiContext
}

type GenAiOpeningGreetingContext = {
  pathname: string
  search?: string
  chatScreen?: string
  activeConversationTitle?: string | null
  activeConversationMode?: string | null
}

const BACKEND_OPENING_GREETING_TOKEN = '__TECTONA_OPENING_GREETING__'

async function resolveGenAiOpeningGreeting(
  convId: string,
  context: GenAiOpeningGreetingContext,
): Promise<ChatMessage> {
  const uiContext = buildTectonaUiContextForChat({
    pathname: context.pathname,
    search: context.search,
    chatPanelOpen: true,
    chatScreen: context.chatScreen,
    activeConversationTitle: context.activeConversationTitle ?? null,
    activeConversationMode: context.activeConversationMode ?? null,
  })

  const runtime = await sendTectonaAgentRuntimeMessage({
    message: BACKEND_OPENING_GREETING_TOKEN,
    context: {
      workspace_id: TECTONA_CHAT_WORKSPACE_ID,
      session_id: convId,
      ui: uiContext,
    },
  })

  const text = runtime.answer.trim() || 'Halo, saya siap membantu sesuai konteks halaman yang sedang Anda buka.'
  return {
    id: `greet-${convId}`,
    role: 'assistant',
    text,
    at: Date.now(),
  }
}

function greetPreviewText(): string {
  return `${TECTONA_ASSISTANT_LABEL} is greeting…`
}

function buildGenAiGreetingErrorMessage(): ChatMessage {
  return {
    id: `greet-error-${Date.now()}`,
    role: 'assistant',
    text: 'Gagal memuat sapaan Tectona Assistant. Silakan coba lagi.',
    at: Date.now(),
    action: { kind: 'retry_greet', label: 'Coba lagi' },
  }
}

async function retryGenAiGreetingInternal(
  conversationId: string,
  opts: {
    setMessagesById: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
    openingContext: GenAiOpeningGreetingContext
  },
): Promise<void> {
  const loadingMsgId = `greet-loading-${conversationId}`
  opts.setMessagesById((prev) => {
    const existing = prev[conversationId] ?? []
    const filtered = existing.filter((m) => m.action?.kind !== 'retry_greet')
    const next: ChatMessage[] =
      filtered.length > 0 && filtered[0]?.id === loadingMsgId
        ? filtered
        : [
            {
              id: loadingMsgId,
              role: 'assistant',
              text: '',
              at: Date.now(),
              isLoading: true,
            },
            ...filtered,
          ]
    return { ...prev, [conversationId]: next }
  })
  opts.setConversations((prev) =>
    prev.map((c) => (c.id === conversationId ? { ...c, preview: greetPreviewText(), updatedAt: Date.now() } : c)),
  )

  try {
    const greeting = await resolveGenAiOpeningGreeting(conversationId, opts.openingContext)
    opts.setMessagesById((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).map((m) =>
        m.id === loadingMsgId ? { ...greeting, id: loadingMsgId, isLoading: false } : m,
      ),
    }))
    opts.setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, preview: truncatePreview(greeting.text || c.preview), updatedAt: Date.now() } : c,
      ),
    )
  } catch {
    const err = buildGenAiGreetingErrorMessage()
    opts.setMessagesById((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).map((m) =>
        m.id === loadingMsgId ? { ...err, id: loadingMsgId, isLoading: false } : m,
      ),
    }))
    opts.setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, preview: truncatePreview(err.text), updatedAt: Date.now() } : c,
      ),
    )
  }
}

function parseLocalDateAndTime(dateStr: string, timeStr: string): Date | null {
  const dPart = dateStr?.trim()
  if (!dPart) return null
  const tPart = (timeStr?.trim() || '00:00').slice(0, 5)
  const dp = dPart.split('-').map((x) => parseInt(x, 10))
  const tp = tPart.split(':').map((x) => parseInt(x, 10))
  const y = dp[0]
  const mo = dp[1]
  const day = dp[2]
  const hh = tp[0]
  const mm = tp[1]
  if (![y, mo, day].every((n) => Number.isFinite(n))) return null
  return new Date(y, mo - 1, day, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0)
}

function hashToIndex(str: string, mod: number): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h) % mod
}

function titleToInitials(title: string): string {
  const t = title.trim()
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0] ?? ''
    const b = parts[parts.length - 1][0] ?? ''
    return (a + b).toUpperCase()
  }
  return t.slice(0, 2).toUpperCase() || '•'
}

const TEAM_AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900',
  'bg-gradient-to-br from-emerald-600 to-teal-800',
  'bg-gradient-to-br from-sky-600 to-indigo-800',
  'bg-gradient-to-br from-amber-600 to-orange-800',
  'bg-gradient-to-br from-rose-600 to-red-900',
  'bg-gradient-to-br from-violet-600 to-purple-900',
] as const

function teamAvatarClassForConversation(id: string): string {
  return TEAM_AVATAR_GRADIENTS[hashToIndex(id, TEAM_AVATAR_GRADIENTS.length)]
}

/** Emoji picker for Create event fields; portals to `document.body` so dialog overflow does not clip the panel. */
function EventFormEmojiTrigger({
  onInsert,
  buttonClassName,
  'aria-label': ariaLabel,
}: {
  onInsert: (emoji: string) => void
  buttonClassName: string
  'aria-label': string
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  const updatePosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const panelW = 180
    const panelH = 200
    const margin = 8
    let top = r.bottom + margin
    if (top + panelH > window.innerHeight - margin) {
      top = Math.max(margin, r.top - panelH - margin)
    }
    let left = r.right - panelW
    left = Math.max(margin, Math.min(left, window.innerWidth - panelW - margin))
    setPanelStyle({
      top,
      left,
      position: 'fixed',
      width: panelW,
      zIndex: 250,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    const onResize = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  useEffect(() => {
    if (!open) return
    useUiOverlayStore.getState().incBlockingOverlay()
    return () => useUiOverlayStore.getState().decBlockingOverlay()
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Smile className="h-4 w-4" aria-hidden />
      </button>
      {open
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[240] bg-transparent"
                aria-hidden
                onMouseDown={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                role="listbox"
                aria-label="Choose emoji"
                className={cn(
                  'fixed rounded-xl border border-slate-200 bg-white p-2 shadow-xl',
                  'dark:border-slate-600 dark:bg-slate-900'
                )}
                style={panelStyle}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex max-w-[11rem] flex-wrap gap-1">
                  {EVENT_FORM_EMOJI_CHOICES.map((em) => (
                    <button
                      key={em}
                      type="button"
                      role="option"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-lg text-foreground transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => {
                        onInsert(em)
                        setOpen(false)
                      }}
                    >
                      <span aria-hidden>{em}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  )
}

export function ChatSidebarPanel() {
  const location = useLocation()
  const close = () => useChatPanelStore.getState().setOpen(false)
  const setActiveChannelId = useChatNotificationTargetStore((s) => s.setActiveChannelId)
  const pendingChatOpen = useChatNavigationStore((s) => s.pendingOpen)
  const clearPendingChatOpen = useChatNavigationStore((s) => s.clearPendingOpen)
  const [screen, setScreen] = useState<ChatScreen>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [filterAi, setFilterAi] = useState(true)
  const [filterPeople, setFilterPeople] = useState(true)
  const [favoritesAccordionOpen, setFavoritesAccordionOpen] = useState(true)
  const [aiAccordionOpen, setAiAccordionOpen] = useState(true)
  const [peopleAccordionOpen, setPeopleAccordionOpen] = useState(true)
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [contextMenu, setContextMenu] = useState<{
    open: boolean
    x: number
    y: number
    conversationIds: string[]
    variant: 'list' | 'team-thread'
  }>({ open: false, x: 0, y: 0, conversationIds: [], variant: 'list' })
  const [contactInfoConversationId, setContactInfoConversationId] = useState<string | null>(null)
  const [messageSearchConversationId, setMessageSearchConversationId] = useState<string | null>(null)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [disappearingMessagesConversationId, setDisappearingMessagesConversationId] = useState<
    string | null
  >(null)
  const [disappearingDurationRevision, setDisappearingDurationRevision] = useState(0)
  const [disappearingNoticesRevision, setDisappearingNoticesRevision] = useState(0)
  const disappearingSaveInFlightRef = useRef(false)
  const [messageSelectionActive, setMessageSelectionActive] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set())
  const [chatLockPanel, setChatLockPanel] = useState<{
    conversationId: string | null
    mode: ChatLockPanelMode
    pendingOpenAfterUnlock: boolean
  }>({
    conversationId: null,
    mode: 'set',
    pendingOpenAfterUnlock: false,
  })
  const [chatLockLoading, setChatLockLoading] = useState(false)
  const [chatLockError, setChatLockError] = useState<string | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupDialogPendingIds, setGroupDialogPendingIds] = useState<string[]>([])
  /** When non-empty, "Create group" uses contact ids from the directory (New chat) instead of conversation ids. */
  const [groupDialogPendingContactIds, setGroupDialogPendingContactIds] = useState<string[]>([])
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [newChatGroupPickMode, setNewChatGroupPickMode] = useState(false)
  const [newChatGroupSelectedIds, setNewChatGroupSelectedIds] = useState<string[]>([])
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderDialogPendingIds, setFolderDialogPendingIds] = useState<string[]>([])
  const [folderNameDraft, setFolderNameDraft] = useState('')
  const [activeDragConvId, setActiveDragConvId] = useState<string | null>(null)

  const chatDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  )

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage[]>>({})
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([TECTONA_ASSISTANT_CONTACT])
  const [chatContactsLoading, setChatContactsLoading] = useState(false)
  const [hiddenChatRevision, setHiddenChatRevision] = useState(0)
  const hiddenContactIds = useMemo(
    () => loadHiddenContactIds(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when user deletes a thread
    [hiddenChatRevision],
  )
  const hiddenChannelIds = useMemo(
    () => loadHiddenChannelIds(),
    [hiddenChatRevision],
  )
  const chatContactsRef = useRef(chatContacts)
  chatContactsRef.current = chatContacts
  const presenceByUserId = useCollaborationPresenceStore((s) => s.byUserId)
  const myPresence = useMyPresenceStore((s) => s.status)
  const chatContactsForDisplay = useMemo(() => {
    let merged = mergeRealtimePresenceStore(chatContacts, presenceByUserId)
    merged = merged.filter((c) => c.isAssistant || !hiddenContactIds.has(c.id))
    if (myPresence === 'offline') return merged
    const selfPresence = myPresence === 'away' ? 'away' : 'online'
    merged = merged.map((contact) =>
      contact.subtitle === 'You' ? { ...contact, presence: selfPresence } : contact,
    )
    return merged
  }, [chatContacts, presenceByUserId, myPresence, hiddenContactIds])

  const genaiHydratedRef = useRef<Set<string>>(new Set())
  const teamChannelHydratedRef = useRef<Set<string>>(new Set())
  const collaborationInboxSyncedRef = useRef(false)
  const [assistantTypingSpeed, setAssistantTypingSpeed] = useState<AssistantTypingSpeed>(() => {
    try {
      const raw = readChatPreferenceStorage(ASSISTANT_TYPING_SPEED_STORAGE_KEY, LEGACY_ASSISTANT_TYPING_SPEED_STORAGE_KEY)
      if (raw === 'fast' || raw === 'instant' || raw === 'normal') return raw
      return 'normal'
    } catch {
      return 'normal'
    }
  })
  const [assistantSpeedProfile, setAssistantSpeedProfile] = useState<AssistantSpeedProfile>(() => {
    try {
      const raw = readChatPreferenceStorage(ASSISTANT_SPEED_PROFILE_STORAGE_KEY, LEGACY_ASSISTANT_SPEED_PROFILE_STORAGE_KEY)
      if (raw === 'uniform' || raw === 'greeting_fast') return raw
      return 'greeting_fast'
    } catch {
      return 'greeting_fast'
    }
  })

  const retryGenAiGreeting = useCallback(
    async (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId)
      await retryGenAiGreetingInternal(conversationId, {
        setMessagesById,
        setConversations,
        openingContext: {
          pathname: location.pathname,
          search: location.search,
          chatScreen: screen,
          activeConversationTitle: conv?.title ?? null,
          activeConversationMode: conv?.mode ?? null,
        },
      })
    },
    [conversations, location.pathname, location.search, screen, setMessagesById, setConversations],
  )

  const handleAgentActionConfirm = useCallback(
    async (
      conversationId: string,
      messageId: string,
      actionId: string,
      patch?: Record<string, unknown>,
    ) => {
      let actionToRun: TectonaProposedAction | undefined

      setMessagesById((prev) => {
        const msgs = prev[conversationId] ?? []
        const msg = msgs.find((m) => m.id === messageId)
        actionToRun = msg?.agentActionState?.actions.find((a) => a.action_id === actionId)
        if (!actionToRun || !msg?.agentActionState) return prev
        return {
          ...prev,
          [conversationId]: msgs.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  agentActionState: {
                    ...m.agentActionState!,
                    executions: {
                      ...m.agentActionState!.executions,
                      [actionId]: { status: 'executing' as const },
                    },
                  },
                }
              : m,
          ),
        }
      })

      if (!actionToRun) return

      // Merge user-edited form fields (e.g. workspace name/description) into the payload.
      // If the name changed, drop workspace_key so it re-slugifies from the new name.
      let runAction = actionToRun
      if (patch && Object.keys(patch).length > 0) {
        const mergedPayload: Record<string, unknown> = { ...actionToRun.payload, ...patch }
        if (patch.name) delete mergedPayload.workspace_key
        runAction = { ...actionToRun, payload: mergedPayload }
      }

      try {
        const resultSummary = await executeTectonaAgentAction(runAction)
        setMessagesById((prev) => {
          const msgs = prev[conversationId] ?? []
          return {
            ...prev,
            [conversationId]: msgs.map((m) => {
              if (m.id !== messageId || !m.agentActionState) return m
              return {
                ...m,
                agentActionState: {
                  ...m.agentActionState,
                  executions: {
                    ...m.agentActionState.executions,
                    [actionId]: { status: 'succeeded' as const, result_summary: resultSummary },
                  },
                },
              }
            }),
          }
        })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Eksekusi gagal'
        setMessagesById((prev) => {
          const msgs = prev[conversationId] ?? []
          return {
            ...prev,
            [conversationId]: msgs.map((m) => {
              if (m.id !== messageId || !m.agentActionState) return m
              return {
                ...m,
                agentActionState: {
                  ...m.agentActionState,
                  executions: {
                    ...m.agentActionState.executions,
                    [actionId]: { status: 'failed' as const, error: errMsg },
                  },
                },
              }
            }),
          }
        })
      }
    },
    [setMessagesById],
  )

  const handleAgentActionCancel = useCallback(
    (conversationId: string, messageId: string, actionId: string) => {
      setMessagesById((prev) => {
        const msgs = prev[conversationId] ?? []
        return {
          ...prev,
          [conversationId]: msgs.map((m) => {
            if (m.id !== messageId || !m.agentActionState) return m
            return {
              ...m,
              agentActionState: {
                ...m.agentActionState,
                executions: {
                  ...m.agentActionState.executions,
                  [actionId]: { status: 'cancelled' as const },
                },
              },
            }
          }),
        }
      })
    },
    [setMessagesById],
  )
  const [autoScrollWhileTyping, setAutoScrollWhileTyping] = useState<boolean>(() => {
    try {
      const raw = readChatPreferenceStorage(ASSISTANT_AUTOSCROLL_STORAGE_KEY, LEGACY_ASSISTANT_AUTOSCROLL_STORAGE_KEY)
      if (raw === 'false') return false
      return true
    } catch {
      return true
    }
  })
  const [typingDoneSoundEnabled, setTypingDoneSoundEnabled] = useState<boolean>(() => {
    try {
      const raw = readChatPreferenceStorage(ASSISTANT_TYPING_SOUND_STORAGE_KEY, LEGACY_ASSISTANT_TYPING_SOUND_STORAGE_KEY)
      return raw === 'true'
    } catch {
      return false
    }
  })
  const [chatMessageSoundEnabled, setChatMessageSoundEnabledState] = useState<boolean>(() =>
    isChatMessageSoundEnabled(),
  )

  const [aiFolderLabelByKey, setAiFolderLabelByKey] = useState<Record<string, string>>(() => {
    try {
      const raw = readChatPreferenceStorage(AI_FOLDER_LABELS_STORAGE_KEY, LEGACY_AI_FOLDER_LABELS_STORAGE_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return {}
      const obj = parsed as Record<string, unknown>
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(obj)) {
        if (typeof k !== 'string') continue
        if (typeof v !== 'string') continue
        next[k] = v
      }
      return next
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(AI_FOLDER_LABELS_STORAGE_KEY, JSON.stringify(aiFolderLabelByKey))
    } catch {
      // ignore
    }
  }, [aiFolderLabelByKey])

  useEffect(() => {
    try {
      localStorage.setItem(ASSISTANT_TYPING_SPEED_STORAGE_KEY, assistantTypingSpeed)
    } catch {
      // ignore
    }
  }, [assistantTypingSpeed])

  useEffect(() => {
    try {
      localStorage.setItem(ASSISTANT_SPEED_PROFILE_STORAGE_KEY, assistantSpeedProfile)
    } catch {
      // ignore
    }
  }, [assistantSpeedProfile])

  useEffect(() => {
    try {
      localStorage.setItem(ASSISTANT_AUTOSCROLL_STORAGE_KEY, String(autoScrollWhileTyping))
    } catch {
      // ignore
    }
  }, [autoScrollWhileTyping])

  useEffect(() => {
    try {
      localStorage.setItem(ASSISTANT_TYPING_SOUND_STORAGE_KEY, String(typingDoneSoundEnabled))
    } catch {
      // ignore
    }
  }, [typingDoneSoundEnabled])

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const activeConversationIdRef = useRef<string | null>(null)
  activeConversationIdRef.current = activeConversationId
  const screenRef = useRef(screen)
  screenRef.current = screen
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations
  const messagesByIdRef = useRef(messagesById)
  messagesByIdRef.current = messagesById
  const [draft, setDraft] = useState('')
  const [lastGenAiContextUsage, setLastGenAiContextUsage] = useState<ContextUsageReport | null>(null)
  /** Gen AI composer: queued attachments before send (images, docs, voice). */
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  /** Lightbox for pending image thumbnail click */
  const [pendingImagePreview, setPendingImagePreview] = useState<ChatAttachment | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevThreadConversationIdRef = useRef<string | null>(null)
  const pendingThreadScrollRef = useRef(false)
  /** User scrolled up — suppress auto-scroll until they return near bottom or send. */
  const userPinnedScrollRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const playedTypingDoneSoundRef = useRef<Set<string>>(new Set())
  const mediaPickRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)

  const [pollAttachOpen, setPollAttachOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOpt1, setPollOpt1] = useState('')
  const [pollOpt2, setPollOpt2] = useState('')

  const [eventAttachOpen, setEventAttachOpen] = useState(false)
  const [eventNameDraft, setEventNameDraft] = useState('')
  const [eventDescriptionDraft, setEventDescriptionDraft] = useState('')
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventStartTime, setEventStartTime] = useState('')
  const [eventEndExpanded, setEventEndExpanded] = useState(false)
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventEndTime, setEventEndTime] = useState('')
  const [eventLocationDraft, setEventLocationDraft] = useState('')

  const [contactAttachOpen, setContactAttachOpen] = useState(false)
  const [contactAttachSearchQuery, setContactAttachSearchQuery] = useState('')
  const [contactAttachSelectedId, setContactAttachSelectedId] = useState<string | null>(null)

  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId)
    : undefined

  const messages = resolveThreadMessages(
    activeConversationId,
    activeConversation?.channelId,
    messagesById,
    conversations,
  )

  const threadDisplayMessages = useMemo(() => {
    void disappearingNoticesRevision
    return mergeLocalDisappearingNotices(messages, activeConversation?.channelId)
  }, [messages, activeConversation?.channelId, disappearingNoticesRevision])

  const refreshCollaborationInbox = useCallback(async () => {
    try {
      const res = await listWorkspaceChannels(TECTONA_CHAT_WORKSPACE_ID, { pageSize: 100 })
      const apiConversations = res.items
        .map((ch) => collaborationChannelToConversation(ch, chatContacts))
        .filter((c): c is Conversation => c != null)
        .filter((c) => !isHiddenPeopleConversation(c))
      collaborationInboxSyncedRef.current = true
      setConversations((prev) => {
        const genai = prev.filter((c) => c.mode === 'genai')
        const teamGroup = mergeCollaborationInbox(
          prev.filter((c) => c.mode === 'team' || c.mode === 'group'),
          apiConversations,
        )
        return [...genai, ...teamGroup].sort((a, b) => b.updatedAt - a.updatedAt)
      })
    } catch {
      // collaboration-context unavailable — inbox stays empty until service is up
    }
  }, [chatContacts, hiddenChannelIds, hiddenContactIds])

  const syncChannelReceiptsAndMessageSequences = useCallback(
    async (conversationId: string, channelId: string, options?: { markAsViewed?: boolean }) => {
      let maxSeq = 0
      try {
        const ch = await fetchCollaborationChannel(channelId)
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId && c.channelId !== channelId) return c
            const peer = safePeerReceiptFromChannel(ch, c)
            return { ...c, channelId, ...peer }
          }),
        )
      } catch {
        try {
          const res = await listWorkspaceChannels(TECTONA_CHAT_WORKSPACE_ID, { pageSize: 100 })
          const ch = res.items.find((item) => item.id === channelId)
          if (ch) {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== conversationId && c.channelId !== channelId) return c
                const peer = safePeerReceiptFromChannel(ch, c)
                return { ...c, ...peer }
              }),
            )
          }
        } catch {
          // ignore
        }
      }

      let mapped: ChatMessage[] = []
      try {
        const msgs = await listChannelMessages(channelId, { limit: 100 })
        maxSeq = msgs.reduce((max, m) => Math.max(max, m.sequence_no), 0)
        const actorId = getCurrentChatActorId()
        mapped = applyDisappearingExpiryFilter(
          applyClearHistoryFilter(
            mapCollaborationMessagesToUi(msgs, actorId) as ChatMessage[],
            channelId,
            conversationId,
          ),
        )
        setMessagesById((prev) => {
          const altKey = channelConversationId(channelId)
          const merged = mergeMessageLists(
            applyClearHistoryFilter(prev[conversationId] ?? [], channelId, conversationId),
            mapped,
          )
          const fromAlt =
            altKey !== conversationId
              ? applyClearHistoryFilter(prev[altKey] ?? [], channelId, conversationId)
              : []
          const combined = applyClearHistoryFilter(
            mergeMessageLists(merged, fromAlt),
            channelId,
            conversationId,
          )
          const existing = applyClearHistoryFilter(prev[conversationId] ?? [], channelId, conversationId)
          if (sameMessageThread(existing, combined)) return prev
          const next: Record<string, ChatMessage[]> = { ...prev, [conversationId]: combined }
          if (altKey !== conversationId) delete next[altKey]
          return next
        })
      } catch {
        // ignore
      }

      if (options?.markAsViewed && mapped.length > 0) {
        const visible = maxVisibleMessageSequence(mapped)
        const inbound = maxInboundMessageSequence(mapped, 'team')
        await acknowledgeChannelAsViewed(channelId, visible, inbound)
      }
    },
    [],
  )

  useEffect(() => {
    if (screen !== 'thread') {
      setActiveChannelId(null)
      return
    }
    setActiveChannelId(activeConversation?.channelId ?? null)
  }, [screen, activeConversation?.channelId, setActiveChannelId])

  useEffect(() => {
    const conv =
      activeConversationId != null
        ? conversations.find((c) => c.id === activeConversationId)
        : undefined
    if (screen !== 'thread' || !conv?.channelId || conv.mode !== 'team') return

    void syncChannelReceiptsAndMessageSequences(conv.id, conv.channelId, { markAsViewed: true })
    const intervalId = window.setInterval(() => {
      void syncChannelReceiptsAndMessageSequences(conv.id, conv.channelId!, { markAsViewed: true })
    }, 2000)
    return () => window.clearInterval(intervalId)
  }, [screen, activeConversationId, conversations, syncChannelReceiptsAndMessageSequences])

  useEffect(() => {
    if (screen !== 'thread' || !activeConversationId) return
    const conv = conversations.find((c) => c.id === activeConversationId)
    if (!conv?.channelId || (conv.mode !== 'team' && conv.mode !== 'group')) return
    if (resolveConversationDisappearingDuration(conv) === 'off') return

    const conversationId = activeConversationId
    const channelId = conv.channelId

    const pruneExpired = () => {
      setMessagesById((prev) => {
        const keys = new Set<string>([conversationId])
        const altKey = channelConversationId(channelId)
        if (altKey !== conversationId) keys.add(altKey)
        let changed = false
        const next: Record<string, ChatMessage[]> = { ...prev }
        for (const key of keys) {
          const msgs = prev[key]
          if (!msgs?.length) continue
          const filtered = applyDisappearingExpiryFilter(msgs)
          if (filtered.length !== msgs.length) {
            next[key] = filtered
            changed = true
          }
        }
        return changed ? next : prev
      })
      const remaining = resolveThreadMessages(
        conversationId,
        channelId,
        messagesByIdRef.current,
        conversationsRef.current,
      )
      if (remaining.length === 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, preview: 'Belum ada pesan', updatedAt: Date.now() } : c,
          ),
        )
      }
    }

    pruneExpired()
    const intervalId = window.setInterval(pruneExpired, 30_000)
    return () => window.clearInterval(intervalId)
  }, [screen, activeConversationId, conversations, disappearingDurationRevision])

  useEffect(() => {
    if (screen !== 'thread' || !activeConversationId) return
    const conv = conversations.find((c) => c.id === activeConversationId)
    if (!conv?.channelId || conv.mode !== 'team') return

    const visible = maxVisibleMessageSequence(messages)
    const inbound = maxInboundMessageSequence(messages, conv.mode)
    if (visible <= 0) return

    const timer = window.setTimeout(() => {
      void acknowledgeChannelAsViewed(conv.channelId!, visible, inbound)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [screen, activeConversationId, messages, conversations])

  useEffect(() => {
    const onIncomingMessage = (event: Event) => {
      const detail = (event as CustomEvent<ChatMessageRealtimePayload>).detail
      if (!detail?.channel_id) return

      void refreshCollaborationInbox()

      const actorId = getCurrentChatActorId()
      const mapped = mapCollaborationMessagesToUi([toCollaborationMessageApi(detail)], actorId)
      const uiMsg = mapped[0]
      if (!uiMsg) return

      const match = conversationsRef.current.find((c) => c.channelId === detail.channel_id)
      if (!match) return

      const activeId = activeConversationIdRef.current
      const activeConv = activeId
        ? conversationsRef.current.find((c) => c.id === activeId)
        : undefined
      const isViewingChannel =
        screenRef.current === 'thread' &&
        !!activeConv?.channelId &&
        activeConv.channelId === detail.channel_id

      if (actorId && detail.sender_user_id !== actorId && detail.sequence_no > 0) {
        if (isViewingChannel && activeId) {
          const existing = resolveThreadMessages(
            activeId,
            detail.channel_id,
            messagesByIdRef.current,
            conversationsRef.current,
          )
          const nextThread = existing.some((m) => m.id === detail.message_id)
            ? existing
            : [...existing, uiMsg as ChatMessage]
          const visible = maxVisibleMessageSequence(nextThread)
          const inbound = maxInboundMessageSequence(nextThread, 'team')
          void acknowledgeChannelAsViewed(detail.channel_id, visible, inbound)
        } else {
          void markChannelDelivered(detail.channel_id, detail.sequence_no).catch(() => undefined)
        }
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.channelId === detail.channel_id
            ? {
                ...c,
                preview: detail.body.slice(0, 72),
                updatedAt: Date.now(),
                unreadCount: isViewingChannel && c.id === activeId ? 0 : (c.unreadCount ?? 0) + 1,
              }
            : c,
        ),
      )

      const messageConvId = isViewingChannel && activeId ? activeId : match.id
      setMessagesById((prev) => {
        const existing = resolveThreadMessages(messageConvId, detail.channel_id, prev, conversationsRef.current)
        if (existing.some((m) => m.id === detail.message_id)) return prev
        return {
          ...prev,
          [messageConvId]: [...existing, uiMsg as ChatMessage],
        }
      })
    }

    window.addEventListener(CHAT_MESSAGE_RECEIVED_EVENT, onIncomingMessage)
    return () => window.removeEventListener(CHAT_MESSAGE_RECEIVED_EVENT, onIncomingMessage)
  }, [refreshCollaborationInbox])

  useEffect(() => {
    const onReceipt = (event: Event) => {
      const detail = (event as CustomEvent<ChatChannelReceiptPayload>).detail
      if (!detail?.channel_id || !detail.user_id) return
      const selfId = getCurrentChatActorId()
      if (!selfId || detail.user_id === selfId) return

      setConversations((prev) =>
        prev.map((c) => {
          if (c.channelId !== detail.channel_id) return c
          if (c.mode === 'team' && c.contactId && detail.user_id !== c.contactId) return c
          if (detail.kind === 'read') {
            return {
              ...c,
              peerLastReadSequence: Math.max(c.peerLastReadSequence ?? 0, detail.sequence_no),
              peerLastDeliveredSequence: Math.max(c.peerLastDeliveredSequence ?? 0, detail.sequence_no),
            }
          }
          return {
            ...c,
            peerLastDeliveredSequence: Math.max(c.peerLastDeliveredSequence ?? 0, detail.sequence_no),
          }
        }),
      )
    }

    window.addEventListener(CHAT_CHANNEL_RECEIPT_EVENT, onReceipt)
    return () => window.removeEventListener(CHAT_CHANNEL_RECEIPT_EVENT, onReceipt)
  }, [])

  useEffect(() => {
    let cancelled = false
    setChatContactsLoading(true)
    void (async () => {
      try {
        const loaded = await loadChatContactDirectory()
        if (!cancelled) setChatContacts(loaded)
      } catch {
        if (!cancelled) setChatContacts([TECTONA_ASSISTANT_CONTACT])
      } finally {
        if (!cancelled) setChatContactsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (chatContacts.length <= 1) return
    void syncWorkspacePresenceStore().catch(() => undefined)
  }, [chatContacts.length])

  useEffect(() => {
    if (screen !== 'newChatContacts') return
    let cancelled = false
    void (async () => {
      try {
        const loaded = await loadChatContactDirectory()
        if (!cancelled) setChatContacts(loaded)
      } catch {
        // keep current directory when collaboration-context is unavailable
      }
    })()
    return () => {
      cancelled = true
    }
  }, [screen])

  // REST fallback when WebSocket is down (initial sync + periodic safety net).
  useEffect(() => {
    let cancelled = false

    const syncPresence = async () => {
      if (chatContactsRef.current.length <= 1) return
      try {
        await syncWorkspacePresenceStore()
      } catch {
        // collaboration-context unavailable
      }
    }

    void syncPresence()
    const intervalId = window.setInterval(() => void syncPresence(), CHAT_PRESENCE_FALLBACK_POLL_MS)
    const onFocus = () => void syncPresence()

    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    setPendingAttachments((prev) => {
      for (const a of prev) {
        if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
      }
      return []
    })
    setPendingImagePreview(null)
  }, [activeConversationId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refreshCollaborationInbox()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [refreshCollaborationInbox])

  useEffect(() => {
    if (chatContacts.length <= 1) return
    void refreshCollaborationInbox()
  }, [chatContacts, refreshCollaborationInbox])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sessions = await listGenAiChatSessions(TECTONA_CHAT_WORKSPACE_ID)
        if (cancelled) return
        const genaiRows = sortGenAiSessionsByUpdatedAt(
          sessions
            .filter((row) => Boolean(row.session_id))
            .map((row) =>
              apiGenAiSessionToConversation(row, aiFolderLabelByKey[row.session_id]),
            ),
        )
        setConversations((prev) => {
          const team = prev.filter((c) => c.mode !== 'genai')
          const apiIds = new Set(genaiRows.map((row) => row.id))
          const localOnlyGenai = prev.filter(
            (c) => c.mode === 'genai' && !apiIds.has(c.id),
          )
          const genai = genaiRows.map((row) => ({
            ...row,
            mode: 'genai' as const,
            unreadCount: 0,
          }))
          return [...localOnlyGenai, ...genai, ...team].sort((a, b) => b.updatedAt - a.updatedAt)
        })
      } catch {
        if (cancelled) return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [aiFolderLabelByKey])

  useEffect(() => {
    const conv =
      activeConversationId != null
        ? conversations.find((c) => c.id === activeConversationId)
        : undefined
    if (!conv || conv.mode !== 'genai' || screen !== 'thread') return
    if (genaiHydratedRef.current.has(conv.id)) return

    let cancelled = false

    const applyGreetingToThread = (
      loadingMsgId: string,
      message: ChatMessage,
    ) => {
      setMessagesById((prev) => ({
        ...prev,
        [conv.id]: (prev[conv.id] ?? []).map((m) =>
          m.id === loadingMsgId ? { ...message, id: loadingMsgId, isLoading: false } : m,
        ),
      }))
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id
            ? { ...c, preview: truncatePreview(message.text || c.preview), updatedAt: Date.now() }
            : c,
        ),
      )
    }

    const syncThreadFromBackend = async (): Promise<boolean> => {
      const persisted = await fetchGenAiChatSessionMessages(conv.id, TECTONA_CHAT_WORKSPACE_ID)
      if (cancelled || persisted.length === 0) return false
      const persistedThread = mapGenAiApiMessagesToUi(persisted)
      setMessagesById((prev) => ({ ...prev, [conv.id]: persistedThread }))
      if (persistedThread.length > 0 && persistedThread[0]?.role === 'assistant') {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conv.id && (c.preview === 'Belum ada pesan' || c.preview === 'No messages yet')
              ? { ...c, preview: truncatePreview(persistedThread[0].text || c.preview) }
              : c,
          ),
        )
      }
      return true
    }

    const runOpeningGreet = async (loadingMsgId: string) => {
      setMessagesById((prev) => ({
        ...prev,
        [conv.id]: [{ id: loadingMsgId, role: 'assistant', text: '', at: Date.now(), isLoading: true }],
      }))
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, preview: greetPreviewText(), updatedAt: Date.now() } : c)),
      )
      try {
        const greeting = await resolveGenAiOpeningGreeting(conv.id, {
          pathname: location.pathname,
          search: location.search,
          chatScreen: screen,
          activeConversationTitle: conv.title,
          activeConversationMode: conv.mode,
        })
        if (cancelled) return
        const synced = await syncThreadFromBackend()
        if (!synced) {
          applyGreetingToThread(loadingMsgId, greeting)
        }
      } catch {
        if (cancelled) return
        applyGreetingToThread(loadingMsgId, buildGenAiGreetingErrorMessage())
      }
    }

    ;(async () => {
      try {
        const loaded = await fetchGenAiChatSessionMessages(conv.id, TECTONA_CHAT_WORKSPACE_ID)
        if (cancelled) return

        const existing = messagesByIdRef.current[conv.id] ?? []
        const loadingMsgId = genAiGreetLoadingMessageId(conv.id)

        if (loaded.length > 0) {
          const thread = mapGenAiApiMessagesToUi(loaded)
          setMessagesById((prev) => ({ ...prev, [conv.id]: thread }))
          if (thread.length > 0 && thread[0]?.role === 'assistant') {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conv.id && (c.preview === 'Belum ada pesan' || c.preview === 'No messages yet')
                  ? { ...c, preview: truncatePreview(thread[0].text || c.preview) }
                  : c,
              ),
            )
          }
          genaiHydratedRef.current.add(conv.id)
          return
        }

        if (genAiThreadHasCompletedAssistantGreeting(existing)) {
          genaiHydratedRef.current.add(conv.id)
          return
        }

        if (genAiThreadHasPendingGreeting(existing)) {
          // Effect re-run cancelled the in-flight greet — finish it now.
          try {
            const greeting = await resolveGenAiOpeningGreeting(conv.id, {
              pathname: location.pathname,
              search: location.search,
              chatScreen: screen,
              activeConversationTitle: conv.title,
              activeConversationMode: conv.mode,
            })
            if (cancelled) return
            const synced = await syncThreadFromBackend()
            if (!synced) {
              applyGreetingToThread(loadingMsgId, greeting)
            }
          } catch {
            if (cancelled) return
            applyGreetingToThread(loadingMsgId, buildGenAiGreetingErrorMessage())
          }
          genaiHydratedRef.current.add(conv.id)
          return
        }

        await runOpeningGreet(loadingMsgId)
        if (!cancelled) genaiHydratedRef.current.add(conv.id)
      } catch {
        if (cancelled) return
        const existing = messagesByIdRef.current[conv.id] ?? []
        if (!genAiThreadHasCompletedAssistantGreeting(existing)) {
          const loadingMsgId = genAiGreetLoadingMessageId(conv.id)
          await runOpeningGreet(loadingMsgId)
        }
        genaiHydratedRef.current.add(conv.id)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeConversationId, conversations, location.pathname, location.search, screen])

  useEffect(() => {
    const conv =
      activeConversationId != null
        ? conversations.find((c) => c.id === activeConversationId)
        : undefined
    if (!conv || screen !== 'thread') return
    if (conv.mode !== 'team' && conv.mode !== 'group') return

    const cachedCount = resolveThreadMessages(conv.id, conv.channelId, messagesById, conversations).length
    if (teamChannelHydratedRef.current.has(conv.id) && conv.channelId && cachedCount > 0) {
      void syncChannelReceiptsAndMessageSequences(conv.id, conv.channelId, { markAsViewed: true })
      return
    }

    let cancelled = false
    ;(async () => {
      let channelId = conv.channelId
      try {
        if (!channelId && conv.mode === 'team' && conv.contactId) {
          const ch = await createDirectChannel(TECTONA_CHAT_WORKSPACE_ID, conv.contactId)
          channelId = ch.id
          if (!cancelled) {
            setConversations((prev) =>
              prev.map((c) => (c.id === conv.id ? { ...c, channelId: ch.id } : c)),
            )
          }
        }
        if (!channelId) return

        const msgs = await listChannelMessages(channelId, { limit: 100 })
        if (cancelled) return

        const actorId = getCurrentChatActorId()
        const mapped = applyDisappearingExpiryFilter(
          applyClearHistoryFilter(
            mapCollaborationMessagesToUi(msgs, actorId) as ChatMessage[],
            channelId,
            conv.id,
          ),
        )
        const altKey = channelConversationId(channelId)
        let combined: ChatMessage[] = mapped
        setMessagesById((prev) => {
          const fromAlt =
            altKey !== conv.id
              ? applyClearHistoryFilter(prev[altKey] ?? [], channelId, conv.id)
              : []
          combined = applyClearHistoryFilter(mergeMessageLists(mapped, fromAlt), channelId, conv.id)
          const existing = applyClearHistoryFilter(prev[conv.id] ?? [], channelId, conv.id)
          if (sameMessageThread(existing, combined)) return prev
          const next: Record<string, ChatMessage[]> = { ...prev, [conv.id]: combined }
          if (altKey !== conv.id) delete next[altKey]
          return next
        })

        const visible = maxVisibleMessageSequence(combined)
        const inbound = maxInboundMessageSequence(combined, conv.mode)
        if (visible > 0) {
          await acknowledgeChannelAsViewed(channelId, visible, inbound)
        }
        teamChannelHydratedRef.current.add(conv.id)
        teamChannelHydratedRef.current.add(channelId)
        await syncChannelReceiptsAndMessageSequences(conv.id, channelId, { markAsViewed: true })
      } catch {
        teamChannelHydratedRef.current.delete(conv.id)
        if (conv.channelId) teamChannelHydratedRef.current.delete(conv.channelId)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeConversationId, conversations, screen, messagesById, syncChannelReceiptsAndMessageSequences])

  const setMessagesForActive = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    if (!activeConversationId) return
    setMessagesById((prev) => ({
      ...prev,
      [activeConversationId]: updater(prev[activeConversationId] ?? []),
    }))
  }

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return conversations
      .filter((c) => (showArchived ? !!c.archived : !c.archived))
      .filter((c) => (c.mode === 'genai' ? filterAi : filterPeople))
      .filter((c) => !isHiddenPeopleConversation(c))
      .filter((c) => {
        if (!q) return true
        const hay = [
          c.title,
          c.preview,
          c.contactName ?? '',
          c.aiFolderName ?? '',
          ...(c.groupMemberNames ?? []),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => {
        const af = a.isFavorite ? 1 : 0
        const bf = b.isFavorite ? 1 : 0
        if (af !== bf) return bf - af
        return b.updatedAt - a.updatedAt
      })
  }, [conversations, searchQuery, showArchived, filterAi, filterPeople, hiddenChatRevision])

  const filteredFavoriteConversations = useMemo(
    () => filteredConversations.filter((c) => c.isFavorite),
    [filteredConversations]
  )

  // Avoid redundancy: favorites appear only in the Favorites section.
  const filteredPeopleConversations = useMemo(
    () =>
      filteredConversations.filter(
        (c) => (c.mode === 'team' || c.mode === 'group') && !c.isFavorite
      ),
    [filteredConversations]
  )

  const filteredAiConversations = useMemo(
    () => filteredConversations.filter((c) => c.mode === 'genai' && !c.isFavorite),
    [filteredConversations]
  )

  const renameAiFolder = useCallback((folderKey: string, nextLabelRaw: string) => {
    const key = (folderKey ?? '').trim()
    const nextLabel = nextLabelRaw.trim()
    if (!key) return
    if (!nextLabel) {
      setAiFolderLabelByKey((prev) => {
        if (prev[key] == null) return prev
        const { [key]: _, ...rest } = prev
        return rest
      })
      return
    }
    setAiFolderLabelByKey((prev) => ({ ...prev, [key]: nextLabel }))
  }, [])

  const filteredAiFolderGroups = useMemo(() => {
    const map = new Map<string, Conversation[]>()
    for (const c of filteredAiConversations) {
      const key = (c.aiFolderName ?? '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === '') return 1
      if (b === '') return -1
      return a.localeCompare(b)
    })
    return keys.map((folderKey) => ({
      folderKey,
      displayLabel:
        folderKey === ''
          ? 'Ungrouped'
          : (aiFolderLabelByKey[folderKey]?.trim() || folderKey),
      conversations: map.get(folderKey)!,
    }))
  }, [filteredAiConversations, aiFolderLabelByKey])

  const filteredAiConversationsInListOrder = useMemo(
    () => filteredAiFolderGroups.flatMap((g) => g.conversations),
    [filteredAiFolderGroups]
  )

  /** Flat order as rendered: Favorites (if any) → AI (if filter on) → People (if filter on). Used for Shift+click range. */
  const visibleOrderedConversationIds = useMemo(() => {
    const ids: string[] = []
    if (filteredFavoriteConversations.length > 0) {
      for (const c of filteredFavoriteConversations) ids.push(c.id)
    }
    if (filterAi) {
      for (const c of filteredAiConversationsInListOrder) ids.push(c.id)
    }
    if (filterPeople) {
      for (const c of filteredPeopleConversations) ids.push(c.id)
    }
    return ids
  }, [
    filteredFavoriteConversations,
    filteredAiConversationsInListOrder,
    filteredPeopleConversations,
    filterAi,
    filterPeople,
  ])

  const filteredContacts = useMemo(() => {
    const q = contactSearchQuery.trim().toLowerCase()
    if (!q) return chatContactsForDisplay
    return chatContactsForDisplay.filter((c) => {
      const hay = `${c.name} ${c.subtitle ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [contactSearchQuery, chatContactsForDisplay])

  const totalUnreadMessages = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  )

  const totalArchived = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.archived ? 1 : 0), 0),
    [conversations]
  )

  const isThreadNearBottom = useCallback(() => {
    const el = threadScrollRef.current
    if (!el) return false
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 120
  }, [])

  const handleThreadScroll = useCallback(() => {
    userPinnedScrollRef.current = !isThreadNearBottom()
  }, [isThreadNearBottom])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = threadScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  const lastThreadMessage = messages[messages.length - 1]
  const lastThreadMessageId = lastThreadMessage?.id
  const lastThreadMessageRole = lastThreadMessage?.role

  useLayoutEffect(() => {
    if (screen !== 'thread' || !activeConversationId) return

    const conversationChanged = prevThreadConversationIdRef.current !== activeConversationId
    if (conversationChanged) {
      prevThreadConversationIdRef.current = activeConversationId
      pendingThreadScrollRef.current = true
      userPinnedScrollRef.current = false
    }

    if (messages.length === 0) return

    const sentByMe = lastThreadMessageRole === 'user'
    if (sentByMe) userPinnedScrollRef.current = false

    const shouldScroll =
      pendingThreadScrollRef.current ||
      sentByMe ||
      (!userPinnedScrollRef.current && isThreadNearBottom())
    if (!shouldScroll) return

    pendingThreadScrollRef.current = false

    const behavior: ScrollBehavior = conversationChanged || sentByMe ? 'auto' : 'smooth'
    scrollToBottom(behavior)
    const t = window.setTimeout(() => scrollToBottom('auto'), 80)
    return () => window.clearTimeout(t)
  }, [
    messages.length,
    lastThreadMessageId,
    lastThreadMessageRole,
    screen,
    activeConversationId,
    isThreadNearBottom,
    scrollToBottom,
  ])

  useEffect(() => {
    setPendingImagePreview(null)
    setPendingAttachments((prev) => {
      for (const a of prev) {
        if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
      }
      return []
    })
  }, [activeConversationId])

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop())
      if (audioCtxRef.current) {
        void audioCtxRef.current.close()
      }
    }
  }, [])

  const handleAssistantTypingProgress = useCallback(() => {
    if (!autoScrollWhileTyping || userPinnedScrollRef.current) return
    scrollToBottom('auto')
  }, [autoScrollWhileTyping, scrollToBottom])

  const playTypingDoneSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 890
      gain.gain.value = 0.0001
      osc.connect(gain)
      gain.connect(ctx.destination)
      const now = ctx.currentTime
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.13)
    } catch {
      // ignore browser audio restrictions/errors
    }
  }, [])

  const handleAssistantTypingComplete = useCallback(
    (messageId: string) => {
      if (!typingDoneSoundEnabled) return
      if (playedTypingDoneSoundRef.current.has(messageId)) return
      playedTypingDoneSoundRef.current.add(messageId)
      playTypingDoneSound()
    },
    [typingDoneSoundEnabled, playTypingDoneSound]
  )

  useEffect(() => {
    setSelectedIds(new Set())
    setSelectionAnchorId(null)
  }, [showArchived, filterAi, filterPeople])

  const handleConversationRowClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.detail === 0) return
      if (e.shiftKey) {
        e.preventDefault()
        const order = visibleOrderedConversationIds
        const anchor = selectionAnchorId ?? id
        const anchorIdx = order.indexOf(anchor)
        const clickIdx = order.indexOf(id)
        if (clickIdx === -1) return
        if (anchorIdx === -1) {
          setSelectionAnchorId(id)
          setSelectedIds(new Set([id]))
          return
        }
        const start = Math.min(anchorIdx, clickIdx)
        const end = Math.max(anchorIdx, clickIdx)
        const next = new Set<string>()
        for (let i = start; i <= end; i++) {
          next.add(order[i]!)
        }
        setSelectedIds(next)
        return
      }
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setSelectedIds((prev) => {
          const next = new Set(prev)
          const wasSelected = next.has(id)
          if (wasSelected) {
            next.delete(id)
          } else {
            next.add(id)
          }
          const newAnchor =
            next.size === 0 ? null : !wasSelected ? id : ([...next][0] ?? null)
          setSelectionAnchorId(newAnchor)
          return next
        })
        return
      }
      setSelectionAnchorId(id)
      setSelectedIds(new Set([id]))
    },
    [visibleOrderedConversationIds, selectionAnchorId]
  )

  const handleConversationContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault()
      if (selectedIds.size > 1 && selectedIds.has(id)) {
        setContextMenu({
          open: true,
          x: e.clientX,
          y: e.clientY,
          conversationIds: Array.from(selectedIds),
          variant: 'list',
        })
      } else {
        setSelectionAnchorId(id)
        setSelectedIds(new Set([id]))
        setContextMenu({
          open: true,
          x: e.clientX,
          y: e.clientY,
          conversationIds: [id],
          variant: 'list',
        })
      }
    },
    [selectedIds]
  )

  const closeContextMenu = useCallback(() => {
    setContextMenu((s) => ({ ...s, open: false, conversationIds: [], variant: 'list' }))
  }, [])

  const handleThreadContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (messageSelectionActive) return
      if (screen !== 'thread' || !activeConversationId) return
      const conv = conversations.find((c) => c.id === activeConversationId)
      if (conv?.mode !== 'team') return
      e.preventDefault()
      setContextMenu({
        open: true,
        x: e.clientX,
        y: e.clientY,
        conversationIds: [activeConversationId],
        variant: 'team-thread',
      })
    },
    [screen, activeConversationId, conversations, messageSelectionActive],
  )

  const showChatFeatureSoonToast = useCallback((label: string) => {
    pushGlobalToast({
      variant: 'default',
      title: label,
      description: 'This option is not available yet.',
    })
  }, [])

  const openMessageSearch = useCallback((conversationId: string) => {
    setContactInfoConversationId(null)
    setDisappearingMessagesConversationId(null)
    setChatLockPanel((prev) => ({ ...prev, conversationId: null }))
    setMessageSearchConversationId(conversationId)
    setMessageSearchQuery('')
  }, [])

  const scrollToThreadMessage = useCallback((messageId: string) => {
    setMessageSearchConversationId(null)
    setMessageSearchQuery('')
    requestAnimationFrame(() => {
      const root = threadScrollRef.current
      const el = root?.querySelector(`[data-chat-message-id="${messageId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const exitMessageSelection = useCallback(() => {
    setMessageSelectionActive(false)
    setSelectedMessageIds(new Set())
  }, [])

  const openDisappearingMessages = useCallback(
    (conversationId: string) => {
      setContactInfoConversationId(null)
      setChatLockPanel((prev) => ({ ...prev, conversationId: null }))
      setMessageSearchConversationId(null)
      setMessageSearchQuery('')
      exitMessageSelection()
      setDisappearingMessagesConversationId(conversationId)
    },
    [exitMessageSelection],
  )

  const openChatLockPanel = useCallback(
    (params: {
      conversationId: string
      mode: ChatLockPanelMode
      pendingOpenAfterUnlock?: boolean
    }) => {
      setContactInfoConversationId(null)
      setDisappearingMessagesConversationId(null)
      setMessageSearchConversationId(null)
      setMessageSearchQuery('')
      exitMessageSelection()
      setChatLockError(null)
      setChatLockPanel({
        conversationId: params.conversationId,
        mode: params.mode,
        pendingOpenAfterUnlock: params.pendingOpenAfterUnlock ?? false,
      })
    },
    [exitMessageSelection],
  )

  const closeChatLockPanel = useCallback(() => {
    setChatLockPanel({
      conversationId: null,
      mode: 'set',
      pendingOpenAfterUnlock: false,
    })
    setChatLockError(null)
  }, [])

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }, [])

  useEffect(() => {
    exitMessageSelection()
  }, [activeConversationId, exitMessageSelection])

  const deleteSelectedThreadMessages = useCallback(() => {
    if (selectedMessageIds.size === 0) return
    const ids = selectedMessageIds
    setMessagesById((prev) => {
      const convId = activeConversationId
      if (!convId) return prev
      const chId = conversations.find((c) => c.id === convId)?.channelId
      const altKey = chId ? channelConversationId(chId) : null
      const next = { ...prev }
      const filterMsgs = (list: ChatMessage[]) => list.filter((m) => !ids.has(m.id))
      if (next[convId]) next[convId] = filterMsgs(next[convId])
      if (altKey && altKey !== convId && next[altKey]) next[altKey] = filterMsgs(next[altKey])
      return next
    })
    exitMessageSelection()
    pushGlobalToast({
      variant: 'default',
      title: 'Messages removed',
      description: 'Removed from this chat view (local).',
    })
  }, [activeConversationId, conversations, selectedMessageIds, exitMessageSelection])

  const goHome = () => {
    setScreen('home')
    setActiveConversationId(null)
    setDraft('')
    setMessageSearchConversationId(null)
    setMessageSearchQuery('')
    exitMessageSelection()
  }

  const goBackFromHeader = () => {
    if (messageSelectionActive) {
      exitMessageSelection()
      return
    }
    if (messageSearchConversationId) {
      setMessageSearchConversationId(null)
      setMessageSearchQuery('')
      return
    }
    if (disappearingMessagesConversationId) {
      setDisappearingMessagesConversationId(null)
      return
    }
    if (chatLockPanel.conversationId) {
      closeChatLockPanel()
      return
    }
    if (contactInfoConversationId) {
      setContactInfoConversationId(null)
      return
    }
    if (screen === 'newChatContacts') {
      setNewChatGroupPickMode(false)
      setNewChatGroupSelectedIds([])
      setScreen('home')
      return
    }
    goHome()
  }

  const archiveConversation = useCallback(
    (id: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, archived: true, unreadCount: 0, updatedAt: Date.now() } : c
        )
      )
      if (activeConversationId === id) {
        goHome()
      }
    },
    [activeConversationId]
  )

  const unarchiveConversation = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, archived: false, updatedAt: Date.now() } : c))
    )
  }, [])

  const deleteGenAiSessionsRemote = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    for (const id of ids) {
      genaiHydratedRef.current.delete(id)
      void deleteGenAiChatSession(id).catch(() => {
        // Best-effort; UI already removed from local state.
      })
    }
  }, [])

  const deleteConversation = useCallback(
    (id: string) => {
      const removed = conversations.find((c) => c.id === id)
      if (removed && (removed.mode === 'team' || removed.mode === 'group')) {
        addHiddenFromConversation(removed)
        setHiddenChatRevision((v) => v + 1)
      }
      if (removed?.mode === 'genai') {
        deleteGenAiSessionsRemote([id])
      }
      setConversations((prev) => prev.filter((c) => c.id !== id))
      setMessagesById((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (activeConversationId === id) {
        goHome()
      }
    },
    [activeConversationId, conversations, deleteGenAiSessionsRemote]
  )

  const markAsUnread = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, unreadCount: Math.max(1, c.unreadCount), updatedAt: Date.now() } : c
      )
    )
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() } : c
      )
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectionAnchorId(null)
  }, [])

  const chatContactLabel = useCallback((c: Conversation) => {
    if (c.mode === 'team') return c.contactName ?? c.title
    return c.title
  }, [])

  const proceedOpenConversation = useCallback(
    (id: string) => {
      const current = conversations.find((x) => x.id === id)
      if (!current || current.isBlocked) return
      // Chat lock diperiksa di openConversation; setelah kode benar boleh buka meski isLocked true.
      if (current.channelId) {
        const altKey = channelConversationId(current.channelId)
        setMessagesById((prev) => {
          if ((prev[id]?.length ?? 0) > 0) return prev
          const alt = prev[altKey]
          if (!alt?.length) return prev
          const next: Record<string, ChatMessage[]> = { ...prev, [id]: alt }
          if (altKey !== id) delete next[altKey]
          return next
        })
        teamChannelHydratedRef.current.delete(id)
        teamChannelHydratedRef.current.delete(current.channelId)
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
      )
      setActiveConversationId(id)
      setScreen('thread')
      setDraft('')
      clearSelection()
    },
    [conversations, clearSelection],
  )

  const requestLockChat = useCallback(
    (id: string) => {
      const c = conversations.find((x) => x.id === id)
      if (!c) return
      if (hasChatLockPassword(c.hasChatLockPassword) && c.isLocked) return
      if (c.mode !== 'team') {
        pushGlobalToast({
          variant: 'default',
          title: 'Lock chat',
          description: 'Password lock is only available for People (direct) chats.',
        })
        return
      }
      if (!c.channelId) return
      if (hasChatLockPassword(c.hasChatLockPassword)) {
        void (async () => {
          try {
            const updated = await enableChatLock(c.channelId!)
            setConversations((prev) =>
              prev.map((row) =>
                row.id === id
                  ? {
                      ...row,
                      isLocked: updated.is_chat_locked ?? true,
                      hasChatLockPassword: updated.has_chat_lock_password ?? true,
                      updatedAt: Date.now(),
                    }
                  : row,
              ),
            )
            if (activeConversationId === id) goHome()
          } catch (err) {
            pushGlobalToast({
              variant: 'destructive',
              title: 'Lock chat',
              description: err instanceof Error ? err.message : 'Gagal mengaktifkan lock.',
            })
          }
        })()
        return
      }
      setChatLockError(null)
      openChatLockPanel({
        conversationId: id,
        mode: 'set',
      })
    },
    [conversations, activeConversationId, goHome, openChatLockPanel],
  )

  const requestUnlockChat = useCallback(
    (id: string) => {
      const c = conversations.find((x) => x.id === id)
      if (!c || !isConversationChatLockActive(c)) return
      if (c.mode !== 'team') return
      if (!hasChatLockPassword(c.hasChatLockPassword)) {
        setConversations((prev) =>
          prev.map((row) =>
            row.id === id
              ? { ...row, isLocked: false, hasChatLockPassword: false, updatedAt: Date.now() }
              : row,
          ),
        )
        return
      }
      setChatLockError(null)
      openChatLockPanel({
        conversationId: id,
        mode: 'remove',
      })
    },
    [conversations, openChatLockPanel],
  )

  const handleChatLockPasswordSubmit = useCallback(
    async (password: string) => {
      const { conversationId, mode, pendingOpenAfterUnlock } = chatLockPanel
      if (!conversationId) return
      const conv = conversations.find((x) => x.id === conversationId)
      const channelId = conv?.channelId
      if (!channelId) {
        setChatLockError('Channel tidak tersedia. Muat ulang daftar chat.')
        return
      }
      setChatLockLoading(true)
      setChatLockError(null)
      try {
        if (mode === 'set') {
          const updated = await saveChatLockPassword(channelId, password)
          setConversations((prev) =>
            prev.map((row) =>
              row.id === conversationId
                ? {
                    ...row,
                    isLocked: updated.is_chat_locked ?? true,
                    hasChatLockPassword: updated.has_chat_lock_password ?? true,
                    updatedAt: Date.now(),
                  }
                : row,
            ),
          )
          closeChatLockPanel()
          if (activeConversationId === conversationId) goHome()
          return
        }
        if (mode === 'remove') {
          const updated = await clearChatLockPassword(channelId, password)
          setConversations((prev) =>
            prev.map((row) =>
              row.id === conversationId
                ? {
                    ...row,
                    isLocked: updated.is_chat_locked ?? false,
                    hasChatLockPassword: updated.has_chat_lock_password ?? false,
                    updatedAt: Date.now(),
                  }
                : row,
            ),
          )
          closeChatLockPanel()
          if (activeConversationId === conversationId) goHome()
          return
        }
        const ok = await verifyChatLockPassword(channelId, password)
        if (!ok) {
          setChatLockError('Password salah. Coba lagi.')
          return
        }
        closeChatLockPanel()
        if (pendingOpenAfterUnlock) proceedOpenConversation(conversationId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memproses kode rahasia.'
        setChatLockError(message)
      } finally {
        setChatLockLoading(false)
      }
    },
    [chatLockPanel, conversations, activeConversationId, proceedOpenConversation, closeChatLockPanel],
  )

  const toggleBlur = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isBlurred: !c.isBlurred, updatedAt: Date.now() } : c
      )
    )
  }, [])

  const blockUser = useCallback(
    (id: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, isBlocked: true, unreadCount: 0, updatedAt: Date.now() } : c
        )
      )
      if (activeConversationId === id) {
        goHome()
      }
    },
    [activeConversationId]
  )

  const clearChat = useCallback((id: string) => {
    const conv = conversationsRef.current.find((c) => c.id === id)
    const msgs = resolveThreadMessages(
      id,
      conv?.channelId,
      messagesByIdRef.current,
      conversationsRef.current,
    )
    const maxSeq = msgs.reduce((max, m) => Math.max(max, m.sequenceNo ?? 0), 0)
    if (maxSeq > 0) {
      recordChatHistoryCleared(conv?.channelId, id, maxSeq)
    }
    setMessagesById((prev) => {
      const next = { ...prev, [id]: [] }
      if (conv?.channelId) {
        const altKey = channelConversationId(conv.channelId)
        if (altKey !== id) delete next[altKey]
      }
      return next
    })
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, preview: 'Belum ada pesan', unreadCount: 0, updatedAt: Date.now() }
          : c,
      ),
    )
  }, [])

  const archiveConversationsMany = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      setConversations((prev) =>
        prev.map((c) =>
          idSet.has(c.id) && !c.archived
            ? { ...c, archived: true, unreadCount: 0, updatedAt: Date.now() }
            : c
        )
      )
      if (activeConversationId && idSet.has(activeConversationId)) {
        goHome()
      }
      clearSelection()
    },
    [activeConversationId, clearSelection]
  )

  const handleChatDragStart = useCallback((event: DragStartEvent) => {
    const id = parseChatConvDndId(event.active.id)
    if (id) setActiveDragConvId(id)
  }, [])

  const handleChatDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveDragConvId(null)
      if (showArchived) return
      if (!over) return

      const convId = parseChatConvDndId(active.id)
      if (!convId) return

      // Drag to AI folder (grouping) — only for Gen AI sessions
      const targetFolderKey = parseAiFolderDropId(over.id)
      if (targetFolderKey !== null) {
        const conv = conversations.find((c) => c.id === convId)
        if (!conv || conv.mode !== 'genai') return
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, aiFolderName: targetFolderKey || undefined, updatedAt: Date.now() }
              : c
          )
        )
        return
      }

      // Drag to archive drop zone
      if (over.id !== CHAT_DND_ARCHIVE_ID) return
      if (selectedIds.size > 1 && selectedIds.has(convId)) {
        archiveConversationsMany(Array.from(selectedIds))
      } else {
        archiveConversation(convId)
      }
    },
    [showArchived, selectedIds, archiveConversation, archiveConversationsMany, conversations]
  )

  const handleChatDragCancel = useCallback(() => {
    setActiveDragConvId(null)
  }, [])

  useEffect(() => {
    if (selectedIds.size === 0) return
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement
      if (!el?.closest) return
      if (el.closest('[data-chat-conversation-row]')) return
      if (el.closest('[data-context-menu-root]')) return
      if (el.closest('[data-context-menu-submenu]')) return
      clearSelection()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [selectedIds.size, clearSelection])

  const bulkArchive = useCallback(
    (ids: string[]) => {
      let shouldCloseHome = false
      setConversations((prev) => {
        const sel = prev.filter((c) => ids.includes(c.id))
        const allArchived = sel.length > 0 && sel.every((c) => c.archived)
        const nextArchived = !allArchived
        shouldCloseHome = Boolean(
          activeConversationId && ids.includes(activeConversationId) && nextArchived
        )
        return prev.map((c) => {
          if (!ids.includes(c.id)) return c
          return {
            ...c,
            archived: nextArchived,
            unreadCount: nextArchived ? 0 : c.unreadCount,
            updatedAt: Date.now(),
          }
        })
      })
      if (shouldCloseHome) queueMicrotask(() => goHome())
      clearSelection()
    },
    [activeConversationId, clearSelection]
  )

  const bulkLock = useCallback(
    (ids: string[]) => {
      const sel = conversations.filter((c) => ids.includes(c.id))
      const allLocked = sel.length > 0 && sel.every((c) => isConversationChatLockActive(c))
      const nextLocked = !allLocked
      if (!nextLocked) {
        const teamNeedsRemove = sel.filter(
          (c) => c.mode === 'team' && isConversationChatLockActive(c),
        )
        if (teamNeedsRemove.length === 1) {
          requestUnlockChat(teamNeedsRemove[0].id)
          clearSelection()
          return
        }
        if (teamNeedsRemove.length > 1) {
          pushGlobalToast({
            variant: 'default',
            title: 'Unlock chat',
            description: 'Nonaktifkan lock satu per satu dengan kode rahasia.',
          })
          clearSelection()
          return
        }
      }
      if (nextLocked) {
        const teamNeedsPassword = sel.filter(
          (c) => c.mode === 'team' && !isConversationChatLockActive(c),
        )
        if (teamNeedsPassword.length === 1) {
          requestLockChat(teamNeedsPassword[0].id)
          clearSelection()
          return
        }
        if (teamNeedsPassword.length > 1) {
          pushGlobalToast({
            variant: 'default',
            title: 'Lock chat',
            description: 'Set a password on each People chat individually.',
          })
          return
        }
      }
      clearSelection()
    },
    [conversations, clearSelection, requestLockChat, requestUnlockChat],
  )

  const bulkBlur = useCallback(
    (ids: string[]) => {
      setConversations((prev) => {
        const sel = prev.filter((c) => ids.includes(c.id))
        const allBlurred = sel.length > 0 && sel.every((c) => c.isBlurred)
        const nextBlurred = !allBlurred
        return prev.map((c) => {
          if (!ids.includes(c.id)) return c
          return { ...c, isBlurred: nextBlurred, updatedAt: Date.now() }
        })
      })
      clearSelection()
    },
    [clearSelection]
  )

  const bulkFavorite = useCallback(
    (ids: string[]) => {
      setConversations((prev) => {
        const sel = prev.filter((c) => ids.includes(c.id))
        const allFav = sel.length > 0 && sel.every((c) => c.isFavorite)
        const nextFav = !allFav
        return prev.map((c) => {
          if (!ids.includes(c.id)) return c
          return { ...c, isFavorite: nextFav, updatedAt: Date.now() }
        })
      })
      clearSelection()
    },
    [clearSelection]
  )

  const bulkClearChat = useCallback(
    (ids: string[]) => {
      setMessagesById((prev) => {
        const next = { ...prev }
        for (const id of ids) next[id] = []
        return next
      })
      setConversations((prev) =>
        prev.map((c) =>
          ids.includes(c.id)
            ? { ...c, preview: 'Belum ada pesan', unreadCount: 0, updatedAt: Date.now() }
            : c
        )
      )
      clearSelection()
    },
    [clearSelection]
  )

  const bulkDelete = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids)
      const genaiIds = conversations.filter((c) => idSet.has(c.id) && c.mode === 'genai').map((c) => c.id)
      if (genaiIds.length > 0) {
        deleteGenAiSessionsRemote(genaiIds)
      }
      setConversations((prev) => prev.filter((c) => !idSet.has(c.id)))
      setMessagesById((prev) => {
        const next = { ...prev }
        for (const id of ids) delete next[id]
        return next
      })
      if (activeConversationId && ids.includes(activeConversationId)) {
        goHome()
      }
      clearSelection()
    },
    [activeConversationId, clearSelection, conversations, deleteGenAiSessionsRemote]
  )

  const bulkMenuCanCreateGroup = useMemo(() => {
    const ids = contextMenu.conversationIds
    if (ids.length < 2) return false
    const picked = conversations.filter((c) => ids.includes(c.id))
    if (picked.length !== ids.length) return false
    if (!picked.every((c) => c.mode === 'team' && c.contactId)) return false
    return new Set(picked.map((c) => c.contactId!)).size >= 2
  }, [contextMenu.conversationIds, conversations])

  const bulkMenuCanCreateAiFolder = useMemo(() => {
    const ids = contextMenu.conversationIds
    if (ids.length < 2) return false
    const picked = conversations.filter((c) => ids.includes(c.id))
    if (picked.length !== ids.length) return false
    return picked.every((c) => c.mode === 'genai')
  }, [contextMenu.conversationIds, conversations])

  const assignAiFolderToSelected = useCallback(
    (sourceIds: string[], folderTitle: string) => {
      const name = folderTitle.trim()
      if (!name) return
      setConversations((prev) =>
        prev.map((c) =>
          sourceIds.includes(c.id) && c.mode === 'genai' ? { ...c, aiFolderName: name } : c
        )
      )
      setFolderDialogOpen(false)
      setFolderDialogPendingIds([])
      setFolderNameDraft('')
      clearSelection()
    },
    [clearSelection]
  )

  const openConversation = (id: string) => {
    const current = conversations.find((x) => x.id === id)
    if (current?.isBlocked) return
    if (current && isConversationChatLockActive(current)) {
      if (activeConversationId === id && screen === 'thread') return
      setChatLockError(null)
      openChatLockPanel({
        conversationId: id,
        mode: 'open',
        pendingOpenAfterUnlock: true,
      })
      return
    }
    proceedOpenConversation(id)
  }

  const bindGroupChannelToConversation = useCallback(
    (convId: string, title: string, memberContactIds: string[]) => {
      const actorId = getCurrentChatActorId()
      const memberUserIds = [...new Set([actorId, ...memberContactIds])]
      void (async () => {
        try {
          const ch = await createGroupChannel(TECTONA_CHAT_WORKSPACE_ID, title, memberUserIds)
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId ? { ...c, channelId: ch.id, preview: 'Group ready', updatedAt: Date.now() } : c,
            ),
          )
          const msgs = await listChannelMessages(ch.id, { limit: 100 })
          const mapped = mapCollaborationMessagesToUi(msgs, actorId) as ChatMessage[]
          setMessagesById((prev) => ({
            ...prev,
            [convId]: mapped.length > 0 ? mapped : (prev[convId] ?? []),
          }))
          teamChannelHydratedRef.current.add(convId)
          teamChannelHydratedRef.current.add(ch.id)
          await refreshCollaborationInbox()
        } catch {
          // UI tetap terbuka; kirim pesan akan meminta bind channel
        }
      })()
    },
    [refreshCollaborationInbox],
  )

  const createGroupFromSelectedConversations = useCallback(
    (sourceIds: string[], groupTitle: string) => {
      const name = groupTitle.trim()
      if (!name) return
      const picked = conversations.filter((c) => sourceIds.includes(c.id))
      const teamOnly = picked.filter((c) => c.mode === 'team' && c.contactId)
      const byContact = new Map<string, string>()
      for (const c of teamOnly) {
        if (c.contactId) byContact.set(c.contactId, c.contactName ?? c.title)
      }
      if (byContact.size < 2) return
      const groupMemberContactIds = [...byContact.keys()]
      const groupMemberNames = groupMemberContactIds.map((id) => byContact.get(id)!)

      const now = Date.now()
      const id = `conv-group-${now}`
      const newConv: Conversation = {
        id,
        mode: 'group',
        title: name,
        groupMemberContactIds,
        groupMemberNames,
        preview: 'Creating group…',
        updatedAt: now,
        unreadCount: 0,
        archived: false,
        isFavorite: false,
        isLocked: false,
        isBlurred: false,
        isBlocked: false,
      }
      setConversations((prev) => [newConv, ...prev])
      setMessagesById((prev) => ({ ...prev, [id]: [] }))
      bindGroupChannelToConversation(id, name, groupMemberContactIds)
      setGroupDialogOpen(false)
      setGroupDialogPendingIds([])
      setGroupDialogPendingContactIds([])
      setGroupNameDraft('')
      setActiveConversationId(id)
      setScreen('thread')
      setDraft('')
      clearSelection()
    },
    [conversations, clearSelection, bindGroupChannelToConversation, chatContacts],
  )

  const createGroupFromContactIds = useCallback(
    (contactIds: string[], groupTitle: string) => {
      const title = groupTitle.trim()
      if (!title) return
      const uniq = [
        ...new Set(
          contactIds.filter((id) => {
            const c = chatContacts.find((x) => x.id === id)
            return c ? canPickContactForGroupChat(c, getCurrentChatActorId()) : false
          })
        ),
      ]
      if (uniq.length < 2) return
      const groupMemberContactIds = uniq
      const groupMemberNames = uniq.map(
        (cid) => chatContacts.find((x) => x.id === cid)?.name ?? cid,
      )

      const now = Date.now()
      const id = `conv-group-${now}`
      const newConv: Conversation = {
        id,
        mode: 'group',
        title,
        groupMemberContactIds,
        groupMemberNames,
        preview: 'Creating group…',
        updatedAt: now,
        unreadCount: 0,
        archived: false,
        isFavorite: false,
        isLocked: false,
        isBlurred: false,
        isBlocked: false,
      }
      setConversations((prev) => [newConv, ...prev])
      setMessagesById((prev) => ({ ...prev, [id]: [] }))
      bindGroupChannelToConversation(id, title, groupMemberContactIds)
      setGroupDialogOpen(false)
      setGroupDialogPendingIds([])
      setGroupDialogPendingContactIds([])
      setGroupNameDraft('')
      setNewChatGroupPickMode(false)
      setNewChatGroupSelectedIds([])
      setActiveConversationId(id)
      setScreen('thread')
      setDraft('')
      setContactSearchQuery('')
      clearSelection()
    },
    [clearSelection, bindGroupChannelToConversation, chatContacts],
  )

  const startChatWithContact = (contact: ChatContact) => {
    if (contact.mode === 'team') {
      unhideChatForContact(contact)
      setHiddenChatRevision((v) => v + 1)
      // People chat is not per-session: one contact => one thread (reuse if exists).
      const existing = conversationsRef.current.find(
        (c) => c.mode === 'team' && c.contactId === contact.id && !c.archived,
      )
      if (existing) {
        openConversation(existing.id)
        setScreen('thread')
        setDraft('')
        setSearchQuery('')
        setContactSearchQuery('')
        return
      }
    }

    const now = Date.now()
    const isAi = contact.mode === 'genai'
    const id = isAi ? `genai-${crypto.randomUUID()}` : `conv-${contact.id}-${now}`
    const newConv: Conversation = {
      id,
      mode: contact.mode,
      // Keep title aligned with backend default from first render to avoid
      // same-session title drift after close/reopen hydration.
      title: isAi ? 'Percakapan baru' : contact.name,
      contactId: contact.mode === 'team' ? contact.id : undefined,
      contactName: contact.mode === 'team' ? contact.name : undefined,
      contactAvatarSrc: contact.mode === 'team' ? contact.avatarSrc : undefined,
      preview: 'Belum ada pesan',
      updatedAt: now,
      unreadCount: 0,
      archived: false,
      isFavorite: false,
      isLocked: false,
      isBlurred: false,
      isBlocked: false,
    }
    setConversations((prev) => [newConv, ...prev])
    setMessagesById((prev) => ({ ...prev, [id]: [] }))
    setActiveConversationId(id)
    setScreen('thread')
    setDraft('')
    setSearchQuery('')
    setContactSearchQuery('')

    if (contact.mode === 'team' && contact.id) {
      const convId = id
      const peerId = contact.id
      void (async () => {
        try {
          const channel = await createDirectChannel(TECTONA_CHAT_WORKSPACE_ID, peerId)
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, channelId: channel.id } : c)),
          )
        } catch {
          // Thread remains open; channel bind may still be in progress
        }
      })()
    }
  }

  const findConversationForOpenRequest = useCallback(
    (list: Conversation[], request: OpenChatThreadRequest): Conversation | undefined => {
      const byChannel = list.find((c) => c.channelId === request.channelId && !c.archived)
      if (byChannel) return byChannel
      if (request.channelType === 'group' && request.channelTitle) {
        const byGroupTitle = list.find(
          (c) => c.mode === 'group' && c.title === request.channelTitle && !c.archived,
        )
        if (byGroupTitle) return byGroupTitle
      }
      if (request.senderUserId) {
        return list.find(
          (c) => c.mode === 'team' && c.contactId === request.senderUserId && !c.archived,
        )
      }
      return undefined
    },
    [],
  )

  const fulfillPendingChatOpen = useCallback(
    async (request: OpenChatThreadRequest): Promise<boolean> => {
      unhideOpenChatRequest(request)
      setHiddenChatRevision((v) => v + 1)

      let contacts = chatContactsRef.current
      if (contacts.length <= 1) {
        try {
          const loaded = await loadChatContactDirectory()
          contacts = loaded
          chatContactsRef.current = loaded
          setChatContacts(loaded)
        } catch {
          contacts = chatContactsRef.current
        }
      }

      let match = findConversationForOpenRequest(conversationsRef.current, request)
      if (match) {
        openConversation(match.id)
        return true
      }

      try {
        const res = await listWorkspaceChannels(TECTONA_CHAT_WORKSPACE_ID, { pageSize: 100 })
        const channel = res.items.find((ch) => ch.id === request.channelId)
        const apiConversations = res.items
          .map((ch) => collaborationChannelToConversation(ch, contacts))
          .filter((c): c is Conversation => c != null)
          .filter((c) => !isHiddenPeopleConversation(c))

        match = findConversationForOpenRequest(apiConversations, request)
        if (match) {
          setConversations((prev) => {
            const genai = prev.filter((c) => c.mode === 'genai')
            const teamGroup = mergeCollaborationInbox(
              prev.filter((c) => c.mode === 'team' || c.mode === 'group'),
              apiConversations,
            )
            const sorted = [...genai, ...teamGroup].sort((a, b) => b.updatedAt - a.updatedAt)
            conversationsRef.current = sorted
            return sorted
          })
          openConversation(match.id)
          return true
        }

        if (channel?.channel_type === 'direct' && channel.peer_user_id) {
          const peerContact = buildTeamChatContactForUserId(channel.peer_user_id, contacts)
          const byChannelConv: Conversation = {
            id: channelConversationId(channel.id),
            mode: 'team',
            title: peerContact.name,
            contactId: channel.peer_user_id,
            contactName: peerContact.name,
            contactAvatarSrc: peerContact.avatarSrc,
            channelId: channel.id,
            ...safePeerReceiptFromChannel(channel),
            preview: truncatePreview(channel.last_message_preview?.trim() || 'Belum ada pesan'),
            updatedAt: parseCollaborationTimestamp(channel.last_message_at),
            unreadCount: channel.unread_count ?? 0,
          }
          setConversations((prev) => {
            const genai = prev.filter((c) => c.mode === 'genai')
            const teamGroup = mergeCollaborationInbox(
              prev.filter((c) => c.mode === 'team' || c.mode === 'group'),
              [byChannelConv],
            )
            const sorted = [...genai, ...teamGroup].sort((a, b) => b.updatedAt - a.updatedAt)
            conversationsRef.current = sorted
            return sorted
          })
          teamChannelHydratedRef.current.delete(byChannelConv.id)
          teamChannelHydratedRef.current.delete(channel.id)
          openConversation(
            conversationsRef.current.find((c) => c.channelId === channel.id)?.id ?? byChannelConv.id,
          )
          return true
        }
      } catch {
        // fall through to contact lookup
      }

      if (request.senderUserId) {
        const contact = buildTeamChatContactForUserId(request.senderUserId, contacts)
        startChatWithContact(contact)
        return true
      }

      return false
    },
    [findConversationForOpenRequest],
  )

  useEffect(() => {
    if (!pendingChatOpen) return
    const request = pendingChatOpen
    let cancelled = false
    let attempts = 0

    const attemptOpen = () => {
      if (cancelled) return
      void fulfillPendingChatOpen(request).then((opened) => {
        if (cancelled) return
        if (opened) {
          clearPendingChatOpen()
          return
        }
        attempts += 1
        if (attempts < 15) {
          window.setTimeout(attemptOpen, 400)
        }
      })
    }

    attemptOpen()
    return () => {
      cancelled = true
    }
  }, [pendingChatOpen, fulfillPendingChatOpen, clearPendingChatOpen, chatContacts.length])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const found = prev.find((a) => a.id === id)
      if (found?.url && found.url.startsWith('blob:')) URL.revokeObjectURL(found.url)
      return prev.filter((a) => a.id !== id)
    })
    setPendingImagePreview((p) => (p?.id === id ? null : p))
  }, [])

  const addImageFilesAsAttachments = useCallback((files: File[]) => {
    const next: ChatAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      next.push({
        id: `att-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
        kind: 'image',
        name: file.name || `image-${i + 1}.png`,
        url: URL.createObjectURL(file),
        mimeType: file.type,
      })
    }
    if (next.length) setPendingAttachments((p) => [...p, ...next])
  }, [])

  const addPhotosAndVideoFiles = useCallback((files: File[]) => {
    const next: ChatAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        next.push({
          id: `att-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
          kind: 'image',
          name: file.name || `image-${i + 1}.png`,
          url: URL.createObjectURL(file),
          mimeType: file.type,
        })
      } else if (file.type.startsWith('video/')) {
        next.push({
          id: `att-${Date.now()}-v-${i}-${Math.random().toString(36).slice(2, 9)}`,
          kind: 'video',
          name: file.name || `video-${i + 1}.mp4`,
          url: URL.createObjectURL(file),
          mimeType: file.type,
        })
      }
    }
    if (next.length) setPendingAttachments((p) => [...p, ...next])
  }, [])

  const onPickPhotosAndVideos = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      addPhotosAndVideoFiles(Array.from(files))
      e.target.value = ''
    },
    [addPhotosAndVideoFiles]
  )

  const onPickAudioFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const next: ChatAttachment[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue
      next.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        kind: 'audio',
        name: file.name || 'audio',
        url: URL.createObjectURL(file),
        mimeType: file.type,
      })
    }
    if (next.length) setPendingAttachments((p) => [...p, ...next])
    e.target.value = ''
  }, [])

  const onPickImages = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      addImageFilesAsAttachments(Array.from(files))
      e.target.value = ''
    },
    [addImageFilesAsAttachments]
  )

  const onGenAiComposerPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const mode = activeConversation?.mode
      if (mode !== 'genai' && mode !== 'team' && mode !== 'group') return
      const cd = e.clipboardData
      if (!cd) return

      const imageFiles: File[] = []
      for (let i = 0; i < cd.items.length; i++) {
        const item = cd.items[i]
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) imageFiles.push(f)
        }
      }
      if (imageFiles.length === 0) {
        for (let i = 0; i < cd.files.length; i++) {
          const f = cd.files[i]
          if (f.type.startsWith('image/')) imageFiles.push(f)
        }
      }
      if (imageFiles.length === 0) return

      e.preventDefault()
      addImageFilesAsAttachments(imageFiles)

      const textPlain = cd.getData('text/plain')
      if (!textPlain) return

      const ta = e.currentTarget
      const selStart = ta.selectionStart ?? 0
      const selEnd = ta.selectionEnd ?? 0
      setDraft((prev) => prev.slice(0, selStart) + textPlain + prev.slice(selEnd))
      queueMicrotask(() => {
        const pos = selStart + textPlain.length
        ta.focus()
        ta.setSelectionRange(pos, pos)
      })
    },
    [activeConversation?.mode, addImageFilesAsAttachments]
  )

  const shareableTeamContacts = useMemo(
    () =>
      chatContacts.filter(
        (c) => canPickContactForGroupChat(c, getCurrentChatActorId())
      ),
    []
  )

  const filteredShareableContactsForAttach = useMemo(() => {
    const q = contactAttachSearchQuery.trim().toLowerCase()
    if (!q) return shareableTeamContacts
    return shareableTeamContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.subtitle?.toLowerCase().includes(q) ?? false)
    )
  }, [shareableTeamContacts, contactAttachSearchQuery])

  const confirmShareContactAttachment = useCallback(() => {
    if (!contactAttachSelectedId) return
    const c = shareableTeamContacts.find((x) => x.id === contactAttachSelectedId)
    if (!c) return
    setPendingAttachments((p) => [
      ...p,
      {
        id: `att-contact-${Date.now()}`,
        kind: 'contact',
        name: c.name,
        subtitle: c.subtitle ?? 'Contact',
        url: '',
      },
    ])
    setContactAttachOpen(false)
  }, [contactAttachSelectedId, shareableTeamContacts])

  const appendEmojiToDraft = useCallback((emoji: string) => {
    setDraft((d) => (d ? `${d}${emoji}` : emoji))
  }, [])

  const submitPollAttachment = useCallback(() => {
    const q = pollQuestion.trim()
    const a = pollOpt1.trim()
    const b = pollOpt2.trim()
    if (!q || !a || !b) return
    setPendingAttachments((p) => [
      ...p,
      {
        id: `att-poll-${Date.now()}`,
        kind: 'poll',
        name: q,
        subtitle: `${a} · ${b}`,
        url: '',
      },
    ])
    setPollQuestion('')
    setPollOpt1('')
    setPollOpt2('')
    setPollAttachOpen(false)
  }, [pollQuestion, pollOpt1, pollOpt2])

  const resetEventComposer = useCallback(() => {
    setEventNameDraft('')
    setEventDescriptionDraft('')
    setEventStartDate('')
    setEventStartTime('')
    setEventEndExpanded(false)
    setEventEndDate('')
    setEventEndTime('')
    setEventLocationDraft('')
  }, [])

  const submitEventAttachment = useCallback(() => {
    const title = eventNameDraft.trim()
    if (!title) return
    const start = parseLocalDateAndTime(eventStartDate, eventStartTime)
    let subtitle = start
      ? start.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Time TBD'
    if (eventEndExpanded && eventEndDate.trim()) {
      const end = parseLocalDateAndTime(eventEndDate, eventEndTime)
      if (end) {
        subtitle = `${subtitle} – ${end.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`
      }
    }
    const desc = eventDescriptionDraft.trim()
    const loc = eventLocationDraft.trim()
    setPendingAttachments((p) => [
      ...p,
      {
        id: `att-event-${Date.now()}`,
        kind: 'event',
        name: title,
        subtitle,
        url: '',
        ...(desc ? { eventDescription: desc } : {}),
        ...(loc ? { eventLocation: loc } : {}),
      },
    ])
    resetEventComposer()
    setEventAttachOpen(false)
  }, [
    eventNameDraft,
    eventStartDate,
    eventStartTime,
    eventEndExpanded,
    eventEndDate,
    eventEndTime,
    eventDescriptionDraft,
    eventLocationDraft,
    resetEventComposer,
  ])

  const onPickDocuments = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const next: ChatAttachment[] = []
    for (const file of Array.from(files)) {
      const ok =
        /^(application\/pdf|text\/|application\/msword|application\/vnd\.openxmlformats)/.test(file.type) ||
        /\.(pdf|doc|docx|txt|md|csv|xlsx|xls|pptx)$/i.test(file.name)
      if (!ok) continue
      next.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        kind: 'document',
        name: file.name,
        url: URL.createObjectURL(file),
        mimeType: file.type,
      })
    }
    if (next.length) setPendingAttachments((p) => [...p, ...next])
    e.target.value = ''
  }, [])

  const toggleVoiceRecording = useCallback(async () => {
    if (isRecordingVoice) {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') {
        try {
          mr.requestData()
        } catch {
          // ignore
        }
        mr.stop()
      }
      setIsRecordingVoice(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      recordedChunksRef.current = []
      mr.ondataavailable = (ev) => {
        if (ev.data.size) recordedChunksRef.current.push(ev.data)
      }
      mr.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const chunks = recordedChunksRef.current
        if (!chunks.length) return
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setPendingAttachments((p) => [
          ...p,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            kind: 'audio',
            name: 'voice-message.webm',
            url,
            mimeType: blob.type,
          },
        ])
      }
      mr.start(250)
      setIsRecordingVoice(true)
    } catch {
      // Mic denied or unsupported
    }
  }, [isRecordingVoice])

  const capturePageEvidenceAttachment = useCallback(
    async (options?: {
      focusText?: string
      uiContext?: TectonaUiContextPayload | null
    }): Promise<ChatAttachment | null> => {
    try {
      const html2canvasModule = await import('html2canvas')
      const html2canvas = html2canvasModule.default
      const root = resolveEvidenceCaptureRoot()
      if (!root) return null

      const candidates = buildEvidenceFocusCandidates(options?.focusText ?? '', options?.uiContext ?? null)
      const capturePlan = resolveEvidenceCapturePlan(root, candidates)
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      const { target, options: canvasOptions } = html2CanvasOptionsForPlan(capturePlan, scale)

      const canvas = await html2canvas(target, canvasOptions)

      const cropTarget = capturePlan.kind === 'element' ? capturePlan.target : target
      const croppedCanvas = cropFocusedEvidenceCanvas(canvas, cropTarget)
      const centeredCanvas = recenterCanvasByInk(croppedCanvas)

      const dataUrl = centeredCanvas.toDataURL('image/png', 0.95)
      if (!dataUrl || !dataUrl.startsWith('data:image/png')) return null

      const ts = new Date()
      const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`
      const subtitle =
        capturePlan.kind === 'union'
          ? `Auto-captured KPI + filter evidence (${capturePlan.matchCount} areas)`
          : capturePlan.focused
            ? 'Auto-captured focused context evidence screenshot'
            : 'Auto-captured context evidence screenshot'
      return {
        id: `att-screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        kind: 'image',
        name: `context-evidence-${stamp}.png`,
        url: dataUrl,
        mimeType: 'image/png',
        subtitle,
      }
    } catch {
      return null
    }
  }, [])

  const uploadAttachmentForGenAi = useCallback(
    async (conversationId: string, attachment: ChatAttachment): Promise<ChatAttachment> => {
      if (attachment.kind === 'contact' || attachment.kind === 'poll' || attachment.kind === 'event') {
        return attachment
      }

      const dataUrl = await attachmentUrlToDataUrl(attachment.url, attachment.mimeType)
      const uploaded = await uploadChatAttachment({
        workspace_id: TECTONA_CHAT_WORKSPACE_ID,
        session_id: conversationId,
        kind: attachment.kind,
        name: attachment.name,
        data_url: dataUrl,
        mime_type: attachment.mimeType,
        subtitle: attachment.subtitle,
        event_description: attachment.eventDescription,
        event_location: attachment.eventLocation,
      })

      return {
        id: uploaded.attachment.id || attachment.id,
        kind: attachment.kind,
        name: uploaded.attachment.name || attachment.name,
        url: uploaded.attachment.url,
        ...(uploaded.attachment.mime_type ? { mimeType: uploaded.attachment.mime_type } : {}),
        ...(uploaded.attachment.subtitle ? { subtitle: uploaded.attachment.subtitle } : {}),
        ...(uploaded.attachment.event_description ? { eventDescription: uploaded.attachment.event_description } : {}),
        ...(uploaded.attachment.event_location ? { eventLocation: uploaded.attachment.event_location } : {}),
      }
    },
    [],
  )

  const persistAttachmentsForGenAi = useCallback(
    async (conversationId: string, attachments: ChatAttachment[]): Promise<ChatAttachment[]> => {
      if (!attachments.length) return []
      const persisted = await Promise.all(
        attachments.map((a) => uploadAttachmentForGenAi(conversationId, a)),
      )
      return persisted
    },
    [uploadAttachmentForGenAi],
  )

  // Voice assistant: refs read inside send()/effects to avoid stale closures.
  const voiceListeningRef = useRef(false)
  const voiceSpeakRef = useRef(true)

  const send = async (textOverride?: string) => {
    if (!activeConversationId) return
    const conversationId = activeConversationId
    const t = (textOverride ?? draft).trim()
    const conv = conversations.find((c) => c.id === conversationId)
    const convMode = conv?.mode ?? 'team'
    const uiContext =
      convMode === 'genai'
        ? buildTectonaUiContextForChat({
            pathname: location.pathname,
            search: location.search,
            chatPanelOpen: true,
            chatScreen: screen,
            activeConversationTitle: conv?.title ?? null,
            activeConversationMode: conv?.mode ?? null,
          })
        : null
    let attachSnapshot =
      convMode === 'genai' || convMode === 'team' || convMode === 'group'
        ? pendingAttachments.map((a) => ({ ...a }))
        : []
    let autoEvidenceAttachment: ChatAttachment | null = null

    if (
      shouldAutoCaptureContextEvidence({
        convMode,
        text: t,
        hasImageAttachment: attachSnapshot.some((a) => a.kind === 'image'),
        pathname: location.pathname,
        uiContext,
      })
    ) {
      const captured = await capturePageEvidenceAttachment({
        focusText: t,
        uiContext,
      })
      if (captured) {
        autoEvidenceAttachment = captured
      } else {
        pushGlobalToast({
          variant: 'error',
          title: 'Screenshot capture unavailable',
          description: 'Auto evidence screenshot could not be captured. Please attach a screenshot manually.',
        })
      }
    }

    if (convMode === 'genai') {
      if (attachSnapshot.length > 0) {
        try {
          const originalAttachments = attachSnapshot
          attachSnapshot = await persistAttachmentsForGenAi(conversationId, originalAttachments)
          for (const original of originalAttachments) {
            if (original.url.startsWith('blob:')) {
              URL.revokeObjectURL(original.url)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Attachment upload failed.'
          pushGlobalToast({
            variant: 'error',
            title: 'Upload attachment gagal',
            description: message,
          })
          return
        }
      }

      if (autoEvidenceAttachment) {
        try {
          autoEvidenceAttachment = await uploadAttachmentForGenAi(conversationId, autoEvidenceAttachment)
        } catch (error) {
          // Do not block user message when automatic evidence storage is unavailable.
          autoEvidenceAttachment = null
          const message = error instanceof Error ? error.message : 'Auto evidence upload failed.'
          pushGlobalToast({
            variant: 'error',
            title: 'Auto evidence dilewati',
            description: message,
          })
        }
      }
    }

    if (!t && attachSnapshot.length === 0) return
    const now = Date.now()
    const userMsg: ChatMessage = {
      id: `u-${now}`,
      role: 'user',
      text: t,
      at: now,
      ...(convMode === 'group' && getCurrentChatActorId()
        ? { senderContactId: getCurrentChatActorId() }
        : {}),
      ...(attachSnapshot.length ? { attachments: attachSnapshot } : {}),
    }
    setMessagesForActive((prev) => [...prev, userMsg])
    setDraft('')
    if (convMode === 'genai' || convMode === 'team' || convMode === 'group') setPendingAttachments([])

    const previewLine =
      t.length > 0
        ? t.slice(0, 72) + (t.length > 72 ? '…' : '')
        : attachSnapshot.length > 0
          ? `📎 ${attachSnapshot.length} lampiran${attachSnapshot.length === 1 ? '' : ''}`
          : ''

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              title:
                c.mode === 'group'
                  ? c.title
                  : c.title === 'New conversation' || c.title === 'Percakapan baru'
                    ? t.length > 0
                      ? t.slice(0, 48) + (t.length > 48 ? '…' : '')
                      : attachSnapshot.length > 0
                        ? 'Lampiran'
                        : c.title
                    : c.title,
              preview: previewLine,
              updatedAt: now,
            }
          : c
      )
    )

    if (convMode === 'genai') {
      const manualAttachmentCount = attachSnapshot.length
      const attCount = manualAttachmentCount + (autoEvidenceAttachment ? 1 : 0)
      const loadingMsgId = `a-loading-${Date.now()}`
      setMessagesById((prev) => ({
        ...prev,
        [conversationId]: [
          ...(prev[conversationId] ?? []),
          {
            id: loadingMsgId,
            role: 'assistant',
            text: '',
            at: Date.now(),
            isLoading: true,
          },
        ],
      }))
      try {
        const runtimeUiContext = extendUiContextWithAttachmentNotes(
          uiContext ??
            buildTectonaUiContextForChat({
              pathname: location.pathname,
              search: location.search,
              chatPanelOpen: true,
              chatScreen: screen,
              activeConversationTitle: conv?.title ?? null,
              activeConversationMode: conv?.mode ?? null,
            }),
          {
            manualAttachmentCount,
            hasAutoEvidence: Boolean(autoEvidenceAttachment),
            userMessage: t,
          },
        )

        const runtimeUserAttachments = attachSnapshot.map((a) => ({
          id: a.id,
          kind: a.kind,
          name: a.name,
          url: a.url,
          ...(a.mimeType ? { mime_type: a.mimeType } : {}),
          ...(a.subtitle ? { subtitle: a.subtitle } : {}),
          ...(a.eventDescription ? { event_description: a.eventDescription } : {}),
          ...(a.eventLocation ? { event_location: a.eventLocation } : {}),
        }))
        const runtimeAssistantAttachments = autoEvidenceAttachment
          ? [
              {
                id: autoEvidenceAttachment.id,
                kind: autoEvidenceAttachment.kind,
                name: autoEvidenceAttachment.name,
                url: autoEvidenceAttachment.url,
                ...(autoEvidenceAttachment.mimeType ? { mime_type: autoEvidenceAttachment.mimeType } : {}),
                ...(autoEvidenceAttachment.subtitle ? { subtitle: autoEvidenceAttachment.subtitle } : {}),
                ...(autoEvidenceAttachment.eventDescription
                  ? { event_description: autoEvidenceAttachment.eventDescription }
                  : {}),
                ...(autoEvidenceAttachment.eventLocation
                  ? { event_location: autoEvidenceAttachment.eventLocation }
                  : {}),
              },
            ]
          : []

        const runtime = await sendTectonaAgentRuntimeMessage({
          message: t,
          context: {
            workspace_id: TECTONA_CHAT_WORKSPACE_ID,
            session_id: conversationId,
            ui: runtimeUiContext,
            user_attachments: runtimeUserAttachments,
            assistant_attachments: runtimeAssistantAttachments,
          },
        })

        if (import.meta.env.DEV && runtime.warnings.length > 0) {
          console.debug('[Tectona Assistant]', {
            warnings: runtime.warnings,
            correlation_id: runtime.correlation_id,
            evidence_count: runtime.evidence.length,
          })
        }

        if (runtime.context_usage) {
          setLastGenAiContextUsage(runtime.context_usage)
        }

        const proposedActions = runtime.proposed_actions ?? []
        const chatEvidence = runtime.evidence.filter((item) => item.key_ref)
        // Auto-run actions the backend already got the user to confirm (in chat): direct
        // navigation, and the conversational create/governance once the user said "ya".
        const AUTO_RUN_CODES = [
          'app.navigate',
          'workspace.create',
          'workspace.update',
          'workspace.governance.apply',
        ]
        const autoRunActions = proposedActions.filter(
          (action) => AUTO_RUN_CODES.includes(action.action_code) && action.requires_confirmation === false,
        )
        for (const action of autoRunActions) {
          if (action.action_code === 'app.navigate') {
            void executeTectonaAgentAction(action).catch(() => undefined)
          } else {
            // Create/update/governance: run it, then post the result as an assistant message (no card).
            void executeTectonaAgentAction(action)
              .then((summary) => {
                window.dispatchEvent(
                  new CustomEvent('tectona:chat-inject-assistant', { detail: { text: `✅ ${summary}` } }),
                )
              })
              .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : 'Aksi gagal dijalankan.'
                window.dispatchEvent(
                  new CustomEvent('tectona:chat-inject-assistant', {
                    detail: { text: `⚠️ Gagal: ${msg}` },
                  }),
                )
              })
          }
        }
        // Auto-ran actions must NOT also render a confirmation card.
        const autoRunIds = new Set(autoRunActions.map((action) => action.action_id))
        const cardActions = proposedActions.filter((action) => !autoRunIds.has(action.action_id))

        setMessagesById((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.id === loadingMsgId
              ? {
                  ...m,
                  text: runtime.answer.trim(),
                  at: Date.now(),
                  isLoading: false,
                  ...(chatEvidence.length > 0 ? { evidence: chatEvidence } : {}),
                  ...(autoEvidenceAttachment
                    ? { attachments: [autoEvidenceAttachment] }
                    : {}),
                  ...(cardActions.length > 0
                    ? { agentActionState: buildAgentActionState(cardActions) }
                    : {}),
                }
              : m,
          ),
        }))

        // Speak the reply when voice mode is active (hands-free).
        if (voiceListeningRef.current && voiceSpeakRef.current) {
          speakReply(runtime.answer.trim())
        }

        if (runtime.session_title && runtime.session_title.trim()) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    title: runtime.session_title!.trim(),
                    updatedAt: Date.now(),
                  }
                : c
            )
          )
        }
      } catch (error) {
        const runtimeErrorMessage =
          error instanceof Error ? error.message : 'Tidak dapat menghubungi Tectona Assistant.'
        pushGlobalToast({
          variant: 'error',
          title: 'Gagal menghubungi Tectona Assistant',
          description: runtimeErrorMessage,
        })
        setMessagesById((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((m) =>
            m.id === loadingMsgId
              ? {
                  ...m,
                  text: `Gagal memproses pesan: ${runtimeErrorMessage}`,
                  at: Date.now(),
                  isLoading: false,
                }
              : m,
          ),
        }))
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, updatedAt: Date.now(), unreadCount: 0 }
            : c
        )
      )
    } else if (convMode === 'team' || convMode === 'group') {
      let channelId = conv?.channelId
      try {
        if (!channelId && convMode === 'team' && conv?.contactId) {
          const ch = await createDirectChannel(TECTONA_CHAT_WORKSPACE_ID, conv.contactId)
          channelId = ch.id
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? { ...c, channelId: ch.id } : c)),
          )
        }
        if (!channelId) {
          throw new Error(
            convMode === 'group'
              ? 'Group channel is not ready yet.'
              : 'Direct channel is not connected yet.',
          )
        }
        if (t) {
          const sent = await sendChannelMessage(channelId, t)
          setMessagesById((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] ?? []).map((m) =>
              m.id === userMsg.id
                ? {
                    ...m,
                    id: sent.id,
                    sequenceNo: sent.sequence_no,
                    ...(sent.expires_at ? { expiresAt: new Date(sent.expires_at).getTime() } : {}),
                  }
                : m,
            ),
          }))
          void syncChannelReceiptsAndMessageSequences(conversationId, channelId)
          if (convMode === 'team') {
            let polls = 0
            const pollPeerReceipts = () => {
              void syncChannelReceiptsAndMessageSequences(conversationId, channelId)
              polls += 1
              if (polls < 6) window.setTimeout(pollPeerReceipts, 1000)
            }
            window.setTimeout(pollPeerReceipts, 500)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send message.'
        pushGlobalToast({
          variant: 'error',
          title: 'Gagal mengirim pesan',
          description: message,
        })
        setMessagesById((prev) => ({
          ...prev,
          [conversationId]: [
            ...(prev[conversationId] ?? []),
            {
              id: `err-${Date.now()}`,
              role: 'system',
              text: `Send failed: ${message}`,
              at: Date.now(),
            },
          ],
        }))
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, updatedAt: Date.now(), unreadCount: 0 } : c))
      )
    }
  }

  // --- Voice assistant (self-host wake word + STT) ---
  const sendRef = useRef(send)
  sendRef.current = send

  // Assistant action cards can ask the agent to explain something "in chat" — they
  // dispatch `tectona:chat-send` with the prompt text, which we submit as a normal turn.
  useEffect(() => {
    const handler = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text
      if (text && text.trim()) void sendRef.current(text.trim())
    }
    window.addEventListener('tectona:chat-send', handler)
    return () => window.removeEventListener('tectona:chat-send', handler)
  }, [])

  // Action cards can inject a ready-made assistant message (e.g. a frontend-built workspace
  // detail for "Jelaskan di chat") without a backend round-trip.
  useEffect(() => {
    const handler = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text
      const convId = activeConversationIdRef.current
      if (!text || !text.trim() || !convId) return
      const message: ChatMessage = {
        id: `assist-inject-${crypto.randomUUID()}`,
        role: 'assistant',
        text: text.trim(),
        at: Date.now(),
      }
      setMessagesById((prev) => ({
        ...prev,
        [convId]: [...(prev[convId] ?? []), message],
      }))
    }
    window.addEventListener('tectona:chat-inject-assistant', handler)
    return () => window.removeEventListener('tectona:chat-inject-assistant', handler)
  }, [])
  const [voiceSpeakEnabled, setVoiceSpeakEnabled] = useState(true)
  voiceSpeakRef.current = voiceSpeakEnabled
  const pendingVoiceCommandRef = useRef<string | null>(null)
  const [voiceTargetConversationId, setVoiceTargetConversationId] = useState<string | null>(null)

  const ensureGenAiConversationForVoice = useCallback((): string => {
    const active = activeConversationId
      ? conversationsRef.current.find((c) => c.id === activeConversationId)
      : undefined
    if (active && active.mode === 'genai') return active.id
    const latestGenai = conversationsRef.current.find((c) => c.mode === 'genai' && !c.archived)
    if (latestGenai) {
      setActiveConversationId(latestGenai.id)
      setScreen('thread')
      return latestGenai.id
    }
    const id = `genai-${crypto.randomUUID()}`
    const ts = Date.now()
    const newConv: Conversation = {
      id,
      mode: 'genai',
      title: 'Percakapan baru',
      preview: 'Belum ada pesan',
      updatedAt: ts,
      unreadCount: 0,
      archived: false,
      isFavorite: false,
      isLocked: false,
      isBlurred: false,
      isBlocked: false,
    }
    setConversations((prev) => [newConv, ...prev])
    setMessagesById((prev) => ({ ...prev, [id]: [] }))
    setActiveConversationId(id)
    setScreen('thread')
    return id
  }, [activeConversationId])

  const voice = useTectonaVoiceWake({
    onCommand: (command) => {
      const target = ensureGenAiConversationForVoice()
      if (target === activeConversationId) {
        void sendRef.current(command)
      } else {
        // Conversation just switched/created — flush once it becomes active (effect below).
        pendingVoiceCommandRef.current = command
        setVoiceTargetConversationId(target)
      }
    },
    onWakeOnly: () => {
      pushGlobalToast({
        variant: 'info',
        title: 'Tectona mendengarkan…',
        description: 'Silakan ucapkan perintah Anda.',
      })
    },
  })

  voiceListeningRef.current = voice.enabled

  // Flush a queued voice command once its target Gen AI conversation is active.
  useEffect(() => {
    const cmd = pendingVoiceCommandRef.current
    if (!cmd || !voiceTargetConversationId) return
    if (activeConversationId !== voiceTargetConversationId) return
    pendingVoiceCommandRef.current = null
    setVoiceTargetConversationId(null)
    void sendRef.current(cmd)
  }, [activeConversationId, voiceTargetConversationId])

  // Silence any in-progress speech when voice mode is turned off.
  useEffect(() => {
    if (!voice.enabled) stopSpeaking()
  }, [voice.enabled])

  const threadMode = activeConversation?.mode ?? 'team'

  const genAiComposerUiContext = useMemo(() => {
    if (threadMode !== 'genai') return null
    return buildTectonaUiContextForChat({
      pathname: location.pathname,
      search: location.search,
      chatPanelOpen: true,
      chatScreen: screen,
      activeConversationTitle: activeConversation?.title ?? null,
      activeConversationMode: activeConversation?.mode ?? null,
    })
  }, [
    threadMode,
    location.pathname,
    location.search,
    screen,
    activeConversation?.title,
    activeConversation?.mode,
  ])

  useEffect(() => {
    setLastGenAiContextUsage(null)
  }, [activeConversationId])
  const threadHeaderTitle =
    activeConversation?.mode === 'team'
      ? (activeConversation.contactName ?? activeConversation.title)
      : activeConversation?.mode === 'group'
        ? activeConversation.title
        : (activeConversation?.title ?? 'Chat')

  const threadHeaderContact = useMemo((): ChatContact | null => {
    const contactId = activeConversation?.contactId
    if (activeConversation?.mode !== 'team' || !contactId) return null
    const fromList = chatContactsForDisplay.find((c) => c.id === contactId)
    const base = buildTeamChatContactForUserId(contactId, chatContactsForDisplay)
    return {
      ...base,
      name: activeConversation.contactName ?? fromList?.name ?? base.name,
      avatarSrc: activeConversation.contactAvatarSrc ?? fromList?.avatarSrc ?? base.avatarSrc,
      presence: fromList?.presence ?? 'offline',
    }
  }, [
    activeConversation?.contactId,
    activeConversation?.contactAvatarSrc,
    activeConversation?.contactName,
    activeConversation?.mode,
    chatContactsForDisplay,
  ])

  const threadContactPresence: PresenceUiStatus = threadHeaderContact?.presence ?? 'offline'

  const groupDialogMemberPreview = useMemo(() => {
    if (groupDialogPendingContactIds.length > 0) {
      return groupDialogPendingContactIds
        .map((id) => chatContacts.find((c) => c.id === id))
        .filter((c): c is ChatContact => !!c)
        .map((c) => c.name)
        .join(', ')
    }
    return groupDialogPendingIds
      .map((id) => conversations.find((c) => c.id === id))
      .filter((c): c is Conversation => !!c && c.mode === 'team')
      .map((c) => c.contactName ?? c.title)
      .join(', ')
  }, [groupDialogPendingContactIds, groupDialogPendingIds, conversations])

  const folderDialogSessionPreview = useMemo(() => {
    return folderDialogPendingIds
      .map((id) => conversations.find((c) => c.id === id))
      .filter((c): c is Conversation => !!c && c.mode === 'genai')
      .map((c) => c.title)
      .join(', ')
  }, [folderDialogPendingIds, conversations])

  const activeDragConversation = useMemo(() => {
    if (!activeDragConvId) return null
    return conversations.find((c) => c.id === activeDragConvId) ?? null
  }, [activeDragConvId, conversations])

  const activeDragOverlayCount = useMemo(() => {
    if (!activeDragConvId) return 1
    if (selectedIds.size > 1 && selectedIds.has(activeDragConvId)) return selectedIds.size
    return 1
  }, [activeDragConvId, selectedIds])

  const contactInfoConversation = useMemo(
    () =>
      contactInfoConversationId
        ? conversations.find((c) => c.id === contactInfoConversationId) ?? null
        : null,
    [contactInfoConversationId, conversations],
  )

  const contactInfoContact = useMemo(() => {
    const contactId = contactInfoConversation?.contactId
    if (!contactId) return null
    return (
      chatContactsForDisplay.find((c) => c.id === contactId) ??
      buildTeamChatContactForUserId(contactId, chatContactsForDisplay)
    )
  }, [contactInfoConversation?.contactId, chatContactsForDisplay])

  const showContactInfo = !!contactInfoConversationId && !!contactInfoConversation && !!contactInfoContact

  const messageSearchConversation = useMemo(
    () =>
      messageSearchConversationId
        ? conversations.find((c) => c.id === messageSearchConversationId) ?? null
        : null,
    [messageSearchConversationId, conversations],
  )

  const messageSearchContact = useMemo(() => {
    const contactId = messageSearchConversation?.contactId
    if (!contactId) return null
    return (
      chatContactsForDisplay.find((c) => c.id === contactId) ??
      buildTeamChatContactForUserId(contactId, chatContactsForDisplay)
    )
  }, [messageSearchConversation?.contactId, chatContactsForDisplay])

  const showMessageSearch =
    !!messageSearchConversationId && !!messageSearchConversation && !!messageSearchContact

  const disappearingMessagesConversation = useMemo(
    () =>
      disappearingMessagesConversationId
        ? conversations.find((c) => c.id === disappearingMessagesConversationId) ?? null
        : null,
    [disappearingMessagesConversationId, conversations],
  )

  const showDisappearingMessages =
    !!disappearingMessagesConversationId && !!disappearingMessagesConversation

  const chatLockConversation = useMemo(
    () =>
      chatLockPanel.conversationId
        ? conversations.find((c) => c.id === chatLockPanel.conversationId) ?? null
        : null,
    [chatLockPanel.conversationId, conversations],
  )

  const showChatLockPanel = !!chatLockPanel.conversationId && !!chatLockConversation

  const chatLockContactLabel = useMemo(() => {
    if (!chatLockConversation) return 'this contact'
    return chatContactLabel(chatLockConversation)
  }, [chatLockConversation, chatContactLabel])

  const disappearingMessagesDuration = useMemo((): DisappearingMessagesDuration => {
    void disappearingDurationRevision
    return resolveConversationDisappearingDuration(disappearingMessagesConversation)
  }, [disappearingMessagesConversation, disappearingDurationRevision])

  const handleDisappearingDurationChange = useCallback(
    async (duration: DisappearingMessagesDuration) => {
      const conv = disappearingMessagesConversation
      const chId = conv?.channelId
      if (!chId || disappearingSaveInFlightRef.current) return
      const prevTtl = resolveConversationDisappearingDuration(conv)
      if (prevTtl === duration) return

      const applyLocal = (ttl: DisappearingMessagesDuration, synced: boolean) => {
        setChannelDisappearingDuration(chId, ttl)
        setConversations((prev) =>
          prev.map((c) =>
            c.channelId === chId
              ? { ...c, disappearingMessagesTtl: ttl, updatedAt: Date.now() }
              : c,
          ),
        )
        recordDisappearingNoticeForActor(chId, prevTtl, ttl)
        setDisappearingDurationRevision((v) => v + 1)
        setDisappearingNoticesRevision((v) => v + 1)
        pushGlobalToast({
          variant: synced ? 'success' : 'warning',
          title: 'Pesan menghilang',
          description: synced
            ? ttl === 'off'
              ? 'Timer dimatikan untuk chat ini.'
              : `Pesan baru akan hilang setelah ${formatDisappearingDurationLabel(ttl)}.`
            : ttl === 'off'
              ? 'Timer dimatikan di perangkat ini. Jalankan service collaboration-context untuk sinkronisasi.'
              : `Timer tersimpan di perangkat ini (${formatDisappearingDurationLabel(ttl)}). Service belum tersedia — akan sinkron saat backend aktif.`,
        })
      }

      disappearingSaveInFlightRef.current = true
      try {
        const updated = await patchChannelDisappearingMessages(chId, duration)
        const ttl = parseDisappearingMessagesDuration(updated.disappearing_messages_ttl)
        applyLocal(ttl, true)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update timer.'
        const networkFailure =
          error instanceof TypeError ||
          /failed to fetch|networkerror|load failed/i.test(message)
        if (networkFailure) {
          applyLocal(duration, false)
        } else {
          pushGlobalToast({
            variant: 'error',
            title: 'Disappearing messages',
            description: message.includes('disappearing_messages_ttl')
              ? 'Database belum dimigrasi. Jalankan migrasi 004_add_disappearing_messages.sql lalu restart service.'
              : message,
          })
        }
      } finally {
        disappearingSaveInFlightRef.current = false
      }
    },
    [disappearingMessagesConversation],
  )

  const messageSearchContextLabel = useMemo(() => {
    const name = messageSearchContact?.name?.trim()
    return name || 'this contact'
  }, [messageSearchContact?.name])

  const messageSearchMessages = useMemo(() => {
    if (!messageSearchConversationId) return []
    return resolveThreadMessages(
      messageSearchConversationId,
      messageSearchConversation?.channelId,
      messagesById,
      conversations,
    )
  }, [
    messageSearchConversationId,
    messageSearchConversation?.channelId,
    messagesById,
    conversations,
  ])

  const contactInfoGroupsInCommon = useMemo(() => {
    const contactId = contactInfoConversation?.contactId
    if (!contactId) return []
    return conversations
      .filter(
        (c) => c.mode === 'group' && !c.archived && c.groupMemberContactIds?.includes(contactId),
      )
      .map((c) => {
        const names = c.groupMemberNames ?? []
        const preview =
          names.length > 4 ? `${names.slice(0, 4).join(', ')}...` : names.join(', ')
        return { id: c.id, title: c.title, memberPreview: preview || 'Group members' }
      })
  }, [contactInfoConversation?.contactId, conversations])

  const contactInfoMediaItems = useMemo((): ContactMediaItem[] => {
    if (!contactInfoConversationId) return []
    const msgs = resolveThreadMessages(
      contactInfoConversationId,
      contactInfoConversation?.channelId,
      messagesById,
      conversations,
    )
    const items: ContactMediaItem[] = []
    for (const m of msgs) {
      for (const a of m.attachments ?? []) {
        if (items.length >= 12) break
        items.push({ id: a.id, url: a.url, kind: a.kind, name: a.name })
      }
      if (items.length >= 12) break
    }
    return items
  }, [contactInfoConversationId, messagesById])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background pl-3">
      <div
        className={cn(
          'flex shrink-0 justify-between gap-3 border-b border-border',
          screen === 'home' ? 'items-start px-3 py-3 sm:px-4' : 'items-center px-3 py-2.5'
        )}
      >
        {screen === 'home' ? (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <MessageSquare className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              Chat
            </h2>
            <p className="max-w-[min(320px,100%)] text-xs leading-snug text-muted-foreground">
              Message your team, talk to Gen AI, and keep conversations organized in one place.
            </p>
          </div>
        ) : showMessageSearch ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Back to chat"
              onClick={goBackFromHeader}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">Search messages</h2>
          </div>
        ) : showDisappearingMessages ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Back to chat"
              onClick={goBackFromHeader}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              Disappearing messages
            </h2>
          </div>
        ) : showChatLockPanel ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Back to chat"
              onClick={goBackFromHeader}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              Chat lock
            </h2>
          </div>
        ) : showContactInfo ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Back to chat"
              onClick={goBackFromHeader}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">Contact info</h2>
          </div>
        ) : (
          <div
            className="flex min-w-0 flex-1 items-center gap-2"
            onContextMenu={
              screen === 'thread' && activeConversation?.mode === 'team' ? handleThreadContextMenu : undefined
            }
          >
            {(screen === 'thread' || screen === 'newChatContacts') && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={screen === 'newChatContacts' ? 'Back' : 'Back to conversation list'}
                onClick={goBackFromHeader}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {screen === 'thread' && threadHeaderContact && activeConversation ? (
              <ContactAvatar
                contact={threadHeaderContact}
                size="md"
                showPresence
                showDisappearingMessages={
                  resolveConversationDisappearingDuration(activeConversation) !== 'off'
                }
              />
            ) : null}
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {screen === 'thread' && activeConversation
                  ? threadHeaderTitle
                  : screen === 'newChatContacts'
                    ? 'New chat'
                    : 'Chat'}
              </h2>
              {screen === 'thread' && activeConversation?.mode === 'team' && (
                <p
                  className={cn(
                    'truncate text-xs font-medium leading-tight',
                    threadContactPresence === 'online' && 'text-emerald-600 dark:text-emerald-400',
                    threadContactPresence === 'away' && 'text-amber-600 dark:text-amber-400',
                    threadContactPresence === 'offline' && 'text-muted-foreground',
                  )}
                >
                  {presenceStatusLabel(threadContactPresence)}
                </p>
              )}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 shrink-0', screen === 'home' && 'mt-0.5')}
          onClick={close}
          aria-label="Close chat panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          screen === 'thread' && (threadMode === 'team' || threadMode === 'group')
            ? 'overflow-hidden'
            : 'px-2 pb-2 pt-2',
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          {showContactInfo && contactInfoConversation && contactInfoContact ? (
            <TeamChatContactInfoPanel
              avatar={
                <ContactAvatar
                  contact={contactInfoContact}
                  size="xl"
                  showPresence
                  showDisappearingMessages={
                    resolveConversationDisappearingDuration(contactInfoConversation) !== 'off'
                  }
                />
              }
              contact={contactInfoContact}
              channelId={contactInfoConversation.channelId}
              isFavorite={contactInfoConversation.isFavorite}
              groupsInCommon={contactInfoGroupsInCommon}
              mediaItems={contactInfoMediaItems}
              onSearch={() => {
                if (contactInfoConversationId) openMessageSearch(contactInfoConversationId)
              }}
              onToggleFavorite={() => {
                if (contactInfoConversationId) toggleFavorite(contactInfoConversationId)
              }}
              onAddToList={() => {
                if (contactInfoContact.id) {
                  setGroupDialogPendingContactIds([contactInfoContact.id])
                  setGroupDialogPendingIds([])
                  setGroupNameDraft('')
                  setGroupDialogOpen(true)
                }
              }}
              onClearChat={() => {
                if (contactInfoConversationId) clearChat(contactInfoConversationId)
              }}
              onBlock={() => {
                if (contactInfoConversationId && !contactInfoConversation.isBlocked) {
                  blockUser(contactInfoConversationId)
                  setContactInfoConversationId(null)
                }
              }}
              onDeleteChat={() => {
                if (contactInfoConversationId) {
                  deleteConversation(contactInfoConversationId)
                  setContactInfoConversationId(null)
                }
              }}
              onOpenDisappearingMessages={() => {
                if (contactInfoConversationId) openDisappearingMessages(contactInfoConversationId)
              }}
              disappearingSubtitle={formatDisappearingDurationLabel(
                resolveConversationDisappearingDuration(contactInfoConversation),
              )}
              isChatLocked={isConversationChatLockActive(contactInfoConversation)}
              onToggleChatLock={() => {
                if (!contactInfoConversationId) return
                if (isConversationChatLockActive(contactInfoConversation)) {
                  requestUnlockChat(contactInfoConversationId)
                } else {
                  requestLockChat(contactInfoConversationId)
                }
              }}
              onFeatureSoon={showChatFeatureSoonToast}
            />
          ) : null}
          {!showContactInfo && !showMessageSearch && !showDisappearingMessages && !showChatLockPanel && screen === 'home' && (
            <DndContext
              sensors={chatDragSensors}
              collisionDetection={pointerWithin}
              onDragStart={handleChatDragStart}
              onDragEnd={handleChatDragEnd}
              onDragCancel={handleChatDragCancel}
            >
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="shrink-0 space-y-2">
                <div className="flex gap-1.5">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages or conversations…"
                      className="h-9 pl-9 text-sm"
                      aria-label="Search messages"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5 px-3"
                    variant="secondary"
                    onClick={() => setScreen('newChatContacts')}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    New chat
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2.5 shrink-0 flex items-end justify-between gap-2 border-b border-border/50 pb-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {showArchived ? 'Archived' : 'Conversations'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/90">
                      {showArchived
                        ? `${totalArchived} archived conversation${totalArchived === 1 ? '' : 's'}`
                        : totalUnreadMessages === 0
                          ? 'No unread messages'
                          : `${totalUnreadMessages} unread message${totalUnreadMessages === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterAi((v) => !v)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none transition-colors',
                        filterAi
                          ? 'border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-800/80 dark:bg-violet-950/50 dark:text-violet-100'
                          : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/45'
                      )}
                      aria-pressed={filterAi}
                      title="Toggle AI sessions"
                    >
                      <Sparkles className="h-3 w-3" aria-hidden />
                      AI
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterPeople((v) => !v)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none transition-colors',
                        filterPeople
                          ? 'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/80 dark:bg-sky-950/50 dark:text-sky-100'
                          : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/45'
                      )}
                      aria-pressed={filterPeople}
                      title="Toggle people chats"
                    >
                      <Users className="h-3 w-3" aria-hidden />
                      Team
                    </button>
                    <ChatArchiveDropWrap showArchived={showArchived}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-8 w-8 shrink-0',
                          showArchived && 'bg-muted ring-1 ring-border/70'
                        )}
                        aria-label={showArchived ? 'Back to Inbox' : 'Show Archived'}
                        title={
                          showArchived
                            ? 'Back to Inbox'
                            : 'Show Archived — drop to archive (drag multiple selected)'
                        }
                        onClick={() => setShowArchived((v) => !v)}
                      >
                        {showArchived ? <Inbox className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                      </Button>
                    </ChatArchiveDropWrap>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain pr-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {filteredConversations.length === 0 ? (
                    <div
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-10 text-center shadow-sm',
                        'ring-1 ring-black/[0.03] dark:ring-white/[0.05]'
                      )}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/40">
                        <MessageSquarePlus className="h-5 w-5 text-muted-foreground/70" aria-hidden />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {searchQuery.trim()
                          ? 'No matches'
                          : showArchived
                            ? 'No archived conversations'
                            : 'No conversations yet'}
                      </p>
                      <p className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
                        {searchQuery.trim()
                          ? 'Try different keywords or clear the search.'
                          : showArchived
                            ? 'Archive a conversation to keep your inbox clean.'
                            : 'Use New chat to pick a contact and start.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {filteredFavoriteConversations.length > 0 && (
                        <ConversationSection
                          kind="favorite"
                          title={showArchived ? 'Archived (Favorites)' : 'Favorites'}
                          emptyLabel="No favorites"
                          conversations={filteredFavoriteConversations}
                          onOpen={openConversation}
                          onConversationRowClick={handleConversationRowClick}
                          onContextMenu={handleConversationContextMenu}
                          selectedIds={selectedIds}
                          open={favoritesAccordionOpen}
                          onToggle={() => setFavoritesAccordionOpen((v) => !v)}
                          dragToArchiveEnabled={!showArchived}
                        />
                      )}
                      {filterAi && (
                        <ConversationSection
                          kind="ai"
                          title={showArchived ? 'Archived (AI sessions)' : 'AI sessions'}
                          emptyLabel={showArchived ? 'No archived AI sessions' : 'No AI sessions yet'}
                          conversations={filteredAiConversations}
                          aiFolderGroups={filteredAiFolderGroups}
                          onRenameAiFolder={renameAiFolder}
                          onOpen={openConversation}
                          onConversationRowClick={handleConversationRowClick}
                          onContextMenu={handleConversationContextMenu}
                          selectedIds={selectedIds}
                          open={aiAccordionOpen}
                          onToggle={() => setAiAccordionOpen((v) => !v)}
                          dragToArchiveEnabled={!showArchived}
                        />
                      )}
                      {filterPeople && (
                        <ConversationSection
                          kind="people"
                          title={showArchived ? 'Archived (People)' : 'People'}
                          emptyLabel={showArchived ? 'No archived people chats' : 'No people chats'}
                          conversations={filteredPeopleConversations}
                          onOpen={openConversation}
                          onConversationRowClick={handleConversationRowClick}
                          onContextMenu={handleConversationContextMenu}
                          selectedIds={selectedIds}
                          open={peopleAccordionOpen}
                          onToggle={() => setPeopleAccordionOpen((v) => !v)}
                          dragToArchiveEnabled={!showArchived}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            {typeof document !== 'undefined'
              ? createPortal(
                  <DragOverlay>
                    {activeDragConversation ? (
                      <ChatConversationDragOverlayCard
                        conversation={activeDragConversation}
                        stackCount={activeDragOverlayCount}
                      />
                    ) : null}
                  </DragOverlay>,
                  document.body
                )
              : null}
            </DndContext>
          )}

          {screen === 'newChatContacts' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Pilih kontak untuk memulai.{' '}
                <span className="font-medium text-foreground">Tectona Assistant</span> tersedia untuk bantuan Gen AI.
              </p>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={newChatGroupPickMode ? 'secondary' : 'outline'}
                  className="h-10 gap-2 border-border/80 bg-background px-3"
                  onClick={() => {
                    setNewChatGroupPickMode((v) => !v)
                    setNewChatGroupSelectedIds([])
                  }}
                >
                  <UsersRound className="h-4 w-4 shrink-0" aria-hidden />
                  {newChatGroupPickMode ? 'Keluar mode grup' : 'Buat grup'}
                </Button>
                {newChatGroupPickMode ? (
                  <span className="text-[11px] text-muted-foreground">
                    Pilih minimal dua orang.{' '}
                    <span className="font-medium text-foreground">{newChatGroupSelectedIds.length} dipilih</span>
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Contacts
              </p>
              <div className="shrink-0">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    placeholder="Search contacts…"
                    className="h-9 pl-9 text-sm"
                    aria-label="Search contacts"
                  />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/15 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {chatContactsLoading ? (
                  <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                    Loading directory…
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                    No contacts found.
                  </div>
                ) : (
                  filteredContacts.map((c) => {
                    const pickable = canPickContactForGroupChat(c, getCurrentChatActorId())
                    const selected = newChatGroupSelectedIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={newChatGroupPickMode && !pickable}
                        onClick={() => {
                          if (newChatGroupPickMode) {
                            if (!pickable) return
                            setNewChatGroupSelectedIds((prev) =>
                              prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                            )
                            return
                          }
                          startChatWithContact(c)
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          newChatGroupPickMode && !pickable && 'cursor-not-allowed opacity-60',
                          newChatGroupPickMode && pickable && selected && 'bg-muted/80 ring-1 ring-border/70',
                          !newChatGroupPickMode &&
                            c.isAssistant &&
                            'border-b border-violet-200/60 bg-gradient-to-r from-violet-500/[0.07] to-transparent dark:border-violet-900/40 dark:from-violet-500/10'
                        )}
                        title={
                          newChatGroupPickMode && !pickable
                            ? 'Gen AI and your own account cannot be added to a group from here.'
                            : undefined
                        }
                      >
                        {newChatGroupPickMode && pickable ? (
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40 bg-background'
                            )}
                            aria-hidden
                          >
                            {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                          </span>
                        ) : newChatGroupPickMode ? (
                          <span className="h-5 w-5 shrink-0" aria-hidden />
                        ) : null}
                        <ContactAvatar contact={c} size={c.isAssistant ? 'lg' : 'md'} showPresence />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                            {c.isAssistant && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-200">
                                <Sparkles className="h-3 w-3" aria-hidden />
                                AI
                              </span>
                            )}
                          </div>
                          {c.subtitle && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.subtitle}</p>
                          )}
                        </div>
                        {!newChatGroupPickMode ? (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
              {newChatGroupPickMode ? (
                <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 w-full gap-2"
                    disabled={newChatGroupSelectedIds.length < 2}
                    onClick={() => {
                      if (newChatGroupSelectedIds.length < 2) return
                      setGroupDialogPendingIds([])
                      setGroupDialogPendingContactIds([...newChatGroupSelectedIds])
                      setGroupNameDraft('')
                      setGroupDialogOpen(true)
                    }}
                  >
                    <UsersRound className="h-4 w-4 shrink-0" aria-hidden />
                    Create group…
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {showDisappearingMessages ? (
            <TeamChatDisappearingMessagesPanel
              channelId={disappearingMessagesConversation?.channelId}
              value={disappearingMessagesDuration}
              onChange={handleDisappearingDurationChange}
              onLearnMore={() => showChatFeatureSoonToast('Learn more')}
              onDefaultTimerSettings={() => showChatFeatureSoonToast('Default message timer')}
            />
          ) : null}

          {showChatLockPanel ? (
            <TeamChatLockPanel
              mode={chatLockPanel.mode}
              contactLabel={chatLockContactLabel}
              loading={chatLockLoading}
              errorMessage={chatLockError}
              onCancel={closeChatLockPanel}
              onSubmit={handleChatLockPasswordSubmit}
            />
          ) : null}

          {showMessageSearch && messageSearchContact ? (
            <TeamChatSearchMessagesPanel
              contactLabel={messageSearchContextLabel}
              query={messageSearchQuery}
              onQueryChange={setMessageSearchQuery}
              messages={messageSearchMessages}
              onSelectResult={scrollToThreadMessage}
              onDateSearch={() => showChatFeatureSoonToast('Search by date')}
            />
          ) : null}

          {!showContactInfo &&
            !showMessageSearch &&
            !showDisappearingMessages &&
            !showChatLockPanel &&
            screen === 'thread' &&
            activeConversationId && (
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col overflow-hidden',
                (threadMode === 'team' || threadMode === 'group') && 'bg-[#efeae2] dark:bg-[#0b141a]',
              )}
              onContextMenu={
                threadMode === 'team' && !messageSelectionActive ? handleThreadContextMenu : undefined
              }
            >
              <MessageThread
                messages={threadDisplayMessages}
                threadMode={threadMode}
                conversation={activeConversation}
                chatContacts={chatContacts}
                currentUserId={getCurrentChatActorId()}
                assistantTypingSpeed={assistantTypingSpeed}
                assistantSpeedProfile={assistantSpeedProfile}
                threadScrollRef={threadScrollRef}
                messagesEndRef={messagesEndRef}
                onThreadScroll={handleThreadScroll}
                onThreadContextMenu={
                  threadMode === 'team' && !messageSelectionActive ? handleThreadContextMenu : undefined
                }
                messageSelectionActive={messageSelectionActive}
                selectedMessageIds={selectedMessageIds}
                onToggleMessageSelection={toggleMessageSelection}
                onAssistantTypingProgress={handleAssistantTypingProgress}
                onAssistantTypingComplete={handleAssistantTypingComplete}
                onRetryGreet={(conversationId) => {
                  if (!conversationId) return
                  void retryGenAiGreeting(conversationId)
                }}
                onAssistantChoiceSubmit={(messageId, labels, mode) => {
                  if (!activeConversationId || labels.length === 0) return
                  const convId = activeConversationId
                  setMessagesById((prev) => ({
                    ...prev,
                    [convId]: (prev[convId] ?? []).map((m) =>
                      m.id === messageId
                        ? { ...m, choiceOffer: { status: 'submitted', selectedLabels: labels } }
                        : m,
                    ),
                  }))
                  const text = buildChoiceSubmitUserMessage(labels, mode)
                  if (text) void send(text)
                }}
                onAgentActionConfirm={(messageId, actionId, patch) => {
                  if (!activeConversationId) return
                  void handleAgentActionConfirm(activeConversationId, messageId, actionId, patch)
                }}
                onAgentActionCancel={(messageId, actionId) => {
                  if (!activeConversationId) return
                  handleAgentActionCancel(activeConversationId, messageId, actionId)
                }}
                onOpenDisappearingMessages={
                  activeConversationId ? () => openDisappearingMessages(activeConversationId) : undefined
                }
              />
              {messageSelectionActive && (threadMode === 'team' || threadMode === 'group') ? (
                <PeopleChatMessageSelectionBar
                  selectedCount={selectedMessageIds.size}
                  onClose={exitMessageSelection}
                  onStar={() => showChatFeatureSoonToast('Star messages')}
                  onDelete={deleteSelectedThreadMessages}
                  onForward={() => showChatFeatureSoonToast('Forward messages')}
                  onDownload={() => showChatFeatureSoonToast('Download messages')}
                />
              ) : (threadMode === 'team' || threadMode === 'group') ? (
                <PeopleChatComposer
                  draft={draft}
                  setDraft={setDraft}
                  pendingAttachments={pendingAttachments}
                  removePendingAttachment={removePendingAttachment}
                  onPreviewImage={setPendingImagePreview}
                  isRecordingVoice={isRecordingVoice}
                  onSend={send}
                  onToggleVoiceRecording={toggleVoiceRecording}
                  appendEmojiToDraft={appendEmojiToDraft}
                  imageInputRef={imageInputRef}
                  docInputRef={docInputRef}
                  mediaPickRef={mediaPickRef}
                  audioFileInputRef={audioFileInputRef}
                  onPickImages={onPickImages}
                  onPickDocuments={onPickDocuments}
                  onPickPhotosAndVideos={onPickPhotosAndVideos}
                  onPickAudioFiles={onPickAudioFiles}
                  onOpenContactAttach={() => setContactAttachOpen(true)}
                  onOpenPollAttach={() => setPollAttachOpen(true)}
                  onOpenEventAttach={() => setEventAttachOpen(true)}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {!showContactInfo && screen === 'thread' && activeConversationId && threadMode === 'genai' && (
        <div
          className={cn(
            'shrink-0 border-t border-border/40 p-3',
            'bg-gradient-to-t from-violet-50/25 to-transparent dark:from-violet-950/15',
          )}
        >
          <div className="flex flex-col gap-2 rounded-2xl border border-border/25 bg-card/80 p-2 shadow-sm backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-900/35">
            {threadMode === 'genai' && (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onPickImages}
                  aria-hidden
                />
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  multiple
                  className="hidden"
                  onChange={onPickDocuments}
                  aria-hidden
                />
                <input
                  ref={mediaPickRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={onPickPhotosAndVideos}
                  aria-hidden
                />
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={onPickAudioFiles}
                  aria-hidden
                />
                {pendingAttachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2 px-0.5">
                    {pendingAttachments.map((a) =>
                      a.kind === 'image' ? (
                        <div key={a.id} className="relative inline-flex">
                          <button
                            type="button"
                            onClick={() => setPendingImagePreview(a)}
                            className={cn(
                              'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/20',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-neutral-400/55',
                              'dark:focus-visible:ring-neutral-500/45'
                            )}
                            aria-label={`Preview ${a.name}`}
                          >
                            <img
                              src={a.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <button
                            type="button"
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              removePendingAttachment(a.id)
                            }}
                            aria-label={`Remove ${a.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : a.kind === 'video' && a.url ? (
                        <div key={a.id} className="relative inline-flex">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-black/10">
                            <video
                              src={a.url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              aria-hidden
                            />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white drop-shadow">
                              ▶
                            </span>
                          </div>
                          <button
                            type="button"
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              removePendingAttachment(a.id)
                            }}
                            aria-label={`Remove ${a.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span
                          key={a.id}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-muted/30 py-1 pl-2 pr-1 text-[11px] text-foreground"
                        >
                          <span className="truncate">
                            {a.kind === 'audio'
                              ? '🎤 '
                              : a.kind === 'contact'
                                ? '👤 '
                                : a.kind === 'poll'
                                  ? '📊 '
                                  : a.kind === 'event'
                                    ? '📅 '
                                    : '📎 '}
                            {a.name}
                          </span>
                          <button
                            type="button"
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                            onClick={() => removePendingAttachment(a.id)}
                            aria-label={`Remove ${a.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )
                    )}
                  </div>
                ) : null}
              </>
            )}
            <Textarea
              placeholder="Ask Gen AI…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={onGenAiComposerPaste}
              className={cn(
                'min-h-[72px] resize-none text-sm',
                'border-0 bg-transparent shadow-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <div className="flex items-center justify-start">
                <div className="inline-flex items-center gap-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => imageInputRef.current?.click()}
                    aria-label="Attach image"
                    title="Attach image"
                  >
                    <Image className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => docInputRef.current?.click()}
                    aria-label="Attach document"
                    title="Attach document"
                  >
                    <Paperclip className="h-4 w-4" aria-hidden />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Typing speed"
                        title={`Typing speed: ${assistantTypingSpeed}`}
                      >
                        <Sparkles className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-44 py-1.5">
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() => setAssistantTypingSpeed('normal')}
                      >
                        <span>Typing: Normal</span>
                        {assistantTypingSpeed === 'normal' ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() => setAssistantTypingSpeed('fast')}
                      >
                        <span>Typing: Fast</span>
                        {assistantTypingSpeed === 'fast' ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() => setAssistantTypingSpeed('instant')}
                      >
                        <span>Typing: Instant</span>
                        {assistantTypingSpeed === 'instant' ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() =>
                          setAssistantSpeedProfile((prev) =>
                            prev === 'greeting_fast' ? 'uniform' : 'greeting_fast'
                          )
                        }
                      >
                        <span>Greeting boost</span>
                        {assistantSpeedProfile === 'greeting_fast' ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() => setAutoScrollWhileTyping((prev) => !prev)}
                      >
                        <span>Auto-scroll typing</span>
                        {autoScrollWhileTyping ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() => setTypingDoneSoundEnabled((prev) => !prev)}
                      >
                        <span>Typing done sound</span>
                        {typingDoneSoundEnabled ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() => {
                          const next = !chatMessageSoundEnabled
                          setChatMessageSoundEnabled(next)
                          setChatMessageSoundEnabledState(next)
                        }}
                      >
                        <span>Incoming message sound</span>
                        {chatMessageSoundEnabled ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between"
                        onClick={() => voice.toggle()}
                      >
                        <span>Voice wake (&ldquo;Hai Tec&rdquo;)</span>
                        {voice.enabled ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </DropdownMenuItem>
                      {isTtsSupported() ? (
                        <DropdownMenuItem
                          className="flex items-center justify-between"
                          onClick={() => {
                            setVoiceSpeakEnabled((prev) => {
                              if (prev) stopSpeaking()
                              return !prev
                            })
                          }}
                        >
                          <span>Speak replies</span>
                          {voiceSpeakEnabled ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChatComposerContextToolbar
                    workspaceId={TECTONA_CHAT_WORKSPACE_ID}
                    userId={getSession()?.user?.id ?? null}
                    sessionId={activeConversationId}
                    draftMessage={draft}
                    ui={genAiComposerUiContext}
                    lastResponseReport={lastGenAiContextUsage}
                    enabled={threadMode === 'genai'}
                  />
                  <Button
                    type="button"
                    variant={voice.enabled ? 'default' : 'ghost'}
                    size="icon"
                    aria-pressed={voice.enabled}
                    className={cn(
                      'h-8 w-8 shrink-0 rounded-full',
                      voice.enabled
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                        : 'text-muted-foreground',
                      (voice.state === 'capturing' || voice.state === 'transcribing') && 'animate-pulse',
                    )}
                    onClick={() => voice.toggle()}
                    aria-label={voice.enabled ? 'Matikan wake word (Hai Tec)' : 'Aktifkan wake word (Hai Tec)'}
                    title={
                      voice.lastError
                        ? voice.lastError
                        : voice.enabled
                          ? voice.state === 'awaiting-command'
                            ? 'Mendengarkan perintah… ucapkan sekarang'
                            : 'Voice aktif — ucapkan "Hai Tec ..."'
                          : 'Aktifkan voice "Hai Tec"'
                    }
                  >
                    <Radio className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant={
                      !draft.trim() && pendingAttachments.length === 0 && isRecordingVoice
                        ? 'destructive'
                        : 'default'
                    }
                    size="icon"
                    className={cn(
                      'h-8 w-8 shrink-0 rounded-full shadow-sm',
                      'focus-visible:ring-offset-background'
                    )}
                    onClick={() => {
                      if (!draft.trim() && pendingAttachments.length === 0) {
                        void toggleVoiceRecording()
                        return
                      }
                      send()
                    }}
                    aria-label={
                      !draft.trim() && pendingAttachments.length === 0
                        ? isRecordingVoice
                          ? 'Stop recording'
                          : 'Record voice'
                        : 'Send message'
                    }
                    title={
                      !draft.trim() && pendingAttachments.length === 0
                        ? isRecordingVoice
                          ? 'Stop recording'
                          : 'Record voice'
                        : 'Send message'
                    }
                  >
                    {!draft.trim() && pendingAttachments.length === 0 ? (
                      <Mic className="h-4 w-4" aria-hidden />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </div>
            </div>
          </div>
        </div>
      )}

      <ContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
      >
        {contextMenu.conversationIds.length === 1 && contextMenu.variant === 'team-thread' ? (
          (() => {
            const id = contextMenu.conversationIds[0]
            const conv = id ? conversations.find((x) => x.id === id) : undefined
            if (!conv || conv.mode !== 'team') return null
            return (
              <>
                <ContextMenuItem
                  onSelect={() => {
                    if (id) setContactInfoConversationId(id)
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Contact info
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    if (id) openMessageSearch(id)
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Search
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    setMessageSelectionActive(true)
                    setSelectedMessageIds(new Set())
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <CheckSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Select messages
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    if (id) openDisappearingMessages(id)
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <Timer className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Disappearing messages
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    if (id) {
                      if (isConversationChatLockActive(conv)) requestUnlockChat(id)
                      else requestLockChat(id)
                    }
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {isConversationChatLockActive(conv) ? 'Unlock chat' : 'Lock chat'}
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    if (id) toggleFavorite(id)
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <Heart
                    className={cn(
                      'h-4 w-4',
                      conv.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                  {conv.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    if (conv.contactId) {
                      setGroupDialogPendingContactIds([conv.contactId])
                      setGroupDialogPendingIds([])
                      setGroupNameDraft('')
                      setGroupDialogOpen(true)
                    }
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <ListPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Add to list
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    goHome()
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Close chat
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    if (id) clearChat(id)
                    closeContextMenu()
                  }}
                  className="gap-2"
                >
                  <Eraser className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Clear chat
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    if (id) deleteConversation(id)
                    closeContextMenu()
                  }}
                  className="gap-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete chat
                </ContextMenuItem>
              </>
            )
          })()
        ) : contextMenu.conversationIds.length > 1 ? (
          <>
            <ContextMenuItem
              onSelect={() => {
                const ids = contextMenu.conversationIds
                if (ids.length === 0) return
                bulkArchive(ids)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Archive className="h-4 w-4 text-muted-foreground" aria-hidden />
              Archive
            </ContextMenuItem>
            {bulkMenuCanCreateGroup && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    const ids = [...contextMenu.conversationIds]
                    setGroupDialogPendingIds(ids)
                    setGroupDialogPendingContactIds([])
                    setGroupNameDraft('')
                    setGroupDialogOpen(true)
                    setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
                  }}
                  className="gap-2"
                >
                  <UsersRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Create group message…
                </ContextMenuItem>
              </>
            )}
            {bulkMenuCanCreateAiFolder && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    const ids = [...contextMenu.conversationIds]
                    setFolderDialogPendingIds(ids)
                    setFolderNameDraft('')
                    setFolderDialogOpen(true)
                    setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
                  }}
                  className="gap-2"
                >
                  <Folder className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Move to folder…
                </ContextMenuItem>
              </>
            )}
            <ContextMenuItem
              onSelect={() => {
                const ids = contextMenu.conversationIds
                if (ids.length === 0) return
                bulkLock(ids)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              Lock chat
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const ids = contextMenu.conversationIds
                if (ids.length === 0) return
                bulkBlur(ids)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />
              Blur chat
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const ids = contextMenu.conversationIds
                if (ids.length === 0) return
                bulkFavorite(ids)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Star className="h-4 w-4 text-amber-500" aria-hidden />
              Add to Favorite
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const ids = contextMenu.conversationIds
                if (ids.length === 0) return
                bulkClearChat(ids)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Eraser className="h-4 w-4 text-muted-foreground" aria-hidden />
              Clear chat
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const ids = contextMenu.conversationIds
                if (ids.length === 0) return
                bulkDelete(ids)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2 text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem
              onSelect={() => {
                const id = contextMenu.conversationIds[0]
                if (!id) return
                markAsUnread(id)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
              Mark as unread
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                const id = contextMenu.conversationIds[0]
                if (!id) return
                const c = conversations.find((x) => x.id === id)
                if (c?.archived) {
                  unarchiveConversation(id)
                } else {
                  archiveConversation(id)
                }
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Archive className="h-5 w-5 text-muted-foreground" aria-hidden />
              {(() => {
                const id = contextMenu.conversationIds[0]
                const c = id ? conversations.find((x) => x.id === id) : undefined
                return c?.archived ? 'Unarchive' : 'Archive'
              })()}
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const id = contextMenu.conversationIds[0]
                const c = id ? conversations.find((x) => x.id === id) : undefined
                if (id && c) {
                  if (isConversationChatLockActive(c)) requestUnlockChat(id)
                  else requestLockChat(id)
                }
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              {(() => {
                const id = contextMenu.conversationIds[0]
                const c = id ? conversations.find((x) => x.id === id) : undefined
                return c && isConversationChatLockActive(c) ? 'Unlock chat' : 'Lock chat'
              })()}
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const id = contextMenu.conversationIds[0]
                if (id) toggleBlur(id)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />
              {(() => {
                const id = contextMenu.conversationIds[0]
                const c = id ? conversations.find((x) => x.id === id) : undefined
                return c?.isBlurred ? 'Unblur chat' : 'Blur chat'
              })()}
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const id = contextMenu.conversationIds[0]
                if (id) toggleFavorite(id)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Star className="h-4 w-4 text-amber-500" aria-hidden />
              {(() => {
                const id = contextMenu.conversationIds[0]
                const c = id ? conversations.find((x) => x.id === id) : undefined
                return c?.isFavorite ? 'Remove from favorites' : 'Add to favorites'
              })()}
            </ContextMenuItem>
            <ContextMenuSeparator />
            {(() => {
              const id = contextMenu.conversationIds[0]
              const conv = id ? conversations.find((x) => x.id === id) : undefined
              if (conv?.mode === 'genai' || conv?.mode === 'group') return null
              return (
                <ContextMenuItem
                  onSelect={() => {
                    const sid = contextMenu.conversationIds[0]
                    if (!sid) return
                    const c = conversations.find((x) => x.id === sid)
                    if (c && !c.isBlocked) blockUser(sid)
                    setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
                  }}
                  className={cn('gap-2', (() => {
                    const sid = contextMenu.conversationIds[0]
                    const c = sid ? conversations.find((x) => x.id === sid) : undefined
                    return c?.isBlocked ? 'opacity-50 pointer-events-none' : ''
                  })())}
                >
                  <Ban className="h-4 w-4 text-destructive/80" aria-hidden />
                  {(() => {
                    const sid = contextMenu.conversationIds[0]
                    const c = sid ? conversations.find((x) => x.id === sid) : undefined
                    return `Block ${(c?.contactName ?? c?.title ?? 'user').trim()}`
                  })()}
                </ContextMenuItem>
              )
            })()}
            <ContextMenuItem
              onSelect={() => {
                const id = contextMenu.conversationIds[0]
                if (id) clearChat(id)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2"
            >
              <Eraser className="h-4 w-4 text-muted-foreground" aria-hidden />
              Clear chat
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const id = contextMenu.conversationIds[0]
                if (id) deleteConversation(id)
                setContextMenu((s) => ({ ...s, open: false, conversationIds: [] }))
              }}
              className="gap-2 text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenu>

      <Dialog
        open={groupDialogOpen}
        onOpenChange={(open) => {
          setGroupDialogOpen(open)
          if (!open) {
            setGroupDialogPendingIds([])
            setGroupDialogPendingContactIds([])
            setGroupNameDraft('')
          }
        }}
      >
        <DialogContent
          className={cn(
            'tilia-enterprise-group-dialog max-w-[min(100%,420px)] gap-0 border-0 p-0',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            'overflow-hidden rounded-[18px]',
            'ring-1 ring-slate-200/90 dark:ring-slate-700/90'
          )}
        >
          <div className="relative px-7 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-9">
            <DialogClose
              className={cn(
                'absolute right-4 top-4 rounded-full p-1.5',
                'text-slate-400 opacity-80 transition-colors hover:bg-slate-200/80 hover:text-slate-700 hover:opacity-100',
                'dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              )}
            />
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle
                className={cn(
                  'text-lg font-semibold leading-tight tracking-tight text-slate-900',
                  'dark:text-slate-50'
                )}
              >
                Create group message
              </DialogTitle>
              <DialogDescription
                className={cn(
                  'text-[13px] leading-relaxed text-slate-500',
                  'dark:text-slate-400'
                )}
              >
                {groupDialogMemberPreview ? (
                  <>
                    <span className="font-medium text-slate-600 dark:text-slate-300">Members:</span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">{groupDialogMemberPreview}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      . Enter a name for this group.
                    </span>
                  </>
                ) : (
                  'Enter a name for this group.'
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7">
              <label htmlFor="tilia-group-name" className="sr-only">
                Group name
              </label>
              <Input
                id="tilia-group-name"
                value={groupNameDraft}
                onChange={(e) => setGroupNameDraft(e.target.value)}
                placeholder="Group name"
                className={cn(
                  'h-11 rounded-full border border-slate-200/90 bg-white px-5 text-sm text-slate-900',
                  'shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]',
                  'placeholder:text-slate-400',
                  'transition-[box-shadow,border-color] focus-visible:border-[#8faadc]/80 focus-visible:ring-2 focus-visible:ring-[#8faadc]/35',
                  'dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-100',
                  'dark:placeholder:text-slate-500 dark:focus-visible:border-sky-500/60 dark:focus-visible:ring-sky-500/30'
                )}
                aria-label="Group name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (groupDialogPendingContactIds.length > 0) {
                      createGroupFromContactIds(groupDialogPendingContactIds, groupNameDraft)
                    } else {
                      createGroupFromSelectedConversations(groupDialogPendingIds, groupNameDraft)
                    }
                  }
                }}
              />
            </div>

            <DialogFooter className="mt-8 flex-row justify-end gap-2.5 border-0 p-0 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-10 min-w-[88px] rounded-full border-slate-200/90 bg-white px-5 font-medium text-slate-700 shadow-sm',
                  'transition-colors hover:bg-slate-50 hover:text-slate-900',
                  'dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                )}
                onClick={() => {
                  setGroupDialogOpen(false)
                  setGroupDialogPendingIds([])
                  setGroupDialogPendingContactIds([])
                  setGroupNameDraft('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!groupNameDraft.trim()}
                className={cn(
                  'h-10 min-w-[96px] rounded-full border-0 px-6 text-sm font-semibold text-white shadow-sm',
                  'bg-[#8faadc] hover:bg-[#7d98c8] hover:text-white focus-visible:ring-2 focus-visible:ring-[#8faadc]/50',
                  'disabled:pointer-events-none disabled:opacity-45',
                  'dark:bg-sky-700 dark:hover:bg-sky-600 dark:hover:text-white dark:focus-visible:ring-sky-500/40'
                )}
                onClick={() =>
                  groupDialogPendingContactIds.length > 0
                    ? createGroupFromContactIds(groupDialogPendingContactIds, groupNameDraft)
                    : createGroupFromSelectedConversations(groupDialogPendingIds, groupNameDraft)
                }
              >
                Create
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={folderDialogOpen}
        onOpenChange={(open) => {
          setFolderDialogOpen(open)
          if (!open) {
            setFolderDialogPendingIds([])
            setFolderNameDraft('')
          }
        }}
      >
        <DialogContent
          className={cn(
            'tilia-enterprise-group-dialog max-w-[min(100%,420px)] gap-0 border-0 p-0',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            'overflow-hidden rounded-[18px]',
            'ring-1 ring-slate-200/90 dark:ring-slate-700/90'
          )}
        >
          <div className="relative px-7 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-9">
            <DialogClose
              className={cn(
                'absolute right-4 top-4 rounded-full p-1.5',
                'text-slate-400 opacity-80 transition-colors hover:bg-slate-200/80 hover:text-slate-700 hover:opacity-100',
                'dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              )}
            />
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle
                className={cn(
                  'text-lg font-semibold leading-tight tracking-tight text-slate-900',
                  'dark:text-slate-50'
                )}
              >
                Move AI sessions to folder
              </DialogTitle>
              <DialogDescription
                className={cn(
                  'text-[13px] leading-relaxed text-slate-500',
                  'dark:text-slate-400'
                )}
              >
                {folderDialogSessionPreview ? (
                  <>
                    <span className="font-medium text-slate-600 dark:text-slate-300">Sessions:</span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">{folderDialogSessionPreview}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      . Enter a folder name to group them in the sidebar.
                    </span>
                  </>
                ) : (
                  'Enter a folder name to group the selected AI sessions in the sidebar.'
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7">
              <label htmlFor="tilia-ai-folder-name" className="sr-only">
                Folder name
              </label>
              <Input
                id="tilia-ai-folder-name"
                value={folderNameDraft}
                onChange={(e) => setFolderNameDraft(e.target.value)}
                placeholder="Folder name"
                className={cn(
                  'h-11 rounded-full border border-slate-200/90 bg-white px-5 text-sm text-slate-900',
                  'shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]',
                  'placeholder:text-slate-400',
                  'transition-[box-shadow,border-color] focus-visible:border-[#8faadc]/80 focus-visible:ring-2 focus-visible:ring-[#8faadc]/35',
                  'dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-100',
                  'dark:placeholder:text-slate-500 dark:focus-visible:border-sky-500/60 dark:focus-visible:ring-sky-500/30'
                )}
                aria-label="Folder name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    assignAiFolderToSelected(folderDialogPendingIds, folderNameDraft)
                  }
                }}
              />
            </div>

            <DialogFooter className="mt-8 flex-row justify-end gap-2.5 border-0 p-0 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-10 min-w-[88px] rounded-full border-slate-200/90 bg-white px-5 font-medium text-slate-700 shadow-sm',
                  'transition-colors hover:bg-slate-50 hover:text-slate-900',
                  'dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
                )}
                onClick={() => {
                  setFolderDialogOpen(false)
                  setFolderDialogPendingIds([])
                  setFolderNameDraft('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!folderNameDraft.trim()}
                className={cn(
                  'h-10 min-w-[96px] rounded-full border-0 px-6 text-sm font-semibold text-white shadow-sm',
                  'bg-[#8faadc] hover:bg-[#7d98c8] hover:text-white focus-visible:ring-2 focus-visible:ring-[#8faadc]/50',
                  'disabled:pointer-events-none disabled:opacity-45',
                  'dark:bg-sky-700 dark:hover:bg-sky-600 dark:hover:text-white dark:focus-visible:ring-sky-500/40'
                )}
                onClick={() =>
                  assignAiFolderToSelected(folderDialogPendingIds, folderNameDraft)
                }
              >
                Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={contactAttachOpen}
        onOpenChange={(open) => {
          setContactAttachOpen(open)
          if (!open) {
            setContactAttachSearchQuery('')
            setContactAttachSelectedId(null)
          } else {
            const first = shareableTeamContacts[0]
            setContactAttachSelectedId(first?.id ?? null)
            setContactAttachSearchQuery('')
          }
        }}
      >
        <DialogContent
          className={cn(
            'relative flex max-h-[min(90vh,520px)] max-w-md flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl',
            'dark:border-slate-700 dark:bg-slate-950'
          )}
        >
          <div className="shrink-0 flex gap-4 border-b border-slate-200/90 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/55">
            <DialogClose
              type="button"
              className={cn(
                'static left-auto right-auto top-auto mt-0.5 shrink-0 translate-x-0 translate-y-0 rounded-md p-2',
                'text-slate-600 opacity-90 ring-offset-background hover:bg-slate-200/80 hover:opacity-100 dark:text-slate-300 dark:hover:bg-slate-800',
                'focus:outline-none focus:ring-2 focus:ring-slate-400/50 focus:ring-offset-2 dark:focus:ring-slate-500/40'
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-left text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Share contact
              </DialogTitle>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Choose someone from your directory, then attach their card to this message. Connect a contacts API for
                production data.
              </p>
            </div>
          </div>

          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5',
              '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            )}
          >
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tilia-share-contact-search" className="text-slate-700 dark:text-slate-200">
                Search
              </Label>
              <div className="relative">
                <Input
                  id="tilia-share-contact-search"
                  value={contactAttachSearchQuery}
                  onChange={(e) => setContactAttachSearchQuery(e.target.value)}
                  placeholder="Filter by name or team…"
                  className="h-10 border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
                  autoComplete="off"
                />
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Directory
              </p>
              <div
                className="space-y-1 rounded-lg border border-slate-200/90 bg-slate-50/40 p-1.5 dark:border-slate-700/80 dark:bg-slate-900/30"
                role="listbox"
                aria-label="Contacts"
              >
                {filteredShareableContactsForAttach.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No contacts match your search.
                  </p>
                ) : (
                  filteredShareableContactsForAttach.map((c) => {
                    const selected = contactAttachSelectedId === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-sm transition-colors',
                          'outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-500/40',
                          selected
                            ? 'border border-slate-300/90 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800/90'
                            : 'border border-transparent hover:bg-white/90 dark:hover:bg-slate-800/70'
                        )}
                        onClick={() => setContactAttachSelectedId(c.id)}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            selected
                              ? 'border-slate-800 bg-slate-800 dark:border-slate-200 dark:bg-slate-200'
                              : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950'
                          )}
                          aria-hidden
                        >
                          {selected ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-slate-900" />
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                            c.avatarClassName ?? 'bg-muted text-foreground'
                          )}
                        >
                          {c.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-900 dark:text-slate-50">{c.name}</span>
                          {c.subtitle ? (
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                              {c.subtitle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-6 pb-6 pt-4 dark:border-slate-800 dark:bg-slate-900/45 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 sm:w-44 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => setContactAttachOpen(false)}
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 w-full gap-2 bg-slate-900 px-4 text-white shadow-sm hover:bg-slate-800 sm:w-44 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              disabled={!contactAttachSelectedId}
              onClick={confirmShareContactAttachment}
            >
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              Share contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pollAttachOpen}
        onOpenChange={(open) => {
          setPollAttachOpen(open)
          if (!open) {
            setPollQuestion('')
            setPollOpt1('')
            setPollOpt2('')
          }
        }}
      >
        <DialogContent
          className={cn(
            'relative max-h-[min(90vh,560px)] max-w-lg gap-0 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl',
            'dark:border-slate-700 dark:bg-slate-950'
          )}
        >
          <div className="flex gap-4 border-b border-slate-200/90 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/55">
            <DialogClose
              type="button"
              className={cn(
                'static left-auto right-auto top-auto mt-0.5 shrink-0 translate-x-0 translate-y-0 rounded-md p-2',
                'text-slate-600 opacity-90 ring-offset-background hover:bg-slate-200/80 hover:opacity-100 dark:text-slate-300 dark:hover:bg-slate-800',
                'focus:outline-none focus:ring-2 focus:ring-slate-400/50 focus:ring-offset-2 dark:focus:ring-slate-500/40'
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-left text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Create poll
              </DialogTitle>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Add a question and two choices. Wire a voting service when you need live tallies or anonymous results.
              </p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="tilia-poll-question" className="text-slate-700 dark:text-slate-200">
                Question
              </Label>
              <Input
                id="tilia-poll-question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="What should we decide?"
                className="h-10 border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
              />
            </div>
            <div className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-900/35">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Choices
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tilia-poll-opt-1" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Option 1
                  </Label>
                  <Input
                    id="tilia-poll-opt-1"
                    value={pollOpt1}
                    onChange={(e) => setPollOpt1(e.target.value)}
                    placeholder="First choice"
                    className="h-10 border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tilia-poll-opt-2" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Option 2
                  </Label>
                  <Input
                    id="tilia-poll-opt-2"
                    value={pollOpt2}
                    onChange={(e) => setPollOpt2(e.target.value)}
                    placeholder="Second choice"
                    className="h-10 border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/45 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 sm:w-44 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => setPollAttachOpen(false)}
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 w-full gap-2 bg-slate-900 px-4 text-white shadow-sm hover:bg-slate-800 sm:w-44 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              disabled={!pollQuestion.trim() || !pollOpt1.trim() || !pollOpt2.trim()}
              onClick={submitPollAttachment}
            >
              <BarChart2 className="h-4 w-4 shrink-0" aria-hidden />
              Add poll
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eventAttachOpen}
        onOpenChange={(open) => {
          setEventAttachOpen(open)
          if (!open) {
            resetEventComposer()
          } else {
            resetEventComposer()
            const now = new Date()
            const pad = (n: number) => String(n).padStart(2, '0')
            setEventStartDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
            setEventStartTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
          }
        }}
      >
        <DialogContent
          className={cn(
            'max-h-[min(90vh,720px)] max-w-lg gap-0 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl',
            'dark:border-slate-700 dark:bg-slate-950'
          )}
        >
          <div className="flex gap-4 border-b border-slate-200/90 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/55">
            <DialogClose
              type="button"
              className={cn(
                'static left-auto right-auto top-auto mt-0.5 shrink-0 translate-x-0 translate-y-0 rounded-md p-2',
                'text-slate-600 opacity-90 ring-offset-background hover:bg-slate-200/80 hover:opacity-100 dark:text-slate-300 dark:hover:bg-slate-800',
                'focus:outline-none focus:ring-2 focus:ring-slate-400/50 focus:ring-offset-2 dark:focus:ring-slate-500/40'
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-left text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Create event
              </DialogTitle>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Schedule an event and attach it to this conversation. Sync with a calendar service when your backend
                is ready.
              </p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="tilia-event-name" className="text-slate-700 dark:text-slate-200">
                Event name
              </Label>
              <div className="relative">
                <Input
                  id="tilia-event-name"
                  value={eventNameDraft}
                  onChange={(e) => setEventNameDraft(e.target.value)}
                  placeholder="Quarterly review, 1:1, …"
                  className="h-10 border-slate-200 bg-white pr-10 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
                />
                <EventFormEmojiTrigger
                  aria-label="Choose emoji for event name"
                  buttonClassName="absolute right-1.5 top-1/2 z-[1] -translate-y-1/2 rounded-md p-1.5 text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onInsert={(em) => setEventNameDraft((s) => `${s}${em}`)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tilia-event-desc" className="text-slate-700 dark:text-slate-200">
                Description{' '}
                <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
              </Label>
              <div className="relative">
                <Textarea
                  id="tilia-event-desc"
                  value={eventDescriptionDraft}
                  onChange={(e) => setEventDescriptionDraft(e.target.value)}
                  placeholder="Agenda, dial-in details, or notes for participants."
                  className={cn(
                    'min-h-[100px] resize-y rounded-md border-slate-200 bg-slate-50/80 pr-10 text-sm text-slate-900',
                    'placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-50',
                    'focus-visible:ring-2 focus-visible:ring-slate-400/35 dark:focus-visible:ring-slate-500/30'
                  )}
                />
                <EventFormEmojiTrigger
                  aria-label="Choose emoji for description"
                  buttonClassName="absolute right-2 top-2 z-[1] rounded-md p-1.5 text-slate-500 outline-none hover:bg-white hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onInsert={(em) => setEventDescriptionDraft((s) => `${s}${em}`)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-900/35">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Start date and time
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tilia-event-start-date" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Date
                  </Label>
                  <div className="relative">
                    <input
                      id="tilia-event-start-date"
                      type="date"
                      value={eventStartDate}
                      onChange={(e) => setEventStartDate(e.target.value)}
                      className={cn(
                        'h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-900 shadow-sm',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2',
                        'dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50 dark:focus-visible:ring-slate-500/35'
                      )}
                    />
                    <Calendar
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                      aria-hidden
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tilia-event-start-time" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Time
                  </Label>
                  <EnterpriseTimePicker
                    id="tilia-event-start-time"
                    aria-label="Event start time"
                    value={eventStartTime}
                    onChange={setEventStartTime}
                  />
                </div>
              </div>
            </div>

            {eventEndExpanded ? (
              <div className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-900/35">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    End date and time
                  </p>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={() => {
                      setEventEndExpanded(false)
                      setEventEndDate('')
                      setEventEndTime('')
                    }}
                  >
                    Remove end time
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tilia-event-end-date" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Date
                    </Label>
                    <div className="relative">
                      <input
                        id="tilia-event-end-date"
                        type="date"
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                        className={cn(
                          'h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-900 shadow-sm',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2',
                          'dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50 dark:focus-visible:ring-slate-500/35'
                        )}
                      />
                      <Calendar
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tilia-event-end-time" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Time
                    </Label>
                    <EnterpriseTimePicker
                      id="tilia-event-end-time"
                      aria-label="Event end time"
                      value={eventEndTime}
                      onChange={setEventEndTime}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                onClick={() => {
                  setEventEndExpanded(true)
                  if (!eventEndDate && eventStartDate) setEventEndDate(eventStartDate)
                  if (!eventEndTime && eventStartTime) setEventEndTime(eventStartTime)
                }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </span>
                Add end time
              </button>
            )}

            <div className="space-y-2">
              <Label htmlFor="tilia-event-location" className="text-slate-700 dark:text-slate-200">
                Location{' '}
                <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="tilia-event-location"
                  value={eventLocationDraft}
                  onChange={(e) => setEventLocationDraft(e.target.value)}
                  placeholder="Building, room, or video link"
                  className="h-10 border-slate-200 bg-white pr-10 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50"
                />
                <MapPin
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/45 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2 border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 sm:w-44 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => setEventAttachOpen(false)}
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 w-full gap-2 bg-slate-900 px-4 text-white shadow-sm hover:bg-slate-800 sm:w-44 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              disabled={!eventNameDraft.trim()}
              onClick={submitEventAttachment}
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
              Create event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImageAttachmentPreviewDialog
        open={!!pendingImagePreview}
        onOpenChange={(open) => {
          if (!open) setPendingImagePreview(null)
        }}
        url={pendingImagePreview?.url ?? ''}
        name={pendingImagePreview?.name ?? ''}
      />
    </div>
  )
}

function ImageAttachmentPreviewDialog({
  open,
  onOpenChange,
  url,
  name,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  name: string
}) {
  useEffect(() => {
    if (open) {
      document.documentElement.setAttribute('data-tilia-image-preview', 'true')
    } else {
      document.documentElement.removeAttribute('data-tilia-image-preview')
    }
    return () => {
      document.documentElement.removeAttribute('data-tilia-image-preview')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    useUiOverlayStore.getState().incBlockingOverlay()
    return () => useUiOverlayStore.getState().decBlockingOverlay()
  }, [open])

  const displayName = name?.trim() || 'Image'
  const handleDownload = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = displayName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-full max-w-[min(98vw,1200px)] gap-0 overflow-hidden rounded-xl border border-slate-200/90 p-0',
          'bg-gradient-to-b from-white to-slate-50/95 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)]',
          'dark:border-slate-700/90 dark:from-slate-950 dark:to-slate-950/98 dark:shadow-black/40'
        )}
      >
        <DialogTitle className="sr-only">{displayName}</DialogTitle>

        <div
          className={cn(
            'flex items-center justify-between gap-3 border-b border-slate-200/90 px-4 py-3',
            'bg-white/95 dark:border-slate-800 dark:bg-slate-900/95'
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50',
                'dark:border-slate-700 dark:bg-slate-800/80'
              )}
              aria-hidden
            >
              <Image className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {displayName}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Image preview
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onClick={() => onOpenChange(false)}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'border-t border-slate-100/80 bg-slate-100/50 px-4 py-4 dark:border-slate-800/80 dark:bg-slate-950/40'
          )}
        >
          <div
            className={cn(
              'flex max-h-[min(84vh,900px)] min-h-[180px] items-center justify-center overflow-auto rounded-lg border border-slate-200/80',
              'bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700/90 dark:bg-slate-900/30',
              'p-1.5 sm:p-2'
            )}
          >
            {url ? (
              <img
                src={url}
                alt=""
                className="mx-auto max-h-[min(82vh,860px)] max-w-full object-contain object-center"
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function UserMessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  if (!attachments.length) return null
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-2">
        {attachments.map((a) => (
          <div key={a.id}>
            {a.kind === 'image' && (
              <button
                type="button"
                onClick={() => setPreview({ url: a.url, name: a.name })}
                className={cn(
                  'relative block h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted/20',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-neutral-400/55',
                  'dark:focus-visible:ring-neutral-500/45'
                )}
                aria-label={`Preview ${a.name}`}
              >
                <img src={a.url} alt="" className="h-full w-full object-cover" />
              </button>
            )}
            {a.kind === 'document' && (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-sky-200/80 bg-white/80 px-2.5 py-1.5 text-xs text-foreground dark:border-slate-700 dark:bg-slate-950/40">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{a.name}</span>
              </span>
            )}
            {a.kind === 'audio' && a.url ? (
              <audio src={a.url} controls className="h-9 w-full max-w-[min(100%,280px)]" preload="metadata" />
            ) : null}
            {a.kind === 'video' && a.url ? (
              <video
                src={a.url}
                controls
                className="max-h-48 w-full max-w-[min(100%,280px)] rounded-md border border-border/50 bg-black/5"
                preload="metadata"
              />
            ) : null}
            {a.kind === 'contact' && (
              <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-xs text-foreground dark:border-sky-800/60 dark:bg-sky-950/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
                  <User className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.name}</span>
                  {a.subtitle ? (
                    <span className="block truncate text-[11px] text-muted-foreground">{a.subtitle}</span>
                  ) : null}
                </span>
              </span>
            )}
            {a.kind === 'poll' && (
              <span className="inline-flex max-w-full flex-col gap-1 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-foreground dark:border-amber-900/50 dark:bg-amber-950/35">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <BarChart2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="truncate">{a.name}</span>
                </span>
                {a.subtitle ? (
                  <span className="pl-10 text-[11px] text-muted-foreground">{a.subtitle}</span>
                ) : null}
              </span>
            )}
            {a.kind === 'event' && (
              <span className="inline-flex max-w-full flex-col gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-xs text-foreground dark:border-rose-900/50 dark:bg-rose-950/35">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="truncate">{a.name}</span>
                </span>
                {a.subtitle ? (
                  <span className="pl-10 text-[11px] text-muted-foreground">{a.subtitle}</span>
                ) : null}
                {a.eventDescription ? (
                  <span className="pl-10 text-[11px] leading-snug text-muted-foreground">{a.eventDescription}</span>
                ) : null}
                {a.eventLocation ? (
                  <span className="inline-flex items-start gap-1.5 pl-10 text-[11px] text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{a.eventLocation}</span>
                  </span>
                ) : null}
              </span>
            )}
          </div>
        ))}
      </div>
      <ImageAttachmentPreviewDialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        url={preview?.url ?? ''}
        name={preview?.name ?? ''}
      />
    </>
  )
}

function ConversationRowAvatar({
  conversation: c,
  size = 'md',
}: {
  conversation: Conversation
  size?: 'sm' | 'md'
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const [teamImgFailed, setTeamImgFailed] = useState(false)
  const sm = size === 'sm'

  useEffect(() => {
    setTeamImgFailed(false)
  }, [c.contactAvatarSrc, c.id])

  if (c.mode === 'group') {
    return (
      <div
        className={cn(
          'relative shrink-0',
          sm ? 'h-8 w-8 min-h-8 min-w-8' : 'h-11 w-11 min-h-11 min-w-11'
        )}
      >
        <div
          className={cn(
            'flex h-full w-full items-center justify-center overflow-hidden rounded-full',
            'bg-gradient-to-br from-sky-500/20 via-background to-indigo-500/25',
            sm
              ? 'ring-1 ring-sky-300/50 shadow-sm dark:ring-sky-700/55'
              : 'ring-2 ring-sky-300/45 shadow-sm dark:ring-sky-700/55'
          )}
        >
          <UsersRound
            className={cn(
              'text-sky-700 dark:text-sky-200',
              sm ? 'h-4 w-4' : 'h-5 w-5'
            )}
            aria-hidden
          />
        </div>
        {resolveConversationDisappearingDuration(c) !== 'off' ? (
          <DisappearingMessagesAvatarBadge size={sm ? 'sm' : 'md'} />
        ) : null}
      </div>
    )
  }

  if (c.mode === 'genai') {
    return (
      <div className={cn('relative shrink-0', sm ? 'h-8 w-8 min-h-8 min-w-8' : 'h-11 w-11 min-h-11 min-w-11')}>
        <div
          className={cn(
            'flex h-full w-full items-center justify-center overflow-hidden rounded-full',
            'bg-gradient-to-br from-violet-500/15 via-background to-sky-500/20',
            sm ? 'ring-1 ring-violet-300/50 shadow-sm dark:ring-violet-700/55' : 'ring-2 ring-violet-300/45 shadow-sm dark:ring-violet-700/55'
          )}
        >
          {!logoFailed ? (
            <img
              src="/images/logo.png"
              alt=""
              className={cn('object-contain p-0.5', sm ? 'h-6 w-6' : 'h-8 w-8')}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Sparkles className={cn('text-violet-600 dark:text-violet-300', sm ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden />
          )}
        </div>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex justify-center rounded-full bg-violet-600 font-bold leading-none text-white shadow-sm ring-2 ring-background',
            sm ? 'min-w-[1rem] px-0.5 py-px text-[7px]' : 'min-w-[1.125rem] px-1 py-0.5 text-[8px]'
          )}
        >
          AI
        </span>
      </div>
    )
  }

  const teamDisplayName = (c.contactName ?? c.title).trim()
  const teamInitials = titleToInitials(teamDisplayName || 'User')
  const showDisappearing = resolveConversationDisappearingDuration(c) !== 'off'
  const disappearingBadge = showDisappearing ? (
    <DisappearingMessagesAvatarBadge size={sm ? 'sm' : 'md'} />
  ) : null
  const rowDims = sm
    ? 'h-8 w-8 min-h-8 min-w-8'
    : 'h-11 w-11 min-h-11 min-w-11'

  if (c.contactAvatarSrc && !teamImgFailed) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-full',
          rowDims,
          sm
            ? 'ring-1 ring-border/40 shadow-sm ring-offset-1 ring-offset-background'
            : 'ring-2 ring-border/50 ring-offset-2 ring-offset-background shadow-md',
        )}
        aria-hidden
      >
        <img
          src={c.contactAvatarSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setTeamImgFailed(true)}
        />
        {disappearingBadge}
      </div>
    )
  }

  return (
    <div className={cn('relative shrink-0', rowDims)} aria-hidden>
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-semibold tracking-tight text-white shadow-md',
          sm
            ? 'text-[10px] ring-1 ring-white/20 ring-offset-1 ring-offset-background'
            : 'text-xs ring-2 ring-white/15 ring-offset-2 ring-offset-background',
          teamAvatarClassForConversation(c.id),
        )}
      >
        {teamInitials}
      </div>
      {disappearingBadge}
    </div>
  )
}

function ContactPresenceDot({
  presence,
  className,
}: {
  presence?: ChatContact['presence']
  className?: string
}) {
  if (!presence) return null
  return <PresenceDot status={presence} className={className} />
}

function ContactAvatar({
  contact,
  size = 'md',
  showPresence = false,
  showDisappearingMessages = false,
}: {
  contact: ChatContact
  size?: 'md' | 'lg' | 'xl'
  showPresence?: boolean
  showDisappearingMessages?: boolean
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const dims =
    size === 'xl'
      ? 'h-28 w-28 min-h-28 min-w-28'
      : size === 'lg'
        ? 'h-12 w-12 min-h-12 min-w-12'
        : 'h-10 w-10 min-h-10 min-w-10'
  const textSize = size === 'xl' ? 'text-xl' : size === 'lg' ? 'text-sm' : 'text-xs'
  const presenceClassName = showDisappearingMessages ? 'left-0 right-auto' : undefined
  const dot =
    showPresence && contact.presence ? (
      <ContactPresenceDot presence={contact.presence} className={presenceClassName} />
    ) : null
  const disappearingBadge = showDisappearingMessages ? (
    <DisappearingMessagesAvatarBadge size={size} />
  ) : null

  if (contact.avatarSrc && !imgFailed) {
    return (
      <div className={cn('relative shrink-0', dims)}>
        <div
          className={cn(
            'h-full w-full overflow-hidden rounded-full ring-2 ring-border/60',
            contact.avatarClassName
          )}
        >
          <img
            src={contact.avatarSrc}
            alt=""
            className={cn(
              'h-full w-full',
              size === 'xl' ? 'object-cover' : 'object-contain p-1',
            )}
            onError={() => setImgFailed(true)}
          />
        </div>
        {dot}
        {disappearingBadge}
      </div>
    )
  }

  return (
    <div className={cn('relative shrink-0', dims)}>
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-black/10',
          textSize,
          contact.avatarClassName
        )}
      >
        {contact.initials}
      </div>
      {dot}
      {disappearingBadge}
    </div>
  )
}

function formatWhatsAppTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

function startOfLocalDayMs(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Pemisah tanggal thread (Today / Yesterday / weekday / tanggal). */
function formatChatThreadDateSeparator(ts: number): string {
  try {
    const msgDay = startOfLocalDayMs(ts)
    const todayStart = startOfLocalDayMs(Date.now())
    const dayMs = 86_400_000
    if (msgDay === todayStart) return 'Today'
    if (msgDay === todayStart - dayMs) return 'Yesterday'

    const msgDate = new Date(ts)
    const now = new Date()
    if (msgDay >= todayStart - 7 * dayMs) {
      return msgDate.toLocaleDateString(undefined, { weekday: 'long' })
    }

    return msgDate.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function shouldShowChatDateSeparator(messages: ChatMessage[], index: number): boolean {
  if (index <= 0) return true
  const current = messages[index]
  const previous = messages[index - 1]
  if (!current || !previous) return true
  return startOfLocalDayMs(current.at) !== startOfLocalDayMs(previous.at)
}

function ChatThreadDateSeparator({ label }: { label: string }) {
  if (!label) return null
  return (
    <div className="flex justify-center py-2" role="separator" aria-label={label}>
      <span className="rounded-lg border border-black/[0.06] bg-white px-3 py-1 text-[12px] font-medium leading-none text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:border-white/10 dark:bg-[#182229] dark:text-[#8696a0]">
        {label}
      </span>
    </div>
  )
}

function getChatContactById(id: string | undefined, contacts: ChatContact[]): ChatContact | undefined {
  if (!id) return undefined
  return contacts.find((c) => c.id === id)
}

function resolveGroupBubbleContact(
  m: ChatMessage,
  conversation: Conversation | null | undefined,
  contacts: ChatContact[],
  currentUserId: string,
): ChatContact | undefined {
  if (!conversation || conversation.mode !== 'group') return undefined
  if (m.role === 'system') return undefined
  if (m.role === 'user') {
    return getChatContactById(m.senderContactId ?? currentUserId, contacts)
  }
  if (m.role === 'assistant') {
    const id = m.senderContactId ?? conversation.groupMemberContactIds?.[0]
    return getChatContactById(id, contacts)
  }
  return undefined
}

function GroupBubbleAvatar({ contact }: { contact: ChatContact }) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/5',
        contact.avatarClassName
      )}
      title={contact.name}
      aria-hidden
    >
      {contact.avatarSrc && !failed ? (
        <img
          src={contact.avatarSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        contact.initials
      )}
    </div>
  )
}

function WhatsAppMetaRow({
  time,
  isUser,
  deliveryStatus,
}: {
  time: string
  isUser: boolean
  deliveryStatus?: ReturnType<typeof resolveOutboundDeliveryStatus>
}) {
  const tickGray = 'text-[#8696a0]'
  return (
    <div className="flex shrink-0 items-end gap-0.5 pb-0.5">
      <span className="text-[11px] tabular-nums leading-none text-[#667781] dark:text-[#8696a0]">{time}</span>
      {isUser && deliveryStatus ? (
        deliveryStatus === 'read' ? (
          <CheckCheck className={cn('h-3.5 w-3.5 shrink-0 text-[#53bdeb]')} aria-hidden strokeWidth={2.5} />
        ) : deliveryStatus === 'delivered' ? (
          <CheckCheck className={cn('h-3.5 w-3.5 shrink-0', tickGray)} aria-hidden strokeWidth={2.5} />
        ) : (
          <Check className={cn('h-3.5 w-3.5 shrink-0', tickGray)} aria-hidden strokeWidth={2.5} />
        )
      ) : null}
    </div>
  )
}

function AssistantTypingDots({ variant = 'reply' }: { variant?: 'greeting' | 'reply' }) {
  const statusLabel =
    variant === 'greeting'
      ? `${TECTONA_ASSISTANT_LABEL} is greeting…`
      : `${TECTONA_ASSISTANT_LABEL} is thinking…`
  return (
    <div
      className="inline-flex items-center gap-2 py-0.5"
      aria-label={statusLabel}
      role="status"
    >
      <div className="inline-flex items-end gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#7b8b95] animate-bounce" style={{ animationDelay: '0ms', animationDuration: '850ms' }} />
        <span className="h-2 w-2 rounded-full bg-[#7b8b95] animate-bounce" style={{ animationDelay: '120ms', animationDuration: '850ms' }} />
        <span className="h-2 w-2 rounded-full bg-[#7b8b95] animate-bounce" style={{ animationDelay: '240ms', animationDuration: '850ms' }} />
      </div>
      <span className="text-[11px] leading-none text-[#667781] dark:text-[#8696a0]">{statusLabel}</span>
    </div>
  )
}

function AssistantTypewriterText({
  text,
  messageId,
  speed,
  renderMarkdown = false,
  emphasizeGreetingLead = false,
  onTypingProgress,
  onTypingComplete,
  choiceUiState,
  onChoiceSubmit,
}: {
  text: string
  messageId: string
  speed: AssistantTypingSpeed
  /** When true, render styled markdown after typewriter animation completes. */
  renderMarkdown?: boolean
  /** Large salutation block — only for the first assistant message in a thread. */
  emphasizeGreetingLead?: boolean
  onTypingProgress?: () => void
  onTypingComplete?: (messageId: string) => void
  choiceUiState?: AssistantChoiceUiState | null
  onChoiceSubmit?: (labels: string[], mode: 'single' | 'multiple') => void
}) {
  const [visibleText, setVisibleText] = useState('')
  const [revealedLineCount, setRevealedLineCount] = useState(0)
  const completionNotifiedRef = useRef(false)

  useEffect(() => {
    completionNotifiedRef.current = false
  }, [messageId, text, speed])

  useEffect(() => {
    const content = text ?? ''
    if (!content) {
      setVisibleText('')
      setRevealedLineCount(0)
      return
    }

    if (speed === 'instant') {
      setVisibleText(content)
      setRevealedLineCount(content.split('\n').length)
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true
        onTypingComplete?.(messageId)
      }
      return
    }

    // Keep animation snappy for long evidence-heavy responses.
    const maxDurationMs = speed === 'fast' ? 800 : 1600
    const totalChars = content.length
    const chunks = Math.min(speed === 'fast' ? 120 : 80, totalChars)
    const charsPerTick = Math.max(1, Math.ceil(totalChars / chunks))
    const totalTicks = Math.ceil(totalChars / charsPerTick)
    const tickMs = Math.max(14, Math.floor(maxDurationMs / Math.max(totalTicks, 1)))

    let current = 0
    setVisibleText('')
    setRevealedLineCount(0)
    const timer = window.setInterval(() => {
      current = Math.min(totalChars, current + charsPerTick)
      setVisibleText(content.slice(0, current))
      onTypingProgress?.()
      if (current >= totalChars) window.clearInterval(timer)
    }, tickMs)

    return () => window.clearInterval(timer)
  }, [text, messageId, speed])

  useEffect(() => {
    if (!visibleText || visibleText !== text) return
    const lines = visibleText.split('\n').length
    if (lines <= 1) {
      setRevealedLineCount(lines)
      return
    }
    if (speed === 'instant') {
      setRevealedLineCount(lines)
      return
    }

    setRevealedLineCount(0)
    let idx = 0
    const stepMs = speed === 'fast' ? 55 : 85
    const lineTimer = window.setInterval(() => {
      idx += 1
      setRevealedLineCount(idx)
      onTypingProgress?.()
      if (idx >= lines) window.clearInterval(lineTimer)
    }, stepMs)
    return () => window.clearInterval(lineTimer)
  }, [visibleText, text, speed, messageId, onTypingProgress])

  useEffect(() => {
    if (!text) return
    if (visibleText !== text) return

    const lines = text.split('\n').length
    const done = speed === 'instant' || lines <= 1 || revealedLineCount >= lines
    if (!done) return
    if (completionNotifiedRef.current) return
    completionNotifiedRef.current = true
    onTypingComplete?.(messageId)
  }, [visibleText, text, speed, revealedLineCount, onTypingComplete, messageId])

  const lines = visibleText.split('\n')
  const showLineFade = lines.length > 1 && visibleText === text
  const lineAnimDone = speed === 'instant' || lines.length <= 1 || revealedLineCount >= lines.length
  const typingComplete = Boolean(text) && visibleText === text && lineAnimDone

  if (renderMarkdown && typingComplete) {
    return (
      <AssistantChatMarkdown
        content={text}
        emphasizeGreetingLead={emphasizeGreetingLead}
        choiceUiState={choiceUiState}
        onChoiceSubmit={onChoiceSubmit}
      />
    )
  }

  if (showLineFade) {
    return (
      <div className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]">
        {lines.map((line, idx) => (
          <span
            key={`${messageId}-line-${idx}`}
            className="block whitespace-pre-wrap break-words transition-all duration-200"
            style={{
              opacity: idx < revealedLineCount ? 1 : 0,
              transform: idx < revealedLineCount ? 'translateY(0px)' : 'translateY(3px)',
            }}
          >
            {line || ' '}
          </span>
        ))}
      </div>
    )
  }

  return (
    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left [overflow-wrap:anywhere]">
      {visibleText}
      {speed !== 'instant' && visibleText.length < text.length ? (
        <span className="ml-0.5 inline-block h-[1em] w-[1px] animate-pulse bg-current align-[-0.1em]" aria-hidden />
      ) : null}
    </p>
  )
}

function WhatsAppChatBubble({
  m,
  conversation,
  chatContacts,
  currentUserId,
  variant,
  assistantTypingSpeed,
  assistantSpeedProfile,
  emphasizeGreetingLead = false,
  onAssistantTypingProgress,
  onAssistantTypingComplete,
  onRetryGreet,
  choiceUiState,
  onChoiceSubmit,
  onAgentActionConfirm,
  onAgentActionCancel,
}: {
  m: ChatMessage
  conversation?: Conversation | null
  chatContacts: ChatContact[]
  currentUserId: string
  /** People (DM/group): semua pesan bubble, tanpa animasi ketik. Gen AI: bubble hanya user, asisten plain + typewriter. */
  variant: 'people' | 'genai'
  assistantTypingSpeed: AssistantTypingSpeed
  assistantSpeedProfile: AssistantSpeedProfile
  /** Large salutation block — only for the first assistant message in a thread. */
  emphasizeGreetingLead?: boolean
  onAssistantTypingProgress?: () => void
  onAssistantTypingComplete?: (messageId: string) => void
  onRetryGreet?: (conversationId: string) => void
  choiceUiState?: AssistantChoiceUiState | null
  onChoiceSubmit?: (labels: string[], mode: 'single' | 'multiple') => void
  onAgentActionConfirm?: (messageId: string, actionId: string, patch?: Record<string, unknown>) => void
  onAgentActionCancel?: (messageId: string, actionId: string) => void
}) {
  const isPeople = variant === 'people'
  const isUser = m.role === 'user'
  const time = formatWhatsAppTime(m.at)
  const hasAttachments = (m.attachments?.length ?? 0) > 0
  const showTyping = Boolean(m.isLoading && m.role === 'assistant' && !isPeople)
  const hasText = Boolean(m.text?.trim()) && !showTyping
  const isGroup = conversation?.mode === 'group'
  const groupContact = isGroup
    ? resolveGroupBubbleContact(m, conversation, chatContacts, currentUserId)
    : undefined

  const resolvedTypingSpeed: AssistantTypingSpeed =
    assistantSpeedProfile === 'greeting_fast' && m.id.startsWith('greet-loading-')
      ? (assistantTypingSpeed === 'instant' ? 'instant' : 'fast')
      : assistantTypingSpeed

  const deliveryStatus =
    isPeople && isUser && conversation?.mode === 'team'
      ? resolveOutboundDeliveryStatus(
          m.sequenceNo,
          conversation.peerLastReadSequence ?? 0,
          conversation.peerLastDeliveredSequence ?? 0,
        )
      : undefined

  const useBubbleShell = isPeople || isUser

  const bubble = (
    <div className={cn('min-w-0 max-w-[min(96%,640px)]', !useBubbleShell && 'w-full max-w-full')}>
      <div
        className={cn(
          'relative flex min-w-0 flex-col gap-1 text-sm leading-[1.4]',
          !useBubbleShell
            ? 'rounded-none border-0 bg-transparent px-0 py-0 text-[#111b21] shadow-none dark:text-[#e9edef]'
            : [
                'px-3 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.08)]',
                isUser
                  ? 'rounded-lg rounded-br-sm bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
                  : 'rounded-lg rounded-bl-sm bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]',
              ],
        )}
      >
        {hasAttachments ? <UserMessageAttachments attachments={m.attachments!} /> : null}

        {showTyping ? (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <AssistantTypingDots variant={m.id.startsWith('greet-loading-') ? 'greeting' : 'reply'} />
            </div>
            <WhatsAppMetaRow time={time} isUser={isUser} deliveryStatus={deliveryStatus} />
          </div>
        ) : hasText ? (
          m.role === 'assistant' && !isPeople ? (
            <div className="flex min-w-0 w-full flex-col gap-1">
              <AssistantTypewriterText
                text={m.text}
                messageId={m.id}
                speed={resolvedTypingSpeed}
                renderMarkdown
                emphasizeGreetingLead={emphasizeGreetingLead}
                onTypingProgress={onAssistantTypingProgress}
                onTypingComplete={onAssistantTypingComplete}
                choiceUiState={choiceUiState}
                onChoiceSubmit={onChoiceSubmit}
              />
              <div className="flex justify-end">
                <WhatsAppMetaRow time={time} isUser={isUser} deliveryStatus={deliveryStatus} />
              </div>
              {m.evidence?.length ? (
                <AssistantEvidenceFootnotes evidence={m.evidence} />
              ) : null}
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left [overflow-wrap:anywhere]">
                {m.text}
              </p>
              <WhatsAppMetaRow time={time} isUser={isUser} deliveryStatus={deliveryStatus} />
            </div>
          )
        ) : hasAttachments ? (
          <div className="flex justify-end pt-0.5">
            <WhatsAppMetaRow time={time} isUser={isUser} deliveryStatus={deliveryStatus} />
          </div>
        ) : (
          <div className="flex justify-end">
            <WhatsAppMetaRow time={time} isUser={isUser} deliveryStatus={deliveryStatus} />
          </div>
        )}

        {m.action?.kind === 'retry_greet' && !isPeople ? (
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                const convId = conversation?.id
                if (!convId) return
                onRetryGreet?.(convId)
              }}
            >
              {m.action.label}
            </Button>
          </div>
        ) : null}

        {!isPeople && m.agentActionState?.actions.length
          ? m.agentActionState.actions.map((action) => (
              <AssistantActionCard
                key={action.action_id}
                action={action}
                execution={m.agentActionState?.executions[action.action_id]}
                onConfirm={(actionId, patch) => onAgentActionConfirm?.(m.id, actionId, patch)}
                onCancel={(actionId) => onAgentActionCancel?.(m.id, actionId)}
              />
            ))
          : null}
      </div>
    </div>
  )

  if (!isGroup || !groupContact) {
    return (
      <div className={cn('flex w-full py-0.5', isUser ? 'justify-end' : 'justify-start')}>{bubble}</div>
    )
  }

  return (
    <div className={cn('flex w-full items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? <GroupBubbleAvatar contact={groupContact} /> : null}
      {bubble}
      {isUser ? <GroupBubbleAvatar contact={groupContact} /> : null}
    </div>
  )
}

function MessageSelectionCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'mb-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors',
        checked
          ? 'border-[#008069] bg-[#008069]'
          : 'border-[#8696a0] bg-white dark:border-[#8696a0] dark:bg-[#2a3942]',
      )}
    >
      {checked ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
    </button>
  )
}

function PeopleChatThread({
  messages,
  conversation,
  chatContacts,
  currentUserId,
  assistantTypingSpeed,
  assistantSpeedProfile,
  threadScrollRef,
  messagesEndRef,
  onThreadScroll,
  onThreadContextMenu,
  messageSelectionActive,
  selectedMessageIds,
  onToggleMessageSelection,
  onAssistantTypingProgress,
  onAssistantTypingComplete,
  onRetryGreet,
  onOpenDisappearingMessages,
}: {
  messages: ChatMessage[]
  conversation: Conversation
  chatContacts: ChatContact[]
  currentUserId: string
  assistantTypingSpeed: AssistantTypingSpeed
  assistantSpeedProfile: AssistantSpeedProfile
  threadScrollRef: RefObject<HTMLDivElement | null>
  messagesEndRef: RefObject<HTMLDivElement | null>
  onThreadScroll?: () => void
  onThreadContextMenu?: (e: React.MouseEvent) => void
  messageSelectionActive?: boolean
  selectedMessageIds?: ReadonlySet<string>
  onToggleMessageSelection?: (messageId: string) => void
  onAssistantTypingProgress?: () => void
  onAssistantTypingComplete?: (messageId: string) => void
  onRetryGreet?: (conversationId: string) => void
  onOpenDisappearingMessages?: () => void
}) {
  return (
    <div
      ref={threadScrollRef}
      onScroll={onThreadScroll}
      onContextMenu={messageSelectionActive ? undefined : onThreadContextMenu}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#efeae2] px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] dark:bg-[#0b141a] [&::-webkit-scrollbar]:hidden"
    >
      {messages.length === 0 ? (
        <p className="py-8 text-center text-[13px] leading-relaxed text-muted-foreground">
          Belum ada pesan — tulis sapaan di bawah.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {messages.map((m, index) => (
            <Fragment key={m.id}>
              {shouldShowChatDateSeparator(messages, index) ? (
                <ChatThreadDateSeparator label={formatChatThreadDateSeparator(m.at)} />
              ) : null}
              {m.disappearingNotice ? (
                <DisappearingMessagesThreadNotice
                  kind={m.disappearingNotice.kind}
                  duration={m.disappearingNotice.duration}
                  onClickChange={onOpenDisappearingMessages}
                />
              ) : m.role === 'system' ? (
                <div className="mx-auto max-w-[92%] rounded-full bg-black/[0.06] px-3 py-1.5 text-center text-[11px] leading-snug text-muted-foreground dark:bg-white/10">
                  {m.text}
                </div>
              ) : (
                <div
                  data-chat-message-id={m.id}
                  className={cn(
                    'flex w-full items-end gap-2.5',
                    messageSelectionActive && 'cursor-pointer',
                  )}
                  onClick={
                    messageSelectionActive && onToggleMessageSelection
                      ? () => onToggleMessageSelection(m.id)
                      : undefined
                  }
                  onKeyDown={
                    messageSelectionActive && onToggleMessageSelection
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onToggleMessageSelection(m.id)
                          }
                        }
                      : undefined
                  }
                  role={messageSelectionActive ? 'button' : undefined}
                  tabIndex={messageSelectionActive ? 0 : undefined}
                >
                  {messageSelectionActive ? (
                    <MessageSelectionCheckbox
                      checked={selectedMessageIds?.has(m.id) ?? false}
                      onToggle={() => onToggleMessageSelection?.(m.id)}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <WhatsAppChatBubble
                      m={m}
                      variant="people"
                      conversation={conversation}
                      chatContacts={chatContacts}
                      currentUserId={currentUserId}
                      assistantTypingSpeed={assistantTypingSpeed}
                      assistantSpeedProfile={assistantSpeedProfile}
                      onAssistantTypingProgress={onAssistantTypingProgress}
                      onAssistantTypingComplete={onAssistantTypingComplete}
                      onRetryGreet={onRetryGreet}
                    />
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}
      <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
    </div>
  )
}

function GenAiChatThread({
  messages,
  conversation,
  chatContacts,
  currentUserId,
  assistantTypingSpeed,
  assistantSpeedProfile,
  threadScrollRef,
  messagesEndRef,
  onThreadScroll,
  onAssistantTypingProgress,
  onAssistantTypingComplete,
  onRetryGreet,
  onAssistantChoiceSubmit,
  onAgentActionConfirm,
  onAgentActionCancel,
}: {
  messages: ChatMessage[]
  conversation: Conversation | null | undefined
  chatContacts: ChatContact[]
  currentUserId: string
  assistantTypingSpeed: AssistantTypingSpeed
  assistantSpeedProfile: AssistantSpeedProfile
  threadScrollRef: RefObject<HTMLDivElement | null>
  messagesEndRef: RefObject<HTMLDivElement | null>
  onThreadScroll?: () => void
  onAssistantTypingProgress?: () => void
  onAssistantTypingComplete?: (messageId: string) => void
  onRetryGreet?: (conversationId: string) => void
  onAssistantChoiceSubmit?: (
    messageId: string,
    labels: string[],
    mode: 'single' | 'multiple',
  ) => void
  onAgentActionConfirm?: (messageId: string, actionId: string, patch?: Record<string, unknown>) => void
  onAgentActionCancel?: (messageId: string, actionId: string) => void
}) {
  return (
    <div
      ref={threadScrollRef}
      onScroll={onThreadScroll}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl bg-white px-2 py-3 [scrollbar-width:none] dark:bg-background [&::-webkit-scrollbar]:hidden"
    >
      {messages.length === 0 ? (
        <p className="py-8 text-center text-[13px] leading-relaxed text-muted-foreground">
          Belum ada pesan — tanyakan sesuatu di bawah.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {messages.map((m, index) => {
            const choiceUiState =
              m.role === 'assistant' && !(m.agentActionState?.actions.length)
                ? resolveAssistantChoiceUiState(m.text, messages, index, m.choiceOffer)
                : null
            const handleChoiceSubmit =
              onAssistantChoiceSubmit && choiceUiState?.kind === 'active'
                ? (labels: string[], mode: 'single' | 'multiple') =>
                    onAssistantChoiceSubmit(m.id, labels, mode)
                : undefined
            const isFirstAssistantMessage =
              m.role === 'assistant' &&
              !messages.slice(0, index).some((prior) => prior.role === 'assistant')

            return (
              <Fragment key={m.id}>
                {shouldShowChatDateSeparator(messages, index) ? (
                  <ChatThreadDateSeparator label={formatChatThreadDateSeparator(m.at)} />
                ) : null}
                {m.role === 'system' ? (
                  <div className="mx-auto max-w-[92%] rounded-full bg-black/[0.06] px-3 py-1.5 text-center text-[11px] text-muted-foreground dark:bg-white/10">
                    {m.text}
                  </div>
                ) : (
                  <WhatsAppChatBubble
                    m={m}
                    variant="genai"
                    conversation={conversation}
                    chatContacts={chatContacts}
                    currentUserId={currentUserId}
                    assistantTypingSpeed={assistantTypingSpeed}
                    assistantSpeedProfile={assistantSpeedProfile}
                    emphasizeGreetingLead={isFirstAssistantMessage}
                    onAssistantTypingProgress={onAssistantTypingProgress}
                    onAssistantTypingComplete={onAssistantTypingComplete}
                    onRetryGreet={onRetryGreet}
                    choiceUiState={choiceUiState}
                    onChoiceSubmit={handleChoiceSubmit}
                    onAgentActionConfirm={onAgentActionConfirm}
                    onAgentActionCancel={onAgentActionCancel}
                  />
                )}
              </Fragment>
            )
          })}
        </div>
      )}
      <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
    </div>
  )
}

function MessageThread({
  messages,
  threadMode,
  conversation,
  chatContacts,
  currentUserId,
  assistantTypingSpeed,
  assistantSpeedProfile,
  threadScrollRef,
  messagesEndRef,
  onThreadScroll,
  onThreadContextMenu,
  messageSelectionActive,
  selectedMessageIds,
  onToggleMessageSelection,
  onAssistantTypingProgress,
  onAssistantTypingComplete,
  onOpenDisappearingMessages,
  onRetryGreet,
  onAssistantChoiceSubmit,
  onAgentActionConfirm,
  onAgentActionCancel,
}: {
  messages: ChatMessage[]
  threadMode: 'team' | 'genai' | 'group'
  conversation?: Conversation | null
  chatContacts: ChatContact[]
  currentUserId: string
  assistantTypingSpeed: AssistantTypingSpeed
  assistantSpeedProfile: AssistantSpeedProfile
  threadScrollRef: RefObject<HTMLDivElement | null>
  messagesEndRef: RefObject<HTMLDivElement | null>
  onThreadScroll?: () => void
  onThreadContextMenu?: (e: React.MouseEvent) => void
  messageSelectionActive?: boolean
  selectedMessageIds?: ReadonlySet<string>
  onToggleMessageSelection?: (messageId: string) => void
  onAssistantTypingProgress?: () => void
  onAssistantTypingComplete?: (messageId: string) => void
  onOpenDisappearingMessages?: () => void
  onRetryGreet?: (conversationId: string) => void
  onAssistantChoiceSubmit?: (
    messageId: string,
    labels: string[],
    mode: 'single' | 'multiple',
  ) => void
  onAgentActionConfirm?: (messageId: string, actionId: string, patch?: Record<string, unknown>) => void
  onAgentActionCancel?: (messageId: string, actionId: string) => void
}) {
  if ((threadMode === 'team' || threadMode === 'group') && conversation) {
    return (
      <PeopleChatThread
        messages={messages}
        conversation={conversation}
        chatContacts={chatContacts}
        currentUserId={currentUserId}
        assistantTypingSpeed={assistantTypingSpeed}
        assistantSpeedProfile={assistantSpeedProfile}
        threadScrollRef={threadScrollRef}
        messagesEndRef={messagesEndRef}
        onThreadScroll={onThreadScroll}
        onThreadContextMenu={onThreadContextMenu}
        messageSelectionActive={messageSelectionActive}
        selectedMessageIds={selectedMessageIds}
        onToggleMessageSelection={onToggleMessageSelection}
        onAssistantTypingProgress={onAssistantTypingProgress}
        onAssistantTypingComplete={onAssistantTypingComplete}
        onOpenDisappearingMessages={onOpenDisappearingMessages}
      />
    )
  }
  return (
    <GenAiChatThread
      messages={messages}
      conversation={conversation}
      chatContacts={chatContacts}
      currentUserId={currentUserId}
      assistantTypingSpeed={assistantTypingSpeed}
      assistantSpeedProfile={assistantSpeedProfile}
      threadScrollRef={threadScrollRef}
      messagesEndRef={messagesEndRef}
      onThreadScroll={onThreadScroll}
      onAssistantTypingProgress={onAssistantTypingProgress}
      onAssistantTypingComplete={onAssistantTypingComplete}
      onRetryGreet={onRetryGreet}
      onAssistantChoiceSubmit={onAssistantChoiceSubmit}
      onAgentActionConfirm={onAgentActionConfirm}
      onAgentActionCancel={onAgentActionCancel}
    />
  )
}

type AiFolderGroupRow = {
  folderKey: string
  displayLabel: string
  conversations: Conversation[]
}

function ChatArchiveDropWrap({
  showArchived,
  children,
}: {
  showArchived: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: CHAT_DND_ARCHIVE_ID,
    disabled: showArchived,
  })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative inline-flex rounded-md transition-[transform,box-shadow] duration-200',
        isOver && !showArchived && 'ring-2 ring-primary/45 ring-offset-2 ring-offset-background scale-105'
      )}
    >
      {children}
    </div>
  )
}

function ChatConversationDragOverlayCard({
  conversation: c,
  stackCount,
}: {
  conversation: Conversation
  stackCount: number
}) {
  return (
    <div className="pointer-events-none relative">
      <div
        className="rotate-[2deg]"
        style={{
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.22), 0 0 0 2px rgba(59, 130, 246, 0.22)',
        }}
      >
        <div className="scale-[1.03] rounded-xl border-2 border-primary/35 bg-card p-2.5 shadow-2xl">
          <div className="flex w-[min(100%,280px)] items-start gap-2.5">
            <ConversationRowAvatar conversation={c} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="line-clamp-1 text-sm font-semibold text-foreground">
                {c.mode === 'team' ? (c.contactName ?? c.title) : c.title}
              </p>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">{c.preview}</p>
            </div>
          </div>
        </div>
      </div>
      {stackCount > 1 && (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shadow-md ring-2 ring-background">
          {stackCount}
        </span>
      )}
    </div>
  )
}

function DraggableChatConversationRow({
  c,
  selectedIds,
  onOpen,
  onConversationRowClick,
  onContextMenu,
  dragToArchiveEnabled,
}: {
  c: Conversation
  selectedIds: Set<string>
  onOpen: (id: string) => void
  onConversationRowClick: (e: React.MouseEvent, id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  dragToArchiveEnabled: boolean
}) {
  const dndId = chatConvDndId(c.id)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dndId,
    disabled: !dragToArchiveEnabled,
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-chat-conversation-row
      title="Double-click to open · Shift+click range · Ctrl+click toggle selection · Drag to archive"
      style={{
        opacity: isDragging ? 0.35 : undefined,
        touchAction: 'none',
      }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // detail === 0: synthetic / non-pointer activation (e.g. keyboard) — open thread
        if (e.detail === 0) {
          onOpen(c.id)
          return
        }
        // Second click of a double-click (detail === 2): open thread. Relying on onDoubleClick alone
        // is unreliable here because @dnd-kit draggable listeners often swallow dblclick.
        if (e.detail === 2) {
          e.preventDefault()
          onOpen(c.id)
          return
        }
        onConversationRowClick(e, c.id)
      }}
      onContextMenu={(e) => onContextMenu(e, c.id)}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-xl border border-border/60 bg-card p-2.5 text-left shadow-sm',
        'ring-1 ring-black/[0.03] transition-all duration-200 dark:ring-white/[0.06]',
        'hover:-translate-y-0.5 hover:border-border hover:shadow-md hover:ring-black/[0.05] dark:hover:ring-white/[0.08]',
        'active:translate-y-0 active:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        dragToArchiveEnabled && 'cursor-grab active:cursor-grabbing',
        selectedIds.has(c.id) &&
          'border-primary/60 bg-primary/[0.06] ring-2 ring-primary/35 dark:bg-primary/10',
        (isConversationChatLockActive(c) || c.isBlocked) && 'opacity-80 hover:translate-y-0 hover:shadow-sm'
      )}
    >
      <ConversationRowAvatar conversation={c} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none',
                c.mode === 'team'
                  ? 'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/80 dark:bg-sky-950/50 dark:text-sky-100'
                  : c.mode === 'group'
                    ? 'border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-100'
                    : 'border-violet-200/80 bg-violet-50 text-violet-900 dark:border-violet-800/80 dark:bg-violet-950/50 dark:text-violet-100'
              )}
            >
              {c.mode === 'team' ? (
                <Users className="h-3 w-3 opacity-80" aria-hidden />
              ) : c.mode === 'group' ? (
                <UsersRound className="h-3 w-3 opacity-80" aria-hidden />
              ) : (
                <Sparkles className="h-3 w-3 opacity-80" aria-hidden />
              )}
              {c.mode === 'team' ? 'People' : c.mode === 'group' ? 'Group' : 'Gen AI'}
            </span>
            <p
              className={cn(
                'line-clamp-1 text-sm font-semibold leading-snug text-foreground',
                c.isBlurred && 'blur-[2px]'
              )}
            >
              {c.mode === 'team' ? (c.contactName ?? c.title) : c.title}
            </p>
            <p
              className={cn(
                'line-clamp-1 text-[11px] leading-snug text-muted-foreground',
                c.isBlurred && 'blur-[2px]'
              )}
            >
              {c.preview}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              {c.isFavorite && <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />}
              {isConversationChatLockActive(c) && (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              )}
              {c.isBlocked && <Ban className="h-3.5 w-3.5 text-destructive/80" aria-hidden />}
              {c.isBlurred && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
            </div>
            {c.unreadCount > 0 && (
              <span
                className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm"
                aria-label={`${c.unreadCount} unread`}
              >
                {c.unreadCount > 99 ? '99+' : c.unreadCount}
              </span>
            )}
            <time
              className="text-[10px] font-medium tabular-nums text-muted-foreground"
              dateTime={new Date(c.updatedAt).toISOString()}
            >
              {formatListTime(c.updatedAt)}
            </time>
          </div>
        </div>
      </div>
    </button>
  )
}

function ConversationListRows({
  conversations,
  onOpen,
  onConversationRowClick,
  onContextMenu,
  selectedIds,
  dragToArchiveEnabled = true,
}: {
  conversations: Conversation[]
  onOpen: (id: string) => void
  onConversationRowClick: (e: React.MouseEvent, id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  selectedIds: Set<string>
  dragToArchiveEnabled?: boolean
}) {
  return (
    <div className="space-y-3">
      {conversations.map((c) => (
        <DraggableChatConversationRow
          key={c.id}
          c={c}
          selectedIds={selectedIds}
          onOpen={onOpen}
          onConversationRowClick={onConversationRowClick}
          onContextMenu={onContextMenu}
          dragToArchiveEnabled={dragToArchiveEnabled}
        />
      ))}
    </div>
  )
}

function ConversationSection({
  kind,
  title,
  emptyLabel,
  conversations,
  aiFolderGroups,
  onRenameAiFolder,
  onOpen,
  onConversationRowClick,
  onContextMenu,
  selectedIds,
  open,
  onToggle,
  dragToArchiveEnabled = true,
}: {
  kind: 'ai' | 'people' | 'favorite'
  title: string
  emptyLabel: string
  conversations: Conversation[]
  aiFolderGroups?: AiFolderGroupRow[]
  onRenameAiFolder?: (folderKey: string, nextLabel: string) => void
  onOpen: (id: string) => void
  onConversationRowClick: (e: React.MouseEvent, id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  selectedIds: Set<string>
  open: boolean
  onToggle: () => void
  dragToArchiveEnabled?: boolean
}) {
  const effectiveGroups = useMemo(() => {
    if (kind === 'ai' && aiFolderGroups !== undefined) {
      return aiFolderGroups
    }
    return [{ folderKey: '', displayLabel: '', conversations }]
  }, [kind, aiFolderGroups, conversations])

  const totalItems =
    kind === 'ai' && aiFolderGroups !== undefined
      ? aiFolderGroups.reduce((s, g) => s + g.conversations.length, 0)
      : conversations.length

  const showFolderHeaders =
    kind === 'ai' &&
    aiFolderGroups !== undefined &&
    aiFolderGroups.length > 0 &&
    (effectiveGroups.length > 1 || (effectiveGroups.length === 1 && effectiveGroups[0].folderKey !== ''))

  const [folderOpenByKey, setFolderOpenByKey] = useState<Record<string, boolean>>({})
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number
    y: number
    folderKey: string
    displayLabel: string
  } | null>(null)
  const [editingFolderKey, setEditingFolderKey] = useState<string | null>(null)
  const [editingFolderDraft, setEditingFolderDraft] = useState('')

  function AiFolderGroupPanel(props: {
    group: AiFolderGroupRow
    folderExpanded: boolean
    onToggleExpand: () => void
    onOpenFolderContextMenu: (e: React.MouseEvent) => void
    onRenameCommit: (nextLabel: string) => void
    onRenameCancel: () => void
    conversations: Conversation[]
  }) {
    const isAiFolderHeader = kind === 'ai' && aiFolderGroups !== undefined
    const { setNodeRef: setFolderDropRef, isOver: isFolderOver } = useDroppable({
      id: aiFolderDropId(props.group.folderKey),
      disabled: !isAiFolderHeader,
    })

    return (
      <div className="overflow-hidden rounded-xl border border-border/55 bg-background/60 shadow-sm ring-1 ring-black/[0.03] dark:bg-card/40 dark:ring-white/[0.06]">
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors',
            'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isFolderOver && 'ring-2 ring-violet-500/35 ring-inset bg-violet-500/[0.06]'
          )}
          ref={setFolderDropRef}
          aria-expanded={props.folderExpanded}
          onContextMenu={props.onOpenFolderContextMenu}
          onClick={props.onToggleExpand}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Folder className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            {editingFolderKey === props.group.folderKey ? (
              <Input
                value={editingFolderDraft}
                onChange={(e) => setEditingFolderDraft(e.target.value)}
                className="h-7 w-full max-w-[210px] bg-background/80 px-2 text-[11px] font-semibold uppercase tracking-wide"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    props.onRenameCommit(editingFolderDraft)
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    props.onRenameCancel()
                  }
                }}
                onBlur={() => props.onRenameCommit(editingFolderDraft)}
              />
            ) : (
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground">{props.group.displayLabel}</span>
            )}
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">({props.group.conversations.length})</span>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              props.folderExpanded ? 'rotate-180' : 'rotate-0'
            )}
            aria-hidden
          />
        </button>

        {props.folderExpanded ? (
          <div className="border-t border-border/50 px-1.5 pb-2 pt-1 dark:border-border/40">
            <ConversationListRows
              conversations={props.conversations}
              onOpen={onOpen}
              onConversationRowClick={onConversationRowClick}
              onContextMenu={onContextMenu}
              selectedIds={selectedIds}
              dragToArchiveEnabled={dragToArchiveEnabled}
            />
          </div>
        ) : null}
      </div>
    )
  }

  const sectionTint =
    kind === 'ai'
      ? 'bg-violet-500/[0.03] dark:bg-violet-500/[0.06]'
      : kind === 'favorite'
        ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.07]'
        : 'bg-sky-500/[0.03] dark:bg-sky-500/[0.06]'

  const sectionBorder =
    kind === 'ai'
      ? 'border-violet-200/70 dark:border-violet-900/45'
      : kind === 'favorite'
        ? 'border-amber-200/70 dark:border-amber-900/45'
        : 'border-sky-200/70 dark:border-sky-900/45'

  return (
    <div className={cn('space-y-2 rounded-2xl border p-2', sectionTint, sectionBorder)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'group flex w-full items-center justify-between gap-2 px-0.5 py-2 text-left',
          'transition-colors duration-150',
          'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md'
        )}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          {kind === 'ai' ? (
            <Sparkles className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          ) : kind === 'favorite' ? (
            <Star className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          ) : (
            <Users className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${totalItems} items`}>
            {totalItems}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              open ? 'rotate-180' : 'rotate-0'
            )}
            aria-hidden
          />
        </div>
      </button>

      {!open ? null : totalItems === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {!showFolderHeaders ? (
            <ConversationListRows
              conversations={effectiveGroups[0]?.conversations ?? []}
              onOpen={onOpen}
              onConversationRowClick={onConversationRowClick}
              onContextMenu={onContextMenu}
              selectedIds={selectedIds}
              dragToArchiveEnabled={dragToArchiveEnabled}
            />
          ) : (
            <div className="space-y-2.5">
              {effectiveGroups.map((g) => {
                const folderKey = g.folderKey || '__ungrouped'
                const folderExpanded = folderOpenByKey[folderKey] ?? true
                return (
                  <AiFolderGroupPanel
                    key={folderKey}
                    group={g}
                    folderExpanded={folderExpanded}
                    conversations={g.conversations}
                    onToggleExpand={() =>
                      setFolderOpenByKey((prev) => ({
                        ...prev,
                        [folderKey]: !(prev[folderKey] ?? true),
                      }))
                    }
                    onOpenFolderContextMenu={(e) => {
                      if (kind !== 'ai') return
                      if (!g.folderKey) return
                      e.preventDefault()
                      setFolderContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        folderKey: g.folderKey,
                        displayLabel: g.displayLabel,
                      })
                    }}
                    onRenameCommit={(nextLabel) => {
                      onRenameAiFolder?.(g.folderKey, nextLabel)
                      setEditingFolderKey(null)
                      setEditingFolderDraft('')
                    }}
                    onRenameCancel={() => {
                      setEditingFolderKey(null)
                      setEditingFolderDraft('')
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {folderContextMenu && (
        <ContextMenu
          open={!!folderContextMenu}
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          onClose={() => setFolderContextMenu(null)}
        >
          <ContextMenuItem
            className="gap-2"
            onSelect={() => {
              const fk = folderContextMenu.folderKey
              const current = folderContextMenu.displayLabel
              setFolderContextMenu(null)
              setEditingFolderKey(fk)
              setEditingFolderDraft(current)
            }}
          >
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="gap-2"
            onSelect={() => {
              const fk = folderContextMenu.folderKey
              setFolderContextMenu(null)
              onRenameAiFolder?.(fk, '')
            }}
          >
            <Eraser className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Reset name
          </ContextMenuItem>
        </ContextMenu>
      )}
    </div>
  )
}

// (Removed duplicate ConversationSection implementation)
