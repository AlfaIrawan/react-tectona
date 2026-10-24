/** Repair explicit bullet glyphs without guessing list items from ordinary prose. */
export function normalizeBrainstormSummary(text: string): string {
  let fence: { marker: string; length: number } | undefined
  return text.split('\n').map((line) => {
    const delimiter = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (delimiter) {
      const marker = delimiter[1]
      if (!fence) fence = { marker: marker[0], length: marker.length }
      else if (marker[0] === fence.marker && marker.length >= fence.length) fence = undefined
      return line
    }
    if (fence || /^(?: {4}|\t)/.test(line) || /^\s*[>|]/.test(line)) return line

    // Ignore markers inside inline code and link destinations.
    const protectedSpans = [...line.matchAll(/(`+)[\s\S]*?\1|\]\([^)]*\)/g)]
    const markers = [...line.matchAll(/\u2022(?=\s+\S)/g)].filter((match) => {
      const index = match.index!
      return (index === 0 || /\s/.test(line[index - 1]))
        && !protectedSpans.some((span) => index >= span.index! && index < span.index! + span[0].length)
    })
    if (!markers.length) return line
    const lead = line.slice(0, markers[0].index).trim()
    const explicitList = !lead || (markers.length >= 2 && (
      lead.endsWith(':') || markers.every((marker) => /^\s+\*\*/.test(line.slice(marker.index! + 1)))
    ))
    if (!explicitList) return line

    const indent = line.match(/^\s*/)?.[0] ?? ''
    const items = markers.map((marker, index) => {
      const end = markers[index + 1]?.index ?? line.length
      return `${indent}- ${line.slice(marker.index! + 1, end).trim()}`
    })
    return (lead ? `${line.slice(0, markers[0].index).trimEnd()}\n\n` : '') + items.join('\n')
  }).join('\n')
}
