import { useEffect, useState } from 'react'

import { Select, SelectItem } from '@/components/ui/select'
import { listTemplates } from '@/lib/api/documentKnowledgeApi'
import { useUserWorkspaceOptions } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'
import { belongsToDkmTemplateScope } from '@/modules/document-knowledge-management/lib/templateWorkspaceScope'
import {
  emailDocumentKindFromTemplateCode,
  emailDocumentKindsFromTemplates,
} from '@/modules/project-management/lib/urdReviewHeads'

const FIELD_LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400'
const LABEL_FALLBACK_KINDS = ['URD', 'BRD', 'FSD'] as const

function kindFromNodeLabel(label: string): string {
  const blob = label.toUpperCase()
  return LABEL_FALLBACK_KINDS.find((kind) => blob.includes(kind)) ?? ''
}

type Props = {
  workspaceId: string | null
  parameter: string
  nodeLabel: string
  onChange: (kind: string) => void
  /** Shown under the dropdown. Upload talks about generation; a request talks about the document row. */
  description?: string
}

export function DocumentTemplateKindField({ workspaceId, parameter, nodeLabel, onChange, description }: Props) {
  const { options: workspaceOptions } = useUserWorkspaceOptions()
  const [templateKinds, setTemplateKinds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const selected = emailDocumentKindFromTemplateCode(parameter) || kindFromNodeLabel(nodeLabel) || 'URD'

  useEffect(() => {
    if (!workspaceId) {
      setTemplateKinds([])
      setNote('Pilih workspace dulu.')
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
        setTemplateKinds(emailDocumentKindsFromTemplates(scoped))
        setNote(scoped.length === 0 ? 'Workspace ini belum punya template dokumen aktif.' : '')
      })
      .catch(() => {
        if (cancelled) return
        setTemplateKinds([])
        setNote('Template dokumen gagal dimuat.')
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, workspaceOptions])

  const options = templateKinds.includes(selected) ? templateKinds : [selected, ...templateKinds]

  return (
    <div className="space-y-1.5 border-t border-slate-100 pt-3">
      <label className={FIELD_LABEL_CLASS}>Jenis dokumen</label>
      <Select value={selected} onChange={(event) => onChange(event.target.value)} className="h-9 text-sm">
        {options.map((kind) => (
          <SelectItem key={kind} value={kind}>{kind}</SelectItem>
        ))}
      </Select>
      <p className="text-xs leading-5 text-slate-500">
        {description ?? `Generate memakai template aktif yang kodenya diawali ${selected.toLowerCase()}-.`}
      </p>
      {note ? <p className="text-xs text-slate-500">{note}</p> : null}
      {templateKinds.length > 0 && !templateKinds.includes(selected) ? (
        <p className="text-xs text-slate-500">Jenis ini tidak ada di template aktif. Pilihan tetap tersimpan sampai diganti.</p>
      ) : null}
    </div>
  )
}
