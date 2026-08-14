import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Pill toolbar — matches Idea & Backlog page header controls. */
export const enterpriseViewControlRailClass =
  'flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-sm flex-nowrap shrink-0'

export const enterpriseViewControlSeparatorClass = 'hidden'

export function enterpriseViewControlButtonClass(active?: boolean) {
  return cn(
    'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm active:scale-95',
    active && 'bg-background text-foreground shadow-sm ring-1 ring-border/50',
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

/** @deprecated Separators removed — rail uses gap spacing like Idea & Backlog. */
export function EnterpriseViewControlSeparator() {
  return null
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
