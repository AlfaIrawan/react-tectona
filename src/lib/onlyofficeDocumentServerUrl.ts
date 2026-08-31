/** Browser-facing OnlyOffice Document Server base URL.

DKM often returns `http://localhost:8085`, which only works if Tectona is also opened on
localhost. On tectona-dev.adira.co.id the browser would load api.js from the *user's* PC.
*/
export function resolveBrowserDocumentServerUrl(configured: string): string {
  const fromEnv = String(import.meta.env.VITE_ONLYOFFICE_PUBLIC_URL || '')
    .trim()
    .replace(/\/$/, '')
  if (fromEnv) return fromEnv

  const fallback = (configured || 'http://localhost:8085').replace(/\/$/, '')
  if (typeof window === 'undefined') return fallback

  try {
    const url = new URL(fallback)
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    const pageHost = window.location.hostname
    const pageLoopback = pageHost === 'localhost' || pageHost === '127.0.0.1'
    if (!loopback || pageLoopback) return fallback
    return `${window.location.origin}/onlyoffice-ds`
  } catch {
    return fallback
  }
}
