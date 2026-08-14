/**
 * Parse assistant markdown: narrative body + optional GFM task-list choices.
 * Checkbox UI only when LLM emits `- [ ]` lines (concrete actions).
 * Plain questions and bullet lists stay in narrative markdown.
 */

export type ParsedAssistantMessage = {
  body: string
  choices: string[]
}

export type AssistantGreetingLead = {
  greeting: string
  body: string
}

/** Only "Selamat pagi/siang/sore/malam, {nama}" line — stops at . or ! (emoji allowed). */
const TIME_SALUTATION_HEAD_RE =
  /^(Selamat\s+(?:pagi|siang|sore|malam),\s*.+?[.!])/i

const GREETING_TAIL_DECORATION_RE = /^[\s🌙🌅☀️🌇😊🙂😄🙏🫡]+$/

function isGreetingTailDecoration(text: string): boolean {
  const trimmed = text.trim()
  return !trimmed || GREETING_TAIL_DECORATION_RE.test(trimmed)
}

export function splitAssistantGreetingLead(content: string): AssistantGreetingLead | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  const lines = trimmed.split('\n')
  const firstLine = lines[0]?.trim() ?? ''
  const headMatch = firstLine.match(TIME_SALUTATION_HEAD_RE)
  if (!headMatch?.[0]?.trim()) return null

  const tailFirstLine = firstLine.slice(headMatch[0].length).trim()

  // First line is purely the greeting (the rest is only decorative emoji).
  if (isGreetingTailDecoration(tailFirstLine)) {
    let bodyStart = 1
    while (bodyStart < lines.length && lines[bodyStart]?.trim() === '') bodyStart += 1
    return {
      greeting: firstLine,
      body: lines.slice(bodyStart).join('\n').trim(),
    }
  }

  return {
    greeting: headMatch[0].trim(),
    body: [tailFirstLine, ...lines.slice(1)].filter(Boolean).join('\n').trim(),
  }
}

const TASK_ITEM_RE = /^\s*[-*+]\s+\[[ xX]?\s*\]\s+(.+?)\s*$/

function lowerFirstChoicePhrase(label: string): string {
  let text = label.trim().replace(/[?.!]+$/, '')
  text = text.replace(/^((?:tolong|silakan)\s+)?(?:saya\s+)?/i, '')
  if (!text) return ''
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** Turn trailing `- [ ]` options into one conversational question (no checkbox widget). */
export function choicesToConversationalQuestion(choices: string[]): string | null {
  const normalized = choices.map((c) => c.trim()).filter(Boolean)
  if (normalized.length < 2 || normalized.length > 3) return null

  // Short quick-action labels stay as clickable pills (Genie-style).
  if (normalized.every((label) => label.length <= 56)) return null

  if (normalized.length === 2) {
    const a = lowerFirstChoicePhrase(normalized[0])
    const b = lowerFirstChoicePhrase(normalized[1])
    if (!a || !b) return null
    return `Would you like ${a}, or ${b}?`
  }

  const last = lowerFirstChoicePhrase(normalized[normalized.length - 1])
  const rest = normalized.slice(0, -1).map(lowerFirstChoicePhrase).filter(Boolean)
  if (!last || rest.length === 0) return null
  return `Would you like ${rest.join(', ')}, or ${last}?`
}

/** Split trailing task-list block from the main narrative. */
export function parseAssistantMessageContent(content: string): ParsedAssistantMessage {
  const trimmed = content.trim()
  if (!trimmed) return { body: '', choices: [] }

  const lines = trimmed.split('\n')
  const choiceLines: { index: number; label: string }[] = []

  lines.forEach((line, index) => {
    const match = line.match(TASK_ITEM_RE)
    if (match?.[1]) {
      choiceLines.push({ index, label: match[1].trim() })
    }
  })

  if (choiceLines.length === 0) {
    return { body: trimmed, choices: [] }
  }

  const firstChoiceIdx = choiceLines[0].index
  const body = lines
    .slice(0, firstChoiceIdx)
    .join('\n')
    .trim()

  const choices = choiceLines.map((c) => c.label).filter(Boolean)

  const question = choicesToConversationalQuestion(choices)
  if (question) {
    return {
      body: body ? `${body}\n\n${question}` : question,
      choices: [],
    }
  }

  return { body, choices }
}

export function messageHasAssistantChoices(content: string): boolean {
  return parseAssistantMessageContent(content).choices.length > 0
}

export function buildChoiceSelectionMessage(labels: string[], mode: 'single' | 'multiple'): string {
  if (labels.length === 0) return ''
  if (mode === 'single') return labels[0]
  return labels.map((l) => `• ${l}`).join('\n')
}

/** User message sent when confirming assistant choice offer — verbatim from LLM labels. */
export function buildChoiceSubmitUserMessage(labels: string[], mode: 'single' | 'multiple'): string {
  const trimmed = labels.map((label) => label.trim()).filter(Boolean)
  if (trimmed.length === 0) return ''
  if (mode === 'single') return trimmed[0]
  return trimmed.join('\n')
}

export type AssistantChoiceUiState =
  | { kind: 'active' }
  | { kind: 'submitted'; selectedLabels: string[] }
  | { kind: 'superseded' }

export type ChoiceOfferRecord = {
  status: 'submitted'
  selectedLabels: string[]
}

export function resolveAssistantChoiceUiState(
  messageText: string,
  messages: Array<{ role: string; choiceOffer?: ChoiceOfferRecord }>,
  messageIndex: number,
  choiceOffer?: ChoiceOfferRecord,
): AssistantChoiceUiState | null {
  if (!messageHasAssistantChoices(messageText)) return null
  if (choiceOffer?.status === 'submitted') {
    return { kind: 'submitted', selectedLabels: choiceOffer.selectedLabels }
  }
  for (let i = messageIndex + 1; i < messages.length; i++) {
    if (messages[i].role === 'user') return { kind: 'superseded' }
  }
  return { kind: 'active' }
}
