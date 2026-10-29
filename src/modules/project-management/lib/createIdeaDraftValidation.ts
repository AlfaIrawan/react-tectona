export function createIdeaDraftError(input: {
  mode: 'ai' | 'manual'
  description: string
  prompts: string[]
  jobStatus?: string | null
  draftText?: string | null
  busy?: boolean
}): string | null {
  if (input.busy) return 'Wait until draft processing has finished.'
  if (input.mode === 'ai' && (input.jobStatus !== 'completed' || !input.draftText?.trim())) {
    return 'Generate the AI draft before creating the idea, or choose Manual Create Draft.'
  }
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
  let content = normalize(input.description)
  for (const prompt of input.prompts) {
    const heading = normalize(prompt)
    if (heading) content = content.split(heading).join(' ')
  }
  if (!content.trim()) return 'Write a description or complete the draft first. Intake questions alone are not a description.'
  return null
}
