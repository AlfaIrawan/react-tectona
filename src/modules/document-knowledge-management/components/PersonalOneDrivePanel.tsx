/**
 * OneDrive (Microsoft Graph /me/drive) browser for a personal Tectona workspace.
 */
import { useCallback, useEffect, useState } from 'react'
import { Cloud, ExternalLink, FileText, Folder, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { startSocialOAuthLogin } from '@/lib/authProviders'
import {
  fetchMicrosoftDriveChildren,
  MicrosoftGraphConsentRequiredError,
  type MicrosoftDriveItem,
  type MicrosoftDriveListing,
} from '@/lib/api/microsoftGraphApi'
import { cn } from '@/lib/utils'
import { storeOAuthIntent } from '@/lib/oauthPkce'

type PersonalOneDrivePanelProps = {
  className?: string
}

export function PersonalOneDrivePanel({ className }: PersonalOneDrivePanelProps) {
  const [listing, setListing] = useState<MicrosoftDriveListing | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [consentRequired, setConsentRequired] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const load = useCallback(async (itemId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchMicrosoftDriveChildren(itemId)
      setListing(next)
      setConsentRequired(false)
    } catch (err) {
      if (err instanceof MicrosoftGraphConsentRequiredError) {
        setListing(null)
        setConsentRequired(true)
        setError(null)
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load OneDrive.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(folderId)
  }, [folderId, load])

  const connect = async () => {
    setConnecting(true)
    try {
      storeOAuthIntent('graph')
      sessionStorage.setItem('tectona:oauth-next', `${window.location.pathname}${window.location.search}`)
      await startSocialOAuthLogin('microsoft', { oauthIntent: 'graph' })
    } catch (err) {
      setConnecting(false)
      setError(err instanceof Error ? err.message : 'Could not start Microsoft sign-in.')
    }
  }

  const openItem = (item: MicrosoftDriveItem) => {
    if (item.kind === 'folder') {
      setFolderId(item.id)
      return
    }
    if (item.web_url) {
      window.open(item.web_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      {consentRequired ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-6 text-center">
          <Cloud className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">Connect OneDrive to this personal workspace</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Sign in with Microsoft so Tectona can list items in your drive (`Files.Read`). Use
            alfa.irawan@adira.co.id for the first check.
          </p>
          <Button type="button" className="mt-3 h-9" disabled={connecting} onClick={() => void connect()}>
            {connecting ? 'Redirecting…' : 'Sign in with Microsoft'}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {!consentRequired && listing ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            {listing.folder.parent_id ? (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                onClick={() => setFolderId(listing.folder.parent_id || null)}
              >
                Up
              </button>
            ) : (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                onClick={() => setFolderId(null)}
              >
                My files
              </button>
            )}
            <span className="font-medium text-foreground">{listing.folder.name}</span>
            {listing.folder.web_url ? (
              <a
                href={listing.folder.web_url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
              >
                Open in OneDrive
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
          {listing.items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">This folder is empty.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {listing.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => openItem(item)}
                  >
                    {item.kind === 'folder' ? (
                      <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                    {item.kind === 'folder' && item.child_count != null ? (
                      <span className="text-[11px] tabular-nums text-muted-foreground">{item.child_count}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {loading && !listing && !consentRequired ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading OneDrive…
        </p>
      ) : null}
    </div>
  )
}
