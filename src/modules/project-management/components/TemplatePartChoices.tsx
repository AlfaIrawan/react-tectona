import { useState } from 'react'
import { AlertTriangle, ChevronRight, RotateCw, Sparkles } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  partPreview,
  partPreviewSummary,
  type PartPayload,
  type PartPreview,
  type TemplatePart,
  type TemplatePartChoice,
} from '@/modules/project-management/lib/templatePartSelection'

const KIND_LABEL: Record<TemplatePart['kind'], string> = { field: 'Field', section: 'Section', table: 'Table' }
const TABLE_PREVIEW_ROWS = 8

function PreviewBody({ preview }: { preview: PartPreview }) {
  if (preview.kind === 'text') {
    return (
      <div className="scroll-reveal max-h-56 overflow-y-auto whitespace-pre-line break-words text-xs leading-relaxed">
        {preview.diagram ? <span className="mr-1 text-muted-foreground">Diagram ·</span> : null}
        {preview.text}
      </div>
    )
  }
  const hidden = preview.rows.length - TABLE_PREVIEW_ROWS
  return (
    <div className="scroll-reveal max-h-56 overflow-auto">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead>
          <tr>
            {preview.columns.map((column) => (
              <th key={column} className="border-b border-border/70 px-1.5 py-1 font-medium text-muted-foreground">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.slice(0, TABLE_PREVIEW_ROWS).map((row, index) => (
            <tr key={index} className="align-top">
              {row.map((cell, column) => (
                <td key={column} className="border-b border-border/40 px-1.5 py-1">
                  <span className="line-clamp-3 whitespace-pre-line">{cell || '—'}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 ? <p className="mt-1 text-[11px] text-muted-foreground">+{hidden} more rows</p> : null}
    </div>
  )
}

function PreviewBox({
  title,
  preview,
  emptyText,
  tone,
}: {
  title: string
  preview: PartPreview | undefined
  emptyText: string
  tone: 'current' | 'used' | 'replaced'
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border px-2.5 py-2',
        tone === 'used' ? 'border-primary/40 bg-background' : 'border-border/60 bg-muted/30',
      )}
    >
      <p className={cn('mb-1 text-[10px] font-medium uppercase tracking-wide', tone === 'used' ? 'text-primary' : 'text-muted-foreground')}>
        {title}
      </p>
      <div className={cn(tone === 'replaced' ? 'text-muted-foreground' : 'text-foreground')}>
        {preview ? <PreviewBody preview={preview} /> : <p className="text-xs italic text-muted-foreground">{emptyText}</p>}
      </div>
    </div>
  )
}

/**
 * Regenerating an existing document: per template part, keep it, take it from an earlier version,
 * or generate it again. Only the last kind is sent to the model. Each row shows what the chosen
 * version holds; opening a row shows it in full, next to the current version when they differ.
 */
export function TemplatePartChoices({
  parts,
  choices,
  currentVersion,
  otherVersions,
  keepable,
  payloads,
  failedVersions,
  onRetry,
  loading,
  disabled,
  onChange,
  className,
}: {
  parts: TemplatePart[]
  choices: Record<string, TemplatePartChoice>
  currentVersion: number
  /** Earlier versions of this document, newest first. */
  otherVersions: number[]
  /** Parts the current version has a value for. */
  keepable: Set<string>
  /** Version payloads read so far; an earlier version is read when it is first picked. */
  payloads: Record<number, PartPayload | undefined>
  /** Versions whose content could not be read; each waits for `onRetry`. */
  failedVersions: number[]
  onRetry: (version: number) => void
  loading: boolean
  disabled: boolean
  onChange: (next: Record<string, TemplatePartChoice>) => void
  className?: string
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const regenerated = parts.filter((part) => (choices[part.key] ?? 'generate') === 'generate').length
  const setAll = (choice: 'keep' | 'generate') => onChange(Object.fromEntries(parts.map((part) => [
    part.key, choice === 'keep' && !keepable.has(part.key) ? 'generate' : choice,
  ])))
  const toggle = (key: string) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const currentFailed = !loading && failedVersions.includes(currentVersion) && !payloads[currentVersion]
  const currentEmptyText = currentFailed ? `Couldn't read V${currentVersion}` : `Empty in V${currentVersion}`
  const retryButton = (version: number) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-foreground underline-offset-2 hover:bg-muted hover:underline disabled:opacity-50"
      disabled={disabled}
      onClick={() => onRetry(version)}
    >
      <RotateCw className="h-3 w-3" aria-hidden="true" />
      Retry
    </button>
  )

  return (
    <div className={cn('space-y-2 lg:flex lg:min-h-0 lg:flex-col', className)}>
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
      {currentFailed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive"
        >
          <span className="flex min-w-0 items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Couldn't read V{currentVersion}, so no part can be kept and every part is set to Regenerate.
          </span>
          {retryButton(currentVersion)}
        </div>
      ) : null}
      <ul className="scroll-reveal divide-y divide-border/50 rounded-xl border border-border/70 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {parts.map((part) => {
          const choice = choices[part.key] ?? 'generate'
          const value = choice === 'keep' ? 'keep' : choice === 'generate' ? 'generate' : `v${choice}`
          const current = loading ? undefined : partPreview(part, payloads[currentVersion])
          const pickedVersion = typeof choice === 'number' ? choice : null
          const pickedLoaded = pickedVersion !== null && payloads[pickedVersion] !== undefined
          const pickedFailed = pickedVersion !== null && !pickedLoaded && failedVersions.includes(pickedVersion)
          const picked = pickedVersion !== null ? partPreview(part, payloads[pickedVersion]) : undefined
          const expanded = open.has(part.key)
          const panelId = `template-part-${part.key}`

          let line: { text: string; tone: 'value' | 'empty' | 'generate' | 'error' }
          if (loading) line = { text: `Reading V${currentVersion}…`, tone: 'empty' }
          else if (choice === 'generate') line = { text: 'Will be written again by AI', tone: 'generate' }
          else if (pickedFailed) line = { text: `Couldn't read V${pickedVersion}`, tone: 'error' }
          else if (pickedVersion !== null && !pickedLoaded) line = { text: `Reading V${pickedVersion}…`, tone: 'empty' }
          else if (pickedVersion !== null) line = picked ? { text: partPreviewSummary(picked), tone: 'value' } : { text: `Empty in V${pickedVersion}`, tone: 'empty' }
          else line = current ? { text: partPreviewSummary(current), tone: 'value' } : { text: currentEmptyText, tone: currentFailed ? 'error' : 'empty' }

          return (
            <li key={part.key} className={cn(choice === 'generate' ? 'bg-primary/5' : '')}>
              <div className="flex items-start justify-between gap-3 px-3 py-2">
                <button
                  type="button"
                  className="group flex min-w-0 flex-1 items-start gap-1.5 text-left"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  disabled={loading}
                  onClick={() => toggle(part.key)}
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground', expanded ? 'rotate-90' : '')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm text-foreground" title={part.label}>{part.label}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{KIND_LABEL[part.kind]}</span>
                      {pickedVersion !== null ? (
                        <span className="shrink-0 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">V{pickedVersion}</span>
                      ) : null}
                    </span>
                    {!expanded ? (
                      <span
                        className={cn(
                          'mt-0.5 line-clamp-2 break-words text-xs leading-snug',
                          line.tone === 'value' ? 'text-muted-foreground' : '',
                          line.tone === 'empty' ? 'italic text-muted-foreground/80' : '',
                          line.tone === 'generate' ? 'text-primary' : '',
                          line.tone === 'error' ? 'text-destructive' : '',
                        )}
                      >
                        {line.tone === 'generate' ? <Sparkles aria-hidden="true" className="mr-1 inline h-3 w-3 align-[-2px]" /> : null}
                        {line.text}
                      </span>
                    ) : null}
                  </span>
                </button>
                <Select
                  aria-label={`What to do with ${part.label}`}
                  className="h-8 w-40 shrink-0 rounded-lg text-xs"
                  value={value}
                  disabled={disabled || loading}
                  onChange={(event) => {
                    const next = event.target.value
                    const pickedChoice: TemplatePartChoice = next === 'keep' || next === 'generate' ? next : Number(next.slice(1))
                    onChange({ ...choices, [part.key]: pickedChoice })
                  }}
                >
                  <option value="keep" disabled={!keepable.has(part.key)}>
                    {keepable.has(part.key)
                      ? `Keep (V${currentVersion})`
                      : currentFailed ? `Keep (couldn't read V${currentVersion})` : `Keep (empty in V${currentVersion})`}
                  </option>
                  <option value="generate">Regenerate</option>
                  {otherVersions.map((version) => (
                    <option key={version} value={`v${version}`}>From V{version}</option>
                  ))}
                </Select>
              </div>
              {pickedFailed && pickedVersion !== null ? (
                <div className="-mt-1 flex items-center gap-1 px-3 pb-2 pl-9">{retryButton(pickedVersion)}</div>
              ) : null}
              {expanded ? (
                <div id={panelId} className="px-3 pb-3 pl-9">
                  {pickedVersion !== null ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <PreviewBox title={`Now · V${currentVersion}`} preview={current} emptyText={currentEmptyText} tone="current" />
                      <PreviewBox
                        title={`Used · V${pickedVersion}`}
                        preview={picked}
                        emptyText={pickedLoaded
                          ? `Empty in V${pickedVersion}`
                          : pickedFailed ? `Couldn't read V${pickedVersion}` : `Reading V${pickedVersion}…`}
                        tone="used"
                      />
                    </div>
                  ) : choice === 'generate' ? (
                    <PreviewBox
                      title={`Now · V${currentVersion} · replaced by AI`}
                      preview={current}
                      emptyText={currentEmptyText}
                      tone="replaced"
                    />
                  ) : (
                    <PreviewBox title={`Kept · V${currentVersion}`} preview={current} emptyText={currentEmptyText} tone="used" />
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
