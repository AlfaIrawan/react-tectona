import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  isOperationalTeamLabelValid,
  normalizeOperationalTeamLabelForSubmit,
  normalizeOperationalTeamLabelInput,
  type OperationalTeamOption,
} from '@/lib/workspaceOperationalTeams'

export type ManageOperationalTeamsModalProps = {
  open: boolean
  onClose: () => void
  options: OperationalTeamOption[]
  selectedValue: string
  onSelectedValueChange: (value: string) => void
  onCreateTeam: (displayName: string) => Promise<void>
  onUpdateTeam: (teamId: string, displayName: string) => Promise<void>
  onDeleteTeam: (teamId: string) => Promise<void>
  disabled?: boolean
  saving?: boolean
}

export function ManageOperationalTeamsModal({
  open,
  onClose,
  options,
  selectedValue,
  onSelectedValueChange,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  disabled = false,
  saving = false,
}: ManageOperationalTeamsModalProps) {
  const [newTeamLabel, setNewTeamLabel] = useState('')
  const [newTeamError, setNewTeamError] = useState<string | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamLabel, setEditingTeamLabel] = useState('')
  const [editingTeamError, setEditingTeamError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNewTeamLabel('')
    setNewTeamError(null)
    setEditingTeamId(null)
    setEditingTeamLabel('')
    setEditingTeamError(null)
  }, [open])

  const busy = disabled || saving

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      e.preventDefault()
      e.stopPropagation()
      if (editingTeamId) {
        setEditingTeamId(null)
        setEditingTeamLabel('')
        setEditingTeamError(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, busy, onClose, editingTeamId])

  const addTeam = async () => {
    const label = normalizeOperationalTeamLabelForSubmit(newTeamLabel)
    if (!label) {
      setNewTeamError('Team name is required.')
      return
    }
    if (!isOperationalTeamLabelValid(label)) {
      setNewTeamError('Only letters, numbers, (, ), &, and - are allowed.')
      return
    }
    if (options.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      setNewTeamError('Team already exists.')
      return
    }
    try {
      await onCreateTeam(label)
      setNewTeamLabel('')
      setNewTeamError(null)
    } catch (e) {
      setNewTeamError(e instanceof Error ? e.message : 'Could not add team')
    }
  }

  const startEditTeam = (team: OperationalTeamOption) => {
    setEditingTeamId(team.id)
    setEditingTeamLabel(team.label)
    setEditingTeamError(null)
  }

  const commitEditTeam = async () => {
    const teamId = editingTeamId
    if (!teamId) return
    const label = normalizeOperationalTeamLabelForSubmit(editingTeamLabel)
    if (!label) {
      setEditingTeamError('Team name is required.')
      return
    }
    if (!isOperationalTeamLabelValid(label)) {
      setEditingTeamError('Only letters, numbers, (, ), &, and - are allowed.')
      return
    }
    if (options.some((t) => t.id !== teamId && t.label.toLowerCase() === label.toLowerCase())) {
      setEditingTeamError('Team name already exists.')
      return
    }
    try {
      await onUpdateTeam(teamId, label)
      setEditingTeamId(null)
      setEditingTeamLabel('')
      setEditingTeamError(null)
    } catch (e) {
      setEditingTeamError(e instanceof Error ? e.message : 'Could not update team')
    }
  }

  const deleteTeam = async (team: OperationalTeamOption) => {
    if (options.length <= 1) return
    try {
      await onDeleteTeam(team.id)
      if (selectedValue === team.value) {
        const remaining = options.filter((t) => t.id !== team.id)
        onSelectedValueChange(remaining[0]?.value ?? '')
      }
    } catch {
      /* parent may surface toast */
    }
  }

  if (typeof document === 'undefined' || !open) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1200] bg-black/30 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose()
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[1250] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-operational-teams-title"
      >
        <div
          className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 id="manage-operational-teams-title" className="text-lg font-semibold text-foreground">
                Manage Operational Teams
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Add, rename, or delete operational team options.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={busy}
              aria-label="Close manage operational teams"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="flex gap-2">
              <Input
                value={newTeamLabel}
                onChange={(e) => {
                  setNewTeamLabel(normalizeOperationalTeamLabelInput(e.target.value))
                  setNewTeamError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addTeam()
                  }
                }}
                placeholder="New team (e.g., PMO Office, Program Delivery)..."
                className="h-10 flex-1 text-sm"
                disabled={busy}
              />
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => void addTeam()}
                disabled={busy}
                aria-label="Add operational team"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {newTeamError ? <p className="text-xs text-red-600 dark:text-red-400">{newTeamError}</p> : null}

            <div className="max-h-72 overflow-y-auto rounded-xl border border-border/70">
              {options.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    {editingTeamId === team.id ? (
                      <div className="space-y-1">
                        <Input
                          value={editingTeamLabel}
                          onChange={(e) => {
                            setEditingTeamLabel(normalizeOperationalTeamLabelInput(e.target.value))
                            setEditingTeamError(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void commitEditTeam()
                            }
                            if (e.key === 'Escape') {
                              setEditingTeamId(null)
                              setEditingTeamLabel('')
                              setEditingTeamError(null)
                            }
                          }}
                          className="h-9 text-sm"
                          autoFocus
                          disabled={busy}
                        />
                        {editingTeamError ? (
                          <p className="text-xs text-red-600 dark:text-red-400">{editingTeamError}</p>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p className="font-mono text-[10px] text-muted-foreground">{team.value}</p>
                        <p className="truncate text-sm font-semibold text-foreground">{team.label}</p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {editingTeamId === team.id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => void commitEditTeam()}
                        disabled={busy}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEditTeam(team)}
                        disabled={busy}
                        aria-label={`Edit ${team.label}`}
                      >
                        <PencilLine className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn('h-8 w-8', options.length <= 1 && 'opacity-40')}
                      onClick={() => void deleteTeam(team)}
                      disabled={busy || options.length <= 1}
                      aria-label={`Delete ${team.label}`}
                      title={options.length <= 1 ? 'At least one team is required' : undefined}
                    >
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Note: team changes are stored in the workspace access catalog. Existing workspace members retain their
            original operational team value until updated.
          </p>
        </div>
      </div>
    </>,
    document.body
  )
}
