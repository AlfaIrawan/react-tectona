import * as React from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Bell, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Above workspace drawers (z-1100) and most page modals (≤1350). */
const TOAST_LAYER_Z_INDEX = 'z-[1400]'

/** Waktu toast tetap terbaca setelah animasi masuk (ms). */
const TOAST_VISIBLE_MS = 7500
/** Durasi slide/fade masuk & keluar (ms) - selaras `duration-[320ms]` di bawah. */
const TOAST_MOTION_MS = 320

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'info' | 'warning'
  onClick?: () => void
}

type ToastInput = Omit<Toast, 'id'>

const globalToastListeners = new Set<(toast: ToastInput) => void>()

function subscribeGlobalToast(listener: (toast: ToastInput) => void) {
  globalToastListeners.add(listener)
  return () => {
    globalToastListeners.delete(listener)
  }
}

export function pushGlobalToast(toast: ToastInput) {
  for (const listener of globalToastListeners) {
    listener(toast)
  }
}

const ToastContext = React.createContext<ToastContextType | null>(null)

type ToastPhase = 'enter' | 'idle' | 'leave'

const MAX_VISIBLE_TOASTS = 5

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast
  onRemove: () => void
}) {
  const [phase, setPhase] = React.useState<ToastPhase>('enter')
  const clickable = typeof toast.onClick === 'function'

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('idle'))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  React.useEffect(() => {
    const t = window.setTimeout(() => setPhase('leave'), TOAST_VISIBLE_MS)
    return () => window.clearTimeout(t)
  }, [])

  React.useEffect(() => {
    if (phase !== 'leave') return
    const t = window.setTimeout(onRemove, TOAST_MOTION_MS)
    return () => window.clearTimeout(t)
  }, [phase, onRemove])

  return (
    <div
      role="status"
      tabIndex={clickable ? 0 : undefined}
      onClick={
        clickable
          ? () => {
              toast.onClick?.()
              setPhase('leave')
            }
          : undefined
      }
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toast.onClick?.()
                setPhase('leave')
              }
            }
          : undefined
      }
      className={cn(
        'group relative min-w-[320px] max-w-[420px] rounded-xl p-4 shadow-xl backdrop-blur-xl border transition-all duration-300',
        'transform will-change-transform duration-[320ms]',
        clickable && 'cursor-pointer pointer-events-auto hover:scale-[1.02]',
        !clickable && 'hover:shadow-2xl hover:scale-105 hover:translate-x-1',
        toast.variant === 'success' && 'bg-gradient-to-r from-emerald-950/95 to-teal-950/95 border-emerald-700/50 hover:border-emerald-600/80',
        toast.variant === 'error' && 'bg-gradient-to-r from-red-950/95 to-rose-950/95 border-red-700/50 hover:border-red-600/80',
        toast.variant === 'warning' && 'bg-gradient-to-r from-amber-950/95 to-orange-950/95 border-amber-700/50 hover:border-amber-600/80',
        toast.variant === 'info' && 'bg-gradient-to-r from-sky-950/95 to-blue-950/95 border-sky-700/50 hover:border-sky-600/80',
        (toast.variant === 'default' || !toast.variant) && 'bg-gradient-to-r from-slate-900/95 to-slate-800/95 border-slate-700/50 hover:border-slate-600/80',
        phase === 'enter' && 'translate-x-[120%] opacity-0 transition-none',
        phase === 'idle' && 'translate-x-0 opacity-100 ease-out',
        phase === 'leave' && 'translate-x-[120%] opacity-0 ease-in'
      )}
    >
      {/* Accent line top */}
      {toast.variant === 'success' && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-emerald-500/0 rounded-t-xl"></div>
      )}
      {toast.variant === 'error' && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500/0 via-red-400 to-red-500/0 rounded-t-xl"></div>
      )}
      {toast.variant === 'warning' && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500/0 via-amber-400 to-amber-500/0 rounded-t-xl"></div>
      )}
      {toast.variant === 'info' && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500/0 via-sky-400 to-sky-500/0 rounded-t-xl"></div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="relative flex-shrink-0">
          {toast.variant === 'success' && (
            <>
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur opacity-30"></div>
              <div className="relative">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" strokeWidth={2.5} />
              </div>
            </>
          )}
          {toast.variant === 'error' && (
            <>
              <div className="absolute inset-0 bg-red-400 rounded-full blur opacity-30"></div>
              <div className="relative">
                <AlertCircle className="w-6 h-6 text-red-400" strokeWidth={2.5} />
              </div>
            </>
          )}
          {toast.variant === 'warning' && (
            <>
              <div className="absolute inset-0 bg-amber-400 rounded-full blur opacity-30"></div>
              <div className="relative">
                <AlertTriangle className="w-6 h-6 text-amber-400" strokeWidth={2.5} />
              </div>
            </>
          )}
          {toast.variant === 'info' && (
            <>
              <div className="absolute inset-0 bg-sky-400 rounded-full blur opacity-30"></div>
              <div className="relative">
                <Info className="w-6 h-6 text-sky-400" strokeWidth={2.5} />
              </div>
            </>
          )}
          {(toast.variant === 'default' || !toast.variant) && (
            <>
              <div className="absolute inset-0 bg-slate-400 rounded-full blur opacity-30"></div>
              <div className="relative">
                <Bell className="w-6 h-6 text-slate-300" strokeWidth={2.5} />
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-semibold leading-tight',
            toast.variant === 'success' && 'text-emerald-100',
            toast.variant === 'error' && 'text-red-100',
            toast.variant === 'warning' && 'text-amber-100',
            toast.variant === 'info' && 'text-sky-100',
            (toast.variant === 'default' || !toast.variant) && 'text-slate-100'
          )}>
            {toast.title}
          </p>
          {toast.description && (
            <p className={cn(
              'text-xs mt-1.5 leading-relaxed whitespace-pre-wrap break-words',
              toast.variant === 'success' && 'text-emerald-200/80',
              toast.variant === 'error' && 'text-red-200/80',
              toast.variant === 'warning' && 'text-amber-200/80',
              toast.variant === 'info' && 'text-sky-200/80',
              (toast.variant === 'default' || !toast.variant) && 'text-slate-300/80'
            )}>
              {toast.description}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setPhase('leave')
          }}
          className={cn(
            'flex-shrink-0 p-1 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100',
            toast.variant === 'success' && 'hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200',
            toast.variant === 'error' && 'hover:bg-red-500/20 text-red-300 hover:text-red-200',
            toast.variant === 'warning' && 'hover:bg-amber-500/20 text-amber-300 hover:text-amber-200',
            toast.variant === 'info' && 'hover:bg-sky-500/20 text-sky-300 hover:text-sky-200',
            (toast.variant === 'default' || !toast.variant) && 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
          )}
          aria-label="Tutup notifikasi"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  React.useEffect(() => {
    return subscribeGlobalToast(addToast)
  }, [addToast])

  // Ambil toasts yang paling baru (dari belakang array)
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS)
  const hiddenToastsCount = Math.max(0, toasts.length - MAX_VISIBLE_TOASTS)

  const toastStack = (
    <div
      className={cn(
        'fixed top-20 right-6 flex flex-col gap-3 pointer-events-none',
        TOAST_LAYER_Z_INDEX
      )}
      aria-live="polite"
      aria-relevant="additions"
    >
      {hiddenToastsCount > 0 && (
        <div className="pointer-events-auto group animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="relative min-w-[320px] max-w-[420px] bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-slate-700/50 hover:border-slate-600/80 transition-all duration-300">
            {/* Accent line */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500/0 via-blue-400 to-blue-500/0 rounded-t-xl"></div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Icon badge */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-lg blur opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                  <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {hiddenToastsCount} More {hiddenToastsCount === 1 ? 'Notification' : 'Notifications'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Waiting in queue</p>
                </div>
              </div>

              {/* Counter badge */}
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur opacity-40"></div>
                  <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-slate-900 text-xs shadow-lg">
                    {hiddenToastsCount > 99 ? '99+' : hiddenToastsCount}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {visibleToasts.map((toast, idx) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {typeof document !== 'undefined' ? createPortal(toastStack, document.body) : toastStack}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
