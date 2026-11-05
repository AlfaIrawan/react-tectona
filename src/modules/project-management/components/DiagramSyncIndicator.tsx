import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function diagramSyncKey(key: string) {
  return ({ 'c4-level-1': 'brainstorm-c4-level-1', 'c4-level-2': 'brainstorm-c4-level-2', 'bpmn-high-level': 'high' } as Record<string, string>)[key] || key
}

export function DiagramSyncIndicator({ status, onRetry }: { status?: string; onRetry?: () => void }) {
  if (!status) return null
  const pending = status === 'pending'
  const synced = status === 'synced'
  const label = synced ? 'Diagram dan dokumen tersinkronisasi' : pending
    ? 'Menyimpan diagram dan memperbarui dokumen' : 'Belum tersinkronisasi. Coba lagi setelah editor dokumen ditutup.'
  const icon = <RefreshCw aria-hidden className={cn('h-4 w-4', pending && 'animate-spin', synced ? 'text-emerald-600' : 'text-amber-600')} />
  return onRetry && !pending && !synced
    ? <button type="button" onClick={onRetry} title={label} aria-label={label} className="shrink-0 rounded p-1 hover:bg-muted">{icon}</button>
    : <span role="status" title={label} aria-label={label} className="inline-flex shrink-0 p-1">{icon}</span>
}
