import type { WorkStatus } from '@/lib/api/workApi'
import type { KanbanBoardColumnId } from '@/lib/work/kanbanCustomBoardColumns'

export type KanbanColumnColorPreset =
  | 'violet'
  | 'slate'
  | 'sky'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'orange'
  | 'fuchsia'
  | 'cyan'

export type KanbanColumnTheme = {
  preset: KanbanColumnColorPreset
  label: string
  swatch: string
  accentBar: string
  columnShell: string
  columnHeader: string
  columnBody: string
  iconWrap: string
  countPill: string
  progressBar: string
}

export const KANBAN_COLUMN_COLOR_PRESETS: Record<KanbanColumnColorPreset, KanbanColumnTheme> = {
  violet: {
    preset: 'violet',
    label: 'Violet',
    swatch: 'bg-violet-500',
    accentBar: 'bg-violet-500',
    columnShell: 'border-violet-200/60 bg-white dark:border-violet-900/50 dark:bg-slate-950',
    columnHeader: 'border-violet-200/50 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/45',
    columnBody: 'bg-violet-50/30 dark:bg-violet-950/20',
    iconWrap: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
    countPill: 'bg-violet-500/10 text-violet-800 ring-violet-500/15 dark:text-violet-200',
    progressBar: 'bg-violet-500',
  },
  slate: {
    preset: 'slate',
    label: 'Slate',
    swatch: 'bg-slate-400',
    accentBar: 'bg-slate-400',
    columnShell: 'border-slate-200/70 bg-white dark:border-slate-700/60 dark:bg-slate-950',
    columnHeader: 'border-slate-200/60 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-900',
    columnBody: 'bg-slate-50/40 dark:bg-slate-950/30',
    iconWrap: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
    countPill: 'bg-slate-500/10 text-slate-700 ring-slate-500/15 dark:text-slate-200',
    progressBar: 'bg-slate-500',
  },
  sky: {
    preset: 'sky',
    label: 'Sky',
    swatch: 'bg-sky-500',
    accentBar: 'bg-sky-500',
    columnShell: 'border-sky-200/60 bg-white dark:border-sky-900/50 dark:bg-slate-950',
    columnHeader: 'border-sky-200/50 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/50',
    columnBody: 'bg-sky-50/30 dark:bg-sky-950/20',
    iconWrap: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
    countPill: 'bg-sky-500/10 text-sky-800 ring-sky-500/15 dark:text-sky-200',
    progressBar: 'bg-sky-500',
  },
  amber: {
    preset: 'amber',
    label: 'Amber',
    swatch: 'bg-amber-500',
    accentBar: 'bg-amber-500',
    columnShell: 'border-amber-200/60 bg-white dark:border-amber-900/50 dark:bg-slate-950',
    columnHeader: 'border-amber-200/50 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/45',
    columnBody: 'bg-amber-50/30 dark:bg-amber-950/20',
    iconWrap: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
    countPill: 'bg-amber-500/10 text-amber-800 ring-amber-500/15 dark:text-amber-200',
    progressBar: 'bg-amber-500',
  },
  emerald: {
    preset: 'emerald',
    label: 'Emerald',
    swatch: 'bg-emerald-500',
    accentBar: 'bg-emerald-500',
    columnShell: 'border-emerald-200/60 bg-white dark:border-emerald-900/50 dark:bg-slate-950',
    columnHeader: 'border-emerald-200/50 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/45',
    columnBody: 'bg-emerald-50/30 dark:bg-emerald-950/20',
    iconWrap: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
    countPill: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/15 dark:text-emerald-200',
    progressBar: 'bg-emerald-500',
  },
  rose: {
    preset: 'rose',
    label: 'Rose',
    swatch: 'bg-rose-500',
    accentBar: 'bg-rose-500',
    columnShell: 'border-rose-200/60 bg-white dark:border-rose-900/50 dark:bg-slate-950',
    columnHeader: 'border-rose-200/50 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/45',
    columnBody: 'bg-rose-50/30 dark:bg-rose-950/20',
    iconWrap: 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300',
    countPill: 'bg-rose-500/10 text-rose-800 ring-rose-500/15 dark:text-rose-200',
    progressBar: 'bg-rose-500',
  },
  orange: {
    preset: 'orange',
    label: 'Orange',
    swatch: 'bg-orange-500',
    accentBar: 'bg-orange-500',
    columnShell: 'border-orange-200/60 bg-white dark:border-orange-900/50 dark:bg-slate-950',
    columnHeader: 'border-orange-200/50 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/45',
    columnBody: 'bg-orange-50/30 dark:bg-orange-950/20',
    iconWrap: 'bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:text-orange-300',
    countPill: 'bg-orange-500/10 text-orange-800 ring-orange-500/15 dark:text-orange-200',
    progressBar: 'bg-orange-500',
  },
  fuchsia: {
    preset: 'fuchsia',
    label: 'Fuchsia',
    swatch: 'bg-fuchsia-500',
    accentBar: 'bg-fuchsia-500',
    columnShell: 'border-fuchsia-200/60 bg-white dark:border-fuchsia-900/50 dark:bg-slate-950',
    columnHeader: 'border-fuchsia-200/50 bg-fuchsia-50 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/45',
    columnBody: 'bg-fuchsia-50/30 dark:bg-fuchsia-950/20',
    iconWrap: 'bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/20 dark:text-fuchsia-300',
    countPill: 'bg-fuchsia-500/10 text-fuchsia-800 ring-fuchsia-500/15 dark:text-fuchsia-200',
    progressBar: 'bg-fuchsia-500',
  },
  cyan: {
    preset: 'cyan',
    label: 'Cyan',
    swatch: 'bg-cyan-500',
    accentBar: 'bg-cyan-500',
    columnShell: 'border-cyan-200/60 bg-white dark:border-cyan-900/50 dark:bg-slate-950',
    columnHeader: 'border-cyan-200/50 bg-cyan-50 dark:border-cyan-900/40 dark:bg-cyan-950/45',
    columnBody: 'bg-cyan-50/30 dark:bg-cyan-950/20',
    iconWrap: 'bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300',
    countPill: 'bg-cyan-500/10 text-cyan-800 ring-cyan-500/15 dark:text-cyan-200',
    progressBar: 'bg-cyan-500',
  },
}

export const KANBAN_COLUMN_COLOR_OPTIONS = Object.values(KANBAN_COLUMN_COLOR_PRESETS)

const DEFAULT_STATUS_COLOR: Record<WorkStatus, KanbanColumnColorPreset> = {
  Backlog: 'violet',
  'To Do': 'slate',
  'In Progress': 'sky',
  'In Review': 'amber',
  Done: 'emerald',
}

export type KanbanBoardColumnColors = Partial<Record<string, KanbanColumnColorPreset>>

export function defaultColorPresetForColumn(columnId: KanbanBoardColumnId): KanbanColumnColorPreset {
  if (isWorkStatusColumn(columnId)) return DEFAULT_STATUS_COLOR[columnId]
  return 'slate'
}

function isWorkStatusColumn(columnId: KanbanBoardColumnId): columnId is WorkStatus {
  return columnId in DEFAULT_STATUS_COLOR
}

export function resolveKanbanColumnTheme(
  columnId: KanbanBoardColumnId,
  columnColors: KanbanBoardColumnColors = {},
): KanbanColumnTheme {
  const preset = columnColors[columnId] ?? defaultColorPresetForColumn(columnId)
  return KANBAN_COLUMN_COLOR_PRESETS[preset]
}

/** Random preset for a new board — prefers colors not already used on this project board. */
export function pickRandomKanbanColumnColor(
  usedPresets: KanbanColumnColorPreset[] = [],
): KanbanColumnColorPreset {
  const all = KANBAN_COLUMN_COLOR_OPTIONS.map((option) => option.preset)
  const unused = all.filter((preset) => !usedPresets.includes(preset))
  const pool = unused.length > 0 ? unused : all
  return pool[Math.floor(Math.random() * pool.length)]!
}
