import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ParticipationScopeOption } from '@/lib/workspaceParticipationScopes'

export type ManageParticipationScopesModalProps = {
  open: boolean
  onClose: () => void
  options: ParticipationScopeOption[]
  onUpdateScope: (scopeId: string, displayName: string) => Promise<void>
  disabled?: boolean
  saving?: boolean
}

export function ManageParticipationScopesModal({
  open,
  onClose,
  options,
  onUpdateScope,
  disabled = false,
  saving = false,
}: ManageParticipationScopesModalProps) {
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [editingError, setEditingError] = useState<string | null>(null)

  const busy = disabled || saving

  useEffect(() => {
    if (!open) return
    setEditingScopeId(null)
    setEditingLabel('')
    setEditingError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      e.preventDefault()
      e.stopPropagation()
      if (editingScopeId) {
        setEditingScopeId(null)
        setEditingLabel('')
        setEditingError(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, busy, onClose, editingScopeId])

  const commitEdit = async () => {
    const scopeId = editingScopeId
    if (!scopeId) return
    const label = editingLabel.trim()
    if (!label) {
      setEditingError('Label is required.')
      return
    }
    if (options.some((o) => o.id !== scopeId && o.label.toLowerCase() === label.toLowerCase())) {
      setEditingError('Label already exists.')
      return
    }
    try {
      await onUpdateScope(scopeId, label)
      setEditingScopeId(null)
      setEditingLabel('')
      setEditingError(null)
    } catch (e) {
      setEditingError(e instanceof Error ? e.message : 'Could not update scope')
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
        aria-labelledby="manage-participation-scopes-title"
      >
        <div
          className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 id="manage-participation-scopes-title" className="text-lg font-semibold text-foreground">
                Manage Participation Scopes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Rename display labels for predefined collaboration boundaries. Scope codes are fixed for policy
                consistency.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={busy} aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto px-5 py-4">
            {options.map((scope) => (
              <div
                key={scope.id}
                className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  {editingScopeId === scope.id ? (
                    <div className="space-y-1">
                      <Input
                        value={editingLabel}
                        onChange={(e) => {
                          setEditingLabel(e.target.value)
                          setEditingError(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void commitEdit()
                          }
                          if (e.key === 'Escape') {
                            setEditingScopeId(null)
                            setEditingLabel('')
                            setEditingError(null)
                          }
                        }}
                        className="h-9 text-sm"
                        autoFocus
                        disabled={busy}
                      />
                      {editingError ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{editingError}</p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="font-mono text-[10px] text-muted-foreground">{scope.value}</p>
                      <p className="truncate text-sm font-semibold text-foreground">{scope.label}</p>
                    </>
                  )}
                </div>
                {editingScopeId === scope.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => void commitEdit()}
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
                    onClick={() => {
                      setEditingScopeId(scope.id)
                      setEditingLabel(scope.label)
                      setEditingError(null)
                    }}
                    disabled={busy}
                    aria-label={`Edit ${scope.label}`}
                  >
                    <PencilLine className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Participation scopes define collaboration boundaries in a workspace. They are separate from Security &amp;
            Access Control role matrices. Adding or removing scope codes requires a platform release.
          </p>
        </div>
      </div>
    </>,
    document.body
  )
}
