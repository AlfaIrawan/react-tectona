import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, KeyRound, Fingerprint } from 'lucide-react'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/modules/auth/auth-tour.css'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { providerIcon } from '@/modules/auth/components/authProviderIcons'
import {
  getLoginPasskeyTourSteps,
  getLoginPasswordTourSteps,
  getLoginMicrosoftTourSteps,
  getRegisterPasswordTourSteps,
  getRegisterMicrosoftTourSteps,
} from '@/modules/auth/authTourSteps'

type AuthTourPage = 'login' | 'register'
type LoginMethod = 'password' | 'passkey' | 'microsoft'
type RegisterMethod = 'password' | 'microsoft'
type TourTarget = { page: 'login'; method: LoginMethod } | { page: 'register'; method: RegisterMethod }

const PENDING_TOUR_KEY = 'tectona:pending-auth-tour'
const MENU_SEEN_KEY = 'tectona:auth-tour-menu-seen'

function encodeTarget(target: TourTarget): string {
  return `${target.page}:${target.method}`
}

function decodeTarget(value: string | null): TourTarget | null {
  if (!value) return null
  const [page, method] = value.split(':')
  if (page === 'login' && (method === 'password' || method === 'passkey' || method === 'microsoft')) {
    return { page, method }
  }
  if (page === 'register' && (method === 'password' || method === 'microsoft')) {
    return { page, method }
  }
  return null
}

function stepsFor(target: TourTarget): DriveStep[] {
  if (target.page === 'login') {
    switch (target.method) {
      case 'password':
        return getLoginPasswordTourSteps()
      case 'passkey':
        return getLoginPasskeyTourSteps()
      case 'microsoft':
        return getLoginMicrosoftTourSteps()
    }
  }
  switch (target.method) {
    case 'password':
      return getRegisterPasswordTourSteps()
    case 'microsoft':
      return getRegisterMicrosoftTourSteps()
  }
}

function runTour(target: TourTarget) {
  let resizeObserver: ResizeObserver | null = null

  const driverObj = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: 'tectona-tour-popover',
    skipMissingElement: true,
    nextBtnText: 'Next',
    prevBtnText: 'Previous',
    doneBtnText: 'Done',
    steps: stepsFor(target),
    // Keep the spotlight in sync with fields that grow (password strength
    // meter, confirm-password mismatch hint) while this step is showing.
    onHighlighted: (element) => {
      resizeObserver?.disconnect()
      if (element) {
        resizeObserver = new ResizeObserver(() => driverObj.refresh())
        resizeObserver.observe(element)
      }
    },
    onDestroyed: () => {
      resizeObserver?.disconnect()
      resizeObserver = null
    },
  })

  driverObj.drive()
}

type AuthTourButtonProps = {
  page: AuthTourPage
}

export function AuthTourButton({ page }: AuthTourButtonProps) {
  const navigate = useNavigate()
  const [hasSeen, setHasSeen] = useState(() => {
    if (window.localStorage.getItem(MENU_SEEN_KEY) === '1') return true
    return decodeTarget(window.sessionStorage.getItem(PENDING_TOUR_KEY))?.page === page
  })

  useEffect(() => {
    const pending = decodeTarget(window.sessionStorage.getItem(PENDING_TOUR_KEY))
    if (pending?.page === page) {
      window.sessionStorage.removeItem(PENDING_TOUR_KEY)
      window.localStorage.setItem(MENU_SEEN_KEY, '1')
      runTour(pending)
    }
  }, [page])

  const selectTour = (target: TourTarget) => {
    window.localStorage.setItem(MENU_SEEN_KEY, '1')
    setHasSeen(true)

    if (target.page === page) {
      runTour(target)
      return
    }

    window.sessionStorage.setItem(PENDING_TOUR_KEY, encodeTarget(target))
    navigate(target.page === 'login' ? '/login' : '/register')
  }

  return (
    <div className="tectona-auth-tour-fab flex items-center gap-2">
      <span className="text-xs text-muted-foreground" title={`Build ${__APP_BUILD_HASH__}`}>
        Build Version v{__APP_VERSION__}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Sign in / sign up help"
            title="Sign in / sign up help"
          >
            {!hasSeen && (
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" aria-hidden />
            )}
            <HelpCircle className="relative h-6 w-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <DropdownMenuLabel>Sign in Guide</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => selectTour({ page: 'login', method: 'password' })}>
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">Sign in with email & password</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => selectTour({ page: 'login', method: 'passkey' })}>
            <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Passkey</p>
              <p className="text-xs text-muted-foreground">Sign in with fingerprint or Face ID</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => selectTour({ page: 'login', method: 'microsoft' })}>
            {providerIcon('microsoft')}
            <div>
              <p className="font-medium text-foreground">Microsoft</p>
              <p className="text-xs text-muted-foreground">Sign in with your Microsoft account</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Sign up Guide</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => selectTour({ page: 'register', method: 'password' })}>
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">Create an account with email & password</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => selectTour({ page: 'register', method: 'microsoft' })}>
            {providerIcon('microsoft')}
            <div>
              <p className="font-medium text-foreground">Microsoft</p>
              <p className="text-xs text-muted-foreground">Sign up with your Microsoft account</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
