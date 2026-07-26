/**
 * Always-listening voice wake hook for the Tectona assistant.
 *
 * Pipeline (all on-prem):
 *   mic → Web Audio energy VAD → record utterance (MediaRecorder) → POST /transcribe (Whisper)
 *   → wake-word match ("Hai Tec ...") → onCommand(command)
 *
 * The VAD only sends an utterance to the server once speech ends, so the mic stream
 * never leaves the browser as a raw feed — only short, speech-bounded clips are posted.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { transcribeAudio, type TranscribeResponse } from '@/lib/api/tectonaVoiceApi'

export type VoiceWakeState =
  | 'idle'
  | 'listening'
  | 'capturing'
  | 'transcribing'
  | 'awaiting-command'
  | 'error'

export interface UseTectonaVoiceWakeOptions {
  /** Fired with the spoken command (text after the wake phrase, or a full follow-up utterance). */
  onCommand: (command: string, response: TranscribeResponse) => void
  /** Fired when the wake phrase is heard but no command followed (bare "Hai Tec"). */
  onWakeOnly?: () => void
  /** Force STT language. Defaults to server default (id). */
  language?: string
  /** RMS (0..1) above which we consider speech started. Default 0.035. */
  startThreshold?: number
  /** Silence duration (ms) that ends an utterance. Default 900ms. */
  silenceMs?: number
  /** Hard cap on a single utterance (ms). Default 9000ms. */
  maxUtteranceMs?: number
  /** Minimum utterance length (ms) worth sending. Default 350ms (drops coughs/clicks). */
  minUtteranceMs?: number
}

interface VoiceWakeApi {
  enabled: boolean
  state: VoiceWakeState
  lastError: string | null
  lastTranscript: string | null
  enable: () => Promise<void>
  disable: () => void
  toggle: () => void
}

const FFT_SIZE = 2048

export function useTectonaVoiceWake(options: UseTectonaVoiceWakeOptions): VoiceWakeApi {
  const {
    onCommand,
    onWakeOnly,
    language,
    startThreshold = 0.035,
    silenceMs = 900,
    maxUtteranceMs = 9000,
    minUtteranceMs = 350,
  } = options

  const [enabled, setEnabled] = useState(false)
  const [state, setState] = useState<VoiceWakeState>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastTranscript, setLastTranscript] = useState<string | null>(null)

  // Keep the latest callbacks/flags in refs so the long-lived VAD loop never goes stale.
  const onCommandRef = useRef(onCommand)
  const onWakeOnlyRef = useRef(onWakeOnly)
  onCommandRef.current = onCommand
  onWakeOnlyRef.current = onWakeOnly
  const awaitingCommandRef = useRef(false)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingRef = useRef(false)
  const speechStartedAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const enabledRef = useRef(false)
  const transcribingRef = useRef(false)

  const now = () => performance.now()

  const handleUtterance = useCallback(
    async (blob: Blob) => {
      if (transcribingRef.current) return // serialize STT calls
      transcribingRef.current = true
      setState('transcribing')
      try {
        const res = await transcribeAudio(blob, { language, detectWake: true })
        setLastTranscript(res.text || '')

        const directCommand = awaitingCommandRef.current
        if (directCommand) {
          // We already heard the wake word; this whole utterance is the command.
          awaitingCommandRef.current = false
          const text = (res.text || '').trim()
          if (text) onCommandRef.current(text, res)
        } else if (res.wake?.matched) {
          const command = (res.wake.command || '').trim()
          if (command) {
            onCommandRef.current(command, res)
          } else {
            // Bare "Hai Tec" — listen for the command in the next utterance.
            awaitingCommandRef.current = true
            onWakeOnlyRef.current?.()
          }
        }
        // else: no wake phrase → ignore, keep listening.
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'Transcription failed')
      } finally {
        transcribingRef.current = false
        if (enabledRef.current) setState(awaitingCommandRef.current ? 'awaiting-command' : 'listening')
      }
    },
    [language],
  )

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream || recordingRef.current) return
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    recorderRef.current = mr
    chunksRef.current = []
    mr.ondataavailable = (ev) => {
      if (ev.data.size) chunksRef.current.push(ev.data)
    }
    mr.onstop = () => {
      const chunks = chunksRef.current
      chunksRef.current = []
      const elapsed = now() - speechStartedAtRef.current
      if (!chunks.length || elapsed < minUtteranceMs) {
        if (enabledRef.current && !transcribingRef.current) {
          setState(awaitingCommandRef.current ? 'awaiting-command' : 'listening')
        }
        return
      }
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
      void handleUtterance(blob)
    }
    mr.start()
    recordingRef.current = true
    speechStartedAtRef.current = now()
    lastVoiceAtRef.current = now()
    setState('capturing')
  }, [handleUtterance, minUtteranceMs])

  const stopRecording = useCallback(() => {
    const mr = recorderRef.current
    recordingRef.current = false
    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop()
      } catch {
        // ignore
      }
    }
  }, [])

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser || !enabledRef.current) return
    const buf = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(buf)
    // RMS around the 128 midpoint, normalized to 0..1.
    let sumSq = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sumSq += v * v
    }
    const rms = Math.sqrt(sumSq / buf.length)
    const t = now()

    if (rms >= startThreshold) {
      lastVoiceAtRef.current = t
      if (!recordingRef.current && !transcribingRef.current) startRecording()
    }

    if (recordingRef.current) {
      const silentFor = t - lastVoiceAtRef.current
      const recordedFor = t - speechStartedAtRef.current
      if (silentFor >= silenceMs || recordedFor >= maxUtteranceMs) {
        stopRecording()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [startThreshold, silenceMs, maxUtteranceMs, startRecording, stopRecording])

  const disable = useCallback(() => {
    enabledRef.current = false
    setEnabled(false)
    awaitingCommandRef.current = false
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    stopRecording()
    recorderRef.current = null
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop())
      streamRef.current = null
    }
    setState('idle')
  }, [stopRecording])

  const enable = useCallback(async () => {
    if (enabledRef.current) return
    setLastError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      source.connect(analyser)
      analyserRef.current = analyser

      enabledRef.current = true
      setEnabled(true)
      setState('listening')
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setLastError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Akses mikrofon ditolak. Izinkan mic di browser untuk mengaktifkan suara.'
          : 'Tidak bisa mengakses mikrofon.',
      )
      setState('error')
      disable()
    }
  }, [tick, disable])

  const toggle = useCallback(() => {
    if (enabledRef.current) disable()
    else void enable()
  }, [enable, disable])

  // Clean up on unmount.
  useEffect(() => () => disable(), [disable])

  return { enabled, state, lastError, lastTranscript, enable, disable, toggle }
}
