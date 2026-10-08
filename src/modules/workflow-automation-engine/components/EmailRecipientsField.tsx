import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Select, SelectItem } from '@/components/ui/select'
import { useUserWorkspaceOptions } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'
import {
  normalizeJobTitle,
  parseEmailRecipientBy,
  parseJobTitles,
  type EmailRecipientBy,
} from '@/modules/project-management/lib/urdReviewHeads'

const FIELD_LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400'

const MODES: Array<{ value: EmailRecipientBy; label: string; placeholder: string }> = [
  { value: 'name', label: 'By Name', placeholder: 'Name, then Enter' },
  { value: 'jobTitle', label: 'By Job Title', placeholder: 'Job title, then Enter' },
  { value: 'department', label: 'By Department', placeholder: 'Department, then Enter' },
  { value: 'team', label: 'By Team', placeholder: 'Team, then Enter' },
  { value: 'role', label: 'By Role', placeholder: 'Role, then Enter' },
  { value: 'workspace', label: 'By Workspace', placeholder: 'Workspace, then Enter' },
]

type Props = {
  mode: string
  values: unknown
  label?: string
  hint?: string
  modes?: EmailRecipientBy[]
  onChange: (patch: { emailRecipientBy: string; emailRecipients: string; jobTitles: string }) => void
}

export function EmailRecipientsField({
  mode,
  values,
  label = 'Email recipients',
  hint,
  modes = ['name', 'jobTitle', 'department', 'role'],
  onChange,
}: Props) {
  const choices = MODES.filter((item) => !modes || modes.includes(item.value))
  const parsed = parseEmailRecipientBy(mode)
  const current = choices.some((item) => item.value === parsed) ? parsed : (choices[0]?.value ?? 'jobTitle')
  const badges = parseJobTitles(values)
  const [draft, setDraft] = useState('')
  const { options: workspaceOptions, loading: workspacesLoading } = useUserWorkspaceOptions()
  const placeholder = choices.find((item) => item.value === current)?.placeholder ?? 'Type, then Enter'
  const workspaceChoices = useMemo(() => {
    const seen = new Set<string>()
    return workspaceOptions
      .filter((option) => {
        const key = normalizeJobTitle(option.workspaceName)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((left, right) => left.workspaceName.localeCompare(right.workspaceName))
  }, [workspaceOptions])
  const selectedWorkspaceKeys = new Set(badges.map((badge) => normalizeJobTitle(badge)))
  const remainingWorkspaces = workspaceChoices.filter((option) => !selectedWorkspaceKeys.has(normalizeJobTitle(option.workspaceName)))

  const commit = (nextMode: EmailRecipientBy, nextBadges: string[]) => {
    const text = nextBadges.join('\n')
    onChange({
      emailRecipientBy: nextMode,
      emailRecipients: text,
      jobTitles: nextMode === 'jobTitle' ? text : '',
    })
  }

  const addDraft = () => {
    const parts = draft.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean)
    if (parts.length === 0) return
    commit(current, parseJobTitles([...badges, ...parts]))
    setDraft('')
  }

  return (
    <div className="space-y-1.5 border-t border-slate-100 pt-3">
      <p className={FIELD_LABEL_CLASS}>{label}</p>
      <Select
        value={current}
        onChange={(event) => {
          setDraft('')
          commit(parseEmailRecipientBy(event.target.value), [])
        }}
        className="h-9 text-sm"
      >
        {choices.map((item) => (
          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
        ))}
      </Select>
      {badges.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {badges.map((badge) => (
            <span key={badge} className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              <span className="truncate">{badge}</span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700"
                aria-label={`Remove ${badge}`}
                onClick={() => commit(current, badges.filter((item) => item !== badge))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {current === 'workspace' ? (
        <Select
          value=""
          onChange={(event) => {
            const name = event.target.value.trim()
            if (!name) return
            commit('workspace', parseJobTitles([...badges, name]))
          }}
          className="h-9 text-sm"
        >
          <SelectItem value="" disabled>
            {workspacesLoading
              ? 'Loading workspaces…'
              : remainingWorkspaces.length === 0
                ? 'All workspaces selected'
                : 'Add a workspace'}
          </SelectItem>
          {remainingWorkspaces.map((option) => (
            <SelectItem key={option.workspaceId} value={option.workspaceName}>
              {option.workspaceName}
            </SelectItem>
          ))}
        </Select>
      ) : (
        <div className="rounded-md border border-slate-200 px-2 py-1.5">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addDraft()
              } else if (event.key === 'Backspace' && draft === '' && badges.length > 0) {
                commit(current, badges.slice(0, -1))
              }
            }}
            onBlur={addDraft}
            placeholder={placeholder}
            className="w-full bg-transparent py-1 text-sm text-slate-800 outline-none"
          />
        </div>
      )}
      <p className="text-xs leading-5 text-slate-500">
        {current === 'workspace'
          ? 'Select one or more workspaces. Leave empty to include everyone.'
          : (hint ?? 'Type and press Enter. Each badge represents one recipient.')}
      </p>
    </div>
  )
}
