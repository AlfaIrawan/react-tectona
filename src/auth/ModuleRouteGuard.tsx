import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { type ModuleId, useModuleAccess } from '@/auth/useModuleAccess'

export function ModuleRouteGuard(props: { moduleId: ModuleId }) {
  const { moduleId } = props
  const location = useLocation()
  const access = useModuleAccess()

  if (access.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Checking access</span>
      </div>
    )
  }

  if (!access.canAccess(moduleId)) {
    return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

