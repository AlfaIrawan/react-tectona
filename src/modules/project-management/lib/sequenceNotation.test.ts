import { describe, expect, it } from 'vitest'
import { insertSequenceNotation, sequenceParticipants, sequenceNotations } from './sequenceNotation'

const source = '@startuml\nparticipant "Web client" as Client\nparticipant API\nClient -> API: Request\n@enduml'
describe('sequence notation insertion', () => {
  it('recognizes declared aliases, quoted names, implicit participants and reverse arrows', () => {
    expect(sequenceParticipants(`${source}\nAPI --> Worker: Work\nWorker <- Queue: Receive\nactor User as "End user"`)).toEqual(['Client', 'API', 'Worker', 'Queue', 'User'])
  })
  it('adds collision-free lifelines before messages without discarding source', () => {
    const first = insertSequenceNotation(source, 'participant', '', '', 'Data store')
    const second = insertSequenceNotation(first, 'participant', '', '', 'Other')
    expect(first).toContain('participant "Data store" as Participant1')
    expect(second).toContain('participant "Other" as Participant2')
    expect(second.indexOf('participant "Other"')).toBeLessThan(second.indexOf('Client -> API'))
    expect(first).toContain('Client -> API: Request')
  })
  it.each([
    ['sync', 'Client -> API: Test'], ['async', 'Client ->> API: Test'], ['return', 'Client --> API: Test'],
    ['self', 'Client -> Client: Test'], ['activation', 'activate API\nAPI --> Client: Result\ndeactivate API'],
    ['alt', 'alt Test\n  Client -> API: Success\nelse Otherwise\n  API --> Client: Failure\nend'],
    ['opt', 'opt Test\n  Client -> API: Message\nend'], ['loop', 'loop Test\n  Client -> API: Message\nend'],
    ['note', 'note over Client: Test'],
  ] as const)('inserts %s with valid source-backed semantics', (kind, expected) => {
    const result = insertSequenceNotation(source, kind, 'Client', 'API', 'Test')
    expect(result).toContain(`${expected}\n@enduml`)
    expect(result).toContain('Client -> API: Request')
    expect((result.match(/@enduml/g) || []).length).toBe(1)
  })
  it('creates a complete document from empty source and preserves literal dollar signs', () => {
    expect(insertSequenceNotation('', 'actor', '', '', '$& Buyer')).toBe('@startuml\nactor "$& Buyer" as Actor1\n@enduml')
    expect(insertSequenceNotation(source, 'sync', 'Client', 'API', '$&')).toContain('Client -> API: $&\n@enduml')
  })
  it('provides real source for every offered notation', () => {
    for (const [kind] of sequenceNotations) expect(insertSequenceNotation(source, kind, 'Client', 'API', 'Label')).not.toBe(source)
  })
})

describe('additional sequence standard notations', () => {
  it.each(['boundary', 'control', 'entity', 'database', 'collections', 'queue'] as const)('declares %s with unique aliases before interactions', kind => {
    const prefix = kind[0].toUpperCase() + kind.slice(1)
    const first = insertSequenceNotation(source, kind, '', '', 'Role')
    const second = insertSequenceNotation(first, kind, '', '', 'Other')
    expect(first).toContain(`${kind} "Role" as ${prefix}1`)
    expect(second).toContain(`${kind} "Other" as ${prefix}2`)
    expect(sequenceParticipants(second)).toContain(`${prefix}2`)
    expect(second.indexOf(`${kind} "Other"`)).toBeLessThan(second.indexOf('Client -> API'))
  })
  it.each(['critical', 'break'] as const)('inserts balanced %s fragment', kind => {
    expect(insertSequenceNotation(source, kind, 'Client', 'API', 'Guard')).toContain(`${kind} Guard\n  Client -> API: Message\nend\n@enduml`)
  })
  it('inserts parallel operands and closes the combined fragment', () => {
    expect(insertSequenceNotation(source, 'par', 'Client', 'API', 'Concurrent')).toContain('par Concurrent\n  Client -> API: First branch\nelse Parallel branch\n  API -> Client: Second branch\nend\n@enduml')
  })
  it('references an interaction over selected distinct lifelines', () => {
    expect(insertSequenceNotation(source, 'ref', 'Client', 'API', 'Authenticate')).toContain('ref over Client, API: Authenticate\n@enduml')
    expect(insertSequenceNotation(source, 'ref', 'Client', 'Client', 'Authenticate')).toContain('ref over Client: Authenticate\n@enduml')
  })
  it('creates a fresh lifeline at the message time and avoids reusing its alias', () => {
    const first = insertSequenceNotation(source, 'create', 'Client', 'API', 'Session')
    expect(first).toContain('create participant "Session" as Created1\nClient -> Created1: Create\n@enduml')
    expect(sequenceParticipants(first)).toContain('Created1')
    expect(insertSequenceNotation(first, 'create', 'Client', 'API', 'Another')).toContain('as Created2\nClient -> Created2: Create')
    expect(first).not.toContain('activate')
  })
  it('destroys the receiver after a final message without opening an activation', () => {
    const result = insertSequenceNotation(source, 'destroy', 'Client', 'API', 'Close')
    expect(result).toContain('Client -> API: Close\ndestroy API\n@enduml')
    expect(result).not.toContain('activate')
  })
})
