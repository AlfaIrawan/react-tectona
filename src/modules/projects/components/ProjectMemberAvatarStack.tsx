import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ProjectMemberAvatar } from '../lib/projectDisplay'

const MEMBER_AVATAR_THEMES = [
  'bg-rose-50 text-rose-700 ring-rose-200/90 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/70',
  'bg-orange-50 text-orange-700 ring-orange-200/90 dark:bg-orange-950/40 dark:text-orange-100 dark:ring-orange-800/70',
  'bg-emerald-50 text-emerald-700 ring-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/70',
  'bg-sky-50 text-sky-700 ring-sky-200/90 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-800/70',
  'bg-violet-50 text-violet-700 ring-violet-200/90 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/70',
  'bg-amber-50 text-amber-800 ring-amber-200/90 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/70',
] as const

function hashLabel(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function memberInitials(name: string): string {
  const normalized = name.trim()
  if (!normalized) return '?'
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

type ProjectMemberAvatarStackProps = {
  members: ProjectMemberAvatar[]
  maxVisible?: number
  className?: string
}

export function ProjectMemberAvatarStack({
  members,
  maxVisible = 4,
  className,
}: ProjectMemberAvatarStackProps) {
  if (members.length === 0) return null

  const visibleMembers = members.slice(0, maxVisible)
  const overflowCount = members.length - visibleMembers.length

  return (
    <div className={cn('flex items-center justify-end', className)}>
      <div className="flex items-center pl-0.5">
        {visibleMembers.map((member, index) => {
          const theme = MEMBER_AVATAR_THEMES[hashLabel(member.name.toLowerCase()) % MEMBER_AVATAR_THEMES.length]
          return (
            <Tooltip key={member.id} content={member.name} side="bottom" size="compact" sideOffset={6}>
              <span
                className={cn(
                  'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase',
                  'ring-2 ring-white transition will-change-transform hover:z-20 hover:scale-105 dark:ring-slate-900',
                  theme,
                  index > 0 && '-ml-2.5',
                )}
                style={{ zIndex: visibleMembers.length - index }}
                aria-label={member.name}
              >
                {memberInitials(member.name)}
              </span>
            </Tooltip>
          )
        })}
        {overflowCount > 0 ? (
          <Tooltip
            content={
              <div className="space-y-0.5">
                {members.slice(maxVisible).map((member) => (
                  <div key={member.id} className="text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                    {member.name}
                  </div>
                ))}
              </div>
            }
            side="bottom"
            size="compact"
            sideOffset={6}
          >
            <span
              className={cn(
                'relative -ml-2.5 inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full',
                'bg-slate-100 px-1.5 text-[10px] font-semibold tabular-nums text-slate-600',
                'ring-2 ring-white transition hover:z-20 hover:scale-105 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-900',
              )}
              style={{ zIndex: 0 }}
              aria-label={`${overflowCount} more members`}
            >
              +{overflowCount}
            </span>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}
