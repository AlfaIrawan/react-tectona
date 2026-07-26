export function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens < 0) return '0'
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000
    const text = value.toFixed(1)
    return text.endsWith('.0') ? `${Math.round(value)}M` : `${text}M`
  }
  if (tokens >= 1_000) {
    const value = tokens / 1_000
    const text = value.toFixed(1)
    return text.endsWith('.0') ? `${Math.round(value)}K` : `${text}K`
  }
  return String(Math.round(tokens))
}

export function contextRingColor(level: 'ok' | 'warning' | 'reached', usagePercent: number): string {
  if (level === 'reached' || usagePercent >= 100) return '#EF4444'
  if (level === 'warning' || usagePercent >= 75) return '#F59E0B'
  return '#6B7280'
}
