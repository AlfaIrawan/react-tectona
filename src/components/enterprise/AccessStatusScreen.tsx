import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'

/** Shared visual frame; caller owns permission, outage and navigation behavior. */
export function AccessStatusScreen({ title, description, context, actions, announce = false, embedded = false }: {
  title: string
  description: ReactNode
  context?: ReactNode
  actions: ReactNode
  announce?: boolean
  embedded?: boolean
}) {
  return (
    <div className={embedded ? 'flex min-h-full flex-1 items-center justify-center p-4' : 'min-h-screen flex items-center justify-center p-4'}>
      <div className="w-full max-w-md">
        <div className="liquid-glass-enterprise-panel rounded-lg p-8 space-y-6">
          <div className="space-y-2 text-center">
            <img src="/images/tectona-wordmark.svg" alt="Tectona" className="mx-auto h-24 w-auto object-contain" />
          </div>
          <div role={announce ? 'alert' : undefined} className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-destructive" aria-hidden />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>
          {context}
          {actions}
        </div>
      </div>
    </div>
  )
}
