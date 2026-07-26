export type RepositoryFileProperties = {
  size_bytes: number
  file_name: string
  pages: number | null
  words: number | null
  characters: number | null
  total_editing_minutes: number | null
  title: string | null
  subject: string | null
  keywords: string | null
  comments: string | null
  category: string | null
  template: string | null
  status: string | null
  company: string | null
  hyperlink_base: string | null
  created: string | null
  modified: string | null
  last_printed: string | null
  author: string | null
  last_modified_by: string | null
  manager: string | null
  custom: Record<string, string>
  extracted_at: string
  source: 'docx' | 'file-only'
}

export type MetadataDisplayRow = {
  label: string
  value: string
}

function firstElementTextByLocalName(xml: string, localName: string): string | null {
  if (!xml.trim()) return null
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  const nodes = doc.getElementsByTagName('*')
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.localName === localName) {
      const text = node.textContent?.trim()
      if (text) return text
    }
  }
  return null
}

function parseInteger(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCustomProperties(xml: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!xml.trim()) return result

  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return result

  const nodes = doc.getElementsByTagName('*')
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.localName !== 'property') continue
    const name = node.getAttribute('name')?.trim()
    if (!name) continue
    const value = node.textContent?.trim()
    if (value) result[name] = value
  }
  return result
}

export function formatRepositoryFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`
  const mb = kb / 1024
  return `${mb.toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`
}

export function formatRepositoryEditingTime(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  if (minutes === 1) return '1 Minute'
  return `${minutes} Minutes`
}

export function formatRepositoryMetadataDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.trim()
  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function row(label: string, value: string | null | undefined): MetadataDisplayRow | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return { label, value: trimmed }
}

export function buildRepositoryFileMetadataSections(
  properties: RepositoryFileProperties | null | undefined,
): {
  properties: MetadataDisplayRow[]
  dates: MetadataDisplayRow[]
  people: MetadataDisplayRow[]
  custom: MetadataDisplayRow[]
} {
  if (!properties) {
    return { properties: [], dates: [], people: [], custom: [] }
  }

  const propertyRows = [
    row('Size', formatRepositoryFileSize(properties.size_bytes)),
    row('Pages', properties.pages != null ? String(properties.pages) : null),
    row('Words', properties.words != null ? String(properties.words) : null),
    row('Total editing time', formatRepositoryEditingTime(properties.total_editing_minutes)),
    row('Title', properties.title),
    row('Tags', properties.keywords),
    row('Comments', properties.comments),
    row('Template', properties.template),
    row('Status', properties.status),
    row('Categories', properties.category),
    row('Subject', properties.subject),
    row('Hyperlink base', properties.hyperlink_base),
    row('Company', properties.company),
  ].filter(Boolean) as MetadataDisplayRow[]

  const dateRows = [
    row('Last modified', formatRepositoryMetadataDate(properties.modified)),
    row('Created', formatRepositoryMetadataDate(properties.created)),
    row('Last printed', formatRepositoryMetadataDate(properties.last_printed)),
  ].filter(Boolean) as MetadataDisplayRow[]

  const peopleRows = [
    row('Manager', properties.manager),
    row('Author', properties.author),
    row('Last modified by', properties.last_modified_by),
  ].filter(Boolean) as MetadataDisplayRow[]

  const customRows = Object.entries(properties.custom ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => row(label, value))
    .filter(Boolean) as MetadataDisplayRow[]

  return {
    properties: propertyRows,
    dates: dateRows,
    people: peopleRows,
    custom: customRows,
  }
}

export function parseRepositoryFileProperties(value: unknown): RepositoryFileProperties | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.size_bytes !== 'number' || typeof record.file_name !== 'string') return null
  return {
    size_bytes: record.size_bytes,
    file_name: record.file_name,
    pages: typeof record.pages === 'number' ? record.pages : null,
    words: typeof record.words === 'number' ? record.words : null,
    characters: typeof record.characters === 'number' ? record.characters : null,
    total_editing_minutes: typeof record.total_editing_minutes === 'number' ? record.total_editing_minutes : null,
    title: typeof record.title === 'string' ? record.title : null,
    subject: typeof record.subject === 'string' ? record.subject : null,
    keywords: typeof record.keywords === 'string' ? record.keywords : null,
    comments: typeof record.comments === 'string' ? record.comments : null,
    category: typeof record.category === 'string' ? record.category : null,
    template: typeof record.template === 'string' ? record.template : null,
    status: typeof record.status === 'string' ? record.status : null,
    company: typeof record.company === 'string' ? record.company : null,
    hyperlink_base: typeof record.hyperlink_base === 'string' ? record.hyperlink_base : null,
    created: typeof record.created === 'string' ? record.created : null,
    modified: typeof record.modified === 'string' ? record.modified : null,
    last_printed: typeof record.last_printed === 'string' ? record.last_printed : null,
    author: typeof record.author === 'string' ? record.author : null,
    last_modified_by: typeof record.last_modified_by === 'string' ? record.last_modified_by : null,
    manager: typeof record.manager === 'string' ? record.manager : null,
    custom: record.custom && typeof record.custom === 'object'
      ? Object.fromEntries(
        Object.entries(record.custom as Record<string, unknown>)
          .filter(([, entry]) => typeof entry === 'string' && entry.trim())
          .map(([key, entry]) => [key, (entry as string).trim()]),
      )
      : {},
    extracted_at: typeof record.extracted_at === 'string' ? record.extracted_at : new Date(0).toISOString(),
    source: record.source === 'docx' ? 'docx' : 'file-only',
  }
}

export async function extractOfficeFileMetadata(file: File): Promise<RepositoryFileProperties> {
  const lowerName = file.name.toLowerCase()
  const isDocx =
    lowerName.endsWith('.docx')
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  const base: RepositoryFileProperties = {
    size_bytes: file.size,
    file_name: file.name,
    pages: null,
    words: null,
    characters: null,
    total_editing_minutes: null,
    title: null,
    subject: null,
    keywords: null,
    comments: null,
    category: null,
    template: null,
    status: null,
    company: null,
    hyperlink_base: null,
    created: null,
    modified: null,
    last_printed: null,
    author: null,
    last_modified_by: null,
    manager: null,
    custom: {},
    extracted_at: new Date().toISOString(),
    source: isDocx ? 'docx' : 'file-only',
  }

  if (!isDocx) return base

  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const coreXml = await zip.file('docProps/core.xml')?.async('string') ?? ''
    const appXml = await zip.file('docProps/app.xml')?.async('string') ?? ''
    const customXml = await zip.file('docProps/custom.xml')?.async('string') ?? ''

    return {
      ...base,
      source: 'docx',
      title: firstElementTextByLocalName(coreXml, 'title'),
      subject: firstElementTextByLocalName(coreXml, 'subject'),
      keywords: firstElementTextByLocalName(coreXml, 'keywords'),
      comments: firstElementTextByLocalName(coreXml, 'description'),
      category: firstElementTextByLocalName(coreXml, 'category'),
      author: firstElementTextByLocalName(coreXml, 'creator'),
      last_modified_by: firstElementTextByLocalName(coreXml, 'lastModifiedBy'),
      created: firstElementTextByLocalName(coreXml, 'created'),
      modified: firstElementTextByLocalName(coreXml, 'modified'),
      last_printed: firstElementTextByLocalName(appXml, 'lastPrinted') ?? firstElementTextByLocalName(coreXml, 'lastPrinted'),
      pages: parseInteger(firstElementTextByLocalName(appXml, 'Pages')),
      words: parseInteger(firstElementTextByLocalName(appXml, 'Words')),
      characters: parseInteger(firstElementTextByLocalName(appXml, 'Characters')),
      total_editing_minutes: parseInteger(firstElementTextByLocalName(appXml, 'TotalTime')),
      company: firstElementTextByLocalName(appXml, 'Company'),
      template: firstElementTextByLocalName(appXml, 'Template'),
      manager: firstElementTextByLocalName(appXml, 'Manager'),
      hyperlink_base: firstElementTextByLocalName(appXml, 'HyperlinkBase'),
      status: firstElementTextByLocalName(appXml, 'Status') ?? firstElementTextByLocalName(appXml, 'ContentStatus'),
      custom: parseCustomProperties(customXml),
    }
  } catch {
    return base
  }
}
