import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AuthBackToLoginLink() {
  return (
    <Link
      to="/login"
      className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to sign in
    </Link>
  )
}
