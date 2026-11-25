import { normalizeBrainstormMarkdown } from './brainstormMarkdown'
import { normalizeBrainstormSummary } from './normalizeBrainstormSummary'

/** Restore only explicit flattened lists. Never infer facts, options or missing content. */
export function normalizeBrainstormDisplayText(text: string): string {
  let fence: string | undefined
  const structured = normalizeBrainstormSummary(text).split('\n').map(line => {
    const delimiter = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (delimiter) {
      if (!fence) fence = delimiter[1]
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length) fence = undefined
      return line
    }
    if (fence || /^(?: {4}|\t|\s*[>|])/.test(line)) return line
    // Do not split literal code, links or math into purported options.
    if (/`|\]\(/.test(line)) return line
    const bullets = [...line.matchAll(/(?:^|[ \t]+)-[ \t]+(?=\*\*[^*]+\*\*)/g)]
    if (bullets.length >= 2) return line.replace(/[ \t]+-[ \t]+(?=\*\*[^*]+\*\*)/g, '\n- ')
    const numbered = [...line.matchAll(/(?:^|[ \t]+)\((\d+)\)[ \t]+/g)]
    if (numbered.length >= 2 && numbered.every((match, index) => Number(match[1]) === index + 1)) {
      return line.replace(/(^|[ \t]+)\((\d+)\)[ \t]+/g, (_match, _space, number) => `\n${number}. `).trimStart()
    }
    return line
  }).join('\n')
  return normalizeBrainstormMarkdown(structured)
}
