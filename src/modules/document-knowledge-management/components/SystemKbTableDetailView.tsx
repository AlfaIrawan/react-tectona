import { getSystemKbTableSpec, type SystemKbTableEditModel } from '@/lib/kb/systemKbTableEditor'

export function SystemKbTableDetailView({ model }: { model: SystemKbTableEditModel }) {
  const spec = getSystemKbTableSpec(model.specId)

  return (
    <div className="space-y-3 px-3 py-3">
      <p className="text-sm leading-6 text-foreground">{model.intro}</p>
      {model.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
          No rows yet. Open Edit to add data without changing the columns.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="min-w-full border-collapse text-left text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                {spec.columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap border-b border-border/70 px-3 py-2 font-semibold text-slate-700">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row, index) => (
                <tr key={`view-row-${index}`} className="odd:bg-white even:bg-slate-50/60">
                  {spec.columns.map((column) => (
                    <td key={column.key} className="align-top border-b border-border/40 px-3 py-2 text-foreground">
                      {(row[column.key] || '').trim() || <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
