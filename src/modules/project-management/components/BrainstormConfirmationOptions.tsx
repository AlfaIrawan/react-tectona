import { useId, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function BrainstormConfirmationOptions({ choices, explanations = [], actions = ['confirm', 'adjust'], indonesian, disabled, onSubmit }: {
  choices: string[]
  explanations?: string[]
  actions?: Array<'confirm' | 'adjust'>
  indonesian: boolean
  disabled?: boolean
  onSubmit: (text: string) => Promise<void> | void
}) {
  const id = useId()
  const lock = useRef(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [correction, setCorrection] = useState('')
  const [sending, setSending] = useState(false)
  const adjusting = selected !== null && actions[selected] === 'adjust'
  const blocked = disabled || sending
  const fallback = indonesian ? [
    'Gunakan fungsi dan alur dalam rangkuman sebagai dasar kebutuhan. Detail yang ditandai belum pasti tetap perlu dikonfirmasi.',
    'Koreksi bagian yang berbeda, misalnya pengguna, sumber data, hak akses, fungsi, atau alur eskalasi. Bagian lain tetap dipertahankan.',
  ] : [
    'Use the functions and process in this summary as the starting requirements. Details marked uncertain still need confirmation.',
    'Correct the affected users, data sources, permissions, functions, or escalation flow. Keep the remaining scope.',
  ]
  return <form className="mt-3 space-y-3" onSubmit={async (event) => {
    event.preventDefault()
    if (blocked || lock.current || selected === null || (adjusting && !correction.trim())) return
    lock.current = true
    setSending(true)
    try { await onSubmit(adjusting ? `${choices[selected]}: ${correction.trim()}` : choices[selected]) }
    finally { lock.current = false; setSending(false) }
  }}>
    <fieldset disabled={blocked} className="space-y-2">
      <legend className="sr-only">{indonesian ? 'Konfirmasi rangkuman' : 'Confirm summary'}</legend>
      {choices.map((choice, index) => <label key={choice} htmlFor={`${id}-${index}`} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-primary">
        <input id={`${id}-${index}`} type="radio" name={id} checked={selected === index} onChange={() => setSelected(index)} className="mt-1 h-5 w-5 shrink-0 accent-blue-600" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-6">{choice}</span>
          <span className="block whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{explanations[index] || fallback[index]}</span>
        </span>
      </label>)}
      {adjusting ? <div className="space-y-1 px-2">
        <label htmlFor={`${id}-correction`} className="text-sm font-medium">{indonesian ? 'Bagian yang perlu disesuaikan' : 'What needs adjustment'}</label>
        <Textarea id={`${id}-correction`} value={correction} onChange={(event) => setCorrection(event.target.value)} required maxLength={4000} rows={3} />
      </div> : null}
    </fieldset>
    <Button type="submit" disabled={blocked || selected === null || (adjusting && !correction.trim())} className="min-h-10 gap-2">
      <Send className="h-4 w-4" />{indonesian ? 'Kirim' : 'Send'}
    </Button>
  </form>
}
