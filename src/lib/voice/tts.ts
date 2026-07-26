/**
 * Browser Text-to-Speech for spoken agent replies (free, on-device — Web Speech API).
 * Prefers a Bahasa Indonesia voice when the platform provides one.
 */

let cachedVoices: SpeechSynthesisVoice[] = []

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  const voices = window.speechSynthesis.getVoices()
  if (voices.length) cachedVoices = voices
  return cachedVoices
}

// Voices populate asynchronously on some browsers.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : loadVoices()
  const target = lang.toLowerCase()
  return (
    voices.find((v) => v.lang?.toLowerCase() === target) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(target.split('-')[0])) ??
    undefined
  )
}

/** Cancel any in-progress speech. */
export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel()
}

/**
 * Speak `text`. Strips markdown/HTML noise so the assistant sounds natural.
 * Safe no-op when TTS is unavailable.
 */
export function speak(text: string, lang = 'id-ID'): void {
  if (!isTtsSupported()) return
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`#>|]/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return

  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(clean.slice(0, 1200))
  utter.lang = lang
  const voice = pickVoice(lang)
  if (voice) utter.voice = voice
  utter.rate = 1
  utter.pitch = 1
  window.speechSynthesis.speak(utter)
}
