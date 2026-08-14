import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import {
  saveMailboxConfig,
  testMailboxConfig,
  toSavePayload,
  type MailboxTestResult,
  type UiMailboxConfig,
} from '@/lib/api/mailApi'
import { cn } from '@/lib/utils'

interface EmailMailboxSetupProps {
  initial: UiMailboxConfig
  onSaved: () => void
}

export function EmailMailboxSetup({ initial, onSaved }: EmailMailboxSetupProps) {
  const [form, setForm] = useState<UiMailboxConfig>(initial)
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<MailboxTestResult | null>(null)

  const canSubmit = useMemo(() => {
    return (
      form.email.trim().length > 0 &&
      form.password.trim().length > 0 &&
      form.imapHost.trim().length > 0 &&
      form.smtpHost.trim().length > 0
    )
  }, [form])

  const patch = (partial: Partial<UiMailboxConfig>) => {
    setForm((prev) => ({ ...prev, ...partial }))
    setTestResult(null)
    setError(null)
  }

  const handleTest = async () => {
    if (!canSubmit) return
    setBusy('test')
    setError(null)
    setTestResult(null)
    try {
      const result = await testMailboxConfig(toSavePayload(form))
      setTestResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection test failed')
    } finally {
      setBusy(null)
    }
  }

  const handleSave = async () => {
    if (!canSubmit) return
    setBusy('save')
    setError(null)
    try {
      await saveMailboxConfig(toSavePayload(form))
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save configuration')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enter your Outlook/M365 mailbox credentials. Default server: IMAP{' '}
          <span className="font-mono text-[10px]">outlook.office365.com:993</span>, SMTP{' '}
          <span className="font-mono text-[10px]">smtp.office365.com:587</span>.
        </p>

        <div className="space-y-2">
          <Label htmlFor="mail-setup-email" className="text-xs">
            Email address
          </Label>
          <Input
            id="mail-setup-email"
            value={form.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="name@company.com"
            className="h-10 text-sm"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mail-setup-password" className="text-xs">
            Password / App Password
          </Label>
          <Input
            id="mail-setup-password"
            type="password"
            value={form.password}
            onChange={(e) => patch({ password: e.target.value })}
            placeholder="Password or M365 app password"
            className="h-10 text-sm"
            autoComplete="current-password"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mail-setup-imap-host" className="text-xs">
              IMAP host
            </Label>
            <Input
              id="mail-setup-imap-host"
              value={form.imapHost}
              onChange={(e) => patch({ imapHost: e.target.value })}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail-setup-imap-port" className="text-xs">
              Port
            </Label>
            <Input
              id="mail-setup-imap-port"
              type="number"
              value={form.imapPort}
              onChange={(e) => patch({ imapPort: Number(e.target.value) || 993 })}
              className="h-10 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mail-setup-smtp-host" className="text-xs">
              SMTP host
            </Label>
            <Input
              id="mail-setup-smtp-host"
              value={form.smtpHost}
              onChange={(e) => patch({ smtpHost: e.target.value })}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail-setup-smtp-port" className="text-xs">
              Port
            </Label>
            <Input
              id="mail-setup-smtp-port"
              type="number"
              value={form.smtpPort}
              onChange={(e) => patch({ smtpPort: Number(e.target.value) || 587 })}
              className="h-10 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={form.imapUseTls} onChange={(e) => patch({ imapUseTls: e.target.checked })} />
            IMAP SSL/TLS
          </label>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={form.smtpUseStarttls}
              onChange={(e) => patch({ smtpUseStarttls: e.target.checked })}
            />
            SMTP STARTTLS
          </label>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {testResult ? (
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
            <p className={testResult.imap_ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
              IMAP: {testResult.imap_message ?? (testResult.imap_ok ? 'OK' : 'Failed')}
            </p>
            <p className={testResult.smtp_ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
              SMTP: {testResult.smtp_message ?? (testResult.smtp_ok ? 'OK' : 'Failed')}
            </p>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-background/95 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-4">
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'w-full justify-center gap-2')}
            disabled={!canSubmit || busy !== null}
            onClick={() => void handleTest()}
          >
            {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Test connection
          </Button>
          <Button
            type="button"
            className={cn(
              enterpriseCyanGradientActionButtonClass(),
              'w-full min-h-11 justify-center gap-2 rounded-lg sm:min-h-10'
            )}
            disabled={!canSubmit || busy !== null}
            onClick={() => void handleSave()}
          >
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
