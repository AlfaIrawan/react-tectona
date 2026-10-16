import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { TemplatePart, TemplatePartChoice } from '@/modules/project-management/lib/templatePartSelection'

const KIND_LABEL: Record<TemplatePart['kind'], string> = { field: 'Field', section: 'Section', table: 'Table' }

/**
 * Regenerating an existing document: per template part, keep it, take it from an earlier version,
 * or generate it again. Only the last kind is sent to the model.
 */
export function TemplatePartChoices({
  parts,
  choices,
  currentVersion,
  otherVersions,
  keepable,
  loading,
  disabled,
  onChange,
}: {
  parts: TemplatePart[]
  choices: Record<string, TemplatePartChoice>
  currentVersion: number
  /** Earlier versions of this document, newest first. */
  otherVersions: number[]
  /** Parts the current version has a value for. */
  keepable: Set<string>
  loading: boolean
  disabled: boolean
  onChange: (next: Record<string, TemplatePartChoice>) => void
}) {
  const regenerated = parts.filter((part) => (choices[part.key] ?? 'generate') === 'generate').length
  const setAll = (choice: 'keep' | 'generate') => onChange(Object.fromEntries(parts.map((part) => [
    part.key, choice === 'keep' && !keepable.has(part.key) ? 'generate' : choice,
  ])))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Parts to regenerate
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={disabled || loading}
            onClick={() => setAll('keep')}
          >
            Keep all
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={disabled || loading}
            onClick={() => setAll('generate')}
          >
            Regenerate all
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {loading
          ? `Reading V${currentVersion}…`
          : `${regenerated} of ${parts.length} parts will be written again. Every other part stays as chosen. Title, owner, number and version are always updated.`}
      </p>
      {/* No scroll of its own: the dialog body scrolls, a list scrolling inside it felt cramped. */}
      <ul className="divide-y divide-border/50 rounded-xl border border-border/70">
        {parts.map((part) => {
          const choice = choices[part.key] ?? 'generate'
          const value = choice === 'keep' ? 'keep' : choice === 'generate' ? 'generate' : `v${choice}`
          return (
            <li
              key={part.key}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-1.5',
                choice === 'generate' ? 'bg-primary/5' : '',
              )}
            >
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-sm text-foreground" title={part.label}>{part.label}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{KIND_LABEL[part.kind]}</span>
              </span>
              <Select
                aria-label={`What to do with ${part.label}`}
                className="h-8 w-40 shrink-0 rounded-lg text-xs"
                value={value}
                disabled={disabled || loading}
                onChange={(event) => {
                  const next = event.target.value
                  const picked: TemplatePartChoice = next === 'keep' || next === 'generate' ? next : Number(next.slice(1))
                  onChange({ ...choices, [part.key]: picked })
                }}
              >
                <option value="keep" disabled={!keepable.has(part.key)}>
                  {keepable.has(part.key) ? `Keep (V${currentVersion})` : `Keep (empty in V${currentVersion})`}
                </option>
                <option value="generate">Regenerate</option>
                {otherVersions.map((version) => (
                  <option key={version} value={`v${version}`}>From V{version}</option>
                ))}
              </Select>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
