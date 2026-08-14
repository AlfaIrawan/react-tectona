import { useId, useMemo, useState } from 'react'
import { CornerDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AssistantChoiceGroupProps = {
  options: string[]
  /** single = pick one; multiple = pick many (only when autoSubmitOnPick is false). */
  mode: 'single' | 'multiple'
  onSubmit?: (labels: string[], mode: 'single' | 'multiple') => void
  className?: string
  /** Picking an option immediately continues the conversation (default: true). */
  autoSubmitOnPick?: boolean
  /** inline = natural chat list; card = legacy boxed panel. */
  variant?: 'inline' | 'card'
  /** Show frozen selection after user already answered. */
  readOnly?: boolean
  selectedLabels?: string[]
}

export function AssistantChoiceGroup({
  options,
  mode,
  onSubmit,
  className,
  autoSubmitOnPick = true,
  variant = 'inline',
  readOnly = false,
  selectedLabels = [],
}: AssistantChoiceGroupProps) {
  const groupId = useId()
  const [singleValue, setSingleValue] = useState<string | null>(null)
  const [multiValues, setMultiValues] = useState<Set<string>>(() => new Set())

  const resolvedMode = mode === 'single' || options.length === 1 ? 'single' : 'multiple'

  const selected = useMemo(() => {
    if (readOnly) return new Set(selectedLabels)
    if (resolvedMode === 'single') return new Set(singleValue ? [singleValue] : [])
    return multiValues
  }, [readOnly, resolvedMode, selectedLabels, singleValue, multiValues])

  if (options.length === 0) return null

  const pillMode =
    !readOnly &&
    autoSubmitOnPick &&
    options.length >= 2 &&
    options.length <= 4 &&
    options.every((label) => label.trim().length > 0 && label.trim().length <= 56)

  if (pillMode && onSubmit) {
    return (
      <div className={cn('mt-2 flex flex-col gap-1.5', className)}>
        {options.map((label, idx) => (
          <button
            key={`${label}-${idx}`}
            type="button"
            onClick={() => onSubmit([label], 'single')}
            className={cn(
              'inline-flex w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5',
              'text-left text-sm font-medium text-slate-800 transition-colors',
              'hover:border-[#008069]/35 hover:bg-[#e7f8f0] dark:border-[#3b4a54] dark:bg-[#1f2c34] dark:text-[#e9edef]',
              'dark:hover:border-[#00a884]/40 dark:hover:bg-[#0b3329]/60',
            )}
          >
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    )
  }

  const pickOne = (label: string) => {
    if (readOnly) return
    if (resolvedMode === 'single') {
      setSingleValue(label)
      if (autoSubmitOnPick && onSubmit) {
        onSubmit([label], 'single')
      }
      return
    }
    const next = new Set(multiValues)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    setMultiValues(next)
    if (autoSubmitOnPick && onSubmit && next.size > 0) {
      onSubmit([...next], 'multiple')
    }
  }

  const listClass =
    variant === 'card'
      ? cn(
          'mt-3 rounded-lg border border-[#d1d7db] bg-[#f0f2f5]/80 p-2 dark:border-[#3b4a54] dark:bg-[#1f2c34]/60',
          className,
        )
      : cn('mt-2', className)

  return (
    <div
      className={listClass}
      role={resolvedMode === 'single' ? 'radiogroup' : 'group'}
      aria-label={resolvedMode === 'single' ? 'Select one option' : 'Select one or more options'}
    >
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {options.map((label, idx) => {
          const inputId = `${groupId}-opt-${idx}`
          const checked = selected.has(label)
          const inputType =
            resolvedMode === 'single' && !readOnly ? 'radio' : 'checkbox'

          return (
            <li key={`${label}-${idx}`} className="m-0 p-0">
              <label
                htmlFor={readOnly ? undefined : inputId}
                className={cn(
                  'flex items-start gap-2 rounded-md px-0.5 py-1 transition-colors',
                  readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                  checked && !readOnly && 'bg-[#e7f8f0]/60 dark:bg-[#0b3329]/30',
                )}
              >
                <input
                  id={inputId}
                  type={inputType}
                  name={resolvedMode === 'single' ? groupId : undefined}
                  checked={checked}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={() => pickOne(label)}
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-[#008069]',
                    'focus-visible:ring-2 focus-visible:ring-[#008069]/40 focus-visible:ring-offset-0',
                    inputType === 'radio' ? 'rounded-full' : 'rounded-[4px]',
                    readOnly && 'opacity-80',
                  )}
                />
                <span className="min-w-0 flex-1 text-left text-sm leading-snug text-[#111b21] dark:text-[#e9edef]">
                  {label}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
