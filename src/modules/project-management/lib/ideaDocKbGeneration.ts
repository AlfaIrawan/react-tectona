/**
 * Lightweight "upload -> auto-generate KB" pipeline for Idea Docs.
 *
 * Reuses the same extraction/LLM/persistence primitives as the Document Repository's KB generation
 * (see DocumentKnowledgeManagementPage.tsx's `createKbFromUploadedDocument`), but skips the
 * BRD/memo-specific structured extraction and standard-content enforcement that pipeline applies —
 * those exist to satisfy the Document Repository's BRD/memo formatting standards, which don't apply
 * to generic idea supporting documents.
 */

import DOMPurify from 'dompurify'
import type { DocumentResponse } from '@/lib/api/documentKnowledgeApi'
import {
  describeImageViaVision,
  generateRepositoryKbFromDocument,
} from '@/lib/api/tectonaAgentRuntimeApi'
import { createKbEntry, createKbRelation, KB_CATEGORIES, type KbEntryResponse } from '@/lib/api/tectonaKbApi'
import { scrubKbExtractionArtifacts, stripRepeatedRunningLines } from '@/lib/kb/kbExtractionArtifacts'
import { sanitizeKbRichHtmlPreservingTables } from '@/lib/kb/kbRichTableHtml'
import {
  extractRepositoryDocumentText,
  findRepositoryTraceEntryByDocumentId,
  repositoryTraceEntryTitle,
} from '@/lib/kb/repositoryKbFromDocument'

const IDEA_DOC_KB_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3',
  'div', 'blockquote', 'a', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
]
const IDEA_DOC_KB_ALLOWED_ATTR = ['href', 'target', 'rel', 'colspan', 'rowspan', 'width', 'height', 'style']

function sanitizeIdeaDocKbHtml(html: string): string {
  if (!html) return ''
  const purify = (content: string) =>
    DOMPurify.sanitize(content, {
      ALLOWED_TAGS: IDEA_DOC_KB_ALLOWED_TAGS,
      ALLOWED_ATTR: IDEA_DOC_KB_ALLOWED_ATTR,
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
      ALLOW_DATA_ATTR: false,
    })
  return sanitizeKbRichHtmlPreservingTables(html, purify)
}

function kbPlainTextLength(html: string): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return html.trim().length
  const root = document.createElement('div')
  root.innerHTML = html
  return (root.textContent || '').trim().length
}

function clampKbPriority(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 50
  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveKbCategory(candidate: string | undefined): string {
  const valid = new Set<string>(KB_CATEGORIES.map((item) => item.value))
  if (candidate && valid.has(candidate)) return candidate
  return 'business_rules'
}

function buildIdeaDocKbFooter(documentTitle: string, ideaTitle: string): string {
  return (
    '<h2>Sumber dokumen</h2>'
    + `<p>Dibuat otomatis dari dokumen pendukung "<strong>${documentTitle}</strong>" pada idea "`
    + `<strong>${ideaTitle}</strong>". Bukan pengganti dokumen asli — buka dokumen di Idea Docs untuk detail lengkap.</p>`
  )
}

export type IdeaDocKbStatus = 'generated' | 'unsupported' | 'failed'

export interface IdeaDocKbResult {
  status: IdeaDocKbStatus
  message?: string
  kbEntry?: KbEntryResponse
}

export async function generateIdeaDocKb(params: {
  file: File
  document: DocumentResponse
  ideaId: string
  ideaTitle: string
  workspaceId: string | null
  existingKbEntries: Array<{ id: string; title: string; content?: string | null }>
}): Promise<IdeaDocKbResult> {
  const { file, document: doc, ideaId, ideaTitle, workspaceId, existingKbEntries } = params

  try {
    // 1. Extract text (or, for images, a vision-LLM description).
    let extractedText = ''
    if (file.type.startsWith('image/')) {
      const described = await describeImageViaVision(file)
      extractedText = (described.text || '').trim()
    } else {
      const extract = await extractRepositoryDocumentText(file)
      extractedText = stripRepeatedRunningLines(extract.text || '').trim()
    }

    if (!extractedText) {
      return {
        status: 'unsupported',
        message: 'Could not extract content from this file type yet.',
      }
    }

    // 2. Generate KB content via the same agent-runtime LLM call Document Repository uses.
    const generated = await generateRepositoryKbFromDocument({
      context: { workspace_id: workspaceId },
      document: {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        project_name: ideaTitle,
        project_id: doc.project_id,
        document_id: doc.id,
        document_title: doc.title,
        document_text_excerpt: extractedText.slice(0, 12_000),
        excerpt_truncated: extractedText.length > 12_000,
      },
      document_kind: 'auto',
      options: { allow_llm: true },
    })

    const parsed = generated.payload
    if (!parsed.kb_content_html?.trim()) {
      return { status: 'failed', message: 'The agent returned an empty KB draft.' }
    }

    // 3. Sanitize + light cleanup (skip Document Repository's BRD/memo standard-content enforcement).
    let html = sanitizeIdeaDocKbHtml(parsed.kb_content_html)
    html = scrubKbExtractionArtifacts(html)
    html += buildIdeaDocKbFooter(doc.title, ideaTitle)

    if (kbPlainTextLength(html) < 10) {
      return { status: 'failed', message: 'Generated KB content was too short to save.' }
    }

    // 4. Persist: trace entry (for cross-page "is KB generated" detection) + the actual KB entry.
    let traceEntry = findRepositoryTraceEntryByDocumentId(existingKbEntries, doc.id, doc.title)
    if (!traceEntry) {
      traceEntry = await createKbEntry({
        category: 'platform_context',
        title: repositoryTraceEntryTitle(doc.title),
        content: `Source document id: ${doc.id}. Idea id: ${ideaId}.`,
        is_active: true,
        priority: 60,
        workspace_id: workspaceId,
      })
    }

    const kbEntry = await createKbEntry({
      category: resolveKbCategory(parsed.kb_category),
      title: parsed.kb_title?.trim() || doc.title,
      content: html,
      is_active: true,
      priority: clampKbPriority(parsed.kb_priority),
      workspace_id: workspaceId,
    })

    try {
      await createKbRelation({
        source_entry_id: kbEntry.id,
        predicate: 'references',
        target_entry_id: traceEntry.id,
        workspace_id: workspaceId,
        properties: { relation_kind: 'document_traceability', document_id: doc.id, idea_id: ideaId },
      })
    } catch {
      // Best-effort — the relation is a convenience link, not required for the KB entry to be valid.
    }

    return { status: 'generated', kbEntry }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'KB generation failed.' }
  }
}
