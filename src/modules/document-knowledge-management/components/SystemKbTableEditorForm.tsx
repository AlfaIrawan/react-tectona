import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addSystemKbTableRow,
  getSystemKbTableSpec,
  type SystemKbTableEditModel,
} from '@/lib/kb/systemKbTableEditor'

type SystemKbTableEditorFormProps = {
  model: SystemKbTableEditModel
  onChange: (next: SystemKbTableEditModel) => void
}

export function SystemKbTableEditorForm({ model, onChange }: SystemKbTableEditorFormProps) {
  const spec = getSystemKbTableSpec(model.specId)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{spec.title.replace(/ \(Default\)$/i, '')}</p>
          <p className="text-[11px] text-muted-foreground">Locked columns. Add or delete rows without changing the table structure.</p>
        </div>
        <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          Structured KB
        </span>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">Framework notes</span>
        <textarea
          value={model.intro}
          onChange={(event) => onChange({ ...model, intro: event.target.value })}
          rows={3}
          className="w-full resize-y rounded-md border border-border/70 bg-background px-2.5 py-2 text-sm leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <div className="space-y-2">
        {model.rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-[12px] text-muted-foreground">
            No rows yet. Add a row to fill {spec.columns.map((column) => column.label).join(', ')}.
          </p>
        ) : null}
        {model.rows.map((row, index) => (
          <div key={`system-kb-row-${index}`} className="space-y-2 rounded-lg border border-border/70 bg-background px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Row {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                onClick={() => onChange({ ...model, rows: model.rows.filter((_, itemIndex) => itemIndex !== index) })}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                Delete
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {spec.columns.map((column) => (
                <label key={column.key} className="block space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">{column.label}</span>
                  <Input
                    value={row[column.key] ?? ''}
                    onChange={(event) => {
                      const nextRows = model.rows.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, [column.key]: event.target.value } : item
                      ))
                      onChange({ ...model, rows: nextRows })
                    }}
                    className="h-9 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-center gap-1.5 text-xs"
        onClick={() => onChange(addSystemKbTableRow(model))}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add row
      </Button>
    </div>
  )
}
