import { createKbEntry, patchKbEntry, type KbEntryResponse } from '@/lib/api/tectonaKbApi'

export const BRD_TO_KB_CONTENT_STANDARD_TITLE = 'BRD-To-Knowledge Base Content Standard'

export type BrdKbRequiredSectionKind = 'toc_summary' | 'affected_apps' | 'stakeholders' | 'generic'

export type BrdKbRequiredSection = {
  title: string
  kind: BrdKbRequiredSectionKind
}

export type BrdToKbContentStandardParsed = {
  requiredSections: BrdKbRequiredSection[]
  promptExcerpt: string
}

/** Konten awal entry KB standar — disimpan di Knowledge Base, bukan sebagai aturan di kode aplikasi. */
export const DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML = [
  '<h2>Tujuan</h2>',
  '<p>Standar ini mengatur struktur konten Knowledge Base (KB) hasil generate otomatis dari dokumen Business Requirement Document (BRD). Tim dapat mengubah isi standar ini langsung di KB tanpa deploy ulang aplikasi.</p>',
  '<p><strong>required_sections:</strong> Ringkasan Daftar Isi:toc_summary | Aplikasi yang Terdampak:affected_apps | Daftar Orang Terkait dan Peran:stakeholders</p>',
  '<h2>Ringkasan Daftar Isi</h2>',
  '<p>Wajib memuat ringkasan untuk <strong>setiap poin</strong> Daftar Isi / Table of Contents BRD.</p>',
  '<ul>',
  '<li>Untuk setiap poin TOC utama: buat <code>&lt;h3&gt;[Judul poin]&lt;/h3&gt;</code> diikuti <code>&lt;p&gt;</code> ringkasan <strong>minimal 2 kalimat substantif</strong>.</li>',
  '<li>Jika poin TOC memiliki sub-section (ditandai format <code>Parent &gt; Sub</code> di daftar isi terdeteksi), cantumkan sub-section sebagai <code>&lt;ul&gt;&lt;li&gt;&lt;strong&gt;Nama Sub&lt;/strong&gt; — ringkasan singkat&lt;/li&gt;&lt;/ul&gt;</code> di bawah <code>&lt;p&gt;</code> parent.</li>',
  '<li>Judul <code>&lt;h3&gt;</code> WAJIB identik dengan nama poin TOC — <strong>jangan tambahkan nomor halaman atau angka apapun</strong> (contoh salah: "Overview 6"; contoh benar: "Overview").</li>',
  '<li>Jangan lewati poin daftar isi yang terdeteksi dari dokumen sumber.</li>',
  '<li><strong>JANGAN</strong> buat <code>&lt;h2&gt;</code> standalone untuk poin-poin TOC di luar section ini — semua ringkasan TOC hanya di sini sebagai <code>&lt;h3&gt;</code>.</li>',
  '<li>Jika cuplikan dokumen tidak cukup untuk suatu poin, tulis keterbatasan secara eksplisit <em>setelah</em> menyebutkan poin-poin yang dapat diekstrak — jangan tulis kalimat kosong tanpa fakta sama sekali.</li>',
  '</ul>',
  '<h2>Aplikasi yang Terdampak</h2>',
  '<p>Wajib mencantumkan aplikasi/sistem yang terdampak oleh BRD.</p>',
  '<ul>',
  '<li>Format: <code>&lt;ul&gt;&lt;li&gt;&lt;strong&gt;Nama Aplikasi&lt;/strong&gt; — dampak/konteks singkat&lt;/li&gt;&lt;/ul&gt;</code>.</li>',
  '<li>Sertakan integrasi atau dependensi sistem bila disebutkan di BRD (mis. IDE, BRMS, core banking).</li>',
  '<li>Jika tidak ada bukti di cuplikan, tulis pernyataan eksplisit bahwa aplikasi terdampak belum dapat diverifikasi.</li>',
  '</ul>',
  '<h2>Daftar Orang Terkait dan Peran</h2>',
  '<p>Wajib mencantumkan stakeholder yang terlibat beserta perannya.</p>',
  '<ul>',
  '<li>Format: <code>&lt;ul&gt;&lt;li&gt;&lt;strong&gt;Nama&lt;/strong&gt; — Peran&lt;/li&gt;&lt;/ul&gt;</code>.</li>',
  '<li>Peran wajib diisi (PIC, Business Owner, Approver, Project Manager, dll.), bukan hanya daftar nama.</li>',
  '<li>Prioritaskan sumber dari matriks RACI/stakeholder/responsibility matrix bila ada di BRD.</li>',
  '<li><strong>Jangan</strong> masukkan label form/template BRD sebagai nama orang (mis. "Nama User", "Confirm BRD", "Revision History", "TABLE OF CONTENTS", "COPYRIGHT NOTICE", "Full Sign Off IT").</li>',
  '<li><strong>Jangan</strong> buat section "Stakeholder tambahan (ekstraksi dokumen)" — hanya cantumkan nama manusia nyata dengan peran bisnis yang valid.</li>',
  '<li><strong>Jangan</strong> gunakan heading <code>&lt;h2&gt;Stakeholder&lt;/h2&gt;</code> terpisah — gunakan tepat <code>Daftar Orang Terkait dan Peran</code> (satu section saja, tanpa duplikasi daftar nama).</li>',
  '</ul>',
  '<h2>Catatan Generate</h2>',
  '<ul>',
  '<li>Tiga section wajib (<code>Ringkasan Daftar Isi</code>, <code>Aplikasi yang Terdampak</code>, <code>Daftar Orang Terkait dan Peran</code>) harus ada dengan judul <code>&lt;h2&gt;</code> persis seperti <code>required_sections</code>.</li>',
  '<li><strong>JANGAN</strong> buat <code>&lt;h2&gt;</code> tambahan untuk poin-poin TOC di luar <code>Ringkasan Daftar Isi</code> — hal ini menyebabkan duplikasi section. Semua ringkasan TOC hanya di dalam <code>&lt;h2&gt;Ringkasan Daftar Isi&lt;/h2&gt;</code> sebagai <code>&lt;h3&gt;</code>.</li>',
  '<li>Ringkasan Daftar Isi wajib memuat <code>&lt;h3&gt;</code> untuk <strong>setiap</strong> poin TOC yang terdeteksi — jangan hanya Overview, dan jangan tambahkan nomor halaman pada judul <code>&lt;h3&gt;</code>.</li>',
  '<li>KB hasil generate adalah ringkasan kuratif; dokumen BRD resmi tetap di Document Repository.</li>',
  '</ul>',
].join('')

function stripHtmlToPlainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSectionKind(value: string): BrdKbRequiredSectionKind {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'toc_summary') return 'toc_summary'
  if (normalized === 'affected_apps') return 'affected_apps'
  if (normalized === 'stakeholders') return 'stakeholders'
  return 'generic'
}

export function parseBrdToKbContentStandard(content: string | null | undefined): BrdToKbContentStandardParsed {
  const source = typeof content === 'string' ? content.replace(/<\/?strong>/gi, '') : ''
  const plain = stripHtmlToPlainText(source)
  const requiredMatch = source.match(/required_sections:\s*([^\n<]+)/i)
    ?? plain.match(/required_sections:\s*(.+)$/i)

  const requiredSections: BrdKbRequiredSection[] = []
  if (requiredMatch?.[1]) {
    requiredMatch[1]
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const colonIndex = part.indexOf(':')
        if (colonIndex < 0) {
          requiredSections.push({ title: part, kind: 'generic' })
          return
        }
        const title = part.slice(0, colonIndex).trim()
        const kindRaw = part.slice(colonIndex + 1).trim()
        if (!title) return
        requiredSections.push({
          title,
          kind: kindRaw ? normalizeSectionKind(kindRaw) : 'generic',
        })
      })
  }

  return {
    requiredSections,
    promptExcerpt: plain.slice(0, 3200),
  }
}

export function findBrdToKbContentStandardEntry(entries: KbEntryResponse[]): KbEntryResponse | null {
  return entries.find(
    (entry) => entry.title.trim().toLowerCase() === BRD_TO_KB_CONTENT_STANDARD_TITLE.toLowerCase(),
  ) ?? null
}

/**
 * Returns true when the stored content looks like raw escaped HTML tags rendered as text
 * (e.g. user pasted HTML into the WYSIWYG editor so "&lt;h2&gt;" or literal "<h2>" became visible text)
 * or is missing the required_sections declaration. Used to OFFER a manual repair — never to mutate
 * a governance entry automatically.
 */
export function isBrdToKbContentStandardCorrupted(content: string): boolean {
  const plain = stripHtmlToPlainText(content)
  return /&lt;h[1-6]&gt;|<h[1-6]>[^<]{0,5}<\/h[1-6]>.*<h[1-6]>/i.test(content)
    || /required_sections:/i.test(plain) === false
}

/**
 * Ensure the standard entry exists. Creates it with the default template ONLY when missing.
 * It never overwrites an existing entry — repair of a corrupted standard is an explicit, manual
 * action (see {@link repairBrdToKbContentStandardEntry}) so we don't silently clobber deliberate edits.
 */
export async function ensureBrdToKbContentStandardEntry(
  entries: KbEntryResponse[],
): Promise<KbEntryResponse | null> {
  const existing = findBrdToKbContentStandardEntry(entries)
  if (existing) return existing

  try {
    return await createKbEntry({
      category: 'governance',
      title: BRD_TO_KB_CONTENT_STANDARD_TITLE,
      content: DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML,
      is_active: true,
      priority: 90,
      workspace_id: null,
      visibility_scope: 'internal',
    })
  } catch {
    return null
  }
}

/**
 * Explicitly reset a corrupted standard entry back to the default template.
 * Call this only in response to a user/admin action (e.g. a "Reset to default" button),
 * never automatically on page load.
 */
export async function repairBrdToKbContentStandardEntry(
  entry: KbEntryResponse,
): Promise<KbEntryResponse> {
  return patchKbEntry(entry.id, { content: DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML })
}

export function buildBrdKbContentStandardPromptBlock(standard: BrdToKbContentStandardParsed): string[] {
  if (!standard.promptExcerpt.trim()) {
    return ['  - Ikuti standar konten BRD→KB dari Knowledge Base jika tersedia.']
  }

  const sectionLines = standard.requiredSections.length > 0
    ? standard.requiredSections.map(
      (section, index) => `    ${index + 1}) <h2>${section.title}</h2> (kind=${section.kind})`,
    )
    : ['    (required_sections tidak ditemukan — ikuti heading h2 pada standar KB)']

  return [
    '  - kb_content_html WAJIB mengikuti BRD-To-Knowledge Base Content Standard dari Knowledge Base.',
    '  - Section wajib (urutan disarankan):',
    ...sectionLines,
    '  - Patuhi format dan aturan pada cuplikan standar KB di bawah.',
  ]
}
