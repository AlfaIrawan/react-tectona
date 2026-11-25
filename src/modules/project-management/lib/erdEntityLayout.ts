/** Conservative bounds for the default 11px Arial ERD compartment. Full labels
 * (including SQL types/nullability) are measured, not just the column names. */
export function erdDisplayLabel(raw: string): string {
  const clean = raw.replace(/^\s*\*\s*/, '').replace(/<<[^>]+>>/g, '').trim()
  const colon = clean.indexOf(':')
  return colon < 0 ? clean : `${clean.slice(0, colon).trim()} : ${clean.slice(colon + 1).trim()}`
}
export function erdEntityDefaultSize(title: string, members: string[]): { width: number; height: number } {
  const labels = members.map(erdDisplayLabel).filter(Boolean)
  const estimate = (text: string, title = false) => [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 13 : title ? 8 : 6.8), 0)
  const width = Math.ceil(Math.min(360, Math.max(168, estimate(title, true) + 28, ...labels.map(label => estimate(label) + 32))))
  const contentWidth = width - 24
  const titleRows = Math.max(1, Math.ceil(estimate(title, true) / contentWidth))
  const memberRows = labels.reduce((total, label) => total + Math.max(1, Math.ceil(estimate(label) / contentWidth)), 0)
  return { width, height: Math.min(640, Math.max(64, titleRows * 20 + Math.max(1, memberRows) * 18 + 28)) }
}
