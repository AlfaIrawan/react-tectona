import { Circle } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useWorkOfflineStatus } from '@/lib/work/offline/useWorkOfflineStatus'

import { formatWorkSyncRelative, formatWorkSyncTimestamp } from '@/lib/work/offline/formatWorkSyncTime'

import { requestOpenWorkSyncConflicts } from '@/lib/work/offline/workOfflineClient'

import { Tooltip } from '@/components/ui/tooltip'



function buildTooltip(status: ReturnType<typeof useWorkOfflineStatus>): string {

  const parts: string[] = []

  if (!status.isOnline) {

    parts.push('Work service unreachable or no network — edits are saved locally and queued to sync.')

  } else {

    parts.push('Connected to the work service.')

  }

  if (status.pendingCount > 0) {

    if (status.isOnline) {

      parts.push(`${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} queued — retrying sync every ~15s.`)

    } else {

      parts.push(`${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} waiting to sync when the service is back.`)

    }

  }

  if (status.conflictCount > 0) {

    parts.push(`${status.conflictCount} sync conflict${status.conflictCount === 1 ? '' : 's'} — click badge to resolve.`)

  }

  if (status.lastSyncedAt) {

    parts.push(

      `Last synced ${formatWorkSyncRelative(status.lastSyncedAt)} (${formatWorkSyncTimestamp(status.lastSyncedAt)}).`,

    )

  }

  if (status.isOnline && status.realtimeConnected) {

    parts.push('Live updates active (WebSocket).')

  } else if (status.isOnline && !status.realtimeConnected) {

    parts.push('Live updates reconnecting…')

  }

  return parts.join(' ')

}



export function DataConnectivityBadge() {

  const status = useWorkOfflineStatus()

  const isOffline = !status.isOnline

  const hasSyncIssue = status.pendingCount > 0 || status.conflictCount > 0

  const label = isOffline ? 'Offline' : 'Online'



  const dotClass = isOffline

    ? 'text-amber-500 fill-amber-500'

    : status.conflictCount > 0

      ? 'text-rose-500 fill-rose-500'

      : status.pendingCount > 0

        ? 'text-sky-500 fill-sky-500'

        : 'text-green-500 fill-green-500'



  const detail =

    !isOffline && hasSyncIssue

      ? [

          status.pendingCount > 0 ? `${status.pendingCount} pending` : null,

          status.conflictCount > 0 ? `${status.conflictCount} conflict` : null,

        ]

          .filter(Boolean)

          .join(' · ')

      : null



  const handleClick = () => {

    if (status.conflictCount > 0) {

      void requestOpenWorkSyncConflicts()

    }

  }



  const badge = (

    <button

      type="button"

      className={cn(

        'environment-indicator flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-sm',

        status.conflictCount > 0 && 'cursor-pointer hover:border-rose-300/80',

      )}

      aria-live="polite"

      aria-label={`Data ${label.toLowerCase()}${detail ? `, ${detail}` : ''}`}

      onClick={handleClick}

      disabled={status.conflictCount === 0}

    >

      <Circle className={cn('h-2 w-2 shrink-0', dotClass)} aria-hidden />

      <span className="text-xs font-medium text-slate-800">{label}</span>

      {detail ? (

        <span className="text-[10px] font-medium text-slate-500 hidden md:inline">{detail}</span>

      ) : null}

    </button>

  )



  return (

    <Tooltip content={buildTooltip(status)} side="bottom" size="compact">

      {badge}

    </Tooltip>

  )

}


