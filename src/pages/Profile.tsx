import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, User, Mail, Shield, Clock, Globe, Palette } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { getSession, logout, requireAuth, type Session } from '@/auth/authService'
import { useThemeStore } from '@/stores/theme-store'
import { cn } from '@/lib/utils'

export function ProfilePage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useThemeStore()
  const [session, setSession] = useState<Session | null>(null)
  const [language, setLanguage] = useState('Indonesian')

  // Load session and redirect if not authenticated
  useEffect(() => {
    const currentSession = requireAuth()
    if (!currentSession) {
      navigate('/login?next=/profile', { replace: true })
      return
    }
    setSession(currentSession)
  }, [navigate])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(date)
    } catch {
      return '-'
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'destructive'
      case 'reviewer':
        return 'secondary'
      case 'member':
        return 'default'
      default:
        return 'outline'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'Admin'
      case 'reviewer':
        return 'Reviewer'
      case 'member':
        return 'Member'
      default:
        return role
    }
  }

  const maskToken = (token: string) => {
    if (!token || token.length < 4) return '••••'
    return `${token.substring(0, 4)}-••••`
  }

  if (!session) {
    return null // Will redirect
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Profil</h1>
        <p className="text-muted-foreground">
          Informasi akun dan preferensi dasar
        </p>
      </div>

      {/* Card 1: Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informasi Akun
          </CardTitle>
          <CardDescription>
            Detail informasi akun Anda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama</Label>
            <Input
              id="name"
              value={session.user.name || '-'}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={session.user.email || '-'}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <div>
              <Badge variant={getRoleBadgeVariant(session.user.role)}>
                {getRoleLabel(session.user.role)}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loginAt" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Login Terakhir
            </Label>
            <Input
              id="loginAt"
              value={formatDate(session.loginAt)}
              readOnly
              className="bg-muted/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Preferensi
          </CardTitle>
          <CardDescription>
            Pengaturan tampilan dan bahasa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Bahasa
            </Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="Indonesian">Indonesian</option>
              <option value="English" disabled>English (Coming Soon)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Tema
            </Label>
            <div className="flex items-center gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="flex-1"
              >
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="flex-1"
              >
                Dark
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Session & Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Sesi & Keamanan
          </CardTitle>
          <CardDescription>
            Informasi sesi dan keamanan akun
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Session Token</Label>
            <Input
              id="token"
              value={maskToken(session.token)}
              readOnly
              className="bg-muted/50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Token sesi saat ini (dummy, non-operasional)
            </p>
          </div>
          <Separator />
          <div>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full sm:w-auto"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
