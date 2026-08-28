/**
 * UUID v4 for client IDs. Works on HTTP dev hosts where `crypto.randomUUID` is unavailable
 * (secure context requires HTTPS or localhost).
 */
export function randomUuid(): string {
  try {
    const webCrypto = globalThis.crypto
    if (webCrypto && typeof webCrypto.randomUUID === 'function') {
      return webCrypto.randomUUID()
    }
    if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      webCrypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  } catch {
    // Some HTTP origins expose `crypto` without usable random APIs.
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = Math.floor(Math.random() * 16)
    if (char === 'x') return n.toString(16)
    return ((n & 0x3) | 0x8).toString(16)
  })
}
