import { useId, useRef, useState } from 'react'
import { BriefcaseBusiness, ClipboardCheck, Send, Wand2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { IdeaDraftBrainstormMessage, IdeaDraftChecklistItem } from '@/lib/api/tectonaAgentRuntimeApi'

export function completedIntakeReviewAvailable(messages: IdeaDraftBrainstormMessage[], checklist: IdeaDraftChecklistItem[], ready: boolean) {
  const last = [...messages].reverse().find(message => message.role === 'assistant')
  const core = checklist.filter(item => !item.id.startsWith('discovery_') && item.required)
  return ready && core.length > 0 && core.every(item => ['answered', 'skipped'].includes(item.status))
    && !checklist.some(item => item.id.startsWith('discovery_') && item.status === 'asked')
    && Boolean(last?.intake_review_ready) && !last?.confirmation_choices?.length && !last?.suggestion_options?.length
    && last?.question_kind !== 'confirm' && last?.question_kind !== 'extended'
}

export function BrainstormIntakeReview({ indonesian, disabled, generating, onSend, onGenerate }: {
  indonesian: boolean
  disabled?: boolean
  generating?: boolean
  onSend: (text: string) => Promise<void> | void
  onGenerate: () => Promise<void> | void
}) {
  const id = useId()
  const [revision, setRevision] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const blocked = disabled || generating || sending
  const hasRevision = Boolean(revision.trim())
  const send = async (text: string) => {
    if (blocked || lock.current) return
    lock.current = true
    setSending(true)
    setError('')
    try { await onSend(text) }
    catch { setError(indonesian ? 'Revisi belum terkirim. Teks tetap disimpan di sini.' : 'The message was not sent. Your revision is still here.') }
    finally { lock.current = false; setSending(false) }
  }
  return <section data-intake-review className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-foreground dark:border-emerald-800 dark:bg-emerald-950/30">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 shrink-0" />{indonesian ? 'Review Rangkuman Pemahaman' : 'Review Summary of Understanding'}</h3>
    <p className="text-sm leading-6">{indonesian ? 'Pertanyaan wajib sudah selesai. Apakah rangkuman di atas sudah sesuai?' : 'Mandatory questions are complete. Does the summary above look correct?'}</p>
    <form className="space-y-2" onSubmit={async event => {
      event.preventDefault()
      if (hasRevision) await send(`${indonesian ? 'Revisi rangkuman pemahaman' : 'Revise my understanding'}: ${revision.trim()}`)
    }}>
      <label htmlFor={id} className="text-sm font-medium">{indonesian ? 'Revisi rangkuman (opsional)' : 'Summary revision (optional)'}</label>
      <Textarea id={id} value={revision} onChange={event => setRevision(event.target.value)} rows={3} maxLength={3900} disabled={blocked} className="min-h-24 resize-y" />
      <Button type="submit" disabled={blocked || !hasRevision} className="min-h-10 gap-2"><Send className="h-4 w-4" />{indonesian ? 'Kirim revisi' : 'Send revision'}</Button>
    </form>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <div className="flex flex-wrap gap-2 border-t border-emerald-200 pt-3 dark:border-emerald-800">
      <Button type="button" variant="outline" disabled={blocked || hasRevision} className="min-h-10 gap-2 whitespace-normal text-left" onClick={() => void send(indonesian ? 'Pertanyaan bisnis' : 'Business questions')}><BriefcaseBusiness className="h-4 w-4 shrink-0" />Extended Question · Business</Button>
      <Button type="button" variant="outline" disabled={blocked || hasRevision} className="min-h-10 gap-2 whitespace-normal text-left" onClick={() => void send(indonesian ? 'Pertanyaan teknis' : 'Technical questions')}><Wrench className="h-4 w-4 shrink-0" />Extended Question · Technical</Button>
      <Button type="button" disabled={blocked || hasRevision} className="min-h-10 gap-2" onClick={() => void onGenerate()}><Wand2 className="h-4 w-4 shrink-0" />{generating ? (indonesian ? 'Membuat draft...' : 'Generating...') : 'Generate draft'}</Button>
    </div>
  </section>
}
