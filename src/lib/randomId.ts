/**
 * UUID v4 for client IDs. Works on HTTP dev hosts where crypto.randomUUID is unavailable
 * (secure context requires HTTPS or localhost).
 */
export function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // Non-secure context — fall through to manual v4.
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = Math.floor(Math.random() * 16)
    if (char === 'x') return n.toString(16)
    return ((n & 0x3) | 0x8).toString(16)
  })
}
