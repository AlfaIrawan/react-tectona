import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authCardButtonClass } from '@/lib/authUiClasses'

type CorporateOrgReadyStepProps = {
  organizationName: string
  emailDomain?: string
  defaultWorkspaceName?: string | null
  onContinue: () => void
}

export function CorporateOrgReadyStep({
  organizationName,
  emailDomain,
  defaultWorkspaceName,
  onContinue,
}: CorporateOrgReadyStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold">Your organization is recognized</h2>
        <p className="text-sm text-muted-foreground">
          {emailDomain ? (
            <>
              Your email domain <span className="font-medium text-foreground">{emailDomain}</span> is verified
              for <span className="font-medium text-foreground">{organizationName}</span>.
            </>
          ) : (
            <>We matched your email domain to a registered company account.</>
          )}{' '}
          Create your personal workspace first, then you can request access to the organization workspace
          {defaultWorkspaceName ? (
            <>
              {' '}
              (<span className="font-medium text-foreground">{defaultWorkspaceName}</span>)
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="rounded-xl border bg-muted/30 px-4 py-5 text-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-foreground">{organizationName}</p>
            {defaultWorkspaceName ? (
              <p className="text-muted-foreground">
                Default workspace: <span className="font-medium text-foreground">{defaultWorkspaceName}</span>
              </p>
            ) : null}
            <p className="text-xs text-green-700 dark:text-green-400">Domain verified</p>
          </div>
        </div>
      </div>

      <Button type="button" className={authCardButtonClass} onClick={onContinue}>
        Continue
      </Button>
    </div>
  )
}
