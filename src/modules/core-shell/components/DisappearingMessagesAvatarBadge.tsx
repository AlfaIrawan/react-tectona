import { Timer } from 'lucide-react'

import { cn } from '@/lib/utils'

type BadgeSize = 'sm' | 'md' | 'lg' | 'xl'

const BOX: Record<BadgeSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-5 w-5',
  xl: 'h-8 w-8',
}

const ICON: Record<BadgeSize, string> = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
}

/** Timer overlay when disappearing messages is enabled for a chat. */
export function DisappearingMessagesAvatarBadge({
  size = 'md',
  className,
}: {
  size?: BadgeSize
  className?: string
}) {
  return (
    <span
      title="Disappearing messages on"
      aria-label="Disappearing messages on"
      className={cn(
        'pointer-events-none absolute -bottom-px -right-px z-[2] flex items-center justify-center rounded-full',
        'border border-dashed border-[#8696a0] bg-white shadow-[0_1px_2px_rgba(11,20,26,0.12)]',
        'outline outline-2 outline-dashed outline-background',
        'dark:border-[#8696a0] dark:bg-[#202c33] dark:outline-[#0b141a] dark:shadow-none',
        BOX[size],
        className,
      )}
    >
      <Timer
        className={cn('text-[#54656f] dark:text-[#aebac1]', ICON[size])}
        strokeWidth={2.25}
        aria-hidden
      />
    </span>
  )
}
