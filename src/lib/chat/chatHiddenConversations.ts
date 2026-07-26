/**
 * Kontak / channel yang dihapus dari daftar chat (lokal).
 * Mencegah inbox sync dari collaboration-context menampilkan ulang thread yang sama.
 */

const HIDDEN_CONTACTS_KEY = 'tectona.chat.hiddenContactIds.v1'
const HIDDEN_CHANNELS_KEY = 'tectona.chat.hiddenChannelIds.v1'

function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

function writeIdSet(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

export function loadHiddenContactIds(): Set<string> {
  return readIdSet(HIDDEN_CONTACTS_KEY)
}

export function loadHiddenChannelIds(): Set<string> {
  return readIdSet(HIDDEN_CHANNELS_KEY)
}

export function hideChatContactId(contactId: string): void {
  const id = contactId.trim()
  if (!id) return
  const next = loadHiddenContactIds()
  next.add(id)
  writeIdSet(HIDDEN_CONTACTS_KEY, next)
}

export function hideChatChannelId(channelId: string): void {
  const id = channelId.trim()
  if (!id) return
  const next = loadHiddenChannelIds()
  next.add(id)
  writeIdSet(HIDDEN_CHANNELS_KEY, next)
}

export function unhideChatContactId(contactId: string): void {
  const id = contactId.trim()
  if (!id) return
  const next = loadHiddenContactIds()
  if (!next.delete(id)) return
  writeIdSet(HIDDEN_CONTACTS_KEY, next)
}

export function unhideChatChannelId(channelId: string): void {
  const id = channelId.trim()
  if (!id) return
  const next = loadHiddenChannelIds()
  if (!next.delete(id)) return
  writeIdSet(HIDDEN_CHANNELS_KEY, next)
}

export function unhideChatForContact(contact: { id: string; mode?: string }): void {
  if (contact.mode !== 'team') return
  unhideChatContactId(contact.id)
}

export function unhideOpenChatRequest(request: {
  channelId?: string
  senderUserId?: string
}): void {
  if (request.channelId) unhideChatChannelId(request.channelId)
  if (request.senderUserId) unhideChatContactId(request.senderUserId)
}

export function addHiddenFromConversation(conv: {
  contactId?: string
  channelId?: string
}): void {
  if (conv.contactId) hideChatContactId(conv.contactId)
  if (conv.channelId) hideChatChannelId(conv.channelId)
}

export function isHiddenChatContact(contactId: string | undefined): boolean {
  if (!contactId) return false
  return loadHiddenContactIds().has(contactId)
}

export function isHiddenChatChannel(channelId: string | undefined): boolean {
  if (!channelId) return false
  return loadHiddenChannelIds().has(channelId)
}

export function isHiddenPeopleConversation(conv: {
  contactId?: string
  channelId?: string
  mode?: string
}): boolean {
  if (conv.mode !== 'team' && conv.mode !== 'group') return false
  if (isHiddenChatChannel(conv.channelId)) return true
  if (conv.mode === 'team' && isHiddenChatContact(conv.contactId)) return true
  return false
}
