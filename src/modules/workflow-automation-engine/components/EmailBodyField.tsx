import { useEffect, useState } from 'react'
import { Loader2, Mail } from 'lucide-react'

import { getSession } from '@/auth/authService'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectItem } from '@/components/ui/select'
import {
  downloadTemplateAttachmentBlob,
  listTemplates,
  type DocumentTemplateResponse,
} from '@/lib/api/documentKnowledgeApi'
import { getPersistentIdeaSummary, listIdeas } from '@/lib/api/ideaBacklogApi'
import { IDENTITY_API_BASE } from '@/lib/api/gatewayBase'
import { apiFetch, tectonaServiceHeaders } from '@/lib/api/httpClient'
import { useUserWorkspaceOptions } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'
import { belongsToDkmTemplateScope } from '@/modules/document-knowledge-management/lib/templateWorkspaceScope'
import {
  composeUrdEmailBody,
  emailDocumentKindFromTemplateCode,
  emailDocumentKindsFromTemplates,
  isEmailCoverHeading,
  loadIdeaUrdEmailBody,
  parseIdeaEmailDocumentKind,
  templateEmailParts,
  urdReviewSummaryText,
  type TemplateEmailPart,
  type UrdEmailBodySource,
} from '@/modules/project-management/lib/urdReviewHeads'

const FIELD_LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400'

type Props = {
  workspaceId: string | null
  source: string
  documentKind: string
  sections: string
  fixedText: string
  includeCover: string
  onChange: (patch: {
    emailBodySource?: string
    emailDocumentKind?: string
    emailBodySections?: string
    emailBodyText?: string
    emailIncludeCover?: string
  }) => void
}

const SOURCES: Array<{ value: UrdEmailBodySource; label: string }> = [
  { value: 'summary', label: 'AI summary' },
  { value: 'urd', label: 'Full document' },
  { value: 'sections', label: 'Selected sections' },
  { value: 'fixed', label: 'Fixed text' },
]

function selectedSections(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

async function docxPlainText(buffer: ArrayBuffer): Promise<string> {
  const jszip = await import('jszip')
  const zip = await jszip.default.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) return ''
  return xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
}

function templateForKind(templates: DocumentTemplateResponse[], kind: string): DocumentTemplateResponse | null {
  const matches = templates.filter((template) => (
    template.has_attachment !== false && emailDocumentKindFromTemplateCode(template.template_code) === kind
  ))
  matches.sort((left, right) => (right.updated_date || right.created_date || '').localeCompare(left.updated_date || left.created_date || ''))
  return matches[0] ?? null
}

export function EmailBodyField({
  workspaceId,
  source,
  documentKind,
  sections,
  fixedText,
  includeCover,
  onChange,
}: Props) {
  const current = (SOURCES.some((item) => item.value === source) ? source : 'urd') as UrdEmailBodySource
  const kind = parseIdeaEmailDocumentKind(documentKind)
  const chosen = selectedSections(sections)
  const { options: workspaceOptions } = useUserWorkspaceOptions()
  const [templates, setTemplates] = useState<DocumentTemplateResponse[]>([])
  const [templateKinds, setTemplateKinds] = useState<string[]>([])
  const [templateNote, setTemplateNote] = useState('')
  const needsDocument = current === 'urd' || current === 'sections'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [parts, setParts] = useState<TemplateEmailPart[]>([])
  const [draft, setDraft] = useState<string[]>([])
  const [loadingParts, setLoadingParts] = useState(false)
  const [pickerNote, setPickerNote] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testNote, setTestNote] = useState('')

  useEffect(() => {
    if (!needsDocument) return
    if (!workspaceId) {
      setTemplates([])
      setTemplateKinds([])
      setTemplateNote('Select a workspace first.')
      return
    }
    let cancelled = false
    const workspace = workspaceOptions.find((option) => option.workspaceId === workspaceId)
    const scope = { mode: 'single' as const, workspaceId, tenantMode: workspace?.tenantMode ?? null }
    const candidates = workspaceOptions.map((option) => ({
      id: option.workspaceId,
      name: option.workspaceName,
      organizationId: option.organizationId,
      tenantMode: option.tenantMode,
    }))
    void listTemplates({ status: 'active' })
      .then((items) => {
        if (cancelled) return
        const scoped = items.filter((item) => belongsToDkmTemplateScope(item, scope, candidates))
        setTemplates(scoped)
        setTemplateKinds(emailDocumentKindsFromTemplates(scoped))
        setTemplateNote(scoped.length === 0 ? 'This workspace has no active document templates.' : '')
      })
      .catch(() => {
        if (cancelled) return
        setTemplates([])
        setTemplateKinds([])
        setTemplateNote('Document templates could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [needsDocument, workspaceId, workspaceOptions])

  useEffect(() => {
    if (!pickerOpen) return
    const template = templateForKind(templates, kind)
    if (!template) {
      setParts([])
      setDraft([])
      setPickerNote(`No ${kind} template with an attached file is available in this workspace.`)
      return
    }
    let cancelled = false
    setLoadingParts(true)
    setPickerNote('')
    void downloadTemplateAttachmentBlob(template.id)
      .then(async (file) => {
        const text = await docxPlainText(await file.blob.arrayBuffer())
        if (cancelled) return
        const found = templateEmailParts(text)
        setParts(found)
        const known = new Set(found.map((part) => part.heading.toLowerCase()))
        const kept = selectedSections(sections).filter((heading) => known.has(heading.toLowerCase()))
        setDraft(kept.length > 0 ? kept : found.filter((part) => !part.cover).map((part) => part.heading))
        setPickerNote(found.length === 0 ? 'This template has no selectable sections.' : '')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setParts([])
        setDraft([])
        setPickerNote(error instanceof Error ? error.message : 'Template content could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoadingParts(false)
      })
    return () => {
      cancelled = true
    }
  }, [pickerOpen, templates, kind, sections])

  const kindOptions = templateKinds.includes(kind) ? templateKinds : [kind, ...templateKinds]
  const draftHas = (heading: string) => draft.some((item) => item.toLowerCase() === heading.toLowerCase())

  const toggleDraft = (heading: string) => {
    setDraft((currentDraft) => (
      currentDraft.some((item) => item.toLowerCase() === heading.toLowerCase())
        ? currentDraft.filter((item) => item.toLowerCase() !== heading.toLowerCase())
        : [...currentDraft, heading]
    ))
  }

  const saveParts = () => {
    if (draft.length === 0) {
      setPickerNote('Select at least one section.')
      return
    }
    const include = draft.some((heading) => isEmailCoverHeading(heading))
    onChange({
      emailBodySource: 'sections',
      emailBodySections: draft.join('\n'),
      emailIncludeCover: include ? 'yes' : 'no',
    })
    setPickerOpen(false)
  }

  const sendTestEmail = async () => {
    const myEmail = getSession()?.user?.email?.trim() ?? ''
    if (!myEmail) {
      setTestNote('This account has no email address.')
      return
    }
    if (!workspaceId) {
      setTestNote('Select a workspace first.')
      return
    }
    setSendingTest(true)
    setTestNote('')
    try {
      const ideaPage = await listIdeas({ workspace_id: workspaceId, page: 1, page_size: 1 })
      const idea = ideaPage.items[0]
      if (!idea) {
        setTestNote('This workspace has no idea to use as a sample.')
        return
      }
      const summaryRecord = current === 'summary' || current === 'fixed' || current === 'urd' || current === 'sections'
        ? await getPersistentIdeaSummary(idea.id).catch(() => null)
        : null
      const summaryText = urdReviewSummaryText([
        summaryRecord?.summary_json?.executive_brief,
        summaryRecord?.summary_json?.core_pressure,
        summaryRecord?.summary_json?.strategic_response,
        summaryRecord?.summary_json?.value_thesis,
        summaryRecord?.summary_json?.board_note,
      ].map((part) => (typeof part === 'string' ? part : '')))
      const documentText = current === 'summary' || current === 'fixed'
        ? ''
        : await loadIdeaUrdEmailBody(idea.id, kind)
      const body = composeUrdEmailBody({
        config: {
          source: current,
          documentKind: kind,
          sections: chosen,
          fixedText,
          includeCover: includeCover === 'yes',
        },
        summary: summaryText || idea.description || idea.title,
        urdText: documentText,
      })
      const subject = `${kind} review: ${idea.title}`
      const response = await apiFetch(`${IDENTITY_API_BASE.replace(/\/$/, '')}/v1/email/transactional-copy`, {
        method: 'POST',
        headers: tectonaServiceHeaders(),
        body: JSON.stringify({
          to: myEmail,
          subject: `[Test] ${subject}`,
          body: body || subject,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { detail?: string; error?: { message?: string } } | null
        const message = payload?.error?.message || payload?.detail
        throw new Error(typeof message === 'string' ? message : `Test email failed (${response.status}).`)
      }
      setTestNote(`Test email sent to ${myEmail}.`)
    } catch (error) {
      setTestNote(error instanceof Error ? error.message : 'Test email failed.')
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <label className={FIELD_LABEL_CLASS}>Email content</label>
      <Select
        value={current}
        onChange={(event) => onChange({ emailBodySource: event.target.value })}
        className="h-9 text-sm"
      >
        {SOURCES.map((item) => (
          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
        ))}
      </Select>
      <p className="text-xs leading-5 text-slate-500">
        The email uses the activation email layout. Only the body content changes.
      </p>
      {needsDocument ? (
        <label className="block space-y-1.5 text-sm text-slate-700">
          Document type
          <Select
            value={kind}
            onChange={(event) => onChange({
              emailDocumentKind: event.target.value,
              emailBodySections: '',
              emailIncludeCover: 'no',
              emailBodySource: current === 'sections' ? 'urd' : current,
            })}
            className="h-9 text-sm"
          >
            {kindOptions.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </Select>
          {templateNote ? <span className="block text-xs font-normal text-slate-500">{templateNote}</span> : null}
          {templateKinds.length > 0 && !templateKinds.includes(kind) ? (
            <span className="block text-xs font-normal text-slate-500">This type has no active template. Your selection is retained until you change it.</span>
          ) : null}
        </label>
      ) : null}
      {needsDocument ? (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setPickerOpen(true)} disabled={!workspaceId}>
              Select template sections
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => void sendTestEmail()} disabled={sendingTest || !workspaceId}>
              {sendingTest ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
              Test email
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {current === 'sections' && chosen.length > 0
              ? `${chosen.length} ${chosen.length === 1 ? 'section' : 'sections'} selected${includeCover === 'yes' ? ', including the cover.' : '.'}`
              : 'Full document without the cover. Select template sections to choose what to include.'}
          </p>
          {testNote ? <p className="text-xs text-slate-500">{testNote}</p> : null}
        </div>
      ) : null}
      {current === 'fixed' ? (
        <textarea
          value={fixedText}
          onChange={(event) => onChange({ emailBodyText: event.target.value })}
          rows={5}
          placeholder="Use the same text for every idea"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
        />
      ) : null}
      {!needsDocument ? (
        <div className="space-y-1">
          <Button type="button" size="sm" variant="outline" onClick={() => void sendTestEmail()} disabled={sendingTest || !workspaceId}>
            {sendingTest ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
            Test email
          </Button>
          {testNote ? <p className="text-xs text-slate-500">{testNote}</p> : null}
        </div>
      ) : null}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent surface="solid" className="w-[min(36rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle className="text-lg">Sections included in the email</DialogTitle>
            <DialogDescription>
              Select the sections from the {kind} template to include in the email.
            </DialogDescription>
          </DialogHeader>
          {loadingParts ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading template content...
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {parts.map((part) => (
                <li key={part.heading}>
                  <label className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={draftHas(part.heading)}
                      onChange={() => toggleDraft(part.heading)}
                    />
                    <span>
                      <span className="font-medium">{part.heading}</span>
                      {part.cover ? <span className="ml-2 text-xs font-normal text-slate-400">Cover</span> : null}
                      {part.preview ? <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">{part.preview}</span> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {pickerNote ? <p className="text-xs text-slate-500">{pickerNote}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveParts} disabled={loadingParts || parts.length === 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
