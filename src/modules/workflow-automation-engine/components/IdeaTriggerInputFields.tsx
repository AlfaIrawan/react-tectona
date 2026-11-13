import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { IDEA_TRIGGER_INPUTS_CONFIG, readIdeaTriggerInputs, type IdeaTriggerInput } from '@/modules/project-management/lib/ideaTriggerInputs'

export function IdeaTriggerInputFields({ value, options, onChange }: {
  value?: string
  options: Array<{ id: string; name: string }>
  onChange: (config: Record<string, string>) => void
}) {
  const fields = readIdeaTriggerInputs(value)
  const save = (rows: IdeaTriggerInput[]) => onChange({ [IDEA_TRIGGER_INPUTS_CONFIG]: JSON.stringify(rows) })
  const update = (index: number, patch: Partial<IdeaTriggerInput>) =>
    save(fields.map((field, i) => i === index ? { ...field, ...patch } : field))
  const add = () => {
    let suffix = 2
    let key = 'ticket_number'
    while (fields.some((field) => field.key === key)) key = `input_${suffix++}`
    save([...fields, { key, label: key === 'ticket_number' ? 'Nomor Ticket' : '', workspace_id: options.length === 1 ? options[0].id : '', requirement: 'optional' }])
  }
  const selectClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-xs'
  return <fieldset className="min-w-0 space-y-2">
    <legend className="text-xs font-semibold">Create Idea Inputs</legend>
    {fields.map((field, index) => <div key={index} className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-xs">Label
          <Input value={field.label} maxLength={80} onChange={(event) => update(index, { label: event.target.value })} />
        </label>
        <button type="button" className="grid h-8 w-8 shrink-0 place-items-center" title="Remove input" aria-label={`Remove input ${index + 1}`}
          onClick={() => save(fields.filter((_, i) => i !== index))}><X className="h-4 w-4" /></button>
      </div>
      <label className="block text-xs">Workflow key
        <Input value={field.key} maxLength={64} onChange={(event) => update(index, { key: event.target.value })} />
      </label>
      <label className="block text-xs">Workspace
        <select className={selectClass} value={field.workspace_id} onChange={(event) => update(index, { workspace_id: event.target.value })}>
          <option value="">Select workspace</option>
          {field.workspace_id && !options.some(({ id }) => id === field.workspace_id) && <option value={field.workspace_id}>Unavailable workspace</option>}
          {options.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="block text-xs">Requirement
        <select className={selectClass} value={field.requirement} onChange={(event) => update(index, { requirement: event.target.value === 'mandatory' ? 'mandatory' : 'optional' })}>
          <option value="optional">Optional</option>
          <option value="mandatory">Mandatory</option>
        </select>
      </label>
    </div>)}
    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs disabled:opacity-50"
      onClick={add} disabled={fields.length >= 12}><Plus className="h-3.5 w-3.5" /> Add input</button>
  </fieldset>
}
