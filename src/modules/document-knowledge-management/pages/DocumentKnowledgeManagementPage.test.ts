import { beforeEach, describe, expect, it } from 'vitest'
import {
  combineKbStructuredChunksBySection,
  detectKbSectionHeaders,
  extractKbStructuredHtmlFromAnswer,
  enforceCanonicalKbSections,
  listUnknownKbHeadings,
  normalizeKbPlainTextForComparison,
  primeKbStructureLexicon,
  renderKbPlainTextAsDeterministicStructuredHtml,
  renderKbPlainTextAsStrictPreservedHtml,
  restoreKbSoftLineBreaks,
  validateKbStructuredContentPreservesSource,
  splitKbBySectionAware,
} from './DocumentKnowledgeManagementPage'

describe('Make Structured helpers', () => {
  beforeEach(() => {
    primeKbStructureLexicon([
      'Overview',
      'Core Function',
      'Key Capabilities',
      'Enterprise Position',
      'Strategic Objective',
      'Key Differentiation',
      'Supported Use Cases',
      'AI Enablement & Future Potential',
      'Objective',
      'Input Context',
      'Rules',
      'Language Handling',
      'Constraints',
      'Formatting',
      'Quality Checklist',
      'Grammar & Language Improvement',
      'Professional Writing Enhancement',
      'Readability Optimization',
      'Content Restructuring',
      'Consistency Validation',
      'AI Writing Assistance',
      'Knowledge Base',
      'Business Requirement Document (BRD)',
      'SOP',
      'Technical Documentation',
      'Proposal',
      'Governance Document',
      'Executive Summary',
      'Operational Documentation',
      'Writing enhancement',
      'Grammar correction',
      'Professional tone adjustment',
      'Readability improvement',
      'Sentence restructuring',
      'Sentence correction',
      'Typo detection',
      'Language normalization',
      'Enterprise-friendly tone adjustment',
      'Formal writing enhancement',
      'Executive-style wording recommendation',
      'Technical writing improvement',
      'Governance-style language refinement',
      'Sentence simplification',
      'Structure clarity improvement',
      'Redundancy reduction',
      'Flow readability enhancement',
      'Contextual readability optimization',
      'Paragraph restructuring',
      'Section organization improvement',
      'Content flow enhancement',
      'Writing hierarchy optimization',
      'Semantic content organization',
      'Terminology consistency',
      'Naming consistency',
      'Tone consistency',
      'Formatting consistency',
      'Documentation alignment',
      'Rewrite recommendation',
      'Intelligent wording suggestion',
      'Context-aware writing enhancement',
      'Enterprise vocabulary optimization',
      'AI-assisted editorial refinement',
    ].join('\n'))
  })

  it('detects known source sections', () => {
    const text = [
      'Overview',
      'Paragraph one about capability.',
      '',
      'Core Function',
      'Item list intro paragraph.',
      '',
      'Key Capabilities',
      'Capability details paragraph.',
      '',
      'Enterprise Position',
      'Enterprise position paragraph.',
    ].join('\n')

    const headers = detectKbSectionHeaders(text)
    expect(headers.map((h) => h.name)).toEqual([
      'Overview',
      'Core Function',
      'Key Capabilities',
      'Enterprise Position',
    ])
  })

  it('splits long sections without leaking continuation marker into content payload', () => {
    const longBody = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} with long explanatory content`).join('\n')
    const text = [
      'Overview',
      longBody,
      '',
      'Core Function',
      'Short core function paragraph.',
    ].join('\n')

    const chunks = splitKbBySectionAware(text, 260)
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.some((chunk) => chunk.content.includes('SECTION CONTINUATION:'))).toBe(false)
    expect(chunks.every((chunk) => chunk.sectionNames.length <= 1)).toBe(true)
  })

  it('keeps only canonical headings after combine and enforce', () => {
    const sectionOrder = ['Overview', 'Core Function']

    const combined = combineKbStructuredChunksBySection(
      [
        {
          sectionName: 'Overview',
          html: '<h2>Overview</h2><p>Intro content.</p><h2>Key Objectives</h2><p>Rogue heading content.</p>',
        },
        {
          sectionName: 'Overview',
          html: '<h2>Overview</h2><p>Continuation content.</p>',
        },
        {
          sectionName: 'Core Function',
          html: '<div><h2>Core Function</h2><p>Core details.</p></div>',
        },
      ],
      sectionOrder
    )

    const unknownBefore = listUnknownKbHeadings(combined, sectionOrder)
    expect(unknownBefore).toContain('Key Objectives')

    const canonical = enforceCanonicalKbSections(combined, sectionOrder)
    const unknownAfter = listUnknownKbHeadings(canonical, sectionOrder)
    expect(unknownAfter).toEqual([])

    const overviewHeadingCount = (canonical.match(/<h2>Overview<\/h2>/g) ?? []).length
    const coreHeadingCount = (canonical.match(/<h2>Core Function<\/h2>/g) ?? []).length
    expect(overviewHeadingCount).toBe(1)
    expect(coreHeadingCount).toBe(1)
    expect(canonical).not.toContain('<h2>Key Objectives</h2>')
  })

  it('accepts structurally different html when the source text is preserved', () => {
    const source = 'Overview\nHello world.\n\nCore Function\nSecond paragraph.'
    const structured = '<h2>Overview</h2><p>Hello world.</p><h2>Core Function</h2><p>Second paragraph.</p>'

    expect(normalizeKbPlainTextForComparison(source)).toBe('Overview Hello world. Core Function Second paragraph.')
    expect(validateKbStructuredContentPreservesSource(source, structured)).toEqual({ valid: true })
  })

  it('rejects rewritten output even if headings are canonical', () => {
    const source = 'Overview\nHello world.\n\nCore Function\nSecond paragraph.'
    const rewritten = '<h2>Overview</h2><p>Hello brave new world.</p><h2>Core Function</h2><p>Second paragraph with rewrite.</p>'

    expect(validateKbStructuredContentPreservesSource(source, rewritten)).toEqual({
      valid: false,
      reason: 'Structured output changes the source wording or content order.',
    })
  })

  it('accepts equivalent punctuation spacing in structured output', () => {
    const source = 'Overview\nCapability ini mendukung berbagai jenis konten seperti:Knowledge Base\n\nCore Function\nCapability ini digunakan untuk:Writing enhancement'
    const structured = '<h2>Overview</h2><p>Capability ini mendukung berbagai jenis konten seperti: Knowledge Base</p><h2>Core Function</h2><p>Capability ini digunakan untuk: Writing enhancement</p>'

    expect(validateKbStructuredContentPreservesSource(source, structured)).toEqual({ valid: true })
  })

  it('extracts structured html from alternate json response keys', () => {
    const answer = JSON.stringify({ html: '<h2>Overview</h2><p>Structured content.</p>' })

    expect(extractKbStructuredHtmlFromAnswer(answer)).toBe('<h2>Overview</h2><p>Structured content.</p>')
  })

  it('renders markdown emphasis as safe html while preserving source meaning', () => {
    const source = 'Overview\nGrafik donut **Workspace Health Distribution** menampilkan status workspace.'
    const html = renderKbPlainTextAsDeterministicStructuredHtml(source)

    expect(html).toContain('<strong>Workspace Health Distribution</strong>')
    expect(validateKbStructuredContentPreservesSource(source, html)).toEqual({ valid: true })
  })

  it('promotes colon-ended labels into subsection headings', () => {
    const source = [
      'Overview',
      'Fungsi:',
      'Menampilkan ringkasan status workspace berdasarkan pola kesehatan, prioritas, dan mitigasi yang relevan.',
      'Sumber data:',
      'workspace-org + sinyal governance/compliance dari modul monitoring, audit, dan compliance.' ,
    ].join('\n')

    const html = renderKbPlainTextAsDeterministicStructuredHtml(source)

    expect(html).toContain('<h3>Fungsi</h3>')
    expect(html).toContain('<h3>Sumber data</h3>')
    expect(validateKbStructuredContentPreservesSource(source, html)).toEqual({ valid: true })
  })

  it('accepts reordered structure when wording tokens stay identical', () => {
    const source = [
      'Overview',
      'Improve writing quality while preserving original meaning and business intent.',
      'Facts numbers and domain terms must stay unchanged.',
      '',
      'Core Function',
      'Use concise professional enterprise tone with consistent terminology.',
    ].join('\n')

    const structured = [
      '<h2>Core Function</h2>',
      '<p>Use concise professional enterprise tone with consistent terminology.</p>',
      '<h2>Overview</h2>',
      '<p>Improve writing quality while preserving original meaning and business intent.</p>',
      '<p>Facts numbers and domain terms must stay unchanged.</p>',
    ].join('')

    expect(validateKbStructuredContentPreservesSource(source, structured)).toEqual({ valid: true })
  })

  it('accepts minor wording drift while preserving critical tokens', () => {
    const source = [
      'Objective',
      'Improve writing quality while preserving original meaning business intent facts numbers and domain terms.',
      'Keep terminology consistent and html safe and clean for enterprise use.',
    ].join('\n')

    const structured = [
      '<h2>Objective</h2>',
      '<p>Improve writing quality while preserving original meaning business intent facts numbers and domain terms.</p>',
      '<p>Keep terminology consistency and html safe clean for enterprise use.</p>',
    ].join('')

    expect(validateKbStructuredContentPreservesSource(source, structured)).toEqual({ valid: true })
  })

  it('rejects output that changes critical numeric/id-like tokens', () => {
    const source = [
      'Rules',
      'Preserve product_id abc-123 and version v2.1.9 with 100 percent accuracy.',
      'Do not alter ids and numbers.',
    ].join('\n')

    const rewritten = [
      '<h2>Rules</h2>',
      '<p>Preserve product_id abc-124 and version v2.2.0 with 100 percent accuracy.</p>',
      '<p>Do not alter ids and numbers.</p>',
    ].join('')

    expect(validateKbStructuredContentPreservesSource(source, rewritten)).toEqual({
      valid: false,
      reason: 'Structured output changes the source wording or content order.',
    })
  })

  it('does not force list mode for json-like line after colon label', () => {
    const source = [
      'Input Context',
      'User will provide KB format context:',
      '{"content_html":"..."}',
      'Rules',
      'Detect source language from input content.',
    ].join('\n')

    const html = renderKbPlainTextAsDeterministicStructuredHtml(source)

    expect(html).toContain('<h2>Input Context</h2>')
    expect(html).toContain('<p>User will provide KB format context:</p>')
    expect(html).toContain('<p>{"content_html":"..."}</p>')
    expect(html).toContain('Rules')
    expect(html).not.toContain('<ul><li>{"content_html":"..."}</li></ul>')
  })

  it('formats rules-like sections as bullet lists for readability', () => {
    const source = [
      'Rules',
      'Detect source language from input content.',
      'Preserve original meaning and business intent.',
      'Constraints',
      'Do NOT add new facts.',
      'Do NOT change business intent.',
    ].join('\n')

    const html = renderKbPlainTextAsDeterministicStructuredHtml(source)

    expect(html).toContain('<h2>Rules</h2>')
    expect(html).toContain('<li>Detect source language from input content.</li>')
    expect(html).toContain('<li>Preserve original meaning and business intent.</li>')
    expect(html).toContain('<li>Constraints</li>')
    expect(html).toContain('<li>Do NOT add new facts.</li>')
    expect(html).toContain('<li>Do NOT change business intent.</li>')
  })

  it('renders deterministic structured html that preserves source text', () => {
    const source = [
      'Overview',
      'Kalimat pembuka capability.',
      '',
      'Capability ini mendukung berbagai jenis konten seperti:',
      'Knowledge Base',
      'BRD',
      '',
      'Core Function',
      'Capability ini digunakan untuk:',
      'Writing enhancement',
      'Grammar correction',
    ].join('\n')

    const html = renderKbPlainTextAsDeterministicStructuredHtml(source)

    expect(html).toContain('<h2>Overview</h2>')
    expect(html).toContain('<h2>Core Function</h2>')
    expect(html).toContain('<ul>')
    expect(validateKbStructuredContentPreservesSource(source, html)).toEqual({ valid: true })
  })

  it('restores heading boundaries from run-on content', () => {
    const runOn = 'OverviewImprove Writing AI Capability. Core FunctionCapability ini digunakan untuk. Key CapabilitiesGrammar correction.'
    const restored = restoreKbSoftLineBreaks(runOn)

    expect(restored).toContain('Overview')
    expect(restored).toContain('Core Function')
    expect(restored).toContain('Key Capabilities')
  })

  it('recovers known list items from run-on content', () => {
    primeKbStructureLexicon([
      'Overview',
      'Core Function',
      'Knowledge Base',
      'Business Requirement Document (BRD)',
      'SOP',
      'Technical Documentation',
      'Proposal',
      'Governance Document',
      'Executive Summary',
      'Operational Documentation',
      'Writing enhancement',
      'Grammar correction',
      'Professional tone adjustment',
      'Readability improvement',
    ].join('\n'))

    const runOn = [
      'OverviewCapability ini mendukung berbagai jenis konten seperti:Knowledge Base Business Requirement Document (BRD) SOP Technical Documentation Proposal Governance Document Executive Summary Operational Documentation',
      'Core FunctionCapability ini digunakan untuk:Writing enhancement Grammar correction Professional tone adjustment Readability improvement',
    ].join(' ')

    const restored = restoreKbSoftLineBreaks(runOn)
    const html = renderKbPlainTextAsDeterministicStructuredHtml(restored)

    expect(html).toContain('Knowledge Base')
    expect(html).toContain('Business Requirement Document (BRD)')
    expect(html).toContain('Writing enhancement')
    expect(html).toContain('Grammar correction')
  })

  it('renders strict preserved html that always passes preservation check', () => {
    const source = [
      'Overview',
      'Capability ini mendukung berbagai jenis konten seperti:Knowledge Base Business Requirement Document (BRD) SOP',
      'Core Function',
      'Capability ini digunakan untuk:Writing enhancement Grammar correction',
    ].join('\n')

    primeKbStructureLexicon(source)

    const html = renderKbPlainTextAsStrictPreservedHtml(source)
    expect(html).toContain('<h2>Overview</h2>')
    expect(html).toContain('Core Function')
    expect(validateKbStructuredContentPreservesSource(source, html)).toEqual({ valid: true })
  })

  it('renders Key Capabilities sub-section labels as strong labels with bullet lists', () => {
    const source = [
      'Key Capabilities',
      'Grammar & Language Improvement',
      'Grammar correction',
      'Sentence correction',
      'Professional Writing Enhancement',
      'Enterprise-friendly tone adjustment',
      'Formal writing enhancement',
    ].join('\n')

    primeKbStructureLexicon(source)

    const html = renderKbPlainTextAsDeterministicStructuredHtml(source)

    expect(html).toContain('<h2>Key Capabilities</h2>')
    expect(html).toContain('<strong>Grammar &amp; Language Improvement</strong>')
    expect(html).toContain('Professional Writing Enhancement')
    expect(html).toContain('Grammar correction')
    expect(html).toContain('Sentence correction')
    expect(html).toContain('Enterprise-friendly tone adjustment')
    expect(html).toContain('Formal writing enhancement')
  })

  it('renders unseen subsection labels using adaptive heuristic', () => {
    const source = [
      'Key Capabilities',
      'Governance Readiness Improvement',
      'Policy alignment enhancement',
      'Audit traceability reinforcement',
    ].join('\n')

    const html = renderKbPlainTextAsDeterministicStructuredHtml(source)

    expect(html).toContain('<h2>Key Capabilities</h2>')
    expect(html).toContain('<strong>Governance Readiness Improvement</strong>')
    expect(html).toContain('<li>Policy alignment enhancement</li>')
    expect(html).toContain('<li>Audit traceability reinforcement</li>')
  })
})
