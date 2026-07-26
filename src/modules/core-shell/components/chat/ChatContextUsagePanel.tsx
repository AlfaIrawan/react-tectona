import { useMemo } from 'react'

import type { ContextUsageReport } from '@/lib/api/tectonaAgentRuntimeApi'
import { formatTokenCount } from '@/lib/chat/contextUsageFormat'

interface ChatContextUsagePanelProps {
  report: ContextUsageReport
  onClose: () => void
}

export function ChatContextUsagePanel({ report, onClose }: ChatContextUsagePanelProps) {
  const usageLabel = `${Math.round(report.usage_percent)}% Full`
  const tokenSummary = `~${formatTokenCount(report.estimated_tokens)} / ${formatTokenCount(report.max_tokens)} Tokens`

  const segments = useMemo(
    () => report.categories.filter((item) => item.share_percent > 0),
    [report.categories],
  )
  const filledWidth = Math.max(0, Math.min(100, report.usage_percent))

  return (
    <div
      className="w-full rounded-xl border border-border bg-popover p-4 shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
      role="dialog"
      aria-label="Context Usage"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Context Usage</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Estimated prompt sent to the agent</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{usageLabel}</span>
        <span>{tokenSummary}</span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="flex h-full" style={{ width: `${filledWidth}%` }}>
          {segments.map((item) => (
            <div
              key={item.key}
              title={`${item.label}: ${formatTokenCount(item.tokens)}`}
              style={{
                width: `${item.share_percent}%`,
                backgroundColor: item.color,
                minWidth: item.share_percent > 0 ? '2px' : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {report.categories.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatTokenCount(item.tokens)}</span>
          </li>
        ))}
      </ul>

      {report.level !== 'ok' && (
        <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {report.level === 'reached'
            ? 'Context limit reached — start a new chat to continue with a handoff summary.'
            : 'This conversation is getting long — consider a new chat before responses are truncated.'}
        </p>
      )}
    </div>
  )
}
