import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML,
  parseBrdToKbContentStandard,
} from './brdToKbContentStandard'
import {
  detectBrdVersionFromName,
  ensureBrdKbStandardContent,
  extractDocxHeadingOutline,
  extractAffectedApplicationsFromDocumentText,
  extractBrdProjectOrInitiativeNameFromDocumentText,
  extractBrdStakeholdersFromDocumentText,
  extractBrdTableOfContentsEntries,
  extractBrdVersionFromDocumentText,
  extractDocxTableStakeholderLines,
  extractDocxXmlTableLines,
  pickRoleNameFromTableCells,
  parseBrdStructuredName,
  resolveRepositoryDocumentVersionLabel,
  sanitizeDetectedStakeholdersForRuntimeApi,
  scrubKbGeneratedContent,
} from './repositoryKbFromDocument'

describe('repository BRD metadata extraction', () => {
  it('parses structured BRD file names', () => {
    expect(parseBrdStructuredName('BRD_Test1_Helpdesk_V2_20260414.docx')).toEqual({
      projectOrInitiativeName: 'Test1',
      moduleOrFeatureName: 'Helpdesk',
      version: 'V2',
      yyyymmdd: '20260414',
    })
  })

  it('parses structured names with multi-segment versions', () => {
    // Regression: the version-format gate only allowed ONE decimal segment, so a name with
    // "V0.2.5" failed structured parsing ENTIRELY (returned null) — not just a display glitch,
    // this silently broke "same family, offer save-as-new-version" duplicate detection, since
    // sameFamily() treats a null `structured` on either side as "definitely not the same family".
    expect(parseBrdStructuredName('BRD_Project_HarmonyPenangananNonZoning_V0.2.5_20260824.docx')).toEqual({
      projectOrInitiativeName: 'Project',
      moduleOrFeatureName: 'HarmonyPenangananNonZoning',
      version: 'V0.2.5',
      yyyymmdd: '20260824',
    })
  })

  it('distinguishes space-separated version segments in file names', () => {
    // Regression: "v 0 2" and "v 0 2.5" (a common human naming convention — spaces standing in
    // for dots) both collapsed to "V0", making two genuinely different revisions of the same
    // document look like exact duplicates and silently overwriting the version distinction.
    expect(detectBrdVersionFromName(
      '[Harmony] Penanganan Non Zoning Collection di Cabang  Adira HI v 0 2.docx',
    )).toBe('V0.2')
    expect(detectBrdVersionFromName(
      '[Harmony] Penanganan Non Zoning Collection di Cabang Adira HI v 0 2.5.docx',
    )).toBe('V0.2.5')
  })

  it('keeps detecting simple version formats in file names', () => {
    expect(detectBrdVersionFromName('SomeDoc_v2.docx')).toBe('V2')
    expect(detectBrdVersionFromName('Report_version_3.docx')).toBe('V3')
    expect(detectBrdVersionFromName('Draft_v1.5.docx')).toBe('V1.5')
    expect(detectBrdVersionFromName('NoVersionHere.docx')).toBe('V1')
  })

  it('extracts multi-segment versions from BRD document content', () => {
    // Regression: (?:\.\d+)? only allowed ONE decimal segment — "Version: 0.2.5" in the document
    // body truncated to "V0.2", losing the ".5" — and this takes priority over file-name
    // detection since document-body text is checked first.
    expect(extractBrdVersionFromDocumentText('Business Requirement Document\nVersion: 0.2.5\n')).toBe('V0.2.5')
    expect(extractBrdVersionFromDocumentText('Versi Dokumen: 0.2.5\n')).toBe('V0.2.5')
  })

  it('extracts version from BRD document content', () => {
    const text = [
      'Business Requirement Document',
      'Version: 2.0',
      'Project Name: Helpdesk Modernization',
    ].join('\n')

    expect(extractBrdVersionFromDocumentText(text)).toBe('V2.0')
    expect(extractBrdProjectOrInitiativeNameFromDocumentText(text)).toBe('Helpdesk Modernization')
  })

  it('prefers document content version over backend revision counter', () => {
    const label = resolveRepositoryDocumentVersionLabel({
      title: 'BRD_Test1_Helpdesk_V2_20260414',
      fileName: 'BRD_Test1_Helpdesk_V2_20260414.docx',
      currentVersionNo: 1,
      documentText: 'Version: 2.0',
    })

    expect(label).toBe('V2.0')
  })

  it('falls back to filename version when content has no version', () => {
    const label = resolveRepositoryDocumentVersionLabel({
      title: 'BRD_Test1_Helpdesk_V2_20260414',
      currentVersionNo: 1,
      documentText: 'Executive summary only',
    })

    expect(label).toBe('V2')
  })
})

describe('BRD to KB content standard enforcement', () => {
  const sampleBrdText = [
    'Table of Contents',
    'I. Kontrol Dokumen',
    'II. Ringkasan Eksekutif',
    'III. Ruang Lingkup',
    '',
    'Aplikasi yang terdampak',
    '- IDE — identitas nasional',
    '- BRMS — analisis kredit',
    '',
    'PIC: Anindya Suryo Prawadyo',
    'Business Owner: Puspa Arundini',
    'Anindya Suryo Prawadyo - Project Manager',
  ].join('\n')

  const standard = parseBrdToKbContentStandard(DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML)

  it('extracts TOC, applications, and stakeholders with roles', () => {
    expect(extractBrdTableOfContentsEntries(sampleBrdText)).toEqual([
      'Kontrol Dokumen',
      'Ringkasan Eksekutif',
      'Ruang Lingkup',
    ])
    expect(extractAffectedApplicationsFromDocumentText(sampleBrdText).map((item) => item.name)).toEqual(
      expect.arrayContaining(['IDE', 'BRMS']),
    )
    const stakeholders = extractBrdStakeholdersFromDocumentText(sampleBrdText)
    expect(stakeholders.some((item) => item.name === 'Anindya Suryo Prawadyo' && item.role.includes('Project Manager'))).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Puspa Arundini' && /business owner/i.test(item.role))).toBe(true)
  })

  it('ensures mandatory KB sections exist in generated html', () => {
    const html = ensureBrdKbStandardContent('<h2>Overview</h2><p>Intro</p>', sampleBrdText, standard)
    expect(html).toContain('<h2>Ringkasan Daftar Isi</h2>')
    expect(html).toContain('<h2>Aplikasi yang Terdampak</h2>')
    expect(html).toContain('<h2>Daftar Orang Terkait dan Peran</h2>')
    expect(html).toContain('Anindya Suryo Prawadyo')
    expect(html).toContain('IDE')
  })

  it('strips page numbers from TOC headings (dotted leaders and plain spaces)', () => {
    const tocWithPages = [
      'TABLE OF CONTENTS',
      'I. Overview ................................. 6',
      'II. User Requirements ...................... 7',
      'IV. BCP 12',
      'V. Approval 13',
    ].join('\n')

    const entries = extractBrdTableOfContentsEntries(tocWithPages)
    // No heading should retain a trailing page number ('Approval' is intentionally
    // dropped as a sign-off boilerplate section by BRD_TOC_STOP_HEADING).
    expect(entries).toEqual(
      expect.arrayContaining(['Overview', 'User Requirements', 'BCP']),
    )
    expect(entries.some((e) => /\d/.test(e))).toBe(false)
    expect(entries.some((e) => /\.{3,}/.test(e))).toBe(false)
  })

  it('renders clean <h3> headings without page numbers in the generated section', () => {
    const tocWithPages = [
      'TABLE OF CONTENTS',
      'I. Overview 6',
      'II. User Requirements 7',
      'IV. BCP 12',
    ].join('\n')
    const html = ensureBrdKbStandardContent('', tocWithPages, standard)
    expect(html).toContain('<h3>Overview</h3>')
    expect(html).toContain('<h3>User Requirements</h3>')
    expect(html).toContain('<h3>BCP</h3>')
    expect(html).not.toMatch(/<h3>[^<]*\d[^<]*<\/h3>/)
  })

  it('strips template instruction text and asterisks from TOC headings', () => {
    const docText = [
      '--- DOCX HEADINGS ---',
      'Resiko/Risk* (jika diperlukan – Diisi oleh Risk Management)',
      'BCP (Business Continuity Plan)',
    ].join('\n')
    const entries = extractBrdTableOfContentsEntries(docText)
    expect(entries).toContain('Resiko/Risk')
    expect(entries).toContain('BCP (Business Continuity Plan)') // meaningful expansion kept
    expect(entries.some((e) => /jika diperlukan|Diisi oleh|\*/.test(e))).toBe(false)
  })

  it('extracts a hierarchical outline from mammoth heading HTML (numbering-independent)', () => {
    // Word auto-numbering (I., A.) is NOT in the text — only heading levels survive.
    const docxHtml = [
      '<h1>BRD CLAR Penanganan Produk SCF FMCG</h1>',
      '<h1>Revision History</h1>',
      '<h2>Overview</h2>',
      '<h3>Latar Belakang/Background</h3>',
      '<h3>Keuntungan/Benefit</h3>',
      '<h3>Resiko/Risk</h3>',
      '<h2>User Requirements</h2>',
      '<h3>Proses Sebelumnya/Current Process</h3>',
      '<h3>Desain Matriks User/Design User Matrix</h3>',
      '<h2>MI/SOP</h2>',
      '<h2>BCP</h2>',
      '<h2>Approval</h2>',
    ].join('')

    const outline = extractDocxHeadingOutline(docxHtml)
    // Boilerplate (Revision History, Approval) dropped; title h1 kept as main (harmless)
    expect(outline).toContain('Overview')
    expect(outline).toContain('Overview > Latar Belakang/Background')
    expect(outline).toContain('User Requirements > Desain Matriks User/Design User Matrix')
    expect(outline).toContain('MI/SOP')
    expect(outline).not.toContain('Revision History')
    expect(outline).not.toContain('Approval')
  })

  it('renders nested sub-sections under their parent in the generated section', () => {
    const docText = [
      '--- DOCX HEADINGS ---',
      'Overview',
      'Overview > Latar Belakang/Background',
      'Overview > Keuntungan/Benefit',
      'User Requirements',
      'User Requirements > Proses Sebelumnya/Current Process',
      'User Requirements > Desain Matriks User/Design User Matrix',
      'MI/SOP',
      'BCP',
    ].join('\n')

    const html = ensureBrdKbStandardContent('', docText, standard)
    // Main sections as <h3>
    expect(html).toContain('<h3>Overview</h3>')
    expect(html).toContain('<h3>User Requirements</h3>')
    expect(html).toContain('<h3>MI/SOP</h3>')
    expect(html).toContain('<h3>BCP</h3>')
    // Sub-sections nested as <li> under their parent
    expect(html).toMatch(/<h3>Overview<\/h3>[\s\S]*?<ul>[\s\S]*?<strong>Latar Belakang\/Background<\/strong>/)
    expect(html).toContain('<strong>Desain Matriks User/Design User Matrix</strong>')
  })

  it('gives each sub-section its own summary from the document body', () => {
    const docText = [
      '--- DOCX HEADINGS ---',
      'Overview',
      'Overview > Latar Belakang/Background',
      'Overview > Keuntungan/Benefit',
      '',
      '--- DOCX BODY ---',
      'Overview',
      'Bagian ini memberikan gambaran umum proyek.',
      'Latar Belakang/Background',
      'Produk SCF FMCG dibutuhkan karena proses manual saat ini lambat dan rawan kesalahan.',
      'Keuntungan/Benefit',
      'Implementasi mempercepat proses approval dan menurunkan biaya operasional secara signifikan.',
    ].join('\n')

    const html = ensureBrdKbStandardContent('', docText, standard)
    // Each sub-section <li> carries its own body-derived summary, not the generic placeholder
    expect(html).toMatch(/<strong>Latar Belakang\/Background<\/strong>\s*—\s*Produk SCF FMCG dibutuhkan/)
    expect(html).toMatch(/<strong>Keuntungan\/Benefit<\/strong>\s*—\s*Implementasi mempercepat/)
  })

  it('states "tidak ada konten" for empty sections and empty sub-sections', () => {
    const docText = [
      '--- DOCX HEADINGS ---',
      'Overview',
      'Overview > Latar Belakang/Background',
      'BCP',
    ].join('\n')

    const html = ensureBrdKbStandardContent('', docText, standard)
    // Empty leaf section (no subs, no content) → honest statement, not a vague hedge
    expect(html).toMatch(/<h3>BCP<\/h3><p>Tidak ada konten untuk bagian ini di dalam BRD\.<\/p>/)
    expect(html).not.toContain('belum dapat diverifikasi')
    // Parent with subs but no own intro → high-level synthesis from sub names
    expect(html).toMatch(/<h3>Overview<\/h3><p>Bagian ini mencakup Latar Belakang\/Background\.<\/p>/)
    // Empty sub-section → honest "no content", consistent with empty top-level sections
    expect(html).toMatch(/<li><strong>Latar Belakang\/Background<\/strong> — Tidak ada konten untuk bagian ini di dalam BRD\.<\/li>/)
  })

  it('treats unfilled BRD template/instruction text as no content', () => {
    const docText = [
      '--- DOCX HEADINGS ---',
      'MI/SOP',
      'BCP',
      '',
      '--- DOCX BODY ---',
      'MI/SOP',
      'Tambahkan nama MI/SOP yang akan dibuat atau diubah untuk BRD ini. Not Applicable Tuliskan N/A jika dalam project ini tidak terdapat hal yang dimaksud.',
      'BCP',
      'Tambahkan langkah BCP untuk dengan BRD ini. Not Applicable Tuliskan N/A jika dalam project ini tidak terdapat hal yang dimaksud. Lampirkan capture dari sign off user.',
    ].join('\n')

    const html = ensureBrdKbStandardContent('', docText, standard)
    expect(html).toMatch(/<h3>MI\/SOP<\/h3><p>Tidak ada konten untuk bagian ini di dalam BRD\.<\/p>/)
    expect(html).toMatch(/<h3>BCP<\/h3><p>Tidak ada konten untuk bagian ini di dalam BRD\.<\/p>/)
    expect(html).not.toContain('Tambahkan')
    expect(html).not.toContain('Lampirkan capture')
  })

  it('parent body intro drops inline sub enumeration (no duplication of the sub list)', () => {
    // The Overview body intro mixes a high-level sentence with an inline sub enumeration.
    const docText = [
      '--- DOCX HEADINGS ---',
      'Overview',
      'Overview > Latar Belakang/Background',
      'Overview > Keuntungan/Benefit',
      'Overview > Resiko/Risk',
      '',
      '--- DOCX BODY ---',
      'Overview',
      'BRD ini membahas penanganan produk SCFFMCG, mencakup latar belakang, keuntungan, dan risiko. '
        + 'Latar Belakang/Background — Menjelaskan konteks. Keuntungan/Benefit — Manfaat. Resiko/Risk — Risiko.',
      'Latar Belakang/Background',
      'Detail latar belakang produk.',
    ].join('\n')

    const html = ensureBrdKbStandardContent('', docText, standard)
    const overviewParagraph = /<h3>Overview<\/h3><p>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? ''
    expect(overviewParagraph).not.toMatch(/Latar Belakang\/Background\s*—/)
    expect(overviewParagraph).not.toMatch(/Keuntungan\/Benefit\s*—/)
    expect(overviewParagraph).toContain('BRD ini membahas penanganan produk SCFFMCG')
  })

  it('rejects BRD template labels masquerading as person names', () => {
    const noisyBrdText = [
      'Business Requirement Document BRD Nama Aplikasi Helpdesk',
      'COPYRIGHT NOTICE Document Information Technology Directorate Copyright',
      'TABLE OF CONTENTS REVISION HISTORY Revision Date Author Sections Changed',
      'Confirm BRD Nama User Sebutkan Full Sign Off IT Versi',
      'Niko Kurniawan Bonggowarsito — Chief of Sales, Service & Distribution',
      'Ricky Gunawan — Chief of IT & Digital Officer',
    ].join('\n')

    const stakeholders = extractBrdStakeholdersFromDocumentText(noisyBrdText)
    expect(stakeholders.some((item) => item.name === 'Niko Kurniawan Bonggowarsito')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Ricky Gunawan')).toBe(true)
    expect(stakeholders.some((item) => /copyright|revision|confirm brd|table of contents/i.test(item.name))).toBe(false)
  })

  it('picks role and name from approval table with leading No column', () => {
    expect(
      pickRoleNameFromTableCells([
        '1',
        'Head of Development Dept IT LM',
        'Rendhy Wijayanto',
        'OK',
        '01-Jan-2026',
      ]),
    ).toEqual({
      role: 'Head of Development Dept IT LM',
      name: 'Rendhy Wijayanto',
    })
  })

  it('rejects a section heading word like "Overview" as a stakeholder name', () => {
    // Regression: an approval-table row pairing a stray heading ("Overview") with a role
    // ("Head of IT") was mistakenly captured as a stakeholder name/role pair.
    const html = [
      '<table>',
      '<tr><td>No</td><td>Area</td><td>Name</td><td>Comments</td><td>Signature</td><td>Date</td></tr>',
      '<tr><td>1</td><td>Head of IT</td><td>Overview</td><td></td><td></td><td></td></tr>',
      '</table>',
    ].join('')

    const tableText = extractDocxTableStakeholderLines(html)
    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(tableText),
    )

    expect(stakeholders.some((item) => item.name === 'Overview')).toBe(false)
  })

  it('strips stray markdown bold markers from stakeholder name/role text', () => {
    const html = [
      '<table>',
      '<tr><td>No</td><td>Area</td><td>Name</td><td>Comments</td><td>Signature</td><td>Date</td></tr>',
      '<tr><td>1</td><td>**Head of IT**</td><td>Rendhy Wijayanto</td><td></td><td></td><td></td></tr>',
      '</table>',
    ].join('')

    const tableText = extractDocxTableStakeholderLines(html)
    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(tableText),
    )

    const rendhy = stakeholders.find((item) => item.name === 'Rendhy Wijayanto')
    expect(rendhy?.name).not.toMatch(/\*/)
    expect(rendhy?.role).not.toMatch(/\*/)
  })

  it('extracts stakeholders from docx html approval table with No column', () => {
    const html = [
      '<table>',
      '<tr><td>No</td><td>Area</td><td>Name</td><td>Comments</td><td>Signature</td><td>Date</td></tr>',
      '<tr><td>1</td><td>Head of Development Dept IT LM</td><td>Rendhy Wijayanto</td><td></td><td></td><td></td></tr>',
      '<tr><td>2</td><td>Head of IT Solution Architect</td><td>Gugun Gunawan</td><td></td><td></td><td></td></tr>',
      '</table>',
    ].join('')

    const tableText = extractDocxTableStakeholderLines(html)
    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(tableText),
    )

    expect(stakeholders.some((item) => item.name === 'Rendhy Wijayanto')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Gugun Gunawan')).toBe(true)
  })

  it('extracts stakeholders from docx xml approval table', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const documentXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:tbl>',
      '<w:tr>',
      '<w:tc><w:p><w:r><w:t>Area</w:t></w:r></w:p></w:tc>',
      '<w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc>',
      '</w:tr>',
      '<w:tr>',
      '<w:tc><w:p><w:r><w:t>IT System Analyst</w:t></w:r></w:p></w:tc>',
      '<w:tc><w:p><w:r><w:t>Imam Mutagin</w:t></w:r></w:p></w:tc>',
      '</w:tr>',
      '</w:tbl>',
      '</w:body>',
      '</w:document>',
    ].join('')
    zip.file('word/document.xml', documentXml)
    const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' })

    const tableText = await extractDocxXmlTableLines(arrayBuffer)
    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(tableText),
    )

    expect(stakeholders.some((item) => item.name === 'Imam Mutagin')).toBe(true)
  })

  it('extracts stakeholders from docx html approval table', () => {
    const html = [
      '<table>',
      '<tr><td>Area</td><td>Name</td><td>Comments</td><td>Signature</td><td>Date</td></tr>',
      '<tr><td>Head of Development Dept IT LM</td><td>Rendhy Wijayanto</td><td></td><td></td><td></td></tr>',
      '<tr><td>Head of IT Solution Architect</td><td>Gugun Gunawan</td><td></td><td></td><td></td></tr>',
      '<tr><td>IT System Analyst</td><td>Imam Mutagin</td><td></td><td></td><td></td></tr>',
      '</table>',
    ].join('')

    const tableText = extractDocxTableStakeholderLines(html)
    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(tableText),
    )

    expect(stakeholders.some((item) => item.name === 'Rendhy Wijayanto')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Gugun Gunawan')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Imam Mutagin')).toBe(true)
  })

  it('extracts stakeholders when role spans multiple lines before name', () => {
    const multilineRoleText = [
      'APPROVAL - IT',
      'Head of Development Dept',
      'IT LM',
      'Rendhy Wijayanto',
      'IT System Analyst',
      'Imam Mutagin',
    ].join('\n')

    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(multilineRoleText),
    )

    expect(stakeholders.some((item) => item.name === 'Rendhy Wijayanto' && /IT LM/i.test(item.role))).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Imam Mutagin')).toBe(true)
  })

  it('extracts approval rows from docx-style vertical table cells', () => {
    const verticalTableText = [
      'Some business content at end of document',
      'Head of IT Solution Architect',
      'Gugun Gunawan',
      'IT System Analyst',
      'Imam Mutagin',
      'IT System Analyst',
      'Nika Arditya',
    ].join('\n')

    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(verticalTableText),
    )
    expect(stakeholders.some((item) => item.name === 'Gugun Gunawan')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Imam Mutagin')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Nika Arditya')).toBe(true)
  })

  it('prioritizes DOCX TABLE EXTRACT block even when body has no approval keywords', () => {
    const combinedText = [
      '--- DOCX TABLE EXTRACT ---',
      'Head of IT Solution Architect\tGugun Gunawan',
      'Head of IT Solution Architect',
      'Gugun Gunawan',
      'IT System Analyst\tImam Mutagin',
      'IT System Analyst',
      'Imam Mutagin',
      '',
      '--- DOCX BODY ---',
      'Business Requirement Document',
      'Ringkasan bisnis tanpa tabel approval di body text.',
    ].join('\n')

    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(combinedText),
    )

    expect(stakeholders.some((item) => item.name === 'Gugun Gunawan')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Imam Mutagin')).toBe(true)
  })

  it('extracts stakeholders from APPROVAL - IT sign-off table', () => {
    const approvalTableText = [
      'APPROVAL - IT',
      'Area Name Comments Signature Date',
      'Head of Development Dept IT LM Rendhy Wijayanto',
      'Head of Development Dept IT CLAR Mulyadi OK',
      'Head of IT Solution Architect Gugun Gunawan',
      'IT System Analyst Imam Mutagin',
      'IT System Analyst Nika Arditya',
      'IT LM QC Desy Puspita Chandra',
      'IT CLAR QC Satrya Fatih Fajri',
    ].join('\n')

    const stakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
      extractBrdStakeholdersFromDocumentText(approvalTableText),
    )

    expect(stakeholders.some((item) => item.name === 'Rendhy Wijayanto' && /Head of Development Dept IT LM/i.test(item.role))).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Mulyadi')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Gugun Gunawan')).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Imam Mutagin' && /System Analyst/i.test(item.role))).toBe(true)
    expect(stakeholders.some((item) => item.name === 'Desy Puspita Chandra')).toBe(true)
    expect(stakeholders.length).toBeGreaterThanOrEqual(6)
  })

  it('removes duplicate Stakeholder section and keeps canonical Daftar Orang Terkait dan Peran', () => {
    const approvalTableText = [
      'APPROVAL - IT',
      'Head of IT Solution Architect Gugun Gunawan',
      'IT System Analyst Imam Mutagin',
    ].join('\n')
    const html = ensureBrdKbStandardContent(
      [
        '<h2>Overview</h2><p>Intro</p>',
        '<h2>Stakeholder</h2><ul><li><strong>Gugun Gunawan</strong> — Head of IT Solution Architect</li></ul>',
        '<h2>Daftar Orang Terkait dan Peran</h2><ul><li><strong>Gugun Gunawan</strong> — Head of IT Solution Architect</li><li><strong>Imam Mutagin</strong> — IT System Analyst</li></ul>',
      ].join(''),
      approvalTableText,
      standard,
    )

    expect(html.match(/<h2>\s*Stakeholder\s*<\/h2>/gi) ?? []).toHaveLength(0)
    expect(html.match(/<h2>\s*Daftar Orang Terkait dan Peran\s*<\/h2>/gi) ?? []).toHaveLength(1)
    expect(html).toContain('Gugun Gunawan')
    expect(html).toContain('Imam Mutagin')
  })

  it('rebuilds Ringkasan Daftar Isi with h3 for every detected TOC entry', () => {
    const brdText = [
      'Table of Contents',
      'I. Document Control',
      'II. Executive Summary',
      'III. Business Process',
      'IV. System Impact',
    ].join('\n')

    const html = ensureBrdKbStandardContent(
      '<h2>Ringkasan Daftar Isi</h2><h3>Overview</h3><p>Ringkasan bagian ini belum dapat diverifikasi penuh dari cuplikan dokumen.</p>',
      brdText,
      standard,
    )

    expect(html).toContain('<h3>Document Control</h3>')
    expect(html).toContain('<h3>Executive Summary</h3>')
    expect(html).toContain('<h3>Business Process</h3>')
    expect(html).toContain('<h3>System Impact</h3>')
    expect(html.match(/<h3>Overview<\/h3>/gi) ?? []).toHaveLength(0)
  })

  it('removes orphan stakeholder list before first section heading', () => {
    const html = ensureBrdKbStandardContent(
      [
        '<ul><li><strong>Desy Puspita Chandra</strong> — IT LM QC</li><li><strong>Satrya Fatih Fajri</strong> — IT CLAR QC</li></ul>',
        '<h2>Ringkasan Daftar Isi</h2><p>TOC</p>',
      ].join(''),
      'Table of Contents\nI. Overview',
      standard,
    )

    const firstH2Index = html.indexOf('<h2>')
    const orphanIndex = html.indexOf('Desy Puspita Chandra')
    expect(orphanIndex === -1 || orphanIndex > firstH2Index).toBe(true)
  })

  it('replaces placeholder stakeholder section with extracted approval names', () => {
    const approvalTableText = [
      'APPROVAL - IT',
      'Head of IT Solution Architect Gugun Gunawan',
      'IT System Analyst Imam Mutagin',
    ].join('\n')
    const html = ensureBrdKbStandardContent(
      '<h2>Stakeholder</h2><p>Stakeholder verifikasi tidak ditemukan dalam dokumen. Perlu klarifikasi lebih lanjut.</p>',
      approvalTableText,
      standard,
    )
    expect(html).toContain('Gugun Gunawan')
    expect(html).toContain('Imam Mutagin')
    expect(html).not.toContain('verifikasi tidak ditemukan')
  })

  it('rejects BRD business prose masquerading as stakeholder role', () => {
    const proseRole = [
      'Apabila Aplikasi Helpdesk — apabila aplikasi helpdesk tidak dapat digunakan, pencatatan tiket sementara dilakukan melalui form darurat atau email terpusat yang telah ditetapkan. Petugas wajib mencatat nomor referensi manual, waktu pelaporan, pelapor, kategori, prioritas, dan status penanganan.',
      'Niko Kurniawan Bonggowarsito — Chief of Sales, Service & Distribution',
    ].join('\n')

    const stakeholders = extractBrdStakeholdersFromDocumentText(proseRole)
    expect(stakeholders.some((item) => item.name === 'Niko Kurniawan Bonggowarsito')).toBe(true)
    expect(stakeholders.some((item) => /apabila aplikasi helpdesk/i.test(item.role))).toBe(false)
    expect(sanitizeDetectedStakeholdersForRuntimeApi(stakeholders).every(
      (item) => item.role.length <= 200,
    )).toBe(true)
  })

  it('scrubs stakeholder junk blocks from generated html', () => {
    const dirty = [
      '<h2>Daftar Orang Terkait dan Peran</h2>',
      '<ul><li><strong>Niko</strong> — Chief</li></ul>',
      '<h3>Stakeholder tambahan (ekstraksi dokumen)</h3>',
      '<ul><li><strong>Confirm BRD</strong> — Peran belum teridentifikasi</li></ul>',
    ].join('')
    const cleaned = scrubKbGeneratedContent(dirty)
    expect(cleaned).not.toContain('Stakeholder tambahan')
    expect(cleaned).not.toContain('Confirm BRD')
    expect(cleaned).toContain('Niko')
  })

  it('strips a TOC-leak line from a client-side-assembled section body', () => {
    // Regression: when server-side section assembly is skipped (e.g. the backend couldn't reach
    // the BRD-To-KB content standard), the client fallback pulls body text straight from the
    // document — including stray TOC lines like "II. User Requirements 7".
    const dirty = '<h3>Resiko/Risk</h3><p>II. User Requirements 7</p>'
    const cleaned = scrubKbGeneratedContent(dirty)
    expect(cleaned).toContain('<h3>Resiko/Risk</h3>')
    expect(cleaned).not.toContain('User Requirements 7')
  })

  it('strips several concatenated TOC-leak entries on one line', () => {
    const dirty = '<h3>Desain Matriks User/Design User Matrix</h3><p>III. MI/SOP 8 IV. BCP 9 V. Approval 10</p>'
    const cleaned = scrubKbGeneratedContent(dirty)
    expect(cleaned).not.toContain('MI/SOP 8')
    expect(cleaned).not.toContain('V. Approval 10')
  })

  it('strips an unfilled form/dropdown instruction placeholder', () => {
    const dirty = '<h3>Keuntungan/Benefit</h3><p>Pilih salah satu atau lebih kategori di bawah: Risk Management: Operational.</p>'
    const cleaned = scrubKbGeneratedContent(dirty)
    expect(cleaned).not.toContain('Pilih salah satu')
  })

  it('keeps real section content untouched', () => {
    const clean = '<h3>Keuntungan/Benefit</h3><p>Mempercepat proses approval jaminan dari 5 hari menjadi 1 hari.</p>'
    expect(scrubKbGeneratedContent(clean)).toBe(clean)
  })
})
