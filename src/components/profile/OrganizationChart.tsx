import { useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { BriefcaseBusiness, Building2, IdCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MicrosoftGraphPerson } from '@/lib/api/microsoftGraphApi'

type OrganizationRole = 'manager' | 'self' | 'report'

type OrganizationNodeData = {
  person: MicrosoftGraphPerson
  role: OrganizationRole
}

function initials(person: MicrosoftGraphPerson): string {
  const source = person.display_name || person.email || '?'
  const words = source.split(/[\s._-]+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : source.slice(0, 2)).toUpperCase()
}

function OrganizationPersonNode({ data }: NodeProps<OrganizationNodeData>) {
  const { person, role } = data
  const roleLabel = role === 'self' ? 'You' : role === 'manager' ? 'Manager' : 'Direct report'
  return (
    <div
      className={cn(
        'w-[15rem] rounded-xl border bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]',
        role === 'self' ? 'border-primary/50 ring-2 ring-primary/10' : 'border-slate-200',
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-white !bg-primary/70" />
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold', role === 'self' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
          {initials(person)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{person.display_name || person.email}</p>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold', role === 'self' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600')}>
              {roleLabel}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-600">{person.job_title || 'Job title not specified'}</p>
          <div className="mt-2 space-y-1 text-[10px] text-slate-500">
            <p className="flex items-center gap-1.5 truncate"><Building2 className="h-3 w-3 shrink-0" />{person.department || 'Department not specified'}</p>
            {person.employee_id ? <p className="flex items-center gap-1.5 truncate"><IdCard className="h-3 w-3 shrink-0" />NIK {person.employee_id}</p> : null}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-white !bg-primary/70" />
    </div>
  )
}

const nodeTypes: NodeTypes = { person: OrganizationPersonNode }

export function OrganizationChart({
  profile,
  manager,
  directReports,
  permissionRequired,
  loading,
  onReconnect,
}: {
  profile?: MicrosoftGraphPerson | null
  manager?: MicrosoftGraphPerson | null
  directReports: MicrosoftGraphPerson[]
  permissionRequired: boolean
  loading: boolean
  onReconnect: () => void
}) {
  const graph = useMemo(() => {
    if (!profile) return { nodes: [] as Node<OrganizationNodeData>[], edges: [] as Edge[], height: 390 }
    const columns = Math.max(1, Math.min(directReports.length, 4))
    const rows = Math.max(1, Math.ceil(directReports.length / 4))
    const graphWidth = Math.max(960, columns * 280)
    const centerX = graphWidth / 2 - 120
    const selfY = manager ? 185 : 70
    const reportsY = selfY + 190
    const nodes: Node<OrganizationNodeData>[] = []
    const edges: Edge[] = []

    if (manager) {
      nodes.push({ id: `manager-${manager.id}`, type: 'person', position: { x: centerX, y: 20 }, data: { person: manager, role: 'manager' }, draggable: false })
      edges.push({ id: 'manager-self', source: `manager-${manager.id}`, target: `self-${profile.id}`, type: 'smoothstep', animated: false, style: { stroke: '#94a3b8', strokeWidth: 1.5 } })
    }
    nodes.push({ id: `self-${profile.id}`, type: 'person', position: { x: centerX, y: selfY }, data: { person: profile, role: 'self' }, draggable: false })
    directReports.forEach((person, index) => {
      const row = Math.floor(index / 4)
      const rowCount = Math.min(4, directReports.length - row * 4)
      const rowStart = graphWidth / 2 - (rowCount * 280 - 40) / 2
      const id = `report-${person.id}`
      nodes.push({ id, type: 'person', position: { x: rowStart + (index % 4) * 280, y: reportsY + row * 155 }, data: { person, role: 'report' }, draggable: false })
      edges.push({ id: `self-${id}`, source: `self-${profile.id}`, target: id, type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5 } })
    })
    return { nodes, edges, height: Math.min(720, reportsY + rows * 155 + 40) }
  }, [directReports, manager, profile])

  if (loading) {
    return <div className="h-[24rem] animate-pulse rounded-xl border border-border/50 bg-muted/25" />
  }
  if (!profile) {
    return (
      <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 text-center">
        <BriefcaseBusiness className="h-8 w-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-semibold">Microsoft organization data is unavailable</p>
        <p className="mt-1 max-w-lg text-xs text-muted-foreground">Sign in with your Microsoft work account to synchronize your department, NIK, job title, manager, and direct reports.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 py-4">
      {permissionRequired ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold text-amber-900">TECTONA needs Microsoft consent for organization details</p><p className="mt-0.5 text-[11px] text-amber-800">Manager details require User.Read.All. Direct reports can use User.ReadBasic.All; User.Read.All also covers them. Graph Explorer permissions do not carry over to TECTONA.</p></div>
          <Button type="button" variant="outline" className="h-9 shrink-0 border-amber-300 bg-white text-xs" onClick={onReconnect}>Reconnect Microsoft</Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.06),transparent_48%)]" style={{ height: graph.height }}>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
          minZoom={0.45}
          maxZoom={1.4}
          nodesConnectable={false}
          nodesDraggable={false}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#cbd5e1" gap={22} size={1} />
          <Controls showInteractive={false} className="!border-slate-200 !bg-white !shadow-sm" />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted-foreground">
        <span>{manager ? '1 manager' : 'No manager listed'}</span>
        <span>{directReports.length} direct {directReports.length === 1 ? 'report' : 'reports'}</span>
        <span>Source: Microsoft Graph</span>
      </div>
    </div>
  )
}
