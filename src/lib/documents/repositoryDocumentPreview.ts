import {
  resolveLatestDocumentAttachmentBlob,
} from '@/lib/api/documentKnowledgeApi'

export type RepositoryPreviewLoadOptions = {
  projectId?: string | null
  attachmentId?: string | null
  fileNameHint?: string | null
}

export type RepositoryPreviewSource = {
  fileName: string
  contentType: string
  blob: Blob
}

export type RepositoryPreviewKind = 'docx' | 'office' | 'docviewer' | 'unsupported'

const DOC_VIEWER_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'txt',
  'html',
  'htm',
  'csv',
])

/** Matches backend Gotenberg convertible set (hidden PDF cache for non-PDF originals). */
const PDF_CONVERTIBLE_EXTENSIONS = new Set([
  'docx',
  'doc',
  'odt',
  'rtf',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'odp',
  'ods',
])

function extensionOf(fileName: string): string {
  const lowerName = fileName.toLowerCase()
  return lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : ''
}

/** True when View Document should use the server-cached PDF (original stays non-PDF, PDF copy is hidden). */
export function isRepositoryPdfConvertiblePreview(fileName: string, contentType: string): boolean {
  const extension = extensionOf(fileName)
  const normalizedType = contentType.toLowerCase()
  if (extension === 'pdf' || normalizedType.includes('application/pdf')) return false
  if (PDF_CONVERTIBLE_EXTENSIONS.has(extension)) return true
  return (
    normalizedType.includes('wordprocessingml')
    || normalizedType.includes('msword')
    || normalizedType.includes('spreadsheetml')
    || normalizedType.includes('ms-excel')
    || normalizedType.includes('presentationml')
    || normalizedType.includes('ms-powerpoint')
    || normalizedType.includes('opendocument')
    || normalizedType.includes('rtf')
  )
}

export function resolveRepositoryPreviewKind(fileName: string, contentType: string): RepositoryPreviewKind {
  const extension = extensionOf(fileName)
  const normalizedType = contentType.toLowerCase()

  if (
    extension === 'docx'
    || normalizedType.includes('wordprocessingml.document')
    || normalizedType.includes('officedocument.wordprocessingml')
  ) {
    return 'docx'
  }

  if (isRepositoryPdfConvertiblePreview(fileName, contentType)) {
    return 'office'
  }

  if (
    DOC_VIEWER_EXTENSIONS.has(extension)
    || normalizedType.includes('pdf')
    || normalizedType.startsWith('image/')
    || normalizedType.startsWith('text/')
  ) {
    return 'docviewer'
  }

  return 'unsupported'
}

export function resolveRepositoryPreviewFileType(fileName: string, contentType: string): string {
  const extension = fileName.toLowerCase().split('.').pop()?.trim()
  if (extension) return extension
  if (contentType.includes('pdf')) return 'pdf'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('jpeg')) return 'jpg'
  if (contentType.includes('plain')) return 'txt'
  return 'txt'
}

/** Native PDFs render more reliably in a browser iframe than via react-doc-viewer/pdf.js. */
export function isRepositoryNativePdfPreview(fileName: string, contentType: string): boolean {
  const lowerName = fileName.toLowerCase()
  const extension = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : ''
  const normalizedType = contentType.toLowerCase()
  return extension === 'pdf' || normalizedType.includes('pdf')
}

export function normalizeRepositoryPreviewBlob(blob: Blob, fileName: string, contentType: string): Blob {
  if (!isRepositoryNativePdfPreview(fileName, contentType)) return blob
  if (blob.type === 'application/pdf') return blob
  return new Blob([blob], { type: 'application/pdf' })
}

export async function loadRepositoryPreviewSource(
  documentId: string,
  localFile?: File | null,
  options?: RepositoryPreviewLoadOptions,
): Promise<RepositoryPreviewSource | null> {
  if (localFile) {
    return {
      fileName: localFile.name,
      contentType: localFile.type || 'application/octet-stream',
      blob: localFile,
    }
  }

  try {
    const downloaded = await resolveLatestDocumentAttachmentBlob(documentId, {
      projectId: options?.projectId,
      attachmentId: options?.attachmentId,
      fileNameHint: options?.fileNameHint,
    })
    return {
      fileName: downloaded.fileName,
      contentType: downloaded.contentType,
      blob: downloaded.blob,
    }
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Unable to load document preview.')
  }
}
