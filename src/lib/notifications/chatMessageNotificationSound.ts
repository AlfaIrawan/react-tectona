const CHAT_MESSAGE_SOUND_KEY = 'tectona:chat-message-sound'

let sharedAudioContext: AudioContext | null = null

export function isChatMessageSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(CHAT_MESSAGE_SOUND_KEY)
    if (raw === null) return true
    return raw !== 'false'
  } catch {
    return true
  }
}

export function setChatMessageSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CHAT_MESSAGE_SOUND_KEY, enabled ? 'true' : 'false')
  } catch {
    // ignore
  }
}

function getAudioContext(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    if (!sharedAudioContext) sharedAudioContext = new Ctx()
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume()
    }
    return sharedAudioContext
  } catch {
    return null
  }
}

/** Short two-tone chime for incoming chat messages. */
export function playChatMessageNotificationSound(): void {
  if (!isChatMessageSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const tones = [
      { freq: 660, start: 0, duration: 0.1 },
      { freq: 880, start: 0.11, duration: 0.14 },
    ]

    for (const tone of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = tone.freq
      gain.gain.value = 0.0001
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = now + tone.start
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
      osc.start(start)
      osc.stop(start + tone.duration + 0.02)
    }
  } catch {
    // Browser may block audio until user gesture
  }
}
