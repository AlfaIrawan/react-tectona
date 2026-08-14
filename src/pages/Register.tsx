import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/auth/authService'
import { registerWithEmail } from '@/lib/api/identityApi'
import { displayNameFromEmail } from '@/lib/appAccessGate'
import { AuthBackToLoginLink } from '@/modules/auth/components/AuthBackToLoginLink'
import { AuthSocialProviders } from '@/modules/auth/components/AuthSocialProviders'
import { PasswordStrengthProgress } from '@/modules/auth/components/PasswordStrengthProgress'
import { AuthTransientAlert } from '@/modules/auth/components/AuthTransientAlert'
import { isStrongPassword, passwordPolicyErrorMessage } from '@/lib/passwordPolicy'
import { cn } from '@/lib/utils'
import { authCardButtonClass, authCardInputClass } from '@/lib/authUiClasses'
import { AuthTourButton } from '@/modules/auth/components/AuthTourButton'
import { AuthCopyrightNotice } from '@/modules/auth/components/AuthCopyrightNotice'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayNameTouched, setDisplayNameTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isEmailValid = email.length === 0 || emailRegex.test(email)
  const passwordsMatch = password === confirmPassword
  const isFormValid =
    isEmailValid
    && password.length > 0
    && passwordsMatch
    && !isSubmitting

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!isEmailValid || !passwordsMatch || password.length === 0) return

    if (!isStrongPassword(password)) {
      setError(passwordPolicyErrorMessage(password) ?? 'Password does not meet security requirements.')
      return
    }

    setIsSubmitting(true)
    try {
      await registerWithEmail({
        email,
        password,
        displayName: displayName.trim() || undefined,
      })
      await login(email, password)
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="glass-card rounded-lg shadow-2xl p-8 space-y-6">
          <AuthBackToLoginLink />

          <div id="register-card-header" className="space-y-2 text-center">
            <img src="/images/logo.png" alt="Tectona" className="mx-auto h-24 w-auto object-contain" />
            <p className="text-sm text-muted-foreground">Create your Tectona account</p>
          </div>

          <AuthTransientAlert message={error} onDismiss={() => setError('')} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => {
                  const nextEmail = e.target.value
                  setEmail(nextEmail)
                  setError('')
                  if (!displayNameTouched && emailRegex.test(nextEmail.trim())) {
                    setDisplayName(displayNameFromEmail(nextEmail.trim()))
                  }
                }}
                className={cn(authCardInputClass, !isEmailValid && email.length > 0 && 'border-destructive')}
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-name">Display name (optional)</Label>
              <Input
                id="register-name"
                className={authCardInputClass}
                value={displayName}
                onChange={(e) => {
                  setDisplayNameTouched(true)
                  setDisplayName(e.target.value)
                }}
                disabled={isSubmitting}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <div data-tour-target="register-password-input">
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                    required
                    className={cn(authCardInputClass, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthProgress password={password} className="pt-1" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-confirm">Confirm password</Label>
              <div data-tour-target="register-confirm-input">
                <Input
                  id="register-confirm"
                  type="password"
                  className={authCardInputClass}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  required
                />
                {!passwordsMatch && confirmPassword.length > 0 && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>
            </div>

            <Button id="register-submit" type="submit" className={authCardButtonClass} disabled={!isFormValid}>
              {isSubmitting ? 'Signing up…' : 'Sign up'}
            </Button>
          </form>

          <AuthSocialProviders id="register-social" mode="signup" />

          <p id="register-signin-link" className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <AuthTourButton page="register" />
      <AuthCopyrightNotice />
    </div>
  )
}
