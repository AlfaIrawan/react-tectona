import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PlatformDataLoadingState } from '@/components/loading'
import { type ModuleId, useModuleAccess } from '@/auth/useModuleAccess'

export function ModuleRouteGuard(props: { moduleId: ModuleId }) {
  const { moduleId } = props
  const location = useLocation()
  const access = useModuleAccess()

  if (access.loading) {
    return (
      <PlatformDataLoadingState
        title="Checking module access"
        description="Verifying your workspace permissions."
      />
    )
  }

  if (!access.canAccess(moduleId)) {
    return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

