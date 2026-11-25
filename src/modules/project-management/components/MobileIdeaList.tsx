import { ChevronRight, FileText, Lightbulb, MessageSquare, RefreshCw, SearchX, Wrench } from 'lucide-react'
import type { CSSProperties } from 'react'

export interface MobileIdeaItem {
  id: string
  title: string
  description: string
  type: string
  status: string
  createdAt: string
  cardAccentColor?: string | null
}
interface Props<T extends MobileIdeaItem> {
  items: T[]
  filtered: boolean
  onOpen: (idea: T) => void
  owner: (idea: T) => string
  onReset: () => void
  onCreate: () => void
}

const typeAppearance = {
  Innovation: { icon: Lightbulb, color: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  Improvement: { icon: Wrench, color: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  Request: { icon: MessageSquare, color: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200' },
  Transformation: { icon: RefreshCw, color: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200' },
}

function statusDot(status: string) {
  if (status === 'Approved' || status === 'Converted to Project') return 'bg-emerald-500'
  if (status === 'Rejected') return 'bg-red-500'
  if (status === 'Under Review') return 'bg-amber-500'
  return 'bg-sky-500'
}

function displayDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function MobileIdeaList<T extends MobileIdeaItem>({ items, filtered, onOpen, owner, onReset, onCreate }: Props<T>) {
  if (!items.length) {
    const Icon = filtered ? SearchX : FileText
    return <div className="flex flex-col items-center gap-3 py-12 text-center" role="status"><Icon className="h-8 w-8 text-muted-foreground" /><h3 className="text-base font-semibold">{filtered ? 'No matching ideas' : 'No ideas yet'}</h3><button type="button" className="min-h-11 rounded-md border bg-background px-4 text-sm font-medium" onClick={filtered ? onReset : onCreate}>{filtered ? 'Reset search and filters' : 'Create Idea'}</button></div>
  }
  return <ul className="space-y-3" aria-label="Ideas">
    {items.map((idea) => {
      const appearance = typeAppearance[idea.type as keyof typeof typeAppearance] ?? typeAppearance.Request
      const Icon = appearance.icon
      const ownerName = owner(idea)
      const accent = idea.cardAccentColor ?? '#94a3b8'
      const initials = ownerName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase()
      return <li key={idea.id}>
        <button type="button" onClick={() => onOpen(idea)} style={{ '--idea-card-accent': accent, borderRight: `4px solid ${accent}` } as CSSProperties} className="liquid-glass-idea-card group block w-full min-w-0 rounded-lg border p-4 text-left text-card-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium leading-4 ${appearance.color}`}><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{idea.type}</span>
            <span className="inline-flex min-h-6 items-center gap-1.5 text-xs font-medium text-muted-foreground"><span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(idea.status)}`} />{idea.status}</span>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <h3 className="min-w-0 flex-1 break-words text-base font-semibold leading-6">{idea.title}</h3>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground group-hover:text-primary"><ChevronRight className="h-4 w-4" aria-hidden /></span>
          </div>
          <p className="mt-2 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">{idea.description}</p>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">{initials}</span><span className="min-w-0 truncate" title={ownerName}>{ownerName}</span></span>
            <time className="shrink-0 tabular-nums" dateTime={idea.createdAt}>{displayDate(idea.createdAt)}</time>
          </div>
        </button>
      </li>
    })}
  </ul>
}
