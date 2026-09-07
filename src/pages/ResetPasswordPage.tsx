import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { completePasswordReset } from '@/lib/api/identityApi'

function ResetShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'linear-gradient(180deg, #dcd6c8 0%, #efece3 42%, #e8e4d9 100%)' }}
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-sm shadow-2xl">
        <div className="h-[5px] bg-[#c9a227]" />
        <div className="bg-[#0b1f3a] px-8 py-8 text-center">
          <img src="/images/logo-white.png" alt="Tectona" className="mx-auto h-14 w-auto object-contain" />
          <p className="mt-3 text-[11px] uppercase tracking-[0.36em] text-[#c9a227]">
            Project Management Platform
          </p>
        </div>
        <div className="space-y-5 bg-[#fffcf7] px-8 py-8">{children}</div>
      </div>
    </div>
  )
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [token] = useState(() => searchParams.get('token')?.trim() ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]')
    const created = !meta
    const previous = meta?.content
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'referrer'
      document.head.appendChild(meta)
    }
    meta.content = 'no-referrer'
    window.history.replaceState({}, document.title, '/reset-password')
    return () => {
      if (meta && created) meta.remove()
      else if (meta && previous) meta.content = previous
    }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('This password reset link is missing its secure token. Use the latest email from Tectona.')
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await completePasswordReset({ token, newPassword: password, confirmPassword: confirmation })
      setComplete(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset your password right now.')
    } finally {
      setBusy(false)
    }
  }

  if (complete) {
    return (
      <ResetShell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c9a227]">Password security</p>
          <h1 className="mt-2 font-serif text-2xl text-[#0b1f3a]">Password changed</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#4a453c]">
            Your new password is active. All existing sessions have been signed out for your protection.
          </p>
          <Link to="/login" className="mt-6 inline-block bg-[#0b1f3a] px-8 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#f7efd4]">
            Sign in
          </Link>
        </div>
      </ResetShell>
    )
  }

  return (
    <ResetShell>
      <div className="text-center">
        <KeyRound className="mx-auto h-9 w-9 text-[#c9a227]" aria-hidden />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c9a227]">Password security</p>
        <h1 className="mt-2 font-serif text-2xl text-[#0b1f3a]">Create a new password</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4a453c]">
          Choose a strong, unique password for your Tectona account.
        </p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#6b6254]" htmlFor="new-password">
          New password
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={visible ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
            className="h-11 w-full border border-[#d8d1c3] bg-white px-3 pr-11 text-sm text-[#0b1f3a] outline-none focus:border-[#0b1f3a]"
          />
          <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 px-3 text-[#6b6254]">
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#6b6254]" htmlFor="confirm-password">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type={visible ? 'text' : 'password'}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          className="h-11 w-full border border-[#d8d1c3] bg-white px-3 text-sm text-[#0b1f3a] outline-none focus:border-[#0b1f3a]"
        />
        <p className="text-xs leading-relaxed text-[#6b6254]">
          Use at least 12 characters with uppercase, lowercase, a number, and a special character.
        </p>
        {error ? <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        <button type="submit" disabled={busy || !token} className="flex w-full items-center justify-center gap-2 bg-[#0b1f3a] px-8 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#f7efd4] disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {busy ? 'Updating…' : 'Reset password'}
        </button>
      </form>
    </ResetShell>
  )
}
