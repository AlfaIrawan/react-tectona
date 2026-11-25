export const sequenceNotations = [
  ['participant', 'Participant / lifeline'], ['actor', 'Actor'],
  ['boundary', 'Boundary'], ['control', 'Control'], ['entity', 'Entity'],
  ['database', 'Database'], ['collections', 'Collections'], ['queue', 'Queue'],
  ['sync', 'Synchronous message'], ['async', 'Asynchronous message'], ['return', 'Return message'],
  ['self', 'Self message'], ['activation', 'Activation'],
  ['alt', 'Alternative (alt)'], ['opt', 'Optional (opt)'], ['loop', 'Loop'],
  ['par', 'Parallel (par)'], ['critical', 'Critical region'], ['break', 'Break'], ['ref', 'Interaction reference'],
  ['create', 'Create lifeline'], ['destroy', 'Destroy lifeline'], ['note', 'Note'],
] as const
export type SequenceNotation = typeof sequenceNotations[number][0]
export function isSequenceDeclaration(kind: SequenceNotation): boolean {
  return ['participant', 'actor', 'boundary', 'control', 'entity', 'database', 'collections', 'queue'].includes(kind)
}

/** Read participant identities without rewriting or discarding unsupported PlantUML syntax. */
export function sequenceParticipants(source: string): string[] {
  const ids = new Set<string>()
  for (const line of source.split(/\r?\n/)) {
    const declaration = line.match(/^\s*(?:create\s+)?(?:participant|actor|boundary|control|entity|database|collections|queue)\s+("[^"\n]+"|[\w.]+)(?:\s+as\s+("[^"\n]+"|[\w.]+))?/i)
    if (declaration) ids.add(declaration[2] && !declaration[2].startsWith('"') ? declaration[2] : declaration[1])
    const message = line.match(/^\s*("[^"\n]+"|[\w.]+)\s*(?:<?[-.]+(?:\[[^\]]*\])?[-.]*[>]+|<+[-.]+)\s*[+-]?("[^"\n]+"|[\w.]+)\s*:/)
    if (message) { ids.add(message[1]); ids.add(message[2]) }
  }
  return [...ids]
}

export function insertSequenceNotation(source: string, kind: SequenceNotation, from: string, to: string, label: string): string {
  const text = label.replace(/[\r\n]+/g, ' ').trim() || 'Message'
  const participants = sequenceParticipants(source)
  const sender = participants.includes(from) ? from : participants[0] ?? 'Participant1'
  const receiver = participants.includes(to) ? to : participants[1] ?? sender
  const uniqueAlias = (prefix: string) => {
    let index = 1
    while (participants.includes(`${prefix}${index}`)) index++
    return `${prefix}${index}`
  }
  let snippet = ''
  if (isSequenceDeclaration(kind)) {
    const id = uniqueAlias(kind[0].toUpperCase() + kind.slice(1))
    snippet = `${kind} "${text.replace(/"/g, "'")}" as ${id}`
  } else {
    const message = `${sender} -> ${receiver}: ${text}`
    switch (kind) {
      case 'sync': snippet = message; break
      case 'async': snippet = `${sender} ->> ${receiver}: ${text}`; break
      case 'return': snippet = `${sender} --> ${receiver}: ${text}`; break
      case 'self': snippet = `${sender} -> ${sender}: ${text}`; break
      case 'activation': snippet = `${message}\nactivate ${receiver}\n${receiver} --> ${sender}: Result\ndeactivate ${receiver}`; break
      case 'alt': snippet = `alt ${text}\n  ${sender} -> ${receiver}: Success\nelse Otherwise\n  ${receiver} --> ${sender}: Failure\nend`; break
      case 'opt': case 'loop': case 'critical': case 'break': snippet = `${kind} ${text}\n  ${sender} -> ${receiver}: Message\nend`; break
      case 'par': snippet = `par ${text}\n  ${sender} -> ${receiver}: First branch\nelse Parallel branch\n  ${receiver} -> ${sender}: Second branch\nend`; break
      case 'ref': snippet = `ref over ${sender}${sender === receiver ? '' : `, ${receiver}`}: ${text}`; break
      case 'create': {
        const id = uniqueAlias('Created')
        snippet = `create participant "${text.replace(/"/g, "'")}" as ${id}\n${sender} -> ${id}: Create`
        break
      }
      case 'destroy': snippet = `${message}\ndestroy ${receiver}`; break
      case 'note': snippet = `note over ${sender}: ${text}`; break
    }
  }
  let document = source.trim() ? source : '@startuml\n@enduml'
  if (!/^\s*@startuml\b/m.test(document)) document = `@startuml\n${document}`
  if (!/^\s*@enduml\b/m.test(document)) document += '\n@enduml'
  // Declarations belong before interactions; message blocks retain their insertion order.
  if (isSequenceDeclaration(kind)) {
    return document.replace(/(^\s*@startuml[^\r\n]*)(\r?\n|$)/m, (_match, start: string) => `${start}\n${snippet}\n`)
  }
  return document.replace(/^[ \t]*@enduml\b/m, () => `${snippet}\n@enduml`)
}
