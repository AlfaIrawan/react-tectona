import { cn } from '@/lib/utils'

export type PresenceUiStatus = 'online' | 'away' | 'offline'

export function presenceStatusLabel(status: PresenceUiStatus): string {
  if (status === 'online') return 'Online'
  if (status === 'away') return 'Idle'
  return 'Offline'
}

export function PresenceDot({
  status,
  size = 'md',
  className,
}: {
  status?: PresenceUiStatus
  size?: 'sm' | 'md'
  className?: string
}) {
  if (!status || status === 'offline') return null
  const dim = size === 'sm' ? 'h-2 w-2 ring-[1.5px]' : 'h-2.5 w-2.5 ring-2'
  return (
    <span
      title={presenceStatusLabel(status)}
      aria-label={presenceStatusLabel(status)}
      className={cn(
        'pointer-events-none absolute bottom-0 right-0 z-[1] box-border rounded-full ring-background',
        dim,
        status === 'online' && 'bg-emerald-500',
        status === 'away' && 'bg-amber-400',
        className,
      )}
    />
  )
}
