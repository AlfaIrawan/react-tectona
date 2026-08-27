import { Suspense, lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './modules/core-shell/components/AppLayout'
import { ToastProvider } from './components/ui/toast'
import { PlatformRouteLoadingFallback } from './components/loading'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppAccessGate } from './auth/AppAccessGate'
import { OnboardingGate } from './auth/OnboardingGate'
import { WorkspaceScopeRedirectLayout, WorkspaceSlugLayout } from './auth/WorkspaceSlugLayout'
import { SessionProvider } from './auth/SessionProvider'
import { TectonaNavigateBridge } from './modules/core-shell/components/TectonaNavigateBridge'
import { renderTectonaShellRoutes } from './routes/tectonaShellRoutes'
import { getSession } from '@/auth/authService'
import { TENANT_STORAGE_KEY, type StoredTenantSelection } from './lib/onboardingFeature'
import { isAllWorkspacesRouteScope, workspaceScopedPath } from './lib/workspaceRouting'
import { LAST_ROUTE_STORAGE_KEY, readStoredTenantSubjectId } from './lib/storedUserWorkspaceContext'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { OnboardingStatusPage } from './pages/OnboardingStatusPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { TenantDeepLinkPage } from './pages/TenantDeepLinkPage'
import { AccessDeniedPage } from './pages/AccessDeniedPage'
import { AppBackgroundVideo } from './components/layout/AppBackgroundVideo'

const ProfilePage = lazy(() => import('./pages/Profile').then((m) => ({ default: m.ProfilePage })))

function readStoredTenantForRouting(): StoredTenantSelection | null {
  try {
    const session = getSession()
    const boundSubjectId = readStoredTenantSubjectId()
    if (!session?.user.id || boundSubjectId !== session.user.id) {
      return null
    }
    const raw = sessionStorage.getItem(TENANT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredTenantSelection
  } catch {
    return null
  }
}

function resolveDefaultHomePath(): string {
  if (typeof window === 'undefined') return '/projects'

  const tenant = readStoredTenantForRouting()
  const scopedProjects = workspaceScopedPath(
    tenant?.slug,
    '/projects',
    tenant?.workspaceId,
  )

  try {
    const stored = localStorage.getItem(LAST_ROUTE_STORAGE_KEY)?.trim()
    if (stored && stored.startsWith('/') && stored !== '/' && !stored.startsWith('/login')) {
      const path = stored.startsWith('/w/')
        ? stored.replace(/^\/w\/[^/]+/, '') || '/projects'
        : stored
      if (path.startsWith('/workspace-management')) {
        return scopedProjects
      }
      return workspaceScopedPath(tenant?.slug, path, tenant?.workspaceId)
    }
  } catch {
    // ignore
  }

  if (tenant?.tenantMode === 'organization' && tenant.slug && !isAllWorkspacesRouteScope(tenant.workspaceId)) {
    return scopedProjects
  }

  return scopedProjects
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppBackgroundVideo />
      <ToastProvider>
        <BrowserRouter>
          <SessionProvider>
            <TectonaNavigateBridge />
            <Suspense fallback={<PlatformRouteLoadingFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/login/oauth/callback" element={<OAuthCallbackPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/verify_email" element={<VerifyEmailPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
                  <Route path="/t/:slug" element={<TenantDeepLinkPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/no-workspace-access" element={<Navigate to="/onboarding" replace />} />
                  <Route path="/access-denied" element={<AccessDeniedPage />} />

                  <Route element={<OnboardingGate />}>
                    <Route element={<AppAccessGate />}>
                      <Route element={<AppLayout />}>
                        <Route path="/" element={<Navigate to={resolveDefaultHomePath()} replace />} />
                        <Route element={<WorkspaceScopeRedirectLayout />}>
                          {renderTectonaShellRoutes('absolute')}
                        </Route>
                        <Route path="/w/:workspaceSlug" element={<WorkspaceSlugLayout />}>
                          {renderTectonaShellRoutes('nested')}
                        </Route>
                        <Route path="*" element={<Navigate to={resolveDefaultHomePath()} replace />} />
                      </Route>
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </SessionProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
