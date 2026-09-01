import { apiFetch, tectonaServiceHeaders } from '@/lib/api/httpClient'

export type EmailFolder = 'inbox' | 'sent' | 'draft' | 'archived' | 'deleted' | 'junk'

export interface MailboxConfigPublic {
  email: string
  imap_host: string
  imap_port: number
  imap_use_tls: boolean
  smtp_host: string
  smtp_port: number
  smtp_use_starttls: boolean
}

export interface MailboxConfigSave extends MailboxConfigPublic {
  password: string
}

export interface MailboxConfigStatus {
  configured: boolean
  config: MailboxConfigPublic | null
}

export interface MailboxTestResult {
  imap_ok: boolean
  smtp_ok: boolean
  imap_message: string | null
  smtp_message: string | null
}

export interface MailMessageSummary {
  id: string
  uid: string
  from_address: string
  to: string | null
  cc: string | null
  subject: string
  preview: string
  at: string
  unread: boolean
  has_attachment: boolean
}

export interface MailMessageDetail extends MailMessageSummary {
  body: string
}

export interface MailMessageListResponse {
  folder: EmailFolder
  messages: MailMessageSummary[]
  imap_folder: string | null
}

export interface SendMailRequest {
  to: string
  cc?: string
  subject: string
  body_html: string
  body_text?: string
}

const BASE = '/api/tectona-mail/v1'

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

function errorMessageFromBody(body: string): string | null {
  try {
    const data = JSON.parse(body) as { detail?: string | { msg?: string }[]; error?: { message?: string } }
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg
    if (data.error?.message) return data.error.message
  } catch {
    return null
  }
  return null
}

async function parseError(response: Response): Promise<string> {
  const body = await readResponseBody(response)
  const apiMessage = errorMessageFromBody(body)
  if (apiMessage) return apiMessage

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('text/html') || /^\s*<!doctype\s+html/i.test(body)) {
    return `Mail service returned an HTML error page (${response.status}). Check that the Tectona Mail service or proxy is running.`
  }
  return `Request failed (${response.status})`
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await readResponseBody(response)
  try {
    return JSON.parse(body) as T
  } catch {
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (contentType.includes('text/html') || /^\s*<!doctype\s+html/i.test(body)) {
      throw new Error(`Mail service returned an HTML response instead of JSON (${response.status}). Check the mail service or proxy route.`)
    }
    throw new Error('Mail service returned an invalid response. Please try again.')
  }
}

export async function getMailboxConfig(): Promise<MailboxConfigStatus> {
  const response = await apiFetch(`${BASE}/mailbox/config`, { headers: tectonaServiceHeaders() })
  if (!response.ok) throw new Error(await parseError(response))
  return parseJsonResponse<MailboxConfigStatus>(response)
}

export async function saveMailboxConfig(payload: MailboxConfigSave): Promise<MailboxConfigPublic> {
  const response = await apiFetch(`${BASE}/mailbox/config`, {
    method: 'PUT',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return parseJsonResponse<MailboxConfigPublic>(response)
}

export async function testMailboxConfig(payload: MailboxConfigSave): Promise<MailboxTestResult> {
  const response = await apiFetch(`${BASE}/mailbox/config/test`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return parseJsonResponse<MailboxTestResult>(response)
}

export async function listMailMessages(folder: EmailFolder, limit = 50): Promise<MailMessageListResponse> {
  const params = new URLSearchParams({ folder, limit: String(limit) })
  const response = await apiFetch(`${BASE}/messages?${params}`, { headers: tectonaServiceHeaders() })
  if (!response.ok) throw new Error(await parseError(response))
  return parseJsonResponse<MailMessageListResponse>(response)
}

export async function getMailMessageDetail(folder: EmailFolder, uid: string): Promise<MailMessageDetail> {
  const params = new URLSearchParams({ folder })
  const response = await apiFetch(`${BASE}/messages/${encodeURIComponent(uid)}?${params}`, {
    headers: tectonaServiceHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return parseJsonResponse<MailMessageDetail>(response)
}

export async function markMailMessageRead(folder: EmailFolder, uid: string): Promise<void> {
  const params = new URLSearchParams({ folder })
  const response = await apiFetch(`${BASE}/messages/${encodeURIComponent(uid)}/read?${params}`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function moveMailMessage(folder: EmailFolder, uid: string, targetFolder: EmailFolder): Promise<void> {
  const params = new URLSearchParams({ folder })
  const response = await apiFetch(`${BASE}/messages/${encodeURIComponent(uid)}/move?${params}`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ target_folder: targetFolder }),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function sendMailMessage(payload: SendMailRequest): Promise<void> {
  const response = await apiFetch(`${BASE}/messages/send`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/** UI-friendly camelCase view of server config defaults. */
export function toUiMailboxConfig(config: MailboxConfigPublic | null | undefined): UiMailboxConfig {
  return {
    email: config?.email ?? '',
    imapHost: config?.imap_host ?? 'outlook.office365.com',
    imapPort: config?.imap_port ?? 993,
    imapUseTls: config?.imap_use_tls ?? true,
    smtpHost: config?.smtp_host ?? 'smtp.office365.com',
    smtpPort: config?.smtp_port ?? 587,
    smtpUseStarttls: config?.smtp_use_starttls ?? true,
    password: '',
  }
}

export interface UiMailboxConfig {
  email: string
  password: string
  imapHost: string
  imapPort: number
  imapUseTls: boolean
  smtpHost: string
  smtpPort: number
  smtpUseStarttls: boolean
}

export function toSavePayload(form: UiMailboxConfig): MailboxConfigSave {
  return {
    email: form.email.trim(),
    password: form.password,
    imap_host: form.imapHost.trim(),
    imap_port: form.imapPort,
    imap_use_tls: form.imapUseTls,
    smtp_host: form.smtpHost.trim(),
    smtp_port: form.smtpPort,
    smtp_use_starttls: form.smtpUseStarttls,
  }
}
