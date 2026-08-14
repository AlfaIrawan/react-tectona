import { useMemo } from 'react'
import { Bot, Lightbulb, Sparkles } from 'lucide-react'
import type { WorkItemApiModel } from '@/lib/api/workApi'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import type { ProjectTemplate } from '../data/projectTemplates'
import type { Project } from '../store/projectStore'
import {
  buildProjectAssistantBrief,
  type ProjectAssistantAdvice,
} from '../lib/buildProjectMetricsFromWorkItems'

function adviceToneStyles(tone: ProjectAssistantAdvice['tone']) {
  if (tone === 'positive') {
    return {
      card: 'border-emerald-200/70 bg-emerald-50/50',
      dot: 'bg-emerald-500',
    }
  }
  if (tone === 'alert') {
    return {
      card: 'border-amber-200/70 bg-amber-50/50',
      dot: 'bg-amber-500',
    }
  }
  return {
    card: 'border-sky-200/70 bg-sky-50/50',
    dot: 'bg-sky-500',
  }
}

export function ProjectAssistantSidebarCard({
  project,
  template,
  workItems,
  loading,
}: {
  project: Project
  template?: ProjectTemplate
  workItems: WorkItemApiModel[]
  loading?: boolean
}) {
  const brief = useMemo(
    () =>
      buildProjectAssistantBrief(workItems, project.name, {
        template,
        anchorDate: project.createdAt.slice(0, 10),
      }),
    [project.createdAt, project.name, template, workItems],
  )

  return (
    <Card className="mt-2 overflow-hidden border-border/30 shadow-sm">
      <div className="h-[2px] w-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-500" aria-hidden="true" />
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-2.5">
          <div className="rounded-lg border border-indigo-200/70 bg-indigo-50/80 p-1.5">
            <Bot className="h-4 w-4 text-indigo-700" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Tectona Assistant
            </p>
            <p className="text-xs font-semibold text-foreground">AI Project Assistant</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Project insight
            </p>
          </div>
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              <div className="h-3 animate-pulse rounded bg-muted/70" />
              <div className="h-3 w-[92%] animate-pulse rounded bg-muted/60" />
              <div className="h-3 w-[78%] animate-pulse rounded bg-muted/50" />
            </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">{brief.summary}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Assistant advice
            </p>
          </div>
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              <div className="h-14 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-14 animate-pulse rounded-lg bg-muted/40" />
            </div>
          ) : (
            <ul className="space-y-2">
              {brief.advice.map((item) => {
                const styles = adviceToneStyles(item.tone)
                return (
                  <li
                    key={item.title}
                    className={cn(
                      'relative overflow-hidden rounded-lg border px-3 py-2.5',
                      styles.card,
                    )}
                  >
                    <div className={cn('absolute bottom-0 left-0 top-0 w-0.5', styles.dot)} aria-hidden="true" />
                    <p className="pl-1.5 text-[11px] font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 pl-1.5 text-[11px] leading-4 text-muted-foreground">{item.body}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="text-[10px] leading-4 text-muted-foreground/80">
          Live advisory from work items — open Summary for full delivery analytics.
        </p>
      </CardContent>
    </Card>
  )
}
