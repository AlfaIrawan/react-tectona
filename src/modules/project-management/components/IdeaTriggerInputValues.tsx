import { Input } from '@/components/ui/input'
import { IDEA_INPUT_MAX_LENGTH, type IdeaTriggerInput } from '../lib/ideaTriggerInputs'

export function IdeaTriggerInputValues({ fields, values, onChange }: {
  fields: IdeaTriggerInput[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return fields.map((field) => (
    <label key={field.key} className="block space-y-1 text-sm">
      <span>{field.label}{field.requirement === 'mandatory' ? ' *' : ' (Optional)'}</span>
      <Input value={Object.hasOwn(values, field.key) ? values[field.key] : ''} maxLength={IDEA_INPUT_MAX_LENGTH}
        aria-required={field.requirement === 'mandatory'} onChange={(event) => onChange(field.key, event.target.value)} />
    </label>
  ))
}
