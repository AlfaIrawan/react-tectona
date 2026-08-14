const DEFAULT_PLANTUML_BASE = '/api/plantuml'

export function resolvePlantUmlBaseUrl(): string {
  const configured = (import.meta.env.VITE_PLANTUML_BASE_URL as string | undefined)?.trim()
  return configured || DEFAULT_PLANTUML_BASE
}

export async function fetchPlantUmlPng(source: string, signal?: AbortSignal): Promise<Blob> {
  const trimmed = source.trim()
  if (!trimmed) {
    throw new Error('PlantUML source is empty.')
  }

  const baseUrl = resolvePlantUmlBaseUrl().replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/png`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: trimmed,
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      detail.trim()
        ? `PlantUML render failed (${response.status}): ${detail.slice(0, 180)}`
        : `PlantUML render failed (${response.status}). Pastikan plantuml-server berjalan.`,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('image')) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail.trim() || 'PlantUML server did not return an image.')
  }

  return response.blob()
}

export function plantUmlPreviewObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
