import * as React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePickerPopup } from './date-picker-popup'

export interface DatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const formatDisplay = (iso: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso + 'T12:00:00')
    if (isNaN(d.getTime())) return ''
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  const displayValue = formatDisplay(value)

  return (
    <>
      <div className={cn('relative', className)}>
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          readOnly
          placeholder={placeholder}
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-slate-200/80 dark:border-slate-600/50',
            'bg-white dark:bg-slate-800/50 pl-9 pr-2 py-2 text-xs text-slate-700 dark:text-slate-300',
            'focus:outline-none focus:ring-2 focus:ring-primary/20',
            'cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>
      <DatePickerPopup
        value={value}
        onChange={onChange}
        open={open}
        onOpenChange={setOpen}
        anchorEl={inputRef.current}
      />
    </>
  )
}
