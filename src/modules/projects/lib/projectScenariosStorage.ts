import type { ProjectScenarioPersistedState } from './projectScenariosTypes'

const STORAGE_KEY = 'tectona_project_scenarios_v1'

function readAll(): Record<string, ProjectScenarioPersistedState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ProjectScenarioPersistedState>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, ProjectScenarioPersistedState>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadProjectScenarioState(projectId: string): ProjectScenarioPersistedState | null {
  const entry = readAll()[projectId]
  return entry?.analysis ? entry : null
}

export function saveProjectScenarioState(state: ProjectScenarioPersistedState): void {
  const all = readAll()
  all[state.project_id] = state
  writeAll(all)
}

export function clearProjectScenarioState(projectId: string): void {
  const all = readAll()
  delete all[projectId]
  writeAll(all)
}

export function updateScenarioCatalogItem(
  projectId: string,
  scenarioId: string,
  patch: Partial<ProjectScenarioPersistedState['analysis']['catalog'][number]>,
): ProjectScenarioPersistedState | null {
  const current = loadProjectScenarioState(projectId)
  if (!current) return null

  const catalog = current.analysis.catalog.map((item) =>
    item.id === scenarioId ? { ...item, ...patch } : item,
  )
  const plan_domains = current.analysis.plan_domains.map((domain) => ({
    ...domain,
    groups: domain.groups.map((group) => ({
      ...group,
      scenarios: group.scenarios.map((scenario) =>
        scenario.id === scenarioId ? { ...scenario, ...patch } : scenario,
      ),
    })),
  }))

  const next: ProjectScenarioPersistedState = {
    ...current,
    analysis: {
      ...current.analysis,
      catalog,
      plan_domains,
    },
  }
  saveProjectScenarioState(next)
  return next
}
