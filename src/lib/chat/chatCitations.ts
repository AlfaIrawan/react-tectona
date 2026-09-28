/**
 * Assistant answers cite sources as `[ref: <document title or index id>]`
 * (agent-runtime keeps only the evidence an answer cites that way). Shown raw,
 * a long file name breaks across lines after every sentence, so the chat shows
 * a small numbered marker instead and names the source on hover. The stored
 * message keeps the tag.
 */
const REF_RE = /[ \t]*\[ref:\s*([^\]\n]+)\]/gi
export const CITATION_HREF_PREFIX = '#tec-cite-'

function sourceLabel(ref: string): string {
  // Index ids ("source:tectona-document-repository#doc:<id>#chunk:<id>") read as "Document".
  return /^source:[^\s]*#doc:/i.test(ref) ? 'Document' : ref.trim()
}

/** The text with each ref as a numbered link, and the source for each number (1-based). */
export function markChatCitations(text: string): { text: string; sources: string[] } {
  const sources: string[] = []
  const marked = text.replace(REF_RE, (_all, ref: string) => {
    const label = sourceLabel(ref)
    let index = sources.findIndex((s) => s.toLowerCase() === label.toLowerCase())
    if (index < 0) {
      sources.push(label)
      index = sources.length - 1
    }
    return ` [${index + 1}](${CITATION_HREF_PREFIX}${index + 1})`
  })
  return { text: marked, sources }
}

/** The citation number of a marker link's href (sanitizers may prefix the fragment), or null. */
export function citationNumberOf(href: string | undefined): number | null {
  const match = /#(?:user-content-)?tec-cite-(\d+)$/.exec(href ?? '')
  return match ? Number(match[1]) : null
}
