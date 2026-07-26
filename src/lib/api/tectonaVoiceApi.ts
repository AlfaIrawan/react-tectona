/**
 * Tectona Voice Service API client (self-host STT).
 *
 * Traffic goes through Laurus gateway-runtime (`serviceApiBase` → `/api/gateway-runtime`
 * → published route `/api/tectona-voice` → upstream `host.docker.internal:8418` in local Docker).
 * Optional override: `VITE_TECTONA_VOICE_API_URL` (e.g. direct `http://127.0.0.1:8418` for debugging).
 *
 * All audio stays on-prem: the browser records an utterance and posts it here for
 * transcription + optional wake-word detection. No third-party cloud STT is used.
 */

import { actorHeaders } from './httpClient'
import { serviceApiBase } from './gatewayBase'

const BASE_URL = serviceApiBase('/api/tectona-voice', import.meta.env.VITE_TECTONA_VOICE_API_URL)

function humanizeVoiceError(status: number, raw: string): string {
  const text = (raw || '').trim()
  if (text) {
    try {
      const body = JSON.parse(text) as {
        detail?: string
        error?: { message?: string; code?: number }
        message?: string
      }
      const gatewayMessage = body.error?.message || body.message || (typeof body.detail === 'string' ? body.detail : '')
      if (gatewayMessage) {
        const lower = gatewayMessage.toLowerCase()
        if (
          lower.includes('failed to reach upstream')
          || lower.includes('host.docker.internal')
          || lower.includes('connection refused')
        ) {
          return (
            'Gateway cannot reach Tectona Voice (upstream :8418). '
            + 'Start python-tectona-voice-service-fastapi on the host, confirm gateway-runtime can resolve '
            + 'host.docker.internal:8418, and that the /api/tectona-voice route is published.'
          )
        }
        if (lower.includes('no published route') || lower.includes('tectona-voice')) {
          return (
            'Tectona Voice has no published gateway route for /api/tectona-voice. '
            + 'Run tectona_dev_bootstrap on gateway-control-plane and ensure gateway-runtime is up (:8084).'
          )
        }
        if (
          lower.includes('1094995529')
          || lower.includes('invalid data')
          || lower.includes("'<none>'")
          || lower.includes('could not decode')
        ) {
          return (
            'Audio could not be decoded for transcription. '
            + 'Use Re-record, speak for a few seconds, then Stop & transcribe once (do not interrupt mid-save).'
          )
        }
        return gatewayMessage
      }
    } catch {
      /* raw text fallback below */
    }
  }
  if (status === 404) {
    return 'Voice transcribe endpoint not found. Start python-tectona-voice-service-fastapi on port 8418.'
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'Voice service is unavailable. Start python-tectona-voice-service-fastapi (port 8418) and retry.'
  }
  return text || `Voice transcribe failed (HTTP ${status})`
}

export interface VoiceWakeMatch {
  matched: boolean
  wake_phrase?: string | null
  command?: string | null
}

export interface VoiceTranscriptSegment {
  start: number
  end: number
  text: string
}

export interface TranscribeResponse {
  text: string
  language?: string | null
  language_probability?: number
  duration?: number
  elapsed_ms?: number
  segments?: VoiceTranscriptSegment[]
  wake?: VoiceWakeMatch | null
}

export interface TranscribeOptions {
  /** Force a language code (e.g. "id"). Omit to use the server default. */
  language?: string
  /** Also run wake-word detection and return `wake`. */
  detectWake?: boolean
  /** Abort signal so callers can cancel in-flight transcription. */
  signal?: AbortSignal
  /** Request timeout (ms). Default 30s — CPU Whisper on a short utterance is well under this. */
  timeoutMs?: number
}

/** Transcribe a recorded audio blob via the on-prem Whisper service. */
export async function transcribeAudio(
  audio: Blob,
  options: TranscribeOptions = {},
): Promise<TranscribeResponse> {
  const { language, detectWake = false, timeoutMs = 30_000 } = options

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const form = new FormData()
  const mime = (audio.type || '').toLowerCase()
  const ext = mime.includes('wav')
    ? 'wav'
    : mime.includes('ogg')
      ? 'ogg'
      : mime.includes('mp4') || mime.includes('m4a')
        ? 'm4a'
        : 'webm'
  // Filename extension matters for some STT/PyAV probes.
  form.append('file', audio, `utterance.${ext}`)
  if (language) form.append('language', language)

  const url = `${BASE_URL}/v1/voice/transcribe${detectWake ? '?detect_wake=true' : ''}`

  try {
    const headers = new Headers(actorHeaders())
    headers.delete('Content-Type') // let the browser set multipart boundary
    const res = await fetch(url, { method: 'POST', headers, body: form, signal: controller.signal })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(humanizeVoiceError(res.status, text))
    }
    return (await res.json()) as TranscribeResponse
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Voice transcription timed out or was cancelled.')
    }
    if (error instanceof TypeError) {
      throw new Error(
        'Cannot reach Tectona Voice service. Start python-tectona-voice-service-fastapi on port 8418.',
      )
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export interface VoiceReadyState {
  status: string
  model_size?: string
  device?: string
  compute_type?: string
  model_loaded?: boolean
  wake_phrases?: string[]
}

/** Probe the voice service readiness (model/config + loaded state). */
export async function fetchVoiceReady(): Promise<VoiceReadyState | null> {
  try {
    const res = await fetch(`${BASE_URL}/health/ready`, { method: 'GET', headers: actorHeaders() })
    if (!res.ok) return null
    return (await res.json()) as VoiceReadyState
  } catch {
    return null
  }
}
