import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { enterprisePrimarySolidButtonClass, enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  createWorkspaceMailConnector,
  listWorkspaceMailConnectors,
  testWorkspaceMailConnector,
  type WorkspaceMailConnector,
} from '@/lib/api/mailApi'
import { cn } from '@/lib/utils'

const EMPTY = {
  name: '',
  smtpHost: 'smtp.office365.com',
  smtpPort: '587',
  username: '',
  fromAddress: '',
  fromName: '',
  password: '',
  testTo: '',
}

export function ExplainerMailboxConnectors({
  workspaceId,
  onConnectors,
}: {
  workspaceId: string
  onConnectors?: (items: WorkspaceMailConnector[]) => void
}) {
  const [items, setItems] = useState<WorkspaceMailConnector[]>([])
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const reload = async () => {
    const next = await listWorkspaceMailConnectors(workspaceId)
    setItems(next)
    onConnectors?.(next)
  }

  useEffect(() => {
    let active = true
    void listWorkspaceMailConnectors(workspaceId)
      .then((next) => {
        if (!active) return
        setItems(next)
        onConnectors?.(next)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load mail connectors.')
      })
    return () => {
      active = false
    }
  }, [workspaceId, onConnectors])

  const save = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const created = await createWorkspaceMailConnector(workspaceId, {
        name: form.name.trim(),
        smtp_host: form.smtpHost.trim(),
        smtp_port: Number(form.smtpPort) || 587,
        smtp_use_starttls: true,
        username: form.username.trim(),
        from_address: (form.fromAddress || form.username).trim(),
        from_name: form.fromName.trim(),
        password: form.password,
      })
      setForm(EMPTY)
      setMessage(`Saved ${created.name}. The password is stored with the mail service and is not shown again.`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the mailbox.')
    } finally {
      setBusy(false)
    }
  }

  const test = async (connectorId: string) => {
    if (!form.testTo.includes('@')) {
      setError('Enter a recipient address before sending the test.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await testWorkspaceMailConnector(workspaceId, connectorId, form.testTo.trim())
      setMessage(result.smtp_ok ? result.smtp_message || 'Test email sent.' : result.smtp_message || 'SMTP test failed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SMTP test failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="shrink-0 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Assistant mailboxes</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            SMTP user and password stay in the mail service. Each assistant only chooses which mailbox it sends as.
            Agent Workflow decides when a message is sent.
          </p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
              <span>
                <span className="font-semibold text-foreground">{item.name}</span>
                <span className="ml-2 text-muted-foreground">{item.from_address}</span>
              </span>
              <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), 'h-8 px-3 text-xs')} disabled={busy} onClick={() => void test(item.id)}>
                Send test
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1"><Label className="text-[11px]">Name</Label><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
        <label className="space-y-1"><Label className="text-[11px]">SMTP host</Label><Input value={form.smtpHost} onChange={(event) => setForm((prev) => ({ ...prev, smtpHost: event.target.value }))} /></label>
        <label className="space-y-1"><Label className="text-[11px]">SMTP user</Label><Input value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} placeholder="assistant@example.com" /></label>
        <label className="space-y-1"><Label className="text-[11px]">SMTP password</Label><Input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} autoComplete="new-password" /></label>
        <label className="space-y-1"><Label className="text-[11px]">From address</Label><Input value={form.fromAddress} onChange={(event) => setForm((prev) => ({ ...prev, fromAddress: event.target.value }))} placeholder="Same as SMTP user if blank" /></label>
        <label className="space-y-1"><Label className="text-[11px]">From name</Label><Input value={form.fromName} onChange={(event) => setForm((prev) => ({ ...prev, fromName: event.target.value }))} /></label>
        <label className="space-y-1 sm:col-span-2"><Label className="text-[11px]">Test recipient</Label><Input value={form.testTo} onChange={(event) => setForm((prev) => ({ ...prev, testTo: event.target.value }))} placeholder="you@example.com" /></label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" className={cn(enterprisePrimarySolidButtonClass(), 'h-9 px-3 text-xs')} disabled={busy || form.name.trim().length < 2 || !form.password} onClick={() => void save()}>
          Save mailbox
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  )
}
