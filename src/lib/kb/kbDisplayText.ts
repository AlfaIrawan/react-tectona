const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Remove UUID tokens from KB titles/summaries so Access Control mirrors show role names, not ids. */
export function stripGuidsFromKbDisplayText(value: string): string {
  const stripped = value
    .replace(UUID_PATTERN, ' ')
    .replace(/\s*[—–]\s*/g, ' — ')
    .replace(/(?:\s*[—–-]\s*){2,}/g, ' — ')
    .replace(/\s+/g, ' ')
    .replace(/^[—–\-\s:]+|[—–\-\s:]+$/g, '')
    .replace(/\s+—\s*$/g, '')
    .replace(/^\s*—\s+/g, '')
    .trim()
  return stripped
}

export function stripGuidsFromKbHtml(html: string): string {
  return html.replace(UUID_PATTERN, '').replace(/\s{2,}/g, ' ')
}
