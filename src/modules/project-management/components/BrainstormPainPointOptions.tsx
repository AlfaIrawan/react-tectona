import { useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Option = { action: string; label: string; explanation: string; value: string }

export function BrainstormPainPointOptions({ options, baseline = '', indonesian, disabled, onSubmit }: {
  options: Option[]
  baseline?: string
  indonesian: boolean
  disabled?: boolean
  onSubmit: (text: string) => Promise<void> | void
}) {
  const [selected, setSelected] = useState<number[]>([])
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)
  const lock = useRef(false)
  const blocked = disabled || sending
  const remaining = Math.max(0, 1900 - baseline.length - selected.reduce((total, index) => total + (options[index].value ? options[index].value.length + 1 : 0), 0) - 1)
  const tooLong = custom.trim().length > remaining
  return <form className="mt-3 space-y-3" onSubmit={async event => {
    event.preventDefault()
    if (blocked || lock.current || !selected.length || tooLong) return
    lock.current = true
    setSending(true)
    try { await onSubmit(`Pain point selection: ${JSON.stringify({ indexes: selected, custom: custom.trim() })}`) }
    finally { lock.current = false; setSending(false) }
  }}>
    <fieldset disabled={blocked} className="space-y-2">
      <legend className="sr-only">{indonesian ? 'Pain point yang relevan' : 'Relevant pain points'}</legend>
      {options.map((option, index) => <label key={index} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-primary">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-blue-600" checked={selected.includes(index)} onChange={() => setSelected(current => {
          if (current.includes(index)) return current.filter(i => i !== index)
          if (option.action === 'defer') return [index]
          return [...current.filter(i => options[i].action !== 'defer'), index]
        })} />
        <span className="min-w-0 text-sm leading-6"><span className="block font-semibold">{option.label}</span><span className="block break-words text-muted-foreground">{option.explanation}</span></span>
      </label>)}
      <label className="block space-y-1 text-sm font-medium">
        <span>{indonesian ? 'Penyesuaian atau pain point lain (opsional)' : 'Adjustments or other pain points (optional)'}</span>
        <Textarea value={custom} onChange={event => setCustom(event.target.value)} maxLength={Math.min(1000, remaining)} rows={3} />
        {tooLong ? <span role="alert" className="text-destructive">{indonesian ? 'Ringkas tambahan pain point.' : 'Shorten the additional pain points.'}</span> : null}
      </label>
    </fieldset>
    <Button type="submit" className="h-10 gap-2" disabled={blocked || !selected.length || tooLong}><Send className="h-4 w-4" aria-hidden />{indonesian ? 'Konfirmasi pilihan' : 'Confirm selection'}</Button>
  </form>
}
