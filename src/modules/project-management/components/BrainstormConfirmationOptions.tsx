import { useId, useRef, useState } from 'react'
import { Clock3, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function BrainstormConfirmationOptions({ choices, explanations = [], actions = ['confirm', 'adjust'], indonesian, disabled, onSubmit }: {
  choices: string[]
  explanations?: string[]
  actions?: Array<'confirm' | 'choose' | 'adjust' | 'defer' | 'discuss' | 'provide'>
  indonesian: boolean
  disabled?: boolean
  onSubmit: (text: string) => Promise<void> | void
}) {
  const id = useId()
  const lock = useRef(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [correction, setCorrection] = useState('')
  const [sending, setSending] = useState(false)
  const providing = selected !== null && actions[selected] === 'provide'
  const adjusting = selected !== null && (actions[selected] === 'adjust' || providing)
  const blocked = disabled || sending
  const comparing = actions.filter(action => action === 'choose').length >= 2
  const deferredIndex = comparing ? actions.indexOf('defer') : -1
  const send = async (text: string) => {
    if (blocked || lock.current) return
    lock.current = true
    setSending(true)
    try { await onSubmit(text) }
    finally { lock.current = false; setSending(false) }
  }
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
    await send(adjusting ? `${choices[selected]}: ${correction.trim()}` : choices[selected])
  }}>
    <fieldset disabled={blocked} className="min-w-0 space-y-2">
      <legend className="sr-only">{indonesian ? 'Pilih tindakan' : 'Choose an action'}</legend>
      {choices.map((choice, index) => index === deferredIndex ? null : <label key={choice} htmlFor={`${id}-${index}`} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-primary">
        <input id={`${id}-${index}`} type="radio" name={id} checked={selected === index} onChange={() => setSelected(index)} className="mt-1 h-5 w-5 shrink-0 accent-blue-600" />
        <span className="min-w-0 flex-1">
          <span className="block whitespace-normal break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{choice}</span>
          <span className="block whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{explanations[index] || fallback[index]}</span>
        </span>
      </label>)}
      {adjusting ? <div className="space-y-1 px-2">
        <label htmlFor={`${id}-correction`} className="text-sm font-medium">{providing ? (indonesian ? 'Referensi pendukung' : 'Supporting reference') : comparing ? (indonesian ? 'Alternatif yang ingin digunakan' : 'Your preferred alternative') : (indonesian ? 'Bagian yang perlu disesuaikan' : 'What needs adjustment')}</label>
        <Textarea id={`${id}-correction`} value={correction} onChange={(event) => setCorrection(event.target.value)} required maxLength={4000 - (selected === null ? 0 : choices[selected].length + 2)} rows={3} />
      </div> : null}
    </fieldset>
    <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={blocked || selected === null || (adjusting && !correction.trim())} className="min-h-10 gap-2">
      <Send className="h-4 w-4" />{indonesian ? 'Kirim' : 'Send'}
    </Button>{deferredIndex >= 0 ? <Button type="button" variant="ghost" disabled={blocked} title={explanations[deferredIndex]} onClick={async () => send(choices[deferredIndex])} className="min-h-10 gap-2 whitespace-normal text-left"><Clock3 className="h-4 w-4 shrink-0" />{choices[deferredIndex]}</Button> : null}</div>
  </form>
}
