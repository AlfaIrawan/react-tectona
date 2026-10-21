import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifySecondaryEmailToken } from '@/lib/api/identityApi'

function VerificationShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="h-1.5 bg-blue-600" />
        <div className="px-8 py-8 text-center">
          <img src="/images/logo-white.png" alt="Tectona" className="mx-auto h-12 w-auto rounded bg-slate-900 px-3 py-2 object-contain" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Profile security</p>
          <div className="mt-6 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function VerifySecondaryEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!token) {
      setError('This verification link is missing a token. Open the latest email from Tectona and try again.')
      setLoading(false)
      return
    }
    let cancelled = false
    void verifySecondaryEmailToken(token)
      .then((result) => {
        if (!cancelled) setEmail(result.email)
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Secondary email verification failed.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  if (loading) {
    return <VerificationShell><Loader2 className="mx-auto h-9 w-9 animate-spin text-blue-600" /><p className="text-sm text-slate-600">Verifying your secondary email…</p></VerificationShell>
  }
  if (error) {
    return <VerificationShell><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Secondary email</p><h1 className="text-2xl font-semibold text-slate-900">Link could not be verified</h1><p className="text-sm leading-relaxed text-slate-600">{error}</p><Link to="/login" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Go to sign in</Link></VerificationShell>
  }
  return <VerificationShell><MailCheck className="mx-auto h-10 w-10 text-emerald-600" /><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Secondary email verified</p><h1 className="text-2xl font-semibold text-slate-900">Recovery email is ready</h1><p className="text-sm leading-relaxed text-slate-600"><span className="font-medium text-slate-900">{email}</span> is now verified and can receive password recovery links for your Tectona account.</p><Link to="/profile" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Return to profile</Link></VerificationShell>
}
