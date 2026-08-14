import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Database, RefreshCw, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api/httpClient'
import { KB_CONFIG_STORAGE_KEY, readKbConfig, type KbUiConfig } from '@/lib/kb/kbConfig'

type HealthState = 'idle' | 'checking' | 'healthy' | 'unhealthy'

export function KnowledgeBaseSettingsPanel() {
  const { addToast } = useToast()
  const [config, setConfig] = useState<KbUiConfig>(() => readKbConfig())
  const [healthState, setHealthState] = useState<HealthState>('idle')
  const [healthMessage, setHealthMessage] = useState('No connection check yet.')

  const normalizedBaseUrl = useMemo(() => config.baseUrl.trim().replace(/\/+$/, ''), [config.baseUrl])

  async function handleTestConnection() {
    if (!normalizedBaseUrl) {
      addToast({
        title: 'Base URL is empty',
        description: 'Enter the Knowledge Base URL first.',
        variant: 'error',
      })
      return
    }

    setHealthState('checking')
    setHealthMessage('Checking connection to the Knowledge Base service...')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutSeconds * 1000)

    try {
      const response = await apiFetch(`${normalizedBaseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      })

      if (response.ok) {
        setHealthState('healthy')
        setHealthMessage(`KB service reachable (${response.status}).`)
        addToast({
          title: 'KB connection succeeded',
          description: `Health endpoint responded ${response.status}.`,
          variant: 'success',
        })
      } else {
        setHealthState('unhealthy')
        setHealthMessage(`KB service responded with status ${response.status}.`)
        addToast({
          title: 'KB connection failed',
          description: `Health endpoint returned status ${response.status}.`,
          variant: 'error',
        })
      }
    } catch {
      setHealthState('unhealthy')
      setHealthMessage('Unable to reach the Knowledge Base /health endpoint.')
      addToast({
        title: 'KB connection failed',
        description: 'Check the base URL, CORS, and the KB service status.',
        variant: 'error',
      })
    } finally {
      clearTimeout(timer)
    }
  }

  function handleSave() {
    try {
      localStorage.setItem(
        KB_CONFIG_STORAGE_KEY,
        JSON.stringify({
          ...config,
          baseUrl: normalizedBaseUrl,
        })
      )
      addToast({
        title: 'KB configuration saved',
        description: 'Settings saved in this browser.',
        variant: 'success',
      })
    } catch {
      addToast({
        title: 'Failed to save configuration',
        description: 'Local browser storage is unavailable.',
        variant: 'error',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Knowledge Base service</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Manage the endpoint and connection behavior for the Tectona Knowledge Base service (UI validation only; the backend runtime still reads from the environment). To
            add or edit KB entry content (title, category, LLM context text), open{' '}
            <Link to="/document-knowledge-management" className="font-medium text-primary underline-offset-4 hover:underline">
              Document &amp; Knowledge Management
            </Link>{' '}
            on the Knowledge Base Integration card.
          </p>
        </div>
        <Button type="button" className="gap-2 shrink-0" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Save KB configuration
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              Runtime connection settings
            </CardTitle>
            <CardDescription>
              These settings are used for UI validation only. The runtime service still reads its configuration from the backend environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="kb-enabled" className="text-sm font-medium">
                  Enable Knowledge Base integration
                </Label>
                <p className="text-xs text-muted-foreground">Disable this to run summaries without KB enrichment.</p>
              </div>
              <Switch
                id="kb-enabled"
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-base-url">Knowledge Base base URL</Label>
              <Input
                id="kb-base-url"
                value={config.baseUrl}
                placeholder="http://localhost:8415"
                onChange={(event) => setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-timeout">Health check timeout (seconds)</Label>
              <Input
                id="kb-timeout"
                type="number"
                min={1}
                max={30}
                value={config.timeoutSeconds}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setConfig((prev) => ({ ...prev, timeoutSeconds: Number.isFinite(value) && value > 0 ? value : 1 }))
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" className="gap-2" onClick={handleTestConnection}>
                <RefreshCw className="h-4 w-4" />
                Test connection
              </Button>

              <Badge
                variant="outline"
                className={
                  healthState === 'healthy'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : healthState === 'unhealthy'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : healthState === 'checking'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : ''
                }
              >
                {healthState === 'healthy'
                  ? 'Healthy'
                  : healthState === 'unhealthy'
                    ? 'Unhealthy'
                    : healthState === 'checking'
                      ? 'Checking...'
                      : 'Not checked'}
              </Badge>

              <span className="text-xs text-muted-foreground">{healthMessage}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Integration notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-md border border-dashed p-3">
              <p className="font-medium text-foreground">Current runtime source of truth</p>
              <p>The service runtime still uses the backend env on startup.</p>
            </div>
            <div className="rounded-md border border-dashed p-3">
              <p className="font-medium text-foreground">Recommended target</p>
              <p>http://localhost:8415 for python-tectona-knowledge-base-service-fastapi.</p>
            </div>
            <div className="rounded-md border border-dashed p-3">
              <p className="font-medium text-foreground">Operational guardrail</p>
              <p>Re-enable KB once the service health is stable to avoid repeated fallbacks.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>UI validation does not store sensitive credentials.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <BadgeCheck className="h-3.5 w-3.5" />
              <span>Use Save KB configuration to persist to local browser storage.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
