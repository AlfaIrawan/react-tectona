const FEATURE_TOPIC = /\b(?:fitur|features?|functionalities)\b/i
const FEATURE_LEAD = /^(?:\*\*)?(?:(?:fitur|features?)(?:\s+(?:yang dibutuhkan|yang diperlukan|utama|yang diusulkan|required|needed))?|(?:required|proposed|main) features?)(?:\*\*)?\s*:(?:\*\*)?\s*/i

/** Presentation only: split explicit feature separators, never infer new capabilities. */
export function formatBrainstormFeatureAnswer(question: string, answer: string): string {
  if (!FEATURE_TOPIC.test(question) && !FEATURE_LEAD.test(answer.trim())) return answer
  // Existing Markdown blocks keep their list hierarchy, code, and table structure.
  if (/^\s*(?:[-*+]\s|\d+[.)]\s|[>|#]|`{3}|~{3})/m.test(answer)) return answer
  const body = answer.trim().replace(FEATURE_LEAD, '')
  if (!body || /^(?:Jawaban belum tersedia|Answer unavailable)\.?$/i.test(body)) return answer
  const protectedSpans = [...body.matchAll(/(`+)[\s\S]*?\1|\[[^\]\n]*\]\([^\n]*?\)|&(?:#\d+|#x[\da-f]+|[a-z]+);/gi)]
  const items: string[] = []
  const brackets: string[] = []
  let start = 0
  for (let index = 0; index < body.length; index += 1) {
    if (protectedSpans.some(span => index >= span.index! && index < span.index! + span[0].length)) continue
    const char = body[index]
    if (char === '(' || char === '[') brackets.push(char)
    else if ((char === ')' && brackets.at(-1) === '(') || (char === ']' && brackets.at(-1) === '[')) brackets.pop()
    else if (!brackets.length && char === ';') {
      const item = body.slice(start, index).trim()
      if (item) items.push(item)
      start = index + 1
    }
  }
  const last = body.slice(start).trim()
  if (last) items.push(last)
  return items.map(item => '- ' + item.replace(/\n/g, '\n  ')).join('\n')
}
