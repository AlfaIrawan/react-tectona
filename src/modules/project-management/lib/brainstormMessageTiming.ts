import type { IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'

export type BrainstormUiMessage = IdeaDraftBrainstormMessage & { imagePreview?: string }

function validTime(value?: string): string | undefined {
  return value && Number.isFinite(Date.parse(value)) ? value : undefined
}
function sameTurn(a: IdeaDraftBrainstormMessage, b: IdeaDraftBrainstormMessage): boolean {
  return a.role === b.role && a.text === b.text
}

/** Keep genuine saved timing. Loading history is never evidence of when a reply arrived. */
export function mergeBrainstormUiMessages(
  previous: BrainstormUiMessage[], incoming: IdeaDraftBrainstormMessage[], responseReceivedAt?: string,
): BrainstormUiMessage[] {
  const matched = new Map<number, BrainstormUiMessage>()
  // A saved snapshot may contain only the tail of the server transcript. Use its
  // complete sequence, not a text-keyed map that conflates repeated "yes" replies.
  const offsets: number[] = []
  if (previous.length) {
    for (let offset = 0; offset <= incoming.length - previous.length; offset += 1) {
      if (previous.every((message, index) => sameTurn(message, incoming[offset + index]))) offsets.push(offset)
    }
  }
  if (offsets.length === 1) {
    previous.forEach((message, index) => matched.set(offsets[0] + index, message))
  } else if (!offsets.length) {
    // Corrections can replace the suffix. Only the unchanged prefix is certain.
    for (let index = 0; index < Math.min(previous.length, incoming.length); index += 1) {
      if (!sameTurn(previous[index], incoming[index])) break
      matched.set(index, previous[index])
    }
  }
  const freshSuffix = previous.length > 0 && offsets.length === 1 && offsets[0] === 0
  return incoming.map((message, index) => {
    const prior = matched.get(index)
    const sentAt = validTime(message.sentAt) ?? validTime(prior?.sentAt)
    const respondedAt = validTime(message.respondedAt) ?? validTime(prior?.respondedAt)
      ?? (message.role === 'assistant' && freshSuffix && index >= previous.length ? validTime(responseReceivedAt) : undefined)
    return { ...message, sentAt, respondedAt, ...(prior?.imagePreview ? { imagePreview: prior.imagePreview } : {}) }
  })
}

/** Persist timing, but never persist the ephemeral uploaded-image preview. */
export function brainstormMessageSnapshot(messages: BrainstormUiMessage[]): IdeaDraftBrainstormMessage[] {
  return messages.map(message => {
    const snapshot = { ...message }
    delete snapshot.imagePreview
    return snapshot
  })
}
