import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { EnterpriseActionConfirmModal } from '@/components/enterprise/EnterpriseActionConfirmModal'
import { Input } from '@/components/ui/input'
import type { IdeaWorkspaceSelectionPolicy } from '../lib/ideaWorkspaceSelection'

export function IdeaWorkspaceSelectionModal({ policy, options, onClose, onContinue }: {
  policy: IdeaWorkspaceSelectionPolicy
  options: Array<{ workspaceId: string; workspaceName: string }>
  onClose: () => void
  onContinue: (workspaceId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(options.some((option) => option.workspaceId === policy.default_workspace_id) ? policy.default_workspace_id! : '')
  const matches = options.filter((option) => option.workspaceName.toLowerCase().includes(query.toLowerCase()))
  return <EnterpriseActionConfirmModal
    open title={policy.popup_title} description="Choose the workspace that will own this idea."
    entityLabel="Workspace" entityValue={options.find((option) => option.workspaceId === selected)?.workspaceName ?? 'No workspace selected'}
    icon={Building2} iconContainerClassName="bg-cyan-500/12 text-cyan-700 ring-cyan-500/25"
    dialogTitleId="idea-workspace-selection-title"
    onClose={onClose} onConfirm={() => { if (options.some((option) => option.workspaceId === selected)) onContinue(selected) }}
    confirmLabel="Continue" disableConfirm={!options.some((option) => option.workspaceId === selected)}
    footerExtra={<div className="space-y-3">
      <Input aria-label="Search workspaces" placeholder="Search workspaces..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="max-h-[35vh] space-y-2 overflow-y-auto" role="radiogroup" aria-label="Workspace">
        {matches.map((option) => <label key={option.workspaceId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="radio" name="idea-owning-workspace" value={option.workspaceId} checked={selected === option.workspaceId} onChange={() => setSelected(option.workspaceId)} />
          <span className="min-w-0 break-words">{option.workspaceName}</span>
        </label>)}
        {!matches.length && <p className="text-sm text-muted-foreground">No matching workspaces.</p>}
      </div>
    </div>}
  />
}
