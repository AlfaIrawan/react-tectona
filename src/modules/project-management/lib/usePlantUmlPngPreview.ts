import { useEffect, useState } from 'react'
import { fetchPlantUmlPng } from '@/modules/project-management/lib/plantumlRenderClient'

type PlantUmlPngPreviewState = {
  objectUrl: string | null
  isLoading: boolean
  error: string | null
}

/**
 * Fetches a PlantUML source string as a rendered PNG (via the shared plantuml-server proxy) and
 * exposes it as an object URL. Manages the blob: URL lifecycle (revoke on source change/unmount)
 * so callers don't leak memory across regenerates.
 */
export function usePlantUmlPngPreview(source: string | null | undefined): PlantUmlPngPreviewState {
  const [state, setState] = useState<PlantUmlPngPreviewState>({ objectUrl: null, isLoading: false, error: null })

  useEffect(() => {
    const trimmed = (source ?? '').trim()
    if (!trimmed) {
      setState({ objectUrl: null, isLoading: false, error: null })
      return
    }

    const controller = new AbortController()
    let currentObjectUrl: string | null = null
    setState((prev) => ({ objectUrl: prev.objectUrl, isLoading: true, error: null }))

    void (async () => {
      try {
        const blob = await fetchPlantUmlPng(trimmed, controller.signal)
        if (controller.signal.aborted) return
        currentObjectUrl = URL.createObjectURL(blob)
        setState({ objectUrl: currentObjectUrl, isLoading: false, error: null })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ objectUrl: null, isLoading: false, error: error instanceof Error ? error.message : 'Failed to render diagram.' })
      }
    })()

    return () => {
      controller.abort()
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl)
    }
  }, [source])

  return state
}
