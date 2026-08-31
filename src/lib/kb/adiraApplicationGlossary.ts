/**
 * Adira Finance application glossary — catalog + one KB entry per application.
 * Seeded via source-upsert on KB load (idempotent).
 */

import { upsertKbSourceEntry, type KbEntryResponse } from '@/lib/api/tectonaKbApi'
import { kbRichHtmlNeedsTableRepair } from './kbRichTableHtml'

export const ADIRA_APPLICATION_CATALOG_TITLE = 'Katalog Aplikasi Adira Finance'
export const ADIRA_GLOSSARY_SOURCE_SYSTEM = 'adira-application-glossary'
/** Workspace key for Adira Finance glossary entries (canonical workspace-org UUID). */
export const ADIRA_FINANCE_WORKSPACE_KEY = '00000000-0000-0000-0001-000000000100'
export const ADIRA_FINANCE_WORKSPACE_SLUG = 'adira-finance-ws'

const ADIRA_FINANCE_WORKSPACE_ALIASES = new Set([
  ADIRA_FINANCE_WORKSPACE_KEY.toLowerCase(),
  ADIRA_FINANCE_WORKSPACE_SLUG,
  'aw-g6uc',
  'afw-11at',
  'adira',
  'adira finance ws',
])

/** True when the active tenant workspace is Adira Finance WS (UUID, slug, or legacy alias). */
export function isAdiraFinanceWorkspaceId(workspaceId: string | null | undefined): boolean {
  const normalized = (workspaceId ?? '').trim().toLowerCase()
  if (!normalized) return false
  return ADIRA_FINANCE_WORKSPACE_ALIASES.has(normalized)
}

export type AdiraWorkspaceLookup = {
  id?: string | null
  workspaceId?: string | null
  workspace_key?: string | null
  slug?: string | null
  name?: string | null
  workspaceName?: string | null
}

/** Match Adira Finance WS by id alias or workspace-org slug/name (multi-workspace header). */
export function isAdiraFinanceWorkspaceRef(
  workspaceId: string | null | undefined,
  catalog?: ReadonlyArray<AdiraWorkspaceLookup>,
): boolean {
  if (isAdiraFinanceWorkspaceId(workspaceId)) return true
  const id = (workspaceId ?? '').trim()
  if (!id || !catalog?.length) return false
  const entry = catalog.find((item) => {
    const candidateId = (item.id ?? item.workspaceId ?? '').trim()
    return candidateId === id
  })
  if (!entry) return false
  const key = (entry.workspace_key ?? entry.slug ?? '').trim().toLowerCase()
  const name = (entry.name ?? entry.workspaceName ?? '').trim().toLowerCase()
  return ADIRA_FINANCE_WORKSPACE_ALIASES.has(key) || ADIRA_FINANCE_WORKSPACE_ALIASES.has(name)
}

export type AdiraApplicationDefinition = {
  slug: string
  title: string
  summary: string
  categoryLabel: string
  platformGroup: 'internal' | 'sap'
}

export const ADIRA_APPLICATIONS: AdiraApplicationDefinition[] = [
  {
    slug: 'onein',
    title: 'OneIn',
    summary: 'Nama/alias internal untuk OneIn Loan Origination System yang mendukung proses origination pembiayaan dari lead/application intake hingga keputusan dan pencairan.',
    categoryLabel: 'Loan Origination System',
    platformGroup: 'internal',
  },
  {
    slug: 'oneex',
    title: 'OneEx',
    summary: 'Aplikasi Adira Finance untuk proses dan layanan kanal eksternal (external) serta interaksi dengan mitra/pihak luar.',
    categoryLabel: 'Aplikasi eksternal',
    platformGroup: 'internal',
  },
  {
    slug: 'acction',
    title: 'ACCTION',
    summary: 'Aplikasi enterprise Adira Finance pada lanskap sistem operasional dan koleksi.',
    categoryLabel: 'Aplikasi operasional',
    platformGroup: 'internal',
  },
  {
    slug: 'aman',
    title: 'AMAN',
    summary: 'Aplikasi enterprise Adira Finance untuk kebutuhan pengelolaan keamanan/kepatuhan operasional terkait akses dan kontrol.',
    categoryLabel: 'Aplikasi keamanan',
    platformGroup: 'internal',
  },
  {
    slug: 'sap-fiori',
    title: 'SAP FIORI',
    summary: 'Antarmuka pengguna berbasis web (SAP Fiori) untuk mengakses transaksi dan laporan modul SAP di lingkungan Adira Finance.',
    categoryLabel: 'SAP — User Experience',
    platformGroup: 'sap',
  },
  {
    slug: 'sap-fico',
    title: 'SAP FICO',
    summary: 'Modul SAP Finance (FI) dan Controlling (CO) untuk akuntansi, pelaporan keuangan, dan controlling di Adira Finance.',
    categoryLabel: 'SAP — Finance & Controlling',
    platformGroup: 'sap',
  },
  {
    slug: 'sap-mm',
    title: 'SAP MM',
    summary: 'Modul SAP Materials Management untuk pengelolaan material, procurement, dan inventory terkait operasional Adira Finance.',
    categoryLabel: 'SAP — Materials Management',
    platformGroup: 'sap',
  },
]

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function listItem(label: string, value: string): string {
  return `<li><strong>${escapeHtml(label)}</strong> — ${escapeHtml(value)}</li>`
}

export function buildAdiraApplicationKbContentHtml(app: AdiraApplicationDefinition): string {
  if (app.slug === 'onein') {
    return [
      '<h2>Definisi</h2>',
      '<p><strong>OneIn</strong> adalah nama/alias internal untuk <strong>OneIn Loan Origination System</strong> di Adira Finance. '
      + 'Sistem ini mendukung proses origination pembiayaan dari lead/application intake hingga keputusan dan pencairan.</p>',
      '<h2>Penggunaan Istilah</h2>',
      '<ul>',
      listItem('Istilah utama', 'OneIn'),
      listItem('Nama kanonis aplikasi', 'OneIn Loan Origination System'),
      listItem('Konteks', 'loan origination, sales, survey, verification, credit analysis, approval, monitoring, dan disbursement'),
      '</ul>',
      '<h2>Batas Konten</h2>',
      '<p>Entry glossary ini hanya menjelaskan arti istilah dan alias. Detail fungsi, kapabilitas, arsitektur, serta integrasi '
      + 'tidak diduplikasi di sini; gunakan entry Application Catalog kanonis.</p>',
    ].join('')
  }

  const platformLabel = app.platformGroup === 'sap' ? 'SAP ERP' : 'Aplikasi internal Adira Finance'
  return [
    '<h2>Profil Aplikasi</h2>',
    '<ul>',
    listItem('Nama', app.title),
    listItem('Organisasi', 'Adira Finance (AF14189)'),
    listItem('Status', 'active'),
    listItem('Category', app.categoryLabel),
    listItem('Platform', platformLabel),
    '</ul>',
    '<h3>Ringkasan</h3>',
    `<p>${escapeHtml(app.summary)}</p>`,
    '<h3>Catatan</h3>',
    '<p>Entry ini merupakan bagian dari <strong>Katalog Aplikasi Adira Finance</strong> di Knowledge Base. '
    + 'Tim owner aplikasi dapat melengkapi integrasi, URL, owner teknis/bisnis, dan dependensi sistem.</p>',
  ].join('')
}

export function buildAdiraApplicationCatalogKbContentHtml(
  apps: AdiraApplicationDefinition[] = ADIRA_APPLICATIONS,
): string {
  const rows = apps.map((app, index) => {
    const platformLabel = app.platformGroup === 'sap' ? 'SAP ERP' : 'Internal'
    return [
      '<tr>',
      `<td>${index + 1}</td>`,
      `<td><strong>${escapeHtml(app.title)}</strong></td>`,
      `<td>${escapeHtml(app.categoryLabel)}</td>`,
      `<td>${escapeHtml(app.summary)}</td>`,
      `<td>${escapeHtml(platformLabel)}</td>`,
      '</tr>',
    ].join('')
  })

  return [
    '<h2>Katalog Aplikasi Adira Finance</h2>',
    '<p>Indeks navigasi aplikasi enterprise Adira Finance. Entry ini hanya merangkum portofolio; '
    + 'definisi istilah berada di Domain Glossary dan detail aplikasi dikelola pada entry Application Catalog kanonis.</p>',
    '<table>',
    '<thead><tr>',
    '<th>No</th>',
    '<th>Aplikasi</th>',
    '<th>Category</th>',
    '<th>Ringkasan</th>',
    '<th>Platform</th>',
    '</tr></thead>',
    `<tbody>${rows.join('')}</tbody>`,
    '</table>',
    '<h2>Aturan Penggunaan</h2>',
    '<ul>',
    '<li>Gunakan katalog ini untuk menemukan aplikasi dalam portofolio Adira Finance.</li>',
    '<li>Gunakan entry <strong>OneIn</strong> untuk definisi istilah/alias.</li>',
    '<li>Gunakan <strong>OneIn Loan Origination System</strong> sebagai sumber utama detail fungsi dan kapabilitas aplikasi.</li>',
    '</ul>',
  ].join('')
}

// ── Tombstones: entries the user explicitly deleted must NOT be re-created by the idempotent seed ──
const SUPPRESSED_GLOSSARY_TITLES_KEY = 'tectona-kb-suppressed-glossary-titles'

function readSuppressedGlossaryTitles(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(SUPPRESSED_GLOSSARY_TITLES_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(list) ? list.map((t) => String(t).trim().toLowerCase()) : [])
  } catch {
    return new Set()
  }
}

/** True if a title belongs to the seeded Adira glossary (an application or the catalog itself). */
export function isAdiraGlossaryManagedTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return false
  if (normalized === ADIRA_APPLICATION_CATALOG_TITLE.toLowerCase()) return true
  return ADIRA_APPLICATIONS.some((app) => app.title.toLowerCase() === normalized)
}

/** Remember a user-deleted glossary entry so the seed won't recreate it on the next KB load. */
export function suppressAdiraGlossaryTitle(title: string): void {
  if (typeof window === 'undefined') return
  const normalized = title.trim().toLowerCase()
  if (!normalized) return
  try {
    const set = readSuppressedGlossaryTitles()
    if (set.has(normalized)) return
    set.add(normalized)
    window.localStorage.setItem(SUPPRESSED_GLOSSARY_TITLES_KEY, JSON.stringify([...set]))
  } catch {
    // localStorage unavailable — best effort only
  }
}

export function findAdiraApplicationCatalogEntry(entries: KbEntryResponse[]): KbEntryResponse | null {
  return entries.find(
    (entry) => entry.title.trim().toLowerCase() === ADIRA_APPLICATION_CATALOG_TITLE.toLowerCase(),
  ) ?? null
}

export function resolveAdiraCatalogKbContent(content: string): string {
  if (kbRichHtmlNeedsTableRepair(content)) {
    return buildAdiraApplicationCatalogKbContentHtml()
  }
  return content
}

function findAdiraApplicationEntry(
  existingEntries: KbEntryResponse[],
  app: AdiraApplicationDefinition,
): KbEntryResponse | null {
  return existingEntries.find(
    (entry) => entry.title.trim().toLowerCase() === app.title.toLowerCase(),
  ) ?? null
}

/** Idempotent seed: create missing entries only. Never auto-patch user-edited content or re-enable inactive entries on load. */
export async function ensureAdiraApplicationGlossaryEntries(
  existingEntries: KbEntryResponse[] = [],
): Promise<KbEntryResponse[]> {
  const touched: KbEntryResponse[] = []
  const suppressed = readSuppressedGlossaryTitles()
  const seedCatalogContent = buildAdiraApplicationCatalogKbContentHtml()
  const existingCatalog = findAdiraApplicationCatalogEntry(existingEntries)

  try {
    if (!existingCatalog && !suppressed.has(ADIRA_APPLICATION_CATALOG_TITLE.toLowerCase())) {
      const catalog = await upsertKbSourceEntry({
        source_system: ADIRA_GLOSSARY_SOURCE_SYSTEM,
        source_entity_type: 'application_portfolio_catalog',
        source_entity_ref: 'adira-finance-catalog',
        category: 'application_catalog',
        title: ADIRA_APPLICATION_CATALOG_TITLE,
        content: seedCatalogContent,
        is_active: true,
        priority: 70,
        workspace_id: ADIRA_FINANCE_WORKSPACE_KEY,
        visibility_scope: 'internal',
      })
      touched.push(catalog.entry)
    }
  } catch {
    if (existingCatalog) touched.push(existingCatalog)
  }

  for (const app of ADIRA_APPLICATIONS) {
    const seedContent = buildAdiraApplicationKbContentHtml(app)
    const existingApp = findAdiraApplicationEntry(existingEntries, app)

    try {
      if (!existingApp && !suppressed.has(app.title.toLowerCase())) {
        const result = await upsertKbSourceEntry({
          source_system: ADIRA_GLOSSARY_SOURCE_SYSTEM,
          source_entity_type: app.slug === 'onein' ? 'domain_term' : 'application',
          source_entity_ref: app.slug,
          source_parent_ref: 'adira-finance-catalog',
          category: 'domain_glossary',
          title: app.title,
          content: seedContent,
          is_active: true,
          priority: 65,
          workspace_id: ADIRA_FINANCE_WORKSPACE_KEY,
          visibility_scope: 'internal',
        })
        touched.push(result.entry)
      }
    } catch {
      if (existingApp) touched.push(existingApp)
    }
  }

  return touched
}
