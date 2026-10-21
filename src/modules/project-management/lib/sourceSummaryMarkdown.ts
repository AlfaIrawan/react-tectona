// The section headings of an idea draft (agent-runtime llm/idea_draft_prompt_builder.py
// _structure_template, both languages, and orchestrator/idea_draft_sections.py aliases).
const DRAFT_SECTION_HEADINGS = new Set([
  'tujuan', 'objective', 'objectives',
  'permasalahan', 'problem', 'problem statement',
  'evidence as-is', 'evidence as is', 'as-is evidence', 'as is evidence',
  'usulan perubahan', 'proposed change', 'proposed changes',
  'asumsi dan pertanyaan terbuka', 'asumsi & pertanyaan terbuka', 'assumptions and open questions',
  'kandidat dampak', 'impact candidates', 'impact candidate',
  'perubahan proses', 'process delta',
  'sinyal scoring', 'scoring signals', 'scoring signal',
  'irisan delivery', 'delivery slices', 'delivery slice',
  'risiko', 'risk', 'risks',
  'evidence pendukung', 'supporting evidence',
])

// A diagram label whose diagram was taken out of the text (the diagrams are drawn on their own).
const DIAGRAM_LABEL_RE = /^(?:AS[-\s]?IS|TO[-\s]?BE)\s*:?\s*$/i
const LIST_ITEM_RE = /^(?:[-*+]|\d+[.)])\s/

function bareHeading(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/\s*:\s*$/, '')
    .trim()
}

/**
 * The source context's summary as Markdown with real headings: the draft's section titles
 * ("Tujuan", "Permasalahan", "Evidence AS-IS", …) arrive as plain lines glued to their first
 * paragraph ("Tujuan Menyediakan solusi …"); they become level-2 headings, and short labels such
 * as "Asumsi:" or a lone title line become level-3 headings.
 */
export function formatSourceSummaryMarkdown(text: string): string {
  const out: string[] = []
  let inFence = false
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (/^\s*```/.test(line)) inFence = !inFence
    if (inFence || /^\s*```/.test(line)) {
      out.push(line)
      continue
    }
    const trimmed = line.trim()
    if (DIAGRAM_LABEL_RE.test(trimmed)) continue
    const bare = bareHeading(trimmed)
    if (bare && DRAFT_SECTION_HEADINGS.has(bare.toLowerCase())) {
      out.push('', `## ${bare}`, '')
      continue
    }
    const label = trimmed.endsWith(':') && trimmed.length <= 60 && !LIST_ITEM_RE.test(trimmed)
      && bare.split(/\s+/).length <= 8
    if (label && bare) {
      out.push('', `### ${bare}`, '')
      continue
    }
    out.push(line)
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n')
      const heading = lines[0]?.trim() ?? ''
      // A title on a line of its own ("Indikator keberhasilan (hipotesis)").
      const isTitle = lines.length === 1 && heading.length > 0 && heading.length <= 100
        && !heading.startsWith('#') && !/[.!?]$/.test(heading) && !LIST_ITEM_RE.test(heading)
      return isTitle ? `### ${bareHeading(heading)}` : block
    })
    .join('\n\n')
    .trim()
}
