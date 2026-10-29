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

export async function sameOriginDocumentServerProblem(base: string): Promise<string | null> {
  if (typeof window === 'undefined') return 'Browser context unavailable.'
  try {
    const url = new URL(stripSlash(base) + API_JS, window.location.origin)
    if (url.origin !== window.location.origin) return 'Not a same-origin Document Server.'
    const res = await fetch(url.href, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return `Document Server API returned HTTP ${res.status}.`
    const text = await res.text()
    const start = text.trimStart()
    if (start.startsWith('<') || !/DocsAPI/.test(text)) return 'The proxy returned a web page instead of the Document Server API.'
    // A working API script does not prove that the actual editor can be framed.
    const editor = await fetch(stripSlash(base) + '/web-apps/apps/documenteditor/main/index.html', {
      method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    })
    if (!editor.ok) return `Editor page returned HTTP ${editor.status}.`
    if (editor.headers.get('x-frame-options')?.toUpperCase().split(',').some((value) => value.trim() === 'DENY')) return 'Editor embedding is blocked by X-Frame-Options: DENY.'
    if (/frame-ancestors\s+'none'/i.test(editor.headers.get('content-security-policy') ?? '')) return 'Editor embedding is blocked by Content-Security-Policy frame-ancestors.'
    const html = await editor.text()
    if (/<div\s+id=["']root["']/i.test(html) || !/(?:document\s*editor|sdkjs|onlyoffice|viewport)/i.test(html)) return 'The editor URL returned the application page, not the Document Server editor.'
    return null
  } catch {
    return 'Document Server could not be reached or timed out.'
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
    let finished = false
    const finish = (ok: boolean) => {
      if (finished) return
      finished = true
      window.clearTimeout(timer)
      if (!ok) script.remove()
      resolve(ok)
    }
    const timer = window.setTimeout(() => finish(false), 15_000)
    script.src = src
    script.async = true
    script.onload = () => finish(Boolean((window as Window & { DocsAPI?: unknown }).DocsAPI))
    script.onerror = () => finish(false)
    document.head.appendChild(script)
  })
}

/** Pick a Document Server base whose api.js is real JS, not the Tectona SPA HTML. */
export async function resolveWorkingDocumentServerUrl(configured: string): Promise<string> {
  const bases = candidateBases(configured)
  const tried: string[] = []
  const problems: string[] = []

  for (const base of bases) {
    const src = `${stripSlash(base)}${API_JS}`
    tried.push(src)
    const sameOrigin = typeof window !== 'undefined' && new URL(src, window.location.origin).origin === window.location.origin
    if (sameOrigin) {
      const problem = await sameOriginDocumentServerProblem(base)
      if (problem) { problems.push(`${base}: ${problem}`); continue }
    }
    const loaded = await loadScript(src)
    if (loaded) return stripSlash(base)
  }

  throw new Error(
    'Document editor failed to initialize. ' +
      (problems.length ? problems.join(' ') : `Document Server API could not be loaded: ${tried.join(' | ')}.`) +
      ' Check the /onlyoffice-ds reverse proxy, Document Server availability, and iframe permissions.',
  )
}

export function resolveBrowserDocumentServerUrl(configured: string): string {
  const bases = candidateBases(configured)
  return bases[0] || stripSlash(configured || 'http://localhost:8085')
}
