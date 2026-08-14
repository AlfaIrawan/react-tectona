import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Fingerprint,
  Globe,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { logoutAsync, requireAuth, registerPasskey, type Session } from '@/auth/authService'
import { passkeyErrorMessage } from '@/lib/api/webauthnApi'
import { buildLoginPathAfterSignOut } from '@/auth/loginRedirect'
import { authCardButtonClass } from '@/lib/authUiClasses'
import { useThemeStore } from '@/stores/theme-store'
import { cn } from '@/lib/utils'

function profileInitials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

function ProfileField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid gap-1 border-b border-border/40 py-3.5 last:border-0 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm font-medium text-foreground break-all', mono && 'font-mono text-xs')}>
        {value}
      </dd>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
      <div className="border-b border-border/40 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-1">{children}</div>
    </section>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useThemeStore()
  const [session, setSession] = useState<Session | null>(null)
  const [language, setLanguage] = useState('en')
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyMsg, setPasskeyMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleAddPasskey = async () => {
    setPasskeyBusy(true)
    setPasskeyMsg(null)
    try {
      await registerPasskey()
      setPasskeyMsg({ ok: true, text: 'Passkey added. You can now sign in with it on this device.' })
    } catch (err) {
      setPasskeyMsg({ ok: false, text: passkeyErrorMessage(err, 'enroll') })
    } finally {
      setPasskeyBusy(false)
    }
  }

  useEffect(() => {
    const currentSession = requireAuth()
    if (!currentSession) {
      navigate('/login?next=/profile', { replace: true })
      return
    }
    setSession(currentSession)
  }, [navigate])

  const handleLogout = () => {
    void logoutAsync().finally(() => {
      navigate(buildLoginPathAfterSignOut('/profile'), { replace: true })
    })
  }

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(dateString))
    } catch {
      return '-'
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
      case 'root':
        return 'destructive' as const
      case 'reviewer':
        return 'secondary' as const
      default:
        return 'default' as const
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'Administrator'
      case 'root':
        return 'Root'
      case 'reviewer':
        return 'Reviewer'
      case 'member':
        return 'Member'
      default:
        return role
    }
  }

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return '••••••••'
    return `${token.slice(0, 6)}••••${token.slice(-4)}`
  }

  if (!session) return null

  const displayName = session.user.name?.trim() || session.user.email.split('@')[0] || 'User'
  const initials = profileInitials(session.user.name ?? '', session.user.email)

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:py-10">
        {/* Top navigation */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Tectona
          </Link>
          <img src="/images/logo.png" alt="Tectona" className="h-8 w-auto object-contain opacity-80" />
        </header>

        {/* Profile hero */}
        <div className="glass-card mb-6 rounded-2xl border border-border/50 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-md"
                aria-hidden
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{displayName}</h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">{session.user.email}</p>
                <div className="mt-3">
                  <Badge variant={getRoleBadgeVariant(session.user.role)} className="text-xs font-medium">
                    {getRoleLabel(session.user.role)}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(authCardButtonClass, 'sm:w-auto sm:min-w-[10rem] border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive')}
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid flex-1 gap-6 lg:grid-cols-2">
          <SectionCard
            icon={User}
            title="Account information"
            description="Your identity and session summary."
          >
            <dl>
              <ProfileField label="Display name" value={displayName} />
              <ProfileField label="Email" value={session.user.email || '-'} />
              <ProfileField label="Platform role" value={getRoleLabel(session.user.role)} />
              <ProfileField label="Last login" value={formatDate(session.loginAt)} />
            </dl>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              icon={Globe}
              title="Preferences"
              description="Language and interface appearance."
            >
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="language" className="text-sm text-muted-foreground">
                    Language
                  </Label>
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="en">English</option>
                    <option value="id" disabled>
                      Indonesian (coming soon)
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Theme</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={cn(
                        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
                        theme === 'light'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background text-foreground hover:bg-muted/60',
                      )}
                    >
                      <Sun className="h-4 w-4" aria-hidden />
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={cn(
                        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
                        theme === 'dark'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background text-foreground hover:bg-muted/60',
                      )}
                    >
                      <Moon className="h-4 w-4" aria-hidden />
                      Dark
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={Shield}
              title="Session & security"
              description="Active session on this device."
            >
              <dl>
                <ProfileField label="Session token" value={maskToken(session.token)} mono />
              </dl>
              <p className="flex items-start gap-2 border-t border-border/40 py-4 text-xs leading-relaxed text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Token is partially masked for security. Sign out to end your session in this browser.
              </p>
              <div className="border-t border-border/40 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Passkey</p>
                    <p className="text-xs text-muted-foreground">
                      Add a passkey to sign in with your fingerprint / PIN — no password.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 gap-2"
                    onClick={() => void handleAddPasskey()}
                    disabled={passkeyBusy}
                  >
                    <Fingerprint className="h-4 w-4" />
                    {passkeyBusy ? 'Adding…' : 'Add passkey'}
                  </Button>
                </div>
                {passkeyMsg && (
                  <p className={cn('mt-3 text-xs', passkeyMsg.ok ? 'text-emerald-600' : 'text-destructive')}>
                    {passkeyMsg.text}
                  </p>
                )}
              </div>
            </SectionCard>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          Tectona Project Management Platform
        </footer>
      </div>
    </div>
  )
}
