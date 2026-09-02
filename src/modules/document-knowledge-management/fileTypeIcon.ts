// File type to icon mapping for DocumentKnowledgeManagementPage
// Uses PNG icons from public/images/icons/ (trimmed to content bounds)

export function getFileTypeIcon(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (/\.(doc|docx|dot|dotx)$/.test(lower)) return '/images/icons/icon-word.png'
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return '/images/icons/icon-power-point.png'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return '/images/icons/icon-excel.png'
  if (lower.endsWith('.pdf')) return '/images/icons/icon-pdf.png'
  if (lower.endsWith('.js')) return '/images/icons/icon-js.png'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return '/images/icons/icon-html.png'
  return '/images/icons/icon-file.png'
}

/** Human-readable file format label (for table "Type" columns) derived from the file name/extension. */
export function getFileTypeLabel(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (/\.(doc|docx|dot|dotx)$/.test(lower)) return 'Word'
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'PowerPoint'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'Excel'
  if (lower.endsWith('.csv')) return 'CSV'
  if (lower.endsWith('.iqy')) return 'Excel Web Query'
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'Markdown'
  if (lower.endsWith('.txt')) return 'Text'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'HTML'
  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.jsx') || lower.endsWith('.tsx')) return 'Code'
  if (lower.endsWith('.json')) return 'JSON'
  if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return 'Archive'
  if (/\.(png|jpe?g|gif|svg|webp|bmp)$/.test(lower)) return 'Image'
  const extMatch = lower.match(/\.([a-z0-9]+)$/)
  return extMatch ? extMatch[1].toUpperCase() : 'File'
}

/** Windows Explorer-style type names for the details / group-by-type view. */
export function getExplorerFileTypeLabel(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (/\.(doc|docx|dot|dotx)$/.test(lower)) return 'Microsoft Word Document'
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'Microsoft PowerPoint Presentation'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'Microsoft Excel Worksheet'
  if (lower.endsWith('.csv')) return 'Microsoft Excel Comma Separated Values File'
  if (lower.endsWith('.iqy')) return 'Microsoft Excel Web Query File'
  if (lower.endsWith('.pdf')) return 'PDF Document'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'HTML Document'
  if (/\.(png|jpe?g|gif|svg|webp|bmp)$/.test(lower)) return 'Image'
  const compact = getFileTypeLabel(fileName)
  return compact === 'File' ? 'File' : compact
}

export function formatExplorerDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const EXPLORER_FOLDER_TYPE_LABEL = 'File folder'
