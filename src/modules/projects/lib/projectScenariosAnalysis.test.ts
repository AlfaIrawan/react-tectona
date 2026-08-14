import { describe, expect, it } from 'vitest'
import { parseAgentAnalysisJson } from './projectScenariosAnalysis'

describe('parseAgentAnalysisJson', () => {
  it('parses fenced JSON from agent answer', () => {
    const parsed = parseAgentAnalysisJson(`
Here is the analysis:
\`\`\`json
{
  "readiness_score": 82,
  "verdict": "sufficient",
  "verdict_summary": "Ready",
  "limitations": [],
  "source_documents": [],
  "gap_items": [],
  "plan_domains": []
}
\`\`\`
`)
    expect(parsed?.readiness_score).toBe(82)
    expect(parsed?.verdict).toBe('sufficient')
  })
})
