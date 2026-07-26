/**
 * OpenTelemetry browser tracing. Optional: set VITE_OTEL_EXPORTER_OTLP_ENDPOINT
 * to send traces to the registry (Option A) for observed dependency discovery.
 */

/** Must match service_id used when registering this app in the registry. */
const DEFAULT_SERVICE_NAME = 'frontend-tectona'

/** Map origin port to backend service_id (must match registry_service.service_id). */
function peerServiceFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url)
    const port = u.port || (u.protocol === 'https:' ? '443' : '80')
    const map: Record<string, string> = {
      '8405': 'svc-registry',
      '8700': 'svc-notification',
      '8650': 'svc-todo',
      '8502': 'svc-base-model',
      '8500': 'svc-project',
      '8600': 'svc-dataset',
      '8400': 'svc-connector',
    }
    return map[port]
  } catch {
    return undefined
  }
}

export async function initTelemetry(): Promise<boolean> {
  const endpoint =
    import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string | undefined
  if (!endpoint?.trim()) return false

  try {
    const { BatchSpanProcessor, WebTracerProvider } = await import(
      '@opentelemetry/sdk-trace-web'
    )
    const { OTLPTraceExporter } = await import(
      '@opentelemetry/exporter-trace-otlp-proto'
    )
    const { Resource } = await import('@opentelemetry/resources')
    const { registerInstrumentations } = await import(
      '@opentelemetry/instrumentation'
    )
    const { FetchInstrumentation } = await import(
      '@opentelemetry/instrumentation-fetch'
    )

    const serviceName =
      (import.meta.env.VITE_OTEL_SERVICE_NAME as string) || DEFAULT_SERVICE_NAME
    const url = endpoint.trim().replace(/\/$/, '') + '/v1/traces'

    const exporter = new OTLPTraceExporter({ url })
    const provider = new WebTracerProvider({
      resource: new Resource({ 'service.name': serviceName }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    })
    provider.register()

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          applyCustomAttributesOnSpan(span, request) {
            const url =
              typeof request === 'string'
                ? request
                : request instanceof Request
                  ? request.url
                  : (request as { url?: string }).url
            if (url) {
              const peer = peerServiceFromUrl(url)
              if (peer) span.setAttribute('peer.service', peer)
            }
          },
        }),
      ],
    })

    return true
  } catch (e) {
    console.warn('[OTEL] init failed:', e)
    return false
  }
}
