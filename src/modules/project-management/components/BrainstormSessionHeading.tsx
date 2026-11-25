import { Building2 } from 'lucide-react'

export function resolveBrainstormWorkspaceName(
  workspaceId: string,
  options: Array<{ id: string; name: string }>,
  savedName?: string | null,
): string | null {
  if (!workspaceId.trim()) return null
  return options.find(option => option.id === workspaceId)?.name.trim() || savedName?.trim() || null
}

export function BrainstormSessionHeading({ title, workspaceId, workspaceName }: {
  title: string
  workspaceId: string
  workspaceName?: string | null
}) {
  const name = workspaceName?.trim() || (workspaceId.trim() ? 'Nama belum tersedia' : 'Belum dipilih')
  return <div className="min-w-0 flex-1" data-brainstorm-session-heading>
    <h3 id="idea-evidence-dialog-title" className="truncate text-sm font-semibold text-foreground">Tectona Assistant</h3>
    <p className="truncate text-[11px] text-muted-foreground" title={title.trim() || undefined}>
      {title.trim() || 'Brainstorm AS-IS context'}
    </p>
    <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground" title={`Workspace tujuan: ${name}`}>
      <Building2 className="h-3 w-3 shrink-0" aria-hidden />
      <span className="shrink-0">Workspace tujuan:</span>
      <span className="min-w-0 truncate font-medium text-foreground" data-brainstorm-workspace>{name}</span>
    </p>
  </div>
}
