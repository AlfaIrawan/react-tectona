import { useId, useState } from 'react'
import { ChevronDown, ChevronUp, Workflow } from 'lucide-react'
import { AssistantMermaidBlock } from '@/modules/core-shell/components/AssistantMermaidBlock'
import type { SummaryDiagramAttachment } from '../lib/brainstormSummaryDiagrams'

export function BrainstormSummaryDiagrams({ diagrams, indonesian }: {
  diagrams: SummaryDiagramAttachment[]
  indonesian: boolean
}) {
  const id = useId()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  return <>{diagrams.map(diagram => {
    const name = diagram.lane === 'as_is' ? 'AS-IS' : 'TO-BE'
    const key = `${diagram.lane}:${diagram.source}`
    const open = diagram.presentation === 'preview' || expanded.has(key)
    const label = indonesian ? `${open ? 'Tutup' : 'Lihat'} diagram ${name}` : `${open ? 'Hide' : 'View'} ${name} diagram`
    return <div key={key} className="my-3 min-w-0" data-chat-summary-diagram={diagram.lane}>
      {diagram.presentation === 'link' ? <button type="button" title={label} aria-expanded={open} aria-controls={`${id}-${diagram.lane}`}
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next })}>
        <Workflow className="h-4 w-4 shrink-0" aria-hidden />{label}{open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
      </button> : null}
      {open ? <figure id={`${id}-${diagram.lane}`} className="min-w-0">
        <figcaption className="mb-2 text-xs font-medium text-muted-foreground">{name} — {indonesian ? 'alur yang dikonfirmasi' : 'confirmed flow'}</figcaption>
        <AssistantMermaidBlock source={diagram.source} notation="bpmn" compact />
      </figure> : null}
    </div>
  })}</>
}
