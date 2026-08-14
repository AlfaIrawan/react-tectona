const SERVICE_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: 'project-service', label: 'Project', pattern: /\/api\/(?:gateway-runtime\/)?api\/project-service|\/api\/project-service/i },
  { id: 'work-management', label: 'Work', pattern: /\/api\/(?:work|task-work-execution)\b/i },
  { id: 'document-knowledge', label: 'Document & knowledge', pattern: /\/api\/(?:gateway-runtime\/)?api\/document-knowledge|\/api\/document-knowledge/i },
  { id: 'notification-service', label: 'Notification', pattern: /\/api\/(?:gateway-runtime\/)?api\/notification-service|\/api\/notification-service/i },
  { id: 'identity-lite', label: 'Identity', pattern: /\/api\/identity-lite/i },
  { id: 'workspace-org', label: 'Workspace', pattern: /\/api\/workspace-org/i },
  { id: 'workspace-access-control', label: 'Workspace access', pattern: /\/api\/workspace-access-control/i },
  { id: 'collaboration-context', label: 'Chat', pattern: /\/api\/collaboration-context/i },
  { id: 'gateway-runtime', label: 'Gateway', pattern: /\/api\/gateway-runtime/i },
]

export function inferServiceFromApiUrl(input: RequestInfo | URL): { id: string; label: string } | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
  try {
    const pathname = raw.startsWith('http') ? new URL(raw).pathname : raw
    for (const entry of SERVICE_PATTERNS) {
      if (entry.pattern.test(pathname)) {
        return { id: entry.id, label: entry.label }
      }
    }
  } catch {
    return null
  }
  return null
}
