const API_JS = '/web-apps/apps/api/documents/api.js'

function stripSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function siblingDocumentServerOrigin(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (!host.endsWith('.adira.co.id')) return null
  return `${window.location.protocol}//document-server-dev.adira.co.id`
}

async function sameOriginLooksLikeApiJs(base: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(stripSlash(base) + API_JS, window.location.origin)
    if (url.origin !== window.location.origin) return false
    const res = await fetch(url.href, { method: 'GET', cache: 'no-store' })
    if (!res.ok) return false
    const text = await res.text()
    const start = text.trimStart()
    if (start.startsWith('<')) return false
    return /DocsAPI/.test(text)
  } catch {
    return false
  }
}

function candidateBases(configured: string): string[] {
  const fromEnv = String(import.meta.env.VITE_ONLYOFFICE_PUBLIC_URL || '')
    .trim()
    .replace(/\/$/, '')
  const configuredClean = stripSlash(configured || 'http://localhost:8085')
  const out: string[] = []
  if (fromEnv) out.push(fromEnv)
  if (typeof window === 'undefined') return out.length ? out : [configuredClean]

  const pageLoopback = isLoopbackHost(window.location.hostname)
  let configuredLoopback = false
  try {
    configuredLoopback = isLoopbackHost(new URL(configuredClean).hostname)
  } catch {
    configuredLoopback = true
  }

  if (!configuredLoopback) out.push(configuredClean)
  if (!pageLoopback) {
    const sibling = siblingDocumentServerOrigin()
    if (sibling) out.push(sibling)
    out.push(`${window.location.origin}/onlyoffice-ds`)
  } else {
    out.push(configuredClean)
  }

  return [...new Set(out.filter(Boolean))]
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve(Boolean((window as Window & { DocsAPI?: unknown }).DocsAPI))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

/** Pick a Document Server base whose api.js is real JS, not the Tectona SPA HTML. */
export async function resolveWorkingDocumentServerUrl(configured: string): Promise<string> {
  const bases = candidateBases(configured)
  const tried: string[] = []

  for (const base of bases) {
    const src = `${stripSlash(base)}${API_JS}`
    tried.push(src)
    const sameOrigin = typeof window !== 'undefined' && src.startsWith(window.location.origin)
    if (sameOrigin) {
      const ok = await sameOriginLooksLikeApiJs(base)
      if (!ok) continue
    }
    const loaded = await loadScript(src)
    if (loaded) return stripSlash(base)
  }

  throw new Error(
    'Document editor failed to initialize. Browser menerima HTML, bukan OnlyOffice api.js. ' +
      `Dicoba: ${tried.join(' | ')}. ` +
      'Di server Ubuntu: pastikan container onlyoffice-documentserver (port 8085) running, ' +
      'lalu pasang nginx `location ^~ /onlyoffice-ds/` → 127.0.0.1:8085 dan reload nginx. ' +
      'Atau buka editor lewat http://document-server-dev.adira.co.id setelah DNS/nginx vhost itu hidup.',
  )
}

export function resolveBrowserDocumentServerUrl(configured: string): string {
  const bases = candidateBases(configured)
  return bases[0] || stripSlash(configured || 'http://localhost:8085')
}
