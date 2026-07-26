import { type ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

export interface EnterpriseNavRailItem<T extends string = string> {
  id: T
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
}

type EnterpriseNavIconRailProps<T extends string> = {
  items: Array<EnterpriseNavRailItem<T>>
  activeId: T
  onSelect: (id: T) => void
  className?: string
  /** `pill` = wrapper bulat (float rail); `plain` = ikon langsung di panel sidebar. */
  variant?: 'pill' | 'plain'
}

/** Icon rail minimize — `plain` untuk sidebar docked; `pill` untuk float rail. */
export function EnterpriseNavIconRail<T extends string>({
  items,
  activeId,
  onSelect,
  className,
  variant = 'plain',
}: EnterpriseNavIconRailProps<T>) {
  if (items.length === 0) return null

  const iconButtons = items.map((panel) => {
    const Icon = panel.icon
    const active = panel.id === activeId
    return (
      <Tooltip key={panel.id} content={panel.label} side="right" sideOffset={14} size="compact">
        <button
          type="button"
          onClick={() => onSelect(panel.id)}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
            active
              ? 'border-sky-300/90 bg-sky-50 text-sky-700 shadow-[0_8px_20px_-12px_rgba(14,165,233,0.5)] ring-2 ring-sky-400/20 dark:border-sky-700/50 dark:bg-sky-950/55 dark:text-sky-200'
              : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200/80 hover:bg-slate-50/95 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-900/80 dark:hover:text-slate-100'
          )}
          aria-label={panel.label}
          aria-current={active ? 'page' : undefined}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.9} />
        </button>
      </Tooltip>
    )
  })

  if (variant === 'pill') {
    return (
      <div className={cn('flex w-full justify-center', className)}>
        <div
          className={cn(
            'flex max-h-full flex-col items-center gap-1.5 overflow-y-auto rounded-full border border-slate-200/75 p-1.5',
            'bg-white/92 shadow-[0_2px_8px_rgba(15,23,42,0.05),0_12px_28px_-10px_rgba(15,23,42,0.12)]',
            'ring-1 ring-slate-900/[0.04] backdrop-blur-md',
            'dark:border-slate-700/60 dark:bg-slate-950/88 dark:ring-white/[0.06]',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {iconButtons}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex max-h-full w-full flex-col items-center gap-1.5 overflow-y-auto',
        '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {iconButtons}
    </div>
  )
}
