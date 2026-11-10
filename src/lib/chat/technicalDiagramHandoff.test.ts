import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { prepareDiagramHandoff, prepareSelectedDescription, readSelectedSourceReferences, serializeSelectedSources, supportsReadOnlyPlantUmlPreview, supportsReadOnlyTechnicalPreview } from './technicalDiagramHandoff'
import { latestRevisedProcessDiagrams } from './extractProcessDiagrams'

const body = '@startuml\n() "Start" as process_start\nrectangle "Read" as read\nprocess_start --> read\n@enduml'
const source = (topic: string) => `@startuml\r\n' tectona-dimension: ${topic}\r\n' tectona-view: archimate\r\n!include <archimate/Archimate>\r\nApplication_Component(a, "Mock")\r\n@enduml`

function parsed(text: string) {
  const result = prepareSelectedDescription(text)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('selected description source retention', () => {
  it('keeps both explicit lanes with identical source and existing extraction compatibility', () => {
    const original = `Before.\nAS-IS:\n\`\`\`plantuml\n${body}\n\`\`\`\nTO-BE:\n\`\`\`plantuml\n${body}\n\`\`\`\nAfter.`
    const result = parsed(original)
    const persisted = serializeSelectedSources(result.prose, result.sources)
    expect(latestRevisedProcessDiagrams(persisted).map(item => item.kind)).toEqual(['as_is', 'to_be'])
    expect(result.prose).not.toMatch(/AS-IS:|TO-BE:/)
    expect(result.prose).toContain('Before.')
    expect(result.prose).toContain('After.')
  })
  it('preserves distinct ArchiMate topics and source bytes through read-only inspector extraction', () => {
    const input = ['infrastructure', 'technology_stack', 'operations'].map(topic => ({ source: source(topic), language: 'plantuml', topic, kind: 'archimate', provenance: 'selected-text' as const, reviewedRepresentation: false }))
    const restored = readSelectedSourceReferences(serializeSelectedSources('Simulation only.', input))
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(restored.sources).toEqual(input)
  })
  it('retains legacy Mermaid format rather than inferring PlantUML from lane', () => {
    const diagram = 'flowchart TD\nA[Read] --> B[Review]'
    const result = parsed(`<!--tectona-process-diagram:as_is:${encodeURIComponent(diagram)}-->`)
    expect(result.sources[0].language).toBe('mermaid')
    expect(parsed(serializeSelectedSources(result.prose, result.sources)).sources[0].source).toBe(diagram)
  })
  it('retains raw BPMN exact bytes and does not claim a supported preview', () => {
    const diagram = '<definitions>\r\n<process id="p"/>\r\n</definitions>\r\n'
    const result = parsed(`\`\`\`bpmn\r\n${diagram}\`\`\``)
    expect(result.sources[0].source).toBe(diagram)
    expect(parsed(serializeSelectedSources(result.prose, result.sources)).sources[0].source).toBe(diagram)
  })
  it('keeps unknown language fences in prose', () => {
    const text = '```unknown-notation\nexact  bytes\n```'
    expect(parsed(text).prose).toBe(text)
  })
  it('returns recovery before stripping HTML-held content', () => {
    expect(prepareSelectedDescription('selected text', '<pre data-process-diagram="plantuml">source</pre>').ok).toBe(false)
  })
  it('does not silently drop malformed encoded sources', () => {
    expect(prepareSelectedDescription('<!--tectona-process-diagram:class:%INVALID-->').ok).toBe(false)
  })
  it('never reads review claims from editable envelopes', () => {
    const value = { version: 1, source: source('operations'), language: 'plantuml', topic: 'operations', kind: 'archimate', reviewedRepresentation: true }
    expect(parsed(`<!--tectona-source-reference:${encodeURIComponent(JSON.stringify(value))}-->`).sources[0].reviewedRepresentation).toBe(false)
  })
  it('restores explicit empty saved selection without newer history', () => {
    const result = prepareDiagramHandoff({ text: '', mode: 'resume', existing: parsed('```plantuml\n' + body + '\n```').sources })
    expect(result.ok && result.sources).toEqual([])
  })
  it('preserves selected sources through prose-only assistance', () => {
    const existing = parsed(`\`\`\`plantuml\n${source('operations')}\n\`\`\``).sources
    const result = prepareDiagramHandoff({ text: 'New prose.', mode: 'assistance', existing })
    expect(result.ok && result.sources).toEqual(existing)
  })
  it('keeps selected old version text despite unavailable metadata', () => {
    const result = prepareDiagramHandoff({ text: 'Old version.', mode: 'version', status: 'unavailable', records: [] })
    expect(result.ok && result.prose).toBe('Old version.')
  })
  it('missing new-draft authoritative handoff is recoverable, manual text remains proposed', () => {
    expect(prepareDiagramHandoff({ text: 'New draft.', mode: 'completed' }).ok).toBe(false)
    expect(prepareDiagramHandoff({ text: 'Manual draft.', mode: 'manual' }).ok).toBe(true)
  })
})

describe('handoff provenance and recovery guards', () => {
  it('preserves depiction qualifiers through description serialization without review authority', () => {
    const sources = [{ source: source('operations'), language: 'plantuml', topic: 'operations', kind: 'archimate', provenance: 'server-version' as const, reviewedRepresentation: true, shownContext: 'Simulation only. Not deployed; staffing remains unknown.' }]
    const restored = parsed(serializeSelectedSources('Current version.', sources)).sources[0]
    expect(restored.shownContext).toBe(sources[0].shownContext)
    expect(restored.reviewedRepresentation).toBe(false)
    expect(restored.source).toBe(sources[0].source)
  })
  it('does not use claimed notation to render mismatched opaque content', () => {
    const entry = { source: '<script>not PlantUML</script>', language: 'plantuml', kind: 'archimate', provenance: 'selected-text' as const, reviewedRepresentation: false }
    expect(supportsReadOnlyPlantUmlPreview(entry)).toBe(false)
    expect(supportsReadOnlyPlantUmlPreview({ ...entry, source: source('operations') })).toBe(true)
  })
  it('retains tecchart without an editable or guessed PlantUML preview', () => {
    const selected = parsed('```tecchart\nopaque exact  content\n```').sources[0]
    expect(selected.language).toBe('tecchart')
    expect(supportsReadOnlyPlantUmlPreview(selected)).toBe(false)
    expect(parsed(serializeSelectedSources('', [selected])).sources[0].source).toBe(selected.source)
  })
  it('shows a metadata notice while preserving selected version text and sources', () => {
    const result = prepareDiagramHandoff({ text: serializeSelectedSources('Old text.', parsed('```plantuml\n' + source('operations') + '\n```').sources), mode: 'version', status: 'unavailable', records: [] })
    expect(result.ok && result.notice).toContain('no verified diagram metadata')
    expect(result.ok && result.sources[0].reviewedRepresentation).toBe(false)
    expect(result.ok && result.prose).toContain('Old text.')
  })
  it('does not restore authority from a local snapshot', () => {
    const result = prepareDiagramHandoff({ text: serializeSelectedSources('', parsed('```plantuml\n' + source('operations') + '\n```').sources), mode: 'resume' })
    expect(result.ok && result.sources[0].provenance).toBe('local-unverified')
  })
})

describe('static caller guards (not mounted UI or integration proof)', () => {
  const page = readFileSync('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
  it('distinguishes unselected pre-generation empty snapshots from explicitly cleared selections', () => {
    expect(page).toContain("snapshot.form.sourceSelectionVersion === 1 || snapshot.form.description.length > 0")
    expect(page).toContain("createIdeaSelectedSources !== null ? { sourceSelectionVersion: 1 as const } : {}")
  })
  it('preflights completed recovery before replacing form and source state', () => {
    const start = page.indexOf('const hasSavedDescription =')
    const section = page.slice(start, page.indexOf('setBrainstormMessages(', start))
    expect(section.indexOf("if (!hasSavedDescription && status.status === 'completed')")).toBeGreaterThan(-1)
    expect(section.indexOf('if (!check.ok)')).toBeLessThan(section.indexOf('const resumed ='))
  })
  it('keeps manual initial completion exempt and exposes selected-version warnings', () => {
    expect(page).toContain("mode: terminal.brainstorm_messages.length ? 'completed' : 'manual'")
    expect(page).toContain('if (version.technical_diagram_warning) setAiAssistanceError(version.technical_diagram_warning)')
    expect(page).toContain('supportsReadOnlyTechnicalPreview(source)')
    expect(page).toContain('{source.shownContext}')
  })
})


describe('existing technical syntax compatibility', () => {
  it.each(['classDiagram\nclass Order', 'erDiagram\nORDER { int id }'])('retains legacy Mermaid language: %s', diagram => {
    const result = parsed(`<!--tectona-process-diagram:class:${encodeURIComponent(diagram)}-->`)
    expect(result.sources[0].language).toBe('mermaid')
    expect(parsed(serializeSelectedSources('', result.sources)).sources[0].source).toBe(diagram)
  })
  it.each([['class', 'class Order'], ['erd', 'entity Order'], ['use-case', 'usecase "Order" as UC']])('recognizes existing explicit %s syntax without producer markers', (kind, declaration) => {
    const result = parsed('```plantuml\n@startuml\n' + declaration + '\n@enduml\n```')
    expect(result.sources[0].kind).toBe(kind)
    expect(supportsReadOnlyPlantUmlPreview(result.sources[0])).toBe(true)
  })
})


describe('isolated actual assistance handler bodies (mocked setters, no page imports)', () => {
  const page = readFileSync('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
  it('retains generated result and prior state when Apply preparation refuses', () => {
    const body = page.split('const handleApplyAiResult = () => {')[1].split('\n  const statCards =')[0].replace(/\s*}\s*$/, '')
    const generated = { result: 'unrecoverable source' }
    let result: typeof generated | null = generated
    let loading: string | null = 'ready'
    const form = { description: 'prior text', sources: ['prior source'] }
    let error = ''
    const handler = new Function('aiAssistanceResult', 'setCreateIdeaDescriptionFromPlainText', 'setAiAssistanceResult', 'setAiAssistanceLoading', body)
    handler(generated, () => { error = 'Recover original source'; return false }, (value: typeof generated | null) => { result = value }, (value: string | null) => { loading = value })
    expect(result).toBe(generated)
    expect(loading).toBe('ready')
    expect(form).toEqual({ description: 'prior text', sources: ['prior source'] })
    expect(error).toBe('Recover original source')
  })
  it('retains newly generated immediate assistance result when preparation refuses', () => {
    const marker = '        setAiAssistanceResult(result)'
    const start = page.indexOf(marker)
    expect(start).toBeGreaterThan(-1)
    const body = page.slice(start, page.indexOf('\n      }', start)) + '\nsetAiAssistanceResult(null)'
    const generated = { result: 'embedded source' }
    let retained: typeof generated | null = null
    let error = ''
    new Function('result', 'setAiAssistanceResult', 'setCreateIdeaDescriptionFromPlainText', body)(generated, (value: typeof generated | null) => { retained = value }, () => { error = 'Recovery required'; return false })
    expect(retained).toBe(generated)
    expect(error).toBe('Recovery required')
  })
})


describe('composed actual preparation and Apply handler refusal', () => {
  const page = readFileSync('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
  it.each(['malformed', 'html-held'])('keeps editor and selection setters untouched for %s source', reason => {
    const start = page.indexOf('  const applySelectedIdeaDescription =')
    const bodyStart = page.indexOf('=> {', start) + 4
    const body = page.slice(bodyStart, page.indexOf('  const setCreateIdeaDescriptionFromPlainText', bodyStart)).replace(/\s*}\s*$/, '')
    const setterNames = ['setCreateIdeaSelectedSources', 'setCreateIdeaProcessDiagrams', 'setCreateIdeaDescriptionHtml', 'setCreateIdeaForm']
    const setters = setterNames.map(() => vi.fn())
    const error = vi.fn()
    const editorWrite = vi.fn()
    const editor = { current: { get innerHTML() { return 'old editor' }, set innerHTML(value: string) { editorWrite(value) } } }
    const names = ['nextText', 'options', 'prepareDiagramHandoff', 'createIdeaSelectedSources', 'setAiAssistanceError', 'sanitizeIdeaDescriptionRichHtml', 'plainTextToIdeaRichHtml', 'extractPlainTextFromIdeaRichHtml', 'resolveSavedIdeaRichHtml', ...setterNames, 'latestRevisedProcessDiagrams', 'createIdeaDescriptionEditorRef']
    const apply = new Function(...names, body)
    const generated = { result: reason === 'malformed' ? '<!--tectona-process-diagram:class:%INVALID-->' : 'selected text' }
    const options = reason === 'html-held' ? { mode: 'resume', html: '<pre data-source="diagram">opaque</pre>' } : { mode: 'assistance' }
    const actualPrepare = (text: string) => apply(text, options, prepareDiagramHandoff, [], error, (text: string) => text, (text: string) => text, (text: string) => text, (plain: string, html?: string) => html && html !== plain ? null : plain, ...setters, latestRevisedProcessDiagrams, editor)
    const handlerBody = page.split('const handleApplyAiResult = () => {')[1].split('\n  const statCards =')[0].replace(/\s*}\s*$/, '')
    const clearResult = vi.fn(), clearLoading = vi.fn()
    new Function('aiAssistanceResult', 'setCreateIdeaDescriptionFromPlainText', 'setAiAssistanceResult', 'setAiAssistanceLoading', handlerBody)(generated, actualPrepare, clearResult, clearLoading)
    expect(error).toHaveBeenCalledOnce()
    for (const setter of setters) expect(setter).not.toHaveBeenCalled()
    expect(editorWrite).not.toHaveBeenCalled()
    expect(clearResult).not.toHaveBeenCalled()
    expect(clearLoading).not.toHaveBeenCalled()
  })
})


it.each(['classDiagram\nclass Order', 'erDiagram\nORDER { int id }', 'sequenceDiagram\nA->>B: Review'])('retains existing Mermaid technical preview eligibility: %s', diagram => {
  const selected = parsed('```mermaid\n' + diagram + '\n```').sources[0]
  expect(supportsReadOnlyTechnicalPreview(selected)).toBe(true)
  expect(selected.reviewedRepresentation).toBe(false)
})


describe('shared bounded attached-caption cleanup', () => {
  const header = 'DIAGRAM PROSES BISNIS YANG SUDAH DISETUJUI (wajib masuk draft):'
  it('cleans the actual147 internal wrapper and preserves both canonical lanes', () => {
    const text = `Before.\n${header}\nAS-IS:\n\`\`\`plantuml\n${body}\n\`\`\`\nTO-BE:\n\`\`\`plantuml\n${body}\n\`\`\`\nAfter.`
    const result = parsed(text)
    expect(result.prose).not.toContain(header)
    expect(result.prose).not.toMatch(/AS-IS:|TO-BE:/)
    expect(result.prose).toContain('Before.')
    expect(result.prose).toContain('After.')
    expect(latestRevisedProcessDiagrams(serializeSelectedSources(result.prose, result.sources)).map(entry => entry.kind)).toEqual(['as_is', 'to_be'])
  })
  it('does not remove the wrapper when attached to a technical source', () => {
    const technical = '@startuml\nclass Payload\n@enduml'
    const result = parsed(`${header}\nAS-IS:\n\`\`\`plantuml\n${technical}\n\`\`\``)
    expect(result.prose).toContain(header)
    expect(result.prose).toContain('AS-IS:')
    expect(result.sources[0].source.trim()).toBe(technical)
  })
  it('keeps unknown fences and ordinary prose containing the wrapper text', () => {
    const unknown = `${header}\nAS-IS:\n\`\`\`unknown\nopaque\n\`\`\``
    expect(parsed(unknown).prose).toBe(unknown)
    const prose = `Discuss ${header} with the owner.\nAS-IS:\n\`\`\`plantuml\n${body}\n\`\`\``
    expect(parsed(prose).prose).toContain(`Discuss ${header} with the owner.`)
  })
})
