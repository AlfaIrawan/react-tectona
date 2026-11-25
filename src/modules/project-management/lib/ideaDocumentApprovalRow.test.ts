import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DocumentResponse } from '@/lib/api/documentKnowledgeApi'
import { Button } from '@/components/ui/button'
import { DocumentRepositoryTableView } from '@/modules/document-knowledge-management/components/DocumentRepositoryTableView'
import { mapDocumentToRepositoryItem } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import { ideaDocumentMatchesApproval } from './ideaDocumentKind'

const document: DocumentResponse = {
  id: 'srd-document', project_id: 'idea', title: 'Pembuatan Chat Gen AI untuk Collection',
  document_type_code: 'delivery_artifact', category_code: 'requirements', status_code: 'draft',
  current_version_no: 6, version: 6, tags: [], access_scope_codes: [], context_links: [],
  created_date: '2026-11-04T00:00:00Z', metadata: {
    doc_type_label: 'SRD', template_code: 'srd-adirafinancews-srdsimplifiedrequirement-v1-2-mvp7xy4r',
    original_file_name: 'Template - SRD (Simplified Requirement Document) V6.docx',
  },
}

describe('SRD approval action in document views', () => {
  it.each([false, true])('renders the row action for mobileCards=%s, without changing permissions', mobileCards => {
    const item = mapDocumentToRepositoryItem(document, document.title)
    function render(owner: boolean, canRequest: boolean, kinds: string[]) {
      return renderToStaticMarkup(createElement(DocumentRepositoryTableView, {
        items: [item], mobileCards, hiddenColumnKeys: ['linked', 'access'],
        rowAction: row => ideaDocumentMatchesApproval(document, row, kinds) && owner && canRequest
          ? createElement(Button, { type: 'button' }, 'Request for Approval') : null,
      }))
    }
    expect(render(true, true, ['SRD'])).toContain('Request for Approval')
    expect(render(false, true, ['SRD'])).not.toContain('Request for Approval')
    expect(render(true, false, ['SRD'])).not.toContain('Request for Approval')
    expect(render(true, true, ['URD'])).not.toContain('Request for Approval')
  })
})
