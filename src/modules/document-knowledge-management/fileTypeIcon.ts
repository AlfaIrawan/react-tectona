// File type to icon mapping for DocumentKnowledgeManagementPage
// Uses PNG icons from public/images/icons/ (trimmed to content bounds)

export function getFileTypeIcon(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return '/images/icons/icon-word.png'
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return '/images/icons/icon-power-point.png'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return '/images/icons/icon-excel.png'
  if (lower.endsWith('.pdf')) return '/images/icons/icon-pdf.png'
  if (lower.endsWith('.js')) return '/images/icons/icon-js.png'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return '/images/icons/icon-html.png'
  return '/images/icons/icon-file.png'
}
