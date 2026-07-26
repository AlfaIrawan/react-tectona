import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Bell,
  Bold,
  Calendar,
  ChevronLeft,
  FileText,
  Flag,
  Forward,
  Inbox,
  Italic,
  List,
  ListOrdered,
  Mail,
  MailOpen,
  Palette,
  Paperclip,
  Reply,
  ReplyAll,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Underline,
  X,
  PenSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { useEmailPanelStore } from '@/stores/email-panel-store'

type EmailFolder = 'inbox' | 'sent' | 'draft' | 'archived' | 'deleted' | 'junk'

interface ComposeImageAttachment {
  id: string
  name: string
  url: string
  mimeType: string
}

interface ComposeFileAttachment {
  id: string
  name: string
  size: number
  mimeType: string
}

interface EmailItem {
  id: string
  from: string
  to?: string
  cc?: string
  subject: string
  preview: string
  body: string
  at: string
  unread?: boolean
  folder: EmailFolder
  hasReminder?: boolean
  hasCalendar?: boolean
  hasAttachment?: boolean
  hasFlagFollowUp?: boolean
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function areEmailListValuesValid(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  const emails = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (emails.length === 0) return false
  return emails.every(isValidEmailAddress)
}

const INITIAL_EMAILS: EmailItem[] = [
  {
    id: 'email-1',
    from: 'Service Registry Bot',
    subject: 'Registry sync completed',
    preview: 'All services were synchronized successfully at 09:15.',
    body: 'Registry sync completed. Total services: 128, dependencies: 417. No anomaly found.',
    at: '09:15',
    unread: true,
    folder: 'inbox',
  },
  {
    id: 'email-2',
    from: 'Platform Ops',
    subject: 'Action required: API Gateway certificate',
    preview: 'Please renew certificate for gateway edge cluster.',
    body: 'Please renew the API Gateway certificate before Friday to avoid TLS interruption in production.',
    at: 'Yesterday',
    folder: 'inbox',
  },
  {
    id: 'email-3',
    from: 'You',
    to: 'dev-team@adira.local',
    subject: 'Weekly service readiness update',
    preview: 'Attached readiness summary from Service Catalog & Registry.',
    body: 'Hi team, attached is the weekly readiness summary from Service Catalog & Registry dashboard.',
    at: 'Tue',
    folder: 'sent',
  },
  {
    id: 'email-4',
    from: 'Architecture Board',
    subject: 'Review service decomposition proposal',
    preview: 'Please provide comments before architecture forum.',
    body: 'Please review and comment the decomposition proposal for the orchestration domain before Thursday.',
    at: 'Mon',
    folder: 'inbox',
  },
  {
    id: 'email-5',
    from: 'You',
    to: 'ops@adira.local',
    subject: 'Draft: Incident response plan update',
    preview: 'Draft saved — not yet sent.',
    body: 'Hi Ops team, please review the updated incident response plan attached to this message.',
    at: 'Today',
    folder: 'draft',
  },
  {
    id: 'email-6',
    from: 'HR System',
    subject: 'Leave approval notification (archived)',
    preview: 'Your leave request was approved and archived.',
    body: 'Leave approved from 2025-04-01 to 2025-04-05. This message has been archived.',
    at: 'Mar 28',
    folder: 'archived',
  },
  {
    id: 'email-7',
    from: 'Old Vendor',
    subject: 'Contract renewal reminder (deleted)',
    preview: 'This message was moved to the deleted folder.',
    body: 'Contract expires on 2025-06-30. Renewal details enclosed — moved to deleted.',
    at: 'Mar 20',
    folder: 'deleted',
  },
  {
    id: 'email-8',
    from: 'noreply@spam.example',
    subject: 'You have been selected!',
    preview: 'Congratulations, claim your prize now.',
    body: 'Click the link to claim your exclusive prize. Limited time offer.',
    at: 'Mar 18',
    folder: 'junk',
  },
  {
    id: 'email-9',
    from: 'Calendar System',
    subject: 'Reminder: Architecture Review Meeting — 2pm today',
    preview: 'Your meeting starts in 30 minutes. Agenda attached.',
    body: 'This is a reminder for the Architecture Review Meeting scheduled today at 2:00 PM. Please review the agenda before joining.',
    at: '13:30',
    unread: true,
    folder: 'inbox',
    hasReminder: true,
    hasCalendar: true,
  },
  {
    id: 'email-10',
    from: 'Task Manager',
    subject: 'Reminder: Submit service dependency report by EOD',
    preview: 'Deadline reminder — action required before 6 PM.',
    body: 'Please remember to submit the service dependency report by end of day. Failure to do so may delay the release cycle.',
    at: '10:00',
    folder: 'inbox',
    hasReminder: true,
  },
  {
    id: 'email-11',
    from: 'DevOps Guild',
    subject: 'Invitation: Platform Engineering Forum — Apr 10',
    preview: 'You are invited to the Platform Engineering quarterly forum.',
    body: 'Join us on April 10 at 3 PM for the Platform Engineering quarterly forum. Topics include observability, registry health, and API gateway updates.',
    at: 'Apr 3',
    folder: 'inbox',
    hasCalendar: true,
  },
  {
    id: 'email-12',
    from: 'Documentation Team',
    subject: 'Service Registry API Spec v2.4 — attached',
    preview: 'Updated API specification document is attached for review.',
    body: 'Please find attached the updated Service Registry API Specification v2.4. Review and provide feedback by Friday.',
    at: 'Apr 2',
    folder: 'inbox',
    hasAttachment: true,
  },
  {
    id: 'email-13',
    from: 'Product Manager',
    subject: 'Follow-up: Service onboarding SLA discussion',
    preview: "Following up on last week's discussion about onboarding SLA targets.",
    body: "Hi, following up on our discussion from last week regarding the service onboarding SLA targets. Please share your team's input so we can finalize the proposal.",
    at: 'Apr 1',
    folder: 'inbox',
    hasFlagFollowUp: true,
  },
]

export function EmailSidebarPanel() {
  const setEmailOpen = useEmailPanelStore((s) => s.setOpen)
  const close = () => setEmailOpen(false)

  const [emails, setEmails] = useState<EmailItem[]>(INITIAL_EMAILS)
  const [folder, setFolder] = useState<EmailFolder>('inbox')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_EMAILS.find((e) => e.folder === 'inbox')?.id ?? null)
  const [openedEmailId, setOpenedEmailId] = useState<string | null>(null)
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeCc, setComposeCc] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeImageAttachments, setComposeImageAttachments] = useState<ComposeImageAttachment[]>([])
  const [composeFileAttachments, setComposeFileAttachments] = useState<ComposeFileAttachment[]>([])
  const [composeFollowUp, setComposeFollowUp] = useState(false)
  const [composeFontColor, setComposeFontColor] = useState('#1f2937')
  const [composeHighlightColor, setComposeHighlightColor] = useState('#fef08a')
  const [composeFontSize, setComposeFontSize] = useState('12')
  const [composeFontFamily, setComposeFontFamily] = useState('Arial')
  const [contextMenu, setContextMenu] = useState<{ emailId: string; x: number; y: number } | null>(null)
  const composeAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const composeEditorRef = useRef<HTMLDivElement | null>(null)

  const getComposeBodyText = (html: string) =>
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const runEditorCommand = (command: string, value?: string) => {
    const editor = composeEditorRef.current
    if (!editor) return

    editor.focus()
    document.execCommand(command, false, value)
    setComposeBody(editor.innerHTML)
  }

  const formatBold = () => runEditorCommand('bold')
  const formatItalic = () => runEditorCommand('italic')
  const formatUnderline = () => runEditorCommand('underline')
  const formatBulletList = () => runEditorCommand('insertUnorderedList')
  const formatNumberedList = () => runEditorCommand('insertOrderedList')
  const applyFontColor = () => runEditorCommand('foreColor', composeFontColor)
  const applyFontSize = () => {
    const editor = composeEditorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('fontSize', false, '7')
    const html = editor.innerHTML.replace(/font-size:\s*xxx-large/gi, `font-size: ${composeFontSize}px`)
    editor.innerHTML = html
    setComposeBody(editor.innerHTML)
  }
  const applyFontFamily = () => runEditorCommand('fontName', composeFontFamily)
  const applyHighlight = () => {
    runEditorCommand('hiliteColor', composeHighlightColor)
    runEditorCommand('backColor', composeHighlightColor)
  }

  const filteredEmails = useMemo(() => {
    const q = search.trim().toLowerCase()
    return emails.filter((email) => {
      if (email.folder !== folder) return false
      if (!q) return true
      return (
        email.from.toLowerCase().includes(q) ||
        email.subject.toLowerCase().includes(q) ||
        email.preview.toLowerCase().includes(q)
      )
    })
  }, [emails, folder, search])

  const selectedEmail = useMemo(
    () => filteredEmails.find((email) => email.id === selectedId) ?? filteredEmails[0] ?? null,
    [filteredEmails, selectedId]
  )

  const openedEmail = useMemo(
    () => filteredEmails.find((email) => email.id === openedEmailId) ?? null,
    [filteredEmails, openedEmailId]
  )

  const contextMenuEmail = useMemo(() => {
    if (!contextMenu) return null
    return emails.find((email) => email.id === contextMenu.emailId) ?? null
  }, [contextMenu, emails])

  const isComposeFormValid = useMemo(() => {
    const to = composeTo.trim()
    const subject = composeSubject.trim()
    const body = getComposeBodyText(composeBody)
    const hasBodyOrAttachment = body.length > 0 || composeImageAttachments.length > 0 || composeFileAttachments.length > 0

    if (!to || !subject || !hasBodyOrAttachment) return false
    if (!areEmailListValuesValid(to)) return false
    if (!areEmailListValuesValid(composeCc)) return false
    return true
  }, [composeTo, composeCc, composeSubject, composeBody, composeImageAttachments.length, composeFileAttachments.length])

  const handleOpenFolder = (next: EmailFolder) => {
    setFolder(next)
    const first = emails.find((e) => e.folder === next)
    setSelectedId(first?.id ?? null)
    setOpenedEmailId(null)
    setIsComposeOpen(false)
    setContextMenu(null)
    clearComposeAttachments()
  }

  const handleToggleCompose = () => {
    setOpenedEmailId(null)
    setIsComposeOpen((value) => {
      if (value) clearComposeAttachments()
      return !value
    })
  }

  const handleBackToInboxList = () => {
    clearComposeAttachments()
    setIsComposeOpen(false)
    setOpenedEmailId(null)
    setContextMenu(null)
    setFolder('inbox')
    const firstInbox = emails.find((e) => e.folder === 'inbox')
    setSelectedId(firstInbox?.id ?? null)
  }

  const splitEmailList = (value?: string) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const canReplyAll = (email: EmailItem) => {
    const toCount = splitEmailList(email.to).length
    const ccCount = splitEmailList(email.cc).length
    return toCount + ccCount > 1
  }

  const setComposeEditorHtml = (html: string) => {
    setComposeBody(html)
    queueMicrotask(() => {
      if (composeEditorRef.current) composeEditorRef.current.innerHTML = html
    })
  }

  const openComposeFromAction = (email: EmailItem, mode: 'reply' | 'replyAll' | 'forward') => {
    clearComposeAttachments()
    setContextMenu(null)
    setIsComposeOpen(true)
    setOpenedEmailId(null)

    const baseSubject = email.subject.trim()
    const replySubject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`
    const forwardSubject = /^fwd:/i.test(baseSubject) ? baseSubject : `Fwd: ${baseSubject}`
    const quotedBody =
      `<br/><br/>--- Original Message ---<br/>` +
      `From: ${email.from}<br/>` +
      `Date: ${email.at}<br/>` +
      `Subject: ${email.subject}<br/><br/>` +
      (email.body.includes('<') ? email.body : email.body.replace(/\n/g, '<br/>'))

    if (mode === 'reply') {
      setComposeTo(email.from === 'You' ? splitEmailList(email.to)[0] ?? '' : email.from)
      setComposeCc('')
      setComposeSubject(replySubject)
      setComposeEditorHtml(quotedBody)
      return
    }

    if (mode === 'replyAll') {
      const replyTo = email.from === 'You' ? splitEmailList(email.to)[0] ?? '' : email.from
      const ccList = splitEmailList(email.cc)
      setComposeTo(replyTo)
      setComposeCc(ccList.join(', '))
      setComposeSubject(replySubject)
      setComposeEditorHtml(quotedBody)
      return
    }

    setComposeTo('')
    setComposeCc('')
    setComposeSubject(forwardSubject)
    setComposeEditorHtml(quotedBody)
  }

  const markAsRead = (emailId: string) => {
    setEmails((prev) => prev.map((email) => (email.id === emailId ? { ...email, unread: false } : email)))
    setContextMenu(null)
  }

  const moveEmailToFolder = (emailId: string, targetFolder: EmailFolder) => {
    setEmails((prev) => prev.map((email) => (email.id === emailId ? { ...email, folder: targetFolder, unread: false } : email)))
    setContextMenu(null)
    if (openedEmailId === emailId) setOpenedEmailId(null)
  }

  const openContextMenu = (event: React.MouseEvent, emailId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(emailId)
    setContextMenu({ emailId, x: event.clientX, y: event.clientY })
  }

  const addComposeImagesFromFiles = useCallback((files: File[]) => {
    const next: ComposeImageAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      next.push({
        id: `img-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name || `image-${i + 1}.png`,
        url: URL.createObjectURL(file),
        mimeType: file.type,
      })
    }
    if (next.length) setComposeImageAttachments((p) => [...p, ...next])
  }, [])

  const addComposeFilesFromFiles = useCallback((files: File[]) => {
    const next: ComposeFileAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      next.push({
        id: `file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name || `file-${i + 1}`,
        size: file.size,
        mimeType: file.type,
      })
    }
    if (next.length) setComposeFileAttachments((p) => [...p, ...next])
  }, [])

  const removeComposeImageAttachment = useCallback((id: string) => {
    setComposeImageAttachments((prev) => {
      const found = prev.find((a) => a.id === id)
      if (found?.url.startsWith('blob:')) URL.revokeObjectURL(found.url)
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  const removeComposeFileAttachment = useCallback((id: string) => {
    setComposeFileAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const clearComposeAttachments = useCallback(() => {
    setComposeImageAttachments((prev) => {
      prev.forEach((a) => {
        if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
      })
      return []
    })
    setComposeFileAttachments([])
  }, [])

  const handleAddAttachmentsClick = () => {
    composeAttachmentInputRef.current?.click()
  }

  const handleComposeAttachmentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const images = files.filter((f) => f.type.startsWith('image/'))
    const nonImages = files.filter((f) => !f.type.startsWith('image/'))
    if (images.length) addComposeImagesFromFiles(images)
    if (nonImages.length) addComposeFilesFromFiles(nonImages)
    e.currentTarget.value = ''
  }

  const onComposeBodyPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
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
        queueMicrotask(() => {
          const editor = composeEditorRef.current
          if (editor) setComposeBody(editor.innerHTML)
        })
        for (let i = 0; i < cd.files.length; i++) {
          const f = cd.files[i]
          if (f.type.startsWith('image/')) imageFiles.push(f)
        }
      }
      if (imageFiles.length === 0) return

      e.preventDefault()
      addComposeImagesFromFiles(imageFiles)

      const textPlain = cd.getData('text/plain')
      if (textPlain) document.execCommand('insertText', false, textPlain)
      const editor = composeEditorRef.current
      if (editor) setComposeBody(editor.innerHTML)
    },
    [addComposeImagesFromFiles]
  )

  const handleSendEmail = () => {
    const to = composeTo.trim()
    const cc = composeCc.trim()
    const subject = composeSubject.trim()
    const bodyText = getComposeBodyText(composeBody)
    const bodyHtml = composeBody.trim()

    if (!isComposeFormValid) return

    const totalAttachmentCount = composeImageAttachments.length + composeFileAttachments.length
    const attachmentNote =
      totalAttachmentCount > 0
        ? `<br/><br/>[${composeImageAttachments.length} image(s), ${composeFileAttachments.length} file(s) attached - connect mail API for real upload.]`
        : ''
    const fullBody = bodyHtml + attachmentNote

    const preview =
      bodyText.length > 0
        ? bodyText.slice(0, 80)
        : totalAttachmentCount > 0
          ? `📎 ${totalAttachmentCount} attachment${totalAttachmentCount === 1 ? '' : 's'}`
          : ''

    composeImageAttachments.forEach((a) => {
      if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
    })

    const newEmail: EmailItem = {
      id: `sent-${Date.now()}`,
      from: 'You',
      to,
      cc,
      subject,
      preview: preview.slice(0, 80),
      body: fullBody,
      at: 'Just now',
      folder: 'sent',
      hasAttachment: totalAttachmentCount > 0,
      hasFlagFollowUp: composeFollowUp,
    }

    setEmails((prev) => [newEmail, ...prev])
    setComposeTo('')
    setComposeCc('')
    setComposeSubject('')
    setComposeBody('')
    if (composeEditorRef.current) composeEditorRef.current.innerHTML = ''
    setComposeFollowUp(false)
    setComposeImageAttachments([])
    setComposeFileAttachments([])
    setIsComposeOpen(false)
    setFolder('sent')
    setSelectedId(newEmail.id)
    setOpenedEmailId(null)
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background pl-3">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Mail className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            Email
          </h2>
          <p className="max-w-[min(320px,100%)] text-xs leading-snug text-muted-foreground">
            Service Catalog & Registry mailbox for operational updates, follow-ups, and email communication.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="mt-0.5 h-8 w-8 shrink-0"
          onClick={close}
          aria-label="Close email panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-0 pb-2 pt-2">
        <div className="py-2 px-3">
          <div className="border-b border-border/70 pb-2">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email..."
                className="h-10 w-full pl-9"
              />
            </div>
          </div>
        </div>

        <div className="py-2 px-3">
          <div className="grid grid-cols-6 gap-1 border-b border-border/70 pb-2">
            <Button
              variant={folder === 'inbox' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-full gap-1 text-xs"
              onClick={() => handleOpenFolder('inbox')}
            >
              <Inbox className="h-3.5 w-3.5" /> Inbox
            </Button>
            <Button
              variant={folder === 'sent' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-full gap-1 text-xs"
              onClick={() => handleOpenFolder('sent')}
            >
              <Send className="h-3.5 w-3.5" /> Sent
            </Button>
            <Button
              variant={folder === 'draft' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-full gap-1 text-xs"
              onClick={() => handleOpenFolder('draft')}
            >
              <FileText className="h-3.5 w-3.5" /> Draft
            </Button>
            <Button
              variant={folder === 'archived' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-full gap-1 text-xs"
              onClick={() => handleOpenFolder('archived')}
            >
              <Archive className="h-3.5 w-3.5" /> Archived
            </Button>
            <Button
              variant={folder === 'deleted' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-full gap-1 text-xs"
              onClick={() => handleOpenFolder('deleted')}
            >
              <Trash2 className="h-3.5 w-3.5" /> Deleted
            </Button>
            <Button
              variant={folder === 'junk' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-full gap-1 text-xs"
              onClick={() => handleOpenFolder('junk')}
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Junk
            </Button>
          </div>
        </div>

        <div className="py-2 px-3">
          <div className="border-b border-border/70 pb-2">
            <Button
              variant={isComposeOpen ? 'default' : 'outline'}
              size="sm"
              className="h-10 w-full gap-1 text-xs"
              onClick={isComposeOpen ? handleBackToInboxList : handleToggleCompose}
            >
              {isComposeOpen ? <Inbox className="h-3.5 w-3.5" /> : <PenSquare className="h-3.5 w-3.5" />}
              {isComposeOpen ? 'List Inbox' : 'Compose Email'}
            </Button>
          </div>
        </div>

        {isComposeOpen ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">
          <Input
            value={composeTo}
            onChange={(e) => setComposeTo(e.target.value)}
            placeholder="To"
            className="h-10 text-xs"
          />
          <Input
            value={composeCc}
            onChange={(e) => setComposeCc(e.target.value)}
            placeholder="CC"
            className="h-10 text-xs"
          />
          <Input
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
            placeholder="Subject"
            className="h-10 text-xs"
          />
          <input
            ref={composeAttachmentInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleComposeAttachmentInputChange}
          />
          {composeImageAttachments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {composeImageAttachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-muted/30 py-1 pl-2 pr-1 text-[11px] text-foreground"
                >
                  <span className="truncate">🖼 {a.name}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => removeComposeImageAttachment(a.id)}
                    aria-label={`Remove ${a.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {composeFileAttachments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {composeFileAttachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-muted/30 py-1 pl-2 pr-1 text-[11px] text-foreground"
                >
                  <span className="truncate">📎 {a.name}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => removeComposeFileAttachment(a.id)}
                    aria-label={`Remove ${a.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1 border-b border-border/70 pb-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleAddAttachmentsClick}
              title="Add Attachment"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={composeFollowUp ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setComposeFollowUp((value) => !value)}
              title="Add Follow Up"
            >
              <Flag className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-border/30" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={formatBold}
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={formatItalic}
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={formatUnderline}
              title="Underline"
            >
              <Underline className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-border/30" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={formatBulletList}
              title="Bullet List"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={formatNumberedList}
              title="Numbered List"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-border/30" />
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Palette className="h-3.5 w-3.5" />
              <input
                type="color"
                value={composeFontColor}
                onChange={(e) => setComposeFontColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-border p-0"
              />
            </label>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[10px]" onClick={applyFontColor}>
              Color
            </Button>
            <select
              value={composeFontSize}
              onChange={(e) => setComposeFontSize(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-[10px]"
            >
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="18">18</option>
              <option value="20">20</option>
            </select>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[10px]" onClick={applyFontSize}>
              Size
            </Button>
            <select
              value={composeFontFamily}
              onChange={(e) => setComposeFontFamily(e.target.value)}
              className="h-8 max-w-[96px] rounded-md border border-input bg-background px-2 text-[10px]"
            >
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times</option>
              <option value="Courier New">Courier</option>
              <option value="Verdana">Verdana</option>
            </select>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[10px]" onClick={applyFontFamily}>
              Font
            </Button>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <input
                type="color"
                value={composeHighlightColor}
                onChange={(e) => setComposeHighlightColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-border p-0"
              />
            </label>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[10px]" onClick={applyHighlight}>
              Highlight
            </Button>
          </div>
          <div
            ref={composeEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setComposeBody((e.currentTarget as HTMLDivElement).innerHTML)}
            onPaste={onComposeBodyPaste}
            data-placeholder="Write your email... (paste images from clipboard)"
            className="email-compose-body min-h-[140px] flex-1 overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-scrollbar]:hidden"
            style={{
              fontSize: `${composeFontSize}px`,
              fontFamily: composeFontFamily,
              color: composeFontColor,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          />
          <Button size="sm" className="h-10 gap-1 text-xs" onClick={handleSendEmail} disabled={!isComposeFormValid}>
            <Send className="h-3.5 w-3.5" /> Send Email
          </Button>
          </div>
        ) : (
          <div
            className={cn(
              'flex min-h-0 flex-1 overflow-hidden py-3',
              openedEmail ? 'px-3' : 'px-0'
            )}
          >
            {openedEmail ? (
              <div className="flex min-h-0 flex-1 flex-col p-1">
                <div className="flex items-start gap-2 border-b border-border/70 pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 shrink-0"
                    onClick={() => setOpenedEmailId(null)}
                    aria-label="Back to email list"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground">
                      {openedEmail.to ? `To: ${openedEmail.to}` : `From: ${openedEmail.from}`}
                    </p>
                    {openedEmail.cc ? <p className="text-[11px] text-muted-foreground">CC: {openedEmail.cc}</p> : null}
                    <h4 className="text-sm font-semibold text-foreground">{openedEmail.subject}</h4>
                  </div>
                </div>
                <div
                  className="mt-2 overflow-y-auto pr-1 text-xs leading-relaxed text-foreground [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  dangerouslySetInnerHTML={{
                    __html: openedEmail.body.includes('<') ? openedEmail.body : openedEmail.body.replace(/\n/g, '<br/>'),
                  }}
                />
              </div>
            ) : (
              <div
                className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                  {filteredEmails.length === 0 ? (
                    <div className="px-2 py-6 text-center text-xs text-muted-foreground">No emails in this folder.</div>
                  ) : (
                    filteredEmails.map((email) => {
                      const active = selectedEmail?.id === email.id
                      return (
                        <button
                          key={email.id}
                          onClick={() => setSelectedId(email.id)}
                          onContextMenu={(event) => openContextMenu(event, email.id)}
                          onDoubleClick={() => {
                            setSelectedId(email.id)
                            setOpenedEmailId(email.id)
                          }}
                          className={cn(
                            'mb-2 flex h-24 w-full flex-col justify-start rounded-md border px-2 py-1.5 text-left transition-colors',
                            active
                              ? 'border-primary/50 bg-primary/10'
                              : 'border-transparent hover:border-border hover:bg-accent/50'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-foreground">{email.from}</p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">{email.at}</span>
                          </div>
                          <p className="truncate text-[11px] text-foreground">{email.subject}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{email.preview}</p>
                          {(email.unread || email.hasReminder || email.hasCalendar || email.hasAttachment || email.hasFlagFollowUp) && (
                            <div className="mt-auto flex items-center gap-1.5 pt-0.5">
                              {email.unread && <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />}
                              {email.hasReminder && <Bell className="h-4 w-4 text-orange-400" />}
                              {email.hasCalendar && <Calendar className="h-4 w-4 text-blue-400" />}
                              {email.hasAttachment && <Paperclip className="h-4 w-4 text-muted-foreground" />}
                              {email.hasFlagFollowUp && <Flag className="h-4 w-4 text-red-400" />}
                            </div>
                          )}
                        </button>
                      )
                    })
                  )}
              </div>
            )}
          </div>
        )}

        {contextMenu && contextMenuEmail ? (
          <ContextMenu
            open
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          >
            <ContextMenuItem
              className="gap-2"
              onSelect={() => openComposeFromAction(contextMenuEmail, 'reply')}
            >
              <Reply className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Reply Email
            </ContextMenuItem>
            {canReplyAll(contextMenuEmail) ? (
              <ContextMenuItem
                className="gap-2"
                onSelect={() => openComposeFromAction(contextMenuEmail, 'replyAll')}
              >
                <ReplyAll className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Reply All
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem
              className="gap-2"
              onSelect={() => openComposeFromAction(contextMenuEmail, 'forward')}
            >
              <Forward className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Forward Email
            </ContextMenuItem>
            <ContextMenuItem className="gap-2" onSelect={() => markAsRead(contextMenuEmail.id)}>
              <MailOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Mark as Read
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="gap-2"
              onSelect={() => moveEmailToFolder(contextMenuEmail.id, 'archived')}
            >
              <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Archive
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive dark:hover:bg-destructive/15"
              onSelect={() => moveEmailToFolder(contextMenuEmail.id, 'deleted')}
            >
              <Trash2 className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
              Delete
            </ContextMenuItem>
          </ContextMenu>
        ) : null}
      </div>
    </div>
  )
}
