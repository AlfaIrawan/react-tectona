type WorkspaceStatus = 'Active' | 'At Risk' | 'Archived'
type WorkspaceHealthBand = 'Healthy' | 'At Risk' | 'Critical'

type WorkspaceChatSummaryWorkspace = {
  name: string
  status: WorkspaceStatus
  healthBand: WorkspaceHealthBand
  // Per-workspace governance signals so the assistant can analyse "why At Risk"
  // concretely (owner present? compliance? governance configured?) instead of guessing.
  owner?: string
  compliance?: string
  governance?: string
}

type WorkspaceHealthDistributionItem = {
  name: string
  value: number
}

type BuildWorkspaceChatDataSummaryArgs = {
  workspaceOrgBackendConnected: boolean
  workspaces: WorkspaceChatSummaryWorkspace[]
  statusCounts: Map<string, number>
  governanceHealthDistribution: WorkspaceHealthDistributionItem[]
  maxLength?: number
}

const DEFAULT_MAX_LENGTH = 1800
const BACKEND_DISCONNECTED_MESSAGE =
  'Backend workspace-org belum terhubung - angka portfolio workspace belum tersedia di layar ini.'

function buildWorkspaceDirectorySegment(
  workspaces: WorkspaceChatSummaryWorkspace[],
  maxLength: number,
): string {
  if (workspaces.length === 0) return ''

  const prefix = ' Workspace terdaftar pada layar: '
  let body = ''
  let included = 0

  for (const workspace of workspaces) {
    const extras: string[] = []
    if (workspace.owner && workspace.owner.trim()) extras.push(`owner=${workspace.owner.trim()}`)
    if (workspace.compliance && workspace.compliance.trim()) extras.push(`compliance=${workspace.compliance.trim()}`)
    if (workspace.governance && workspace.governance.trim()) extras.push(`governance=${workspace.governance.trim()}`)
    const extraStr = extras.length > 0 ? `, ${extras.join(', ')}` : ''
    const entry = `${workspace.name} [status=${workspace.status}, health=${workspace.healthBand}${extraStr}]`
    const candidate = included === 0 ? entry : `${body}, ${entry}`
    if ((prefix.length + candidate.length) > maxLength) break
    body = candidate
    included += 1
  }

  if (included === 0) return ''

  const omitted = workspaces.length - included
  if (omitted <= 0) return `${prefix}${body}.`

  const suffix = `, +${omitted} workspace lainnya.`
  if ((prefix.length + body.length + suffix.length) <= maxLength) {
    return `${prefix}${body}${suffix}`
  }

  return `${prefix}${body}.`
}

export function buildWorkspaceChatDataSummary({
  workspaceOrgBackendConnected,
  workspaces,
  statusCounts,
  governanceHealthDistribution,
  maxLength = DEFAULT_MAX_LENGTH,
}: BuildWorkspaceChatDataSummaryArgs): string {
  if (!workspaceOrgBackendConnected) {
    return BACKEND_DISCONNECTED_MESSAGE
  }

  const parts: string[] = [`total workspace=${workspaces.length}`]
  const active = statusCounts.get('Active') ?? 0
  const atRisk = statusCounts.get('At Risk') ?? 0
  const archived = statusCounts.get('Archived') ?? 0
  parts.push(`status Active=${active}`, `At Risk=${atRisk}`, `Archived=${archived}`)

  for (const band of governanceHealthDistribution) {
    parts.push(`health ${band.name}=${band.value}`)
  }

  const base = `Portfolio workspace (snapshot layar saat ini): ${parts.join('; ')}.`
  if (base.length >= maxLength) return base.slice(0, maxLength)

  const remaining = maxLength - base.length
  const directorySegment = buildWorkspaceDirectorySegment(workspaces, remaining)
  return `${base}${directorySegment}`.slice(0, maxLength)
}

export { BACKEND_DISCONNECTED_MESSAGE }
