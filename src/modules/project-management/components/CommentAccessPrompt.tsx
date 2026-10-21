import { useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CommentAccessLevel = 'read' | 'comment' | 'deny'

export type CommentAccessPerson = {
  id: string
  name: string
  /** Why they are asked about, e.g. "Mentioned by Iman". */
  note?: string
}

const LEVEL_LABEL: Record<CommentAccessLevel, string> = {
  read: 'Read only',
  comment: 'Comment',
  deny: 'Decline',
}

/**
 * The idea owner's choice of what people may do with the idea's comments: read the discussion
 * (Read only) or also reply (Comment). Shown when the owner mentions someone without access, and
 * for requests that came from another participant's mention (then Decline is offered too).
 * Rendered over the Generate dialog, inside it.
 */
export function CommentAccessPrompt({
  title,
  description,
  people,
  allowDecline,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  people: CommentAccessPerson[]
  allowDecline: boolean
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: (levels: Record<string, CommentAccessLevel>) => void
  onCancel: () => void
}) {
  const [levels, setLevels] = useState<Record<string, CommentAccessLevel>>({})
  useEffect(() => {
    setLevels(Object.fromEntries(people.map((person) => [person.id, 'comment' as CommentAccessLevel])))
  }, [people])
  const options: CommentAccessLevel[] = allowDecline ? ['read', 'comment', 'deny'] : ['read', 'comment']

  return (
    <div className="absolute inset-0 z-[30] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label={cancelLabel}
        className="absolute inset-0 bg-slate-950/40"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-access-title"
        className="relative w-full max-w-md space-y-4 rounded-2xl border border-border bg-background p-5 text-sm shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.stopPropagation()
            onCancel()
          }
        }}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 id="comment-access-title" className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {people.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{person.name}</p>
                {person.note ? <p className="truncate text-[11px] text-muted-foreground">{person.note}</p> : null}
              </div>
              <div role="radiogroup" aria-label={`Access for ${person.name}`} className="flex shrink-0 rounded-lg border border-border/70 p-0.5">
                {options.map((level) => {
                  const active = levels[person.id] === level
                  return (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={busy}
                      onClick={() => setLevels((prev) => ({ ...prev, [person.id]: level }))}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? level === 'deny' ? 'bg-destructive/10 text-destructive' : 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {LEVEL_LABEL[level]}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] leading-4 text-muted-foreground">
          Read only: sees this idea's document comments. Comment: may also reply. It covers the comments only;
          what they can open elsewhere still follows their workspace role.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>{cancelLabel}</Button>
          <Button type="button" size="sm" disabled={busy || people.length === 0} onClick={() => onConfirm(levels)}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
