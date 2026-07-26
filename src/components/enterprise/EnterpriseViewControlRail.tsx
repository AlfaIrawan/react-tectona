import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Pill toolbar chrome — matches Workspace Management page header controls. */
export const enterpriseViewControlRailClass =
  'flex items-center gap-px rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-[0_2px_12px_rgba(15,23,42,0.07)] ring-1 ring-white/60 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/70 dark:ring-slate-700/30'

export const enterpriseViewControlSeparatorClass =
  'h-5 w-px bg-slate-200/70 dark:bg-slate-700/60'

export function enterpriseViewControlButtonClass(active?: boolean) {
  return cn(
    'group relative flex items-center justify-center rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
    active &&
      'bg-sky-50 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(37,99,235,0.18)] hover:bg-sky-50 hover:text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
  )
}

export function EnterpriseViewControlRail({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(enterpriseViewControlRailClass, className)}>{children}</div>
}

export function EnterpriseViewControlSeparator() {
  return <div className={enterpriseViewControlSeparatorClass} aria-hidden />
}

export function EnterpriseViewControlButton({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(enterpriseViewControlButtonClass(active), className)}
      {...props}
    />
  )
}
