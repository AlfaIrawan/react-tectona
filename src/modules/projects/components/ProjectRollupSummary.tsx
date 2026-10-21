import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkItemApiModel } from '@/lib/api/workApi'
import { summarizeWorkItems, type SubProjectEntry, type WorkItemSummary } from '../lib/subProjects'
import type { Project } from '../store/projectStore'

export type RollupScope = 'all' | 'self'

type SourceRow = {
  id: string
  name: string
  kind: 'self' | 'sub'
  idea: string
  summary: WorkItemSummary
}

function healthLabel(summary: WorkItemSummary): { label: string; className: string } {
  if (summary.overdue > 1) return { label: 'At risk', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  if (summary.overdue === 1) return { label: 'Watch', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  return { label: 'On track', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
}

/**
 * Program view on the Summary: which part of the program the numbers come from, and a switch
 * between "this project only" and "include sub-projects". The dashboard below it is the same
 * Summary dashboard every project has; only its input changes with the scope.
 */
export function ProjectRollupSummary({
  project,
  ownWorkItems,
  ownIdeaCount,
  entries,
  loading,
  scope,
  onScopeChange,
}: {
  project: Project
  ownWorkItems: WorkItemApiModel[]
  ownIdeaCount: number
  entries: SubProjectEntry[]
  loading?: boolean
  scope: RollupScope
  onScopeChange: (scope: RollupScope) => void
}) {
  const navigate = useNavigate()
  const rows: SourceRow[] = [
    {
      id: project.id,
      name: project.name,
      kind: 'self',
      idea: ownIdeaCount === 1 ? '1 idea' : `${ownIdeaCount} ideas`,
      summary: summarizeWorkItems(ownWorkItems),
    },
    ...(scope === 'all'
      ? entries.map((entry) => ({
          id: entry.project.id,
          name: entry.project.name,
          kind: 'sub' as const,
          idea: entry.idea?.title ?? 'No idea linked yet',
          summary: entry.summary,
        }))
      : []),
  ]

  return (
    <section className="space-y-3" aria-labelledby="program-rollup-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Program roll-up</p>
          <h2 id="program-rollup-heading" className="text-sm text-muted-foreground">
            {scope === 'all'
              ? `${project.name} plus ${entries.length} sub-project${entries.length === 1 ? '' : 's'}`
              : `${project.name} only — sub-projects excluded`}
          </h2>
        </div>
        <div role="group" aria-label="Summary scope" className="inline-flex gap-1 rounded-xl bg-muted/60 p-1">
          {(
            [
              ['all', 'Include sub-projects'],
              ['self', 'This project only'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => onScopeChange(value)}
              className={cn(
                'min-h-9 rounded-lg px-3 text-xs font-semibold transition',
                scope === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/50 bg-background/80">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Idea</th>
              <th className="px-4 py-3">Work items</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">In review</th>
              <th className="px-4 py-3">Overdue</th>
              <th className="px-4 py-3">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const health = healthLabel(row.summary)
              return (
                <tr key={row.id} className="border-t border-border/40">
                  <td className="px-4 py-3">
                    {row.kind === 'sub' ? (
                      <button
                        type="button"
                        className="text-left font-semibold text-foreground hover:text-primary hover:underline"
                        onClick={() => navigate(`/projects/${row.id}`)}
                      >
                        {row.name}
                      </button>
                    ) : (
                      <span className="font-semibold text-foreground">{row.name}</span>
                    )}
                    <div className="mt-0.5">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          row.kind === 'sub'
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600',
                        )}
                      >
                        {row.kind === 'sub' ? 'Sub-project' : 'This project'}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground" title={row.idea}>
                    {row.idea}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{row.summary.total}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${row.summary.donePct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{row.summary.donePct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{row.summary.inReview}</td>
                  <td className={cn('px-4 py-3 font-semibold', row.summary.overdue > 0 ? 'text-rose-600' : 'text-foreground')}>
                    {row.summary.overdue}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', health.className)}>
                      {health.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {loading && scope === 'all' ? (
              <tr className="border-t border-border/40">
                <td colSpan={7} className="px-4 py-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading sub-projects…
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
