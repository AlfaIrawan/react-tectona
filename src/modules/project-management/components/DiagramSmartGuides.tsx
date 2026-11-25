import { useStore } from 'reactflow'
import type { DiagramGuideFeedback } from '../lib/diagramSmartGuides'

/** Screen-space overlay keeps guide weight and measurements legible at every canvas zoom. */
export function DiagramSmartGuides({ feedback }: { feedback: DiagramGuideFeedback }) {
  const [panX, panY, zoom] = useStore(state => state.transform)
  const toX = (value: number) => panX + value * zoom
  const toY = (value: number) => panY + value * zoom
  return (
    <div className="diagram-smart-guides pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 35 }} aria-hidden>
      <svg className="absolute inset-0 h-full w-full">
        {feedback.lines.map((line, index) => {
          const vertical = line.axis === 'x'
          const x1 = toX(vertical ? line.value : line.from), x2 = toX(vertical ? line.value : line.to)
          const y1 = toY(vertical ? line.from : line.value), y2 = toY(vertical ? line.to : line.value)
          return <g key={index} data-diagram-guide={line.kind} stroke="#0ea5e9" strokeWidth={1}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {line.kind === 'dimension' ? <>
              <line x1={x1 - (vertical ? 4 : 0)} y1={y1 - (vertical ? 0 : 4)} x2={x1 + (vertical ? 4 : 0)} y2={y1 + (vertical ? 0 : 4)} />
              <line x1={x2 - (vertical ? 4 : 0)} y1={y2 - (vertical ? 0 : 4)} x2={x2 + (vertical ? 4 : 0)} y2={y2 + (vertical ? 0 : 4)} />
            </> : null}
          </g>
        })}
      </svg>
      {feedback.size ? <div data-diagram-size className="absolute whitespace-nowrap rounded border border-sky-200 bg-white/95 px-2 py-1 text-[11px] font-medium tabular-nums text-sky-700 shadow-sm"
        style={{ left: toX(feedback.size.x + feedback.size.width / 2), top: toY(feedback.size.y + feedback.size.height) + 20, transform: 'translateX(-50%)' }}>
        {Math.round(feedback.size.width)} × {Math.round(feedback.size.height)} px
      </div> : null}
    </div>
  )
}
