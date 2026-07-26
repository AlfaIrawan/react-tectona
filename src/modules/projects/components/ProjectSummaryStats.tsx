import { Activity, Database, Brain, Server, Clock } from 'lucide-react'

interface ProjectSummaryStatsProps {
  trainingRuns?: number
  datasets?: number
  trainers?: number
  computes?: number
  lastActivity?: string | null
}

/**
 * ProjectSummaryStats - Informational summary component for Project Detail Page
 * 
 * This is a READ-ONLY informational component. It does NOT provide any actions or capabilities.
 * All values are static/mock for visualization purposes only.
 * 
 * Scope: Module 2 - Projects & Workspace (non-operational)
 */
export function ProjectSummaryStats({
  trainingRuns = 0,
  datasets = 0,
  trainers = 0,
  computes = 0,
  lastActivity = null,
}: ProjectSummaryStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Datasets */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-0.5">Datasets</p>
            <p className="text-xl font-semibold text-foreground">{datasets}</p>
          </div>
        </div>
      </div>

      {/* Trainers */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <Brain className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-0.5">Trainers</p>
            <p className="text-xl font-semibold text-foreground">{trainers}</p>
          </div>
        </div>
      </div>

      {/* Compute */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-green-500/10">
            <Server className="w-4 h-4 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-0.5">Compute</p>
            <p className="text-xl font-semibold text-foreground">{computes}</p>
          </div>
        </div>
      </div>

      {/* Training Runs */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-0.5">Training Runs</p>
            <p className="text-xl font-semibold text-foreground">{trainingRuns}</p>
          </div>
        </div>
      </div>

      {/* Last Activity */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-muted/30">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-0.5">Last Activity</p>
            <p className="text-xl font-semibold text-foreground">
              {lastActivity || '–'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
