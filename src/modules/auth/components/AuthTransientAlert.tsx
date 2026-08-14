import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type AuthTransientAlertProps = {
  message: string
  onDismiss?: () => void
  variant?: 'error' | 'warning'
  autoHideMs?: number
  className?: string
}

export function AuthTransientAlert({
  message,
  onDismiss,
  variant = 'error',
  autoHideMs = 5000,
  className,
}: AuthTransientAlertProps) {
  const [visible, setVisible] = useState(Boolean(message))
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }

    setVisible(true)
    const timer = window.setTimeout(() => {
      setVisible(false)
      onDismissRef.current?.()
    }, autoHideMs)

    return () => window.clearTimeout(timer)
  }, [message, autoHideMs])

  if (!message) return null

  return (
    <div
      role="alert"
      className={cn(
        'rounded-md px-4 py-3 text-sm transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
        variant === 'error' && 'border border-destructive/20 bg-destructive/10 text-destructive',
        variant === 'warning' && 'border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
        className,
      )}
    >
      {message}
    </div>
  )
}
