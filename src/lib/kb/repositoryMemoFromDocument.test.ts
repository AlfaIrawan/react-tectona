import { describe, expect, it } from 'vitest'
import {
  buildRepositoryFolderPathNames,
  buildMemoAttachmentSelfEntry,
  buildMemoPolicySummaryHtml,
  detectRepositoryDocumentKind,
  deriveMemoKbTitle,
  enrichMemoMetadataFromAttachmentFileName,
  extractMemoAttachmentEntriesFromDocumentText,
  extractMemoMetadataFromDocumentText,
  extractMemoPolicySummaryFromDocumentText,
  ensureMemoKbStandardContent,
  isMemoAttachmentUpload,
  isMemoInternalFolderPath,
  looksLikeMemoAttachmentFileName,
  mergeMemoAttachmentEntriesForUpload,
  mergeMemoMetadataExtract,
  parseMemoAttachmentFromFileName,
} from './repositoryMemoFromDocument'
import { parseMemoInternalToKbContentStandard } from './memoInternalToKbContentStandard'

describe('repositoryMemoFromDocument', () => {
  const sampleMemoHead = [
    'Klasifikasi : Internal',
    'MEMO INTERNAL',
    'No. MI-001/RISKMGT/IFRSKMGT/I/2026',
    'Kepada Head of Level 1 & 2',
    'Dari INFORMATION RISK MANAGEMENT',
    'Perihal Kebijakan Sistem Manajemen Keamanan Informasi (SMKI)',
    'Lampiran o Lampiran 1 – Isu Internal dan Eksternal (2 lembar)',
    'o Lampiran 3 – Sasaran Keamanan Informasi (2 lembar)',
    'Tanggal Terbit 07/01/2026',
    'GAMBARAN UMUM KETENTUAN',
    '1. Memo Internal ini mengatur SMKI sesuai ISO/IEC 27001:2022.',
    '2. Perubahan ketentuan dari Memo Internal sebelumnya adalah sebagai berikut',
  ].join('\n')

  it('detects memo internal from header text', () => {
    expect(detectRepositoryDocumentKind(sampleMemoHead, 'policy.pdf')).toBe('memo_internal')
    expect(detectRepositoryDocumentKind(sampleMemoHead, 'BRD_Helpdesk.docx')).toBe('memo_internal')
  })

  it('detects memo lampiran from filename and folder path', () => {
    expect(
      detectRepositoryDocumentKind('Isu internal dan eksternal ...', 'Lampiran II - Isu Internal dan Eksternal.pdf', {
        folderPath: ['Memo Internal', 'Kebijakan Sistem Manajemen Keamanan Informasi'],
      }),
    ).toBe('memo_internal')
    expect(
      detectRepositoryDocumentKind('', 'BRD_LampiranIIsuInternalDanEksternal_LampiranIIsuInternalDanEksternal_V1_20260331.pdf', {
        folderPath: ['Memo Internal'],
      }),
    ).toBe('memo_internal')
    expect(isMemoInternalFolderPath(['Memo Internal', 'Kebijakan SMKI'])).toBe(true)
    expect(looksLikeMemoAttachmentFileName('Lampiran 1 - Sasaran.pdf')).toBe(true)
    expect(
      buildRepositoryFolderPathNames(
        [
          { id: 'root-memo', name: 'Memo Internal', parent_id: null },
          { id: 'child-smki', name: 'Kebijakan SMKI', parent_id: 'root-memo' },
        ],
        'child-smki',
      ),
    ).toEqual(['Memo Internal', 'Kebijakan SMKI'])
  })

  it('extracts memo metadata and attachments', () => {
    const metadata = extractMemoMetadataFromDocumentText(sampleMemoHead)
    expect(metadata.memoNumber).toContain('MI-001')
    expect(metadata.subject).toContain('SMKI')
    expect(metadata.toAudience).toContain('Head of Level 1')

    const attachments = extractMemoAttachmentEntriesFromDocumentText(sampleMemoHead)
    expect(attachments.length).toBeGreaterThanOrEqual(2)
    expect(attachments[0]?.id).toMatch(/^L/)
  })

  it('derives memo KB title', () => {
    const metadata = extractMemoMetadataFromDocumentText(sampleMemoHead)
    const title = deriveMemoKbTitle({
      metadata,
      documentTitle: 'SMKI',
      fallbackTitle: null,
    })
    expect(title).toContain('Memo Internal')
    expect(title).toContain('MI-001')
  })

  it('builds required memo sections from standard', () => {
    const standard = parseMemoInternalToKbContentStandard(
      '<p><strong>required_sections:</strong> Metadata Memo:memo_metadata | Ringkasan Ketentuan:policy_summary | Peta Lampiran:attachment_index</p>',
    )
    const html = ensureMemoKbStandardContent(
      '<h2>Metadata Memo</h2><p>short</p>',
      sampleMemoHead,
      standard,
      extractMemoMetadataFromDocumentText(sampleMemoHead),
      extractMemoAttachmentEntriesFromDocumentText(sampleMemoHead),
    )
    expect(html).toContain('<h2>Metadata Memo</h2>')
    expect(html).toContain('<h2>Ringkasan Ketentuan</h2>')
    expect(html).toContain('<h2>Peta Lampiran</h2>')
    expect(html).toContain('MI-001')
  })

  it('formats policy summary as numbered HTML list', () => {
    const mashed = [
      'Berikut isu internal dan eksternal yang mempengaruhi implementasi SMKI di ADIRA FINANCE berdasarkan Lampiran 1 (MI-001/RISKMGT/IFRSKMGT/I/2026)',
      '1 Strategi dan tujuan bisnis yang selaras dengan kebijakan perusahaan',
      '2 Perubahan organisasi dengan kompleksitas tata kelola',
      '3 Kinerja keuangan dan kondisi keuangan perusahaan',
      '4 Tata kelola SMKI dan kepatuhan regulasi',
    ].join(' ')

    const html = buildMemoPolicySummaryHtml(mashed)
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>Strategi dan tujuan bisnis')
    expect(html).toContain('<li>Perubahan organisasi')
    expect(html).not.toMatch(/<p>[^<]*1 Strategi[^<]*2 Perubahan/)
  })

  it('formats lampiran table extract as HTML tables with section headings', () => {
    const source = [
      '--- DOC BODY ---',
      'Lampiran 1 (MI-001/RISKMGT/IFRSKMGT/I/2026) – Isu Internal dan Eksternal',
      'Isu-isu yang dapat mempengaruhi tujuan utama dari penerapan SMKI di ADIRA FINANCE',
      'telah diidentifikasi sebagai berikut:',
      '1. Isu Internal',
      'No. | Isu | Dampak',
      '1 | Strategi dan tujuan bisnis | Perubahan strategi dan tujuan bisnis perusahaan.',
      '8 | Teknologi | Teknologi yang belum sesuai best practice.',
      'Page 1 of 2',
      'Klasifikasi : Internal',
      'Lampiran 1 (MI-001/RISKMGT/IFRSKMGT/I/2026) – Isu Internal dan Eksternal',
      '2. Isu Eksternal',
      'No. | Isu | Dampak',
      '1 | Perubahan peraturan | Perubahan peraturan dapat mempengaruhi strategi.',
      '2 | Kebutuhan konsumen | Privasi data konsumen mempengaruhi sasaran.',
      'Page 2 of 2',
      'Klasifikasi : Internal',
    ].join('\n')

    const html = buildMemoPolicySummaryHtml(source)
    expect(html).toContain('<h3>Isu Internal</h3>')
    expect(html).toContain('<h3>Isu Eksternal</h3>')
    expect(html.match(/<table>/g)?.length).toBe(2)
    expect(html).toContain('<td>Strategi dan tujuan bisnis</td>')
    expect(html).toContain('<td>Kebutuhan konsumen</td>')
    expect(html).not.toContain('Page')
    expect(html).not.toContain('Klasifikasi')
  })

  it('enriches lampiran uploads with self index, parent metadata merge, and body summary', () => {
    const lampiranName = 'Lampiran 4 – Komunikasi Internal dan Eksternal.pdf'
    const lampiranText = [
      'Klasifikasi : Internal',
      'No. MI-001/RISKMGT/IFRSKMGT/I/2026',
      'Komunikasi internal dan eksternal harus mengikuti kanal resmi yang ditetapkan perusahaan.',
      'Setiap unit wajib memastikan distribusi informasi sesuai klasifikasi dan kebutuhan penerima.',
      'Pelanggaran terhadap ketentuan komunikasi dapat dikenakan sanksi sesuai kebijakan HR dan keamanan informasi.',
    ].join('\n')

    expect(parseMemoAttachmentFromFileName(lampiranName)).toEqual({
      id: 'L4',
      title: 'Komunikasi Internal dan Eksternal',
    })
    expect(isMemoAttachmentUpload(lampiranName, lampiranText)).toBe(true)

    const parent = extractMemoMetadataFromDocumentText(sampleMemoHead)
    const child = enrichMemoMetadataFromAttachmentFileName(
      extractMemoMetadataFromDocumentText(lampiranText),
      lampiranName,
    )
    const merged = mergeMemoMetadataExtract(parent, child)
    expect(merged.toAudience).toContain('Head of Level 1')
    expect(merged.fromUnit).toContain('INFORMATION RISK MANAGEMENT')
    expect(merged.subject).toContain('Komunikasi Internal dan Eksternal')

    const attachments = mergeMemoAttachmentEntriesForUpload([], lampiranName, true)
    expect(attachments).toHaveLength(1)
    expect(attachments[0]?.status).toBe('linked')
    expect(attachments[0]?.id).toBe('L4')

    expect(extractMemoPolicySummaryFromDocumentText(lampiranText)).toContain('komunikasi')

    const title = deriveMemoKbTitle({
      metadata: merged,
      documentTitle: 'Lampiran 4',
      fileName: lampiranName,
    })
    expect(title).toContain('Lampiran 4:')
    expect(title).toContain('MI-001')
  })
})
