import { useMemo, useRef } from 'react'
import { CalendarSearch, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SearchableChatMessage = {
  id: string
  role: string
  text?: string
  at: number
}

type TeamChatSearchMessagesPanelProps = {
  contactLabel: string
  query: string
  onQueryChange: (value: string) => void
  messages: SearchableChatMessage[]
  onSelectResult: (messageId: string) => void
  onDateSearch?: () => void
}

function startOfLocalDayMs(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatChatSearchResultTimestamp(ts: number): string {
  try {
    const msgDay = startOfLocalDayMs(ts)
    const todayStart = startOfLocalDayMs(Date.now())
    const dayMs = 86_400_000
    if (msgDay === todayStart) {
      return new Date(ts).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }
    if (msgDay >= todayStart - 7 * dayMs) {
      return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' })
    }
    return new Date(ts).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function truncateAroundMatch(text: string, query: string, maxLen = 96): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLen) return trimmed
  const q = query.trim()
  if (!q) return `${trimmed.slice(0, maxLen)}…`
  const idx = trimmed.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return `${trimmed.slice(0, maxLen)}…`
  const half = Math.floor(maxLen / 2)
  const start = Math.max(0, idx - half)
  const slice = trimmed.slice(start, start + maxLen)
  const prefix = start > 0 ? '…' : ''
  const suffix = start + maxLen < trimmed.length ? '…' : ''
  return `${prefix}${slice}${suffix}`
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  const display = truncateAroundMatch(text, q)
  if (!q) {
    return <span className="line-clamp-2 text-[14px] leading-snug text-foreground">{display}</span>
  }
  const parts = display.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'))
  return (
    <span className="line-clamp-2 text-[14px] leading-snug text-foreground">
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <span key={`${part}-${i}`} className="font-semibold text-[#008069] dark:text-[#25d366]">
            {part}
          </span>
        ) : (
          <span key={`${part}-${i}`}>{part}</span>
        ),
      )}
    </span>
  )
}

export function TeamChatSearchMessagesPanel({
  contactLabel,
  query,
  onQueryChange,
  messages,
  onSelectResult,
  onDateSearch,
}: TeamChatSearchMessagesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmedQuery = query.trim()

  const results = useMemo(() => {
    if (!trimmedQuery) return []
    const q = trimmedQuery.toLowerCase()
    return messages
      .filter((m) => m.role !== 'system' && (m.text?.trim() ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.at - a.at)
  }, [messages, trimmedQuery])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 px-3 pb-3 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Search by date"
          onClick={onDateSearch}
        >
          <CalendarSearch className="h-5 w-5" aria-hidden />
        </Button>
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-full border bg-[#f0f2f5] px-3 py-1.5 transition-colors dark:bg-[#202c33]',
            'border-transparent focus-within:border-[#008069] focus-within:bg-white dark:focus-within:border-[#25d366] dark:focus-within:bg-[#2a3942]',
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-[#8696a0]" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search"
            autoComplete="off"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[#8696a0] [appearance:textfield] [&::-ms-clear]:hidden"
            aria-label="Search messages in this chat"
          />
          {query.length > 0 ? (
            <button
              type="button"
              className="shrink-0 rounded-full p-0.5 text-[#8696a0] hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              aria-label="Clear search"
              onClick={() => {
                onQueryChange('')
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {trimmedQuery.length === 0 ? (
          <p className="px-6 py-16 text-center text-[14px] leading-relaxed text-[#8696a0]">
            Search for messages with {contactLabel}.
          </p>
        ) : results.length === 0 ? (
          <p className="px-6 py-16 text-center text-[14px] leading-relaxed text-[#8696a0]">
            No messages found.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {results.map((m) => {
              const body = m.text?.trim() ?? ''
              if (!body) return null
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted/70"
                    onClick={() => onSelectResult(m.id)}
                  >
                    <span className="text-[12px] text-[#8696a0]">
                      {formatChatSearchResultTimestamp(m.at)}
                    </span>
                    <HighlightedSnippet text={body} query={trimmedQuery} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
