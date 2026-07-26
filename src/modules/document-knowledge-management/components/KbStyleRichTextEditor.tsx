/**
 * KB-parity rich text editor (toolbar + contentEditable) for reuse outside the KB drawer.
 * Visual/command surface matches Document Knowledge insert editor (Gambar 2).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CaseSensitive,
  ChevronDown,
  Code2,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Table2,
  Type,
  Underline,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { repairKbInlineBoldHtml } from '@/lib/kb/kbInlineBoldRepair'
import { scrubKbInlineStyles } from '@/lib/kb/kbInlineStyleScrub'
import {
  applyKbSelectionHighlightColor,
  applyKbSelectionTextColor,
  KB_HIGHLIGHT_COLOR_SWATCHES,
  KB_TEXT_COLOR_SWATCHES,
} from '@/lib/kb/kbRichTextColors'
import {
  applyKbDocStyle,
  getKbDocStyleById,
  hydrateKbDocStyleInlineStyles,
  KB_DOC_STYLES,
  readActiveKbDocStyleId,
  selectionIsInsideKbTable,
  type KbDocStyleId,
} from '@/lib/kb/kbRichTextStyles'
import {
  applyKbSelectionFontFamily,
  applyKbSelectionFontSizePx,
  applyKbSelectionTextCase,
  clampKbFontSizePx,
  KB_FONT_FAMILY_OPTIONS,
  KB_FONT_SIZE_OPTIONS,
  KB_TEXT_CASE_OPTIONS,
  matchKbFontFamilyOption,
  readSelectionFontSizePx,
  type KbTextCaseMode,
} from '@/lib/kb/kbRichTextTypography'
import { applyKbTableLayoutStylesFromAttrs, sanitizeKbRichHtmlPreservingTables } from '@/lib/kb/kbRichTableHtml'
import {
  KB_TOOLBAR_ACTIVE_DEFAULT,
  readKbToolbarActiveState,
} from '@/lib/kb/kbToolbarActiveState'

const KB_TABLE_INSERT_MAX_COLS = 8
const KB_TABLE_INSERT_MAX_ROWS = 6

type KbTableInsertOptions = {
  headerRow: boolean
  firstColumn: boolean
  totalRow: boolean
  lastColumn: boolean
  bandedRows: boolean
  bandedColumns: boolean
}

const KB_TABLE_INSERT_DEFAULT_OPTIONS: KbTableInsertOptions = {
  headerRow: true,
  firstColumn: false,
  totalRow: false,
  lastColumn: false,
  bandedRows: false,
  bandedColumns: false,
}

const KB_RICH_TABLE_CLASSES = [
  '[&_table]:my-2 [&_table]:border-collapse [&_table]:text-[13px]',
  '[&_table:not([width])]:w-full [&_table:not([width])]:table-fixed [&_table:not([width])]:max-w-full',
  '[&_table[width]]:table-fixed [&_table[width]]:max-w-full',
  '[&_thead]:bg-muted/60',
  '[&_th]:relative [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-foreground [&_th]:whitespace-normal [&_th]:break-words',
  '[&_td]:relative [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-[13px] [&_td]:text-foreground [&_td]:break-words',
].join(' ')

const KB_RICH_CONTENT_PROSE_CLASSES = [
  'kb-rich-content space-y-3 text-sm leading-7 text-foreground',
  '[&_h1]:mb-2 [&_h1:not([data-kb-style]):not([style])]:text-2xl [&_h1:not([data-kb-style]):not([style])]:font-semibold [&_h1:not([data-kb-style]):not([style])]:leading-tight',
  '[&_h2]:mb-2 [&_h2:not([data-kb-style]):not([style])]:text-xl [&_h2:not([data-kb-style]):not([style])]:font-semibold [&_h2:not([data-kb-style]):not([style])]:leading-tight',
  '[&_h3]:mb-1 [&_h3:not([data-kb-style]):not([style])]:text-base [&_h3:not([data-kb-style]):not([style])]:font-semibold',
  '[&_strong]:font-semibold [&_b]:font-semibold',
  '[&_u]:underline',
  '[&_p]:mb-2',
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6',
  '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote:not([data-kb-style]):not([style])]:my-2 [&_blockquote:not([data-kb-style]):not([style])]:border-l-2 [&_blockquote:not([data-kb-style]):not([style])]:border-border [&_blockquote:not([data-kb-style]):not([style])]:pl-3',
  '[&_a]:text-blue-600 [&_a]:underline',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-slate-200 [&_pre]:bg-slate-50 [&_pre]:px-3 [&_pre]:py-2 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-6 [&_pre]:text-slate-800',
  '[&_code]:font-mono [&_code]:text-[13px] [&_code]:text-slate-800',
].join(' ')

const KB_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'div',
  'blockquote', 'a', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
]
const KB_ALLOWED_ATTR = [
  'href', 'target', 'rel', 'colspan', 'rowspan', 'width', 'height', 'style',
  'data-kb-header-row', 'data-kb-first-column', 'data-kb-total-row',
  'data-kb-last-column', 'data-kb-banded-rows', 'data-kb-banded-columns',
  'data-kb-style', 'data-kb-table-index',
]

function escapeKbHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeKbStyleRichHtml(content: string): string {
  if (!content) return ''
  if (typeof window === 'undefined' || typeof document === 'undefined') return content

  const repairedBold = repairKbInlineBoldHtml(content)
  const scrubbedStyles = scrubKbInlineStyles(repairedBold)
  const hydratedStyles = hydrateKbDocStyleInlineStyles(scrubbedStyles)
  const scrubbedHydrated = scrubKbInlineStyles(hydratedStyles)

  const runPurify = (html: string) => DOMPurify.sanitize(html, {
    ALLOWED_TAGS: KB_ALLOWED_TAGS,
    ALLOWED_ATTR: KB_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
    ALLOW_DATA_ATTR: false,
  })

  const clean = sanitizeKbRichHtmlPreservingTables(scrubbedHydrated, runPurify)

  if (!clean.includes('<a')) {
    const trimmedOnly = clean.trim()
    return applyKbTableLayoutStylesFromAttrs(trimmedOnly === '<br>' ? '' : trimmedOnly)
  }

  const root = document.createElement('div')
  root.innerHTML = clean
  root.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noreferrer noopener')
  })
  const normalized = root.innerHTML.trim()
  return applyKbTableLayoutStylesFromAttrs(normalized === '<br>' ? '' : normalized)
}

function extractPlainText(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const root = document.createElement('div')
  root.innerHTML = html
  return (root.textContent ?? '').replace(/\u00a0/g, ' ')
}

function isEditorEmpty(html: string): boolean {
  const safe = sanitizeKbStyleRichHtml(html)
  if (!safe) return true
  if (extractPlainText(safe).trim().length > 0) return false
  if (typeof document === 'undefined') {
    return !/<(ul|ol|li|h1|h2|h3|pre|blockquote|table)\b/i.test(safe)
  }
  const root = document.createElement('div')
  root.innerHTML = safe
  return root.querySelector('ul,ol,pre,blockquote,h1,h2,h3,table') === null
}

function buildKbTableHtml(rows: number, cols: number, options: KbTableInsertOptions): string {
  const safeRows = Math.max(1, Math.min(Math.floor(rows), KB_TABLE_INSERT_MAX_ROWS))
  const safeCols = Math.max(1, Math.min(Math.floor(cols), KB_TABLE_INSERT_MAX_COLS))
  const capabilityAttrs = [
    options.headerRow ? 'data-kb-header-row="true"' : '',
    options.firstColumn ? 'data-kb-first-column="true"' : '',
    options.totalRow ? 'data-kb-total-row="true"' : '',
    options.lastColumn ? 'data-kb-last-column="true"' : '',
    options.bandedRows ? 'data-kb-banded-rows="true"' : '',
    options.bandedColumns ? 'data-kb-banded-columns="true"' : '',
  ].filter(Boolean).join(' ')
  const tableAttrs = capabilityAttrs ? ` ${capabilityAttrs}` : ''
  const header = options.headerRow
    ? `<thead><tr>${Array.from({ length: safeCols }, () => '<th><br></th>').join('')}</tr></thead>`
    : ''
  const bodyRowCount = Math.max(options.headerRow ? safeRows - 1 : safeRows, 0)
  const body = Array.from({ length: bodyRowCount }, () => {
    const cells = Array.from({ length: safeCols }, () => '<td><br></td>').join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<table${tableAttrs}>${header}<tbody>${body}</tbody></table>`
}

function useFixedPopupPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
): { top: number; left: number } {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open) {
      setPos({ top: 0, left: 0 })
      return
    }

    let cancelled = false
    const update = () => {
      const trigger = triggerRef.current
      if (!trigger || cancelled) return

      const t = trigger.getBoundingClientRect()
      const panel = panelRef.current
      const measured = panel?.getBoundingClientRect()
      const width = measured && measured.width > 0 ? measured.width : 176
      const height = measured && measured.height > 0 ? measured.height : 168
      const margin = 8

      let top = t.bottom + 6
      let left = t.right - width

      if (left < margin) left = margin
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - width - margin)
      }
      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, t.top - height - 6)
      }
      if (top < margin) top = margin

      setPos({ top, left })
    }

    update()
    const raf1 = requestAnimationFrame(() => {
      update()
      requestAnimationFrame(update)
    })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, triggerRef, panelRef])

  return pos
}

export type KbStyleRichTextEditorProps = {
  id?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
  maxPlainTextLength?: number
  disabled?: boolean
  className?: string
  showCharCount?: boolean
}

export function KbStyleRichTextEditor({
  id,
  value,
  onChange,
  placeholder = 'Context text for KB (policy, glossary, business rules, ...)',
  maxPlainTextLength = 50000,
  disabled = false,
  className,
  showCharCount = false,
}: KbStyleRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const lastCommittedHtmlRef = useRef(value)
  const [editorHtml, setEditorHtml] = useState(value)
  const [toolbarActive, setToolbarActive] = useState(KB_TOOLBAR_ACTIVE_DEFAULT)
  const [fontFamily, setFontFamily] = useState(KB_FONT_FAMILY_OPTIONS[0]?.value ?? 'Arial, Helvetica, sans-serif')
  const [fontSize, setFontSize] = useState('12')
  const [textColor, setTextColor] = useState('#000000')
  const [highlightColor, setHighlightColor] = useState('#fef08a')
  const [caseMenuOpen, setCaseMenuOpen] = useState(false)
  const [colorMenuOpen, setColorMenuOpen] = useState<'text' | 'highlight' | null>(null)
  const [stylesOpen, setStylesOpen] = useState(false)
  const [activeDocStyle, setActiveDocStyle] = useState<KbDocStyleId>('normal')
  const [tableInsertOpen, setTableInsertOpen] = useState(false)
  const [tableInsertHover, setTableInsertHover] = useState({ rows: 0, cols: 0 })
  const [tableInsertOptions, setTableInsertOptions] = useState<KbTableInsertOptions>(KB_TABLE_INSERT_DEFAULT_OPTIONS)
  const [editorFocused, setEditorFocused] = useState(false)

  const caseMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const caseMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const textColorTriggerRef = useRef<HTMLButtonElement | null>(null)
  const highlightTriggerRef = useRef<HTMLButtonElement | null>(null)
  const colorMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const stylesTriggerRef = useRef<HTMLButtonElement | null>(null)
  const stylesPanelRef = useRef<HTMLDivElement | null>(null)
  const tableInsertTriggerRef = useRef<HTMLButtonElement | null>(null)
  const tableInsertPanelRef = useRef<HTMLDivElement | null>(null)

  const stylesPos = useFixedPopupPosition(stylesOpen, stylesTriggerRef, stylesPanelRef)
  const tableInsertPos = useFixedPopupPosition(tableInsertOpen, tableInsertTriggerRef, tableInsertPanelRef)

  const plainTextLength = extractPlainText(editorHtml).trim().length
  // contentEditable uses an overlay placeholder (not native). Hide on focus so the caret
  // does not sit under the hint text; also hide once the editor has real content.
  const showPlaceholder = isEditorEmpty(editorHtml) && !editorFocused && !disabled


  useEffect(() => {
    setEditorHtml(value)
  }, [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const nextHtml = value || ''
    if (nextHtml === lastCommittedHtmlRef.current) return

    lastCommittedHtmlRef.current = nextHtml
    if (
      !nextHtml &&
      !isEditorEmpty(editor.innerHTML) &&
      editor.contains(document.activeElement)
    ) {
      return
    }
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml
    }
  }, [value])

  const commitEditorHtml = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const safe = sanitizeKbStyleRichHtml(editor.innerHTML)
    lastCommittedHtmlRef.current = safe
    setEditorHtml(safe)
    onChange(safe)
  }, [onChange])

  const syncToolbarActive = useCallback(() => {
    const active = readKbToolbarActiveState(editorRef.current)
    setToolbarActive(active)
    if (active.fontFamily) setFontFamily(matchKbFontFamilyOption(active.fontFamily))
    if (active.fontSizePx) setFontSize(active.fontSizePx)
  }, [])

  useEffect(() => {
    if (disabled) {
      setToolbarActive(KB_TOOLBAR_ACTIVE_DEFAULT)
      return
    }
    const onSelectionChange = () => {
      const editor = editorRef.current
      if (!editor) return
      const selection = window.getSelection()
      const anchor = selection?.anchorNode ?? null
      if (!anchor || !editor.contains(anchor)) return
      syncToolbarActive()
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [disabled, syncToolbarActive])

  useEffect(() => {
    if (!caseMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (caseMenuTriggerRef.current?.contains(target)) return
      if (caseMenuPanelRef.current?.contains(target)) return
      setCaseMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCaseMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [caseMenuOpen])

  useEffect(() => {
    if (!colorMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (textColorTriggerRef.current?.contains(target)) return
      if (highlightTriggerRef.current?.contains(target)) return
      if (colorMenuPanelRef.current?.contains(target)) return
      setColorMenuOpen(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorMenuOpen(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [colorMenuOpen])

  useEffect(() => {
    if (!stylesOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (stylesTriggerRef.current?.contains(target)) return
      if (stylesPanelRef.current?.contains(target)) return
      setStylesOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStylesOpen(false)
    }
    const timeoutId = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown)
    }, 0)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [stylesOpen])

  useEffect(() => {
    if (!tableInsertOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (tableInsertTriggerRef.current?.contains(target)) return
      if (tableInsertPanelRef.current?.contains(target)) return
      setTableInsertOpen(false)
      setTableInsertHover({ rows: 0, cols: 0 })
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setTableInsertOpen(false)
      setTableInsertHover({ rows: 0, cols: 0 })
    }
    const timeoutId = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown)
    }, 0)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [tableInsertOpen])

  const applyCommand = useCallback((command: string) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(command, false)
    commitEditorHtml()
    syncToolbarActive()
  }, [commitEditorHtml, disabled, syncToolbarActive])

  const applyFontFamily = useCallback((family: string) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    setFontFamily(family)
    applyKbSelectionFontFamily(editor, family)
    commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const applyFontSize = useCallback((sizePx: string) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    const next = String(clampKbFontSizePx(Number(sizePx)))
    setFontSize(next)
    applyKbSelectionFontSizePx(editor, Number(next))
    commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const stepFontSize = useCallback((delta: number) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    const current = readSelectionFontSizePx(editor, Number(fontSize) || 12)
    const next = String(clampKbFontSizePx(current + delta))
    setFontSize(next)
    applyKbSelectionFontSizePx(editor, Number(next))
    commitEditorHtml()
  }, [commitEditorHtml, disabled, fontSize])

  const applyTextCase = useCallback((mode: KbTextCaseMode) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    const applied = applyKbSelectionTextCase(editor, mode)
    setCaseMenuOpen(false)
    if (applied) commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const applyTextColorChoice = useCallback((color: string) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    setTextColor(color)
    applyKbSelectionTextColor(editor, color)
    setColorMenuOpen(null)
    commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const applyHighlightColorChoice = useCallback((color: string | null) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    if (color) setHighlightColor(color)
    applyKbSelectionHighlightColor(editor, color)
    setColorMenuOpen(null)
    commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const applyCodeBlock = useCallback(() => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() ?? ''
    const codeText = selectedText || 'code snippet'
    document.execCommand('insertHTML', false, `<pre><code>${escapeKbHtml(codeText)}</code></pre>`)
    commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const applyTable = useCallback((rows = 2, cols = 3) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('insertHTML', false, buildKbTableHtml(rows, cols, tableInsertOptions))
    commitEditorHtml()
    setTableInsertOpen(false)
    setTableInsertHover({ rows: 0, cols: 0 })
  }, [commitEditorHtml, disabled, tableInsertOptions])

  const applyDocStyleChoice = useCallback((styleId: KbDocStyleId) => {
    if (disabled) return
    const editor = editorRef.current
    const style = getKbDocStyleById(styleId)
    if (!editor || !style) return
    if (style.kind === 'block' && selectionIsInsideKbTable(editor)) {
      setStylesOpen(false)
      return
    }
    applyKbDocStyle(editor, style)
    setActiveDocStyle(style.id)
    setStylesOpen(false)
    commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const handleInput = useCallback(() => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    const raw = sanitizeKbStyleRichHtml(editor.innerHTML)
    const plain = extractPlainText(raw)
    if (plain.length > maxPlainTextLength) {
      editor.textContent = plain.slice(0, maxPlainTextLength)
      const safe = sanitizeKbStyleRichHtml(editor.innerHTML)
      lastCommittedHtmlRef.current = safe
      setEditorHtml(safe)
      onChange(safe)
      return
    }
    lastCommittedHtmlRef.current = raw
    setEditorHtml(raw)
    onChange(raw)
    syncToolbarActive()
  }, [disabled, maxPlainTextLength, onChange, syncToolbarActive])

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    const html = event.clipboardData.getData('text/html')
    const safeHtml = html ? sanitizeKbStyleRichHtml(html) : ''
    if (safeHtml.trim()) {
      document.execCommand('insertHTML', false, safeHtml)
    } else {
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    }
    handleInput()
  }, [disabled, handleInput])

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="min-w-0 rounded-xl border border-border/70 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('undo')}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('redo')}>
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <select
            className="h-8 max-w-[9.5rem] rounded-md border border-border/70 bg-background px-1.5 text-[11px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            value={fontFamily}
            title="Font"
            aria-label="Font family"
            disabled={disabled}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => applyFontFamily(e.target.value)}
          >
            {KB_FONT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} style={{ fontFamily: option.value }}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="h-8 w-[3.25rem] rounded-md border border-border/70 bg-background px-1 text-[11px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            value={fontSize}
            title="Font size"
            aria-label="Font size"
            disabled={disabled}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => applyFontSize(e.target.value)}
          >
            {KB_FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
            {!KB_FONT_SIZE_OPTIONS.includes(fontSize as typeof KB_FONT_SIZE_OPTIONS[number]) ? (
              <option value={fontSize}>{fontSize}</option>
            ) : null}
          </select>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Perbesar font" aria-label="Increase font size" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => stepFontSize(1)}>
            <AArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Perkecil font" aria-label="Decrease font size" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => stepFontSize(-1)}>
            <AArrowDown className="h-3.5 w-3.5" />
          </Button>
          <div className="relative">
            <Button
              ref={caseMenuTriggerRef}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-0.5 px-1.5"
              title="Change case"
              aria-label="Change case"
              aria-expanded={caseMenuOpen}
              aria-haspopup="menu"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCaseMenuOpen((open) => !open)}
            >
              <CaseSensitive className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3 opacity-70" />
            </Button>
            {caseMenuOpen ? (
              <div
                ref={caseMenuPanelRef}
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-border bg-popover p-1 shadow-lg"
              >
                {KB_TEXT_CASE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    className="flex w-full rounded-md px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextCase(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.bold && 'bg-muted text-foreground shadow-sm')} aria-pressed={toolbarActive.bold} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('bold')}>
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.italic && 'bg-muted text-foreground shadow-sm')} aria-pressed={toolbarActive.italic} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('italic')}>
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.underline && 'bg-muted text-foreground shadow-sm')} aria-pressed={toolbarActive.underline} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('underline')}>
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <div className="relative">
            <Button
              ref={highlightTriggerRef}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-0.5 px-1.5"
              title="Highlight"
              aria-label="Text highlight"
              aria-expanded={colorMenuOpen === 'highlight'}
              aria-haspopup="menu"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setCaseMenuOpen(false)
                setColorMenuOpen((open) => (open === 'highlight' ? null : 'highlight'))
              }}
            >
              <span className="flex flex-col items-center gap-0.5">
                <Highlighter className="h-3.5 w-3.5" />
                <span className="h-0.5 w-3.5 rounded-sm" style={{ backgroundColor: highlightColor }} />
              </span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </Button>
            {colorMenuOpen === 'highlight' ? (
              <div
                ref={colorMenuPanelRef}
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 w-[11.5rem] rounded-lg border border-border bg-popover p-2 shadow-lg"
              >
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Highlight</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {KB_HIGHLIGHT_COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      role="menuitem"
                      title={color}
                      className={cn(
                        'h-5 w-5 rounded-sm border border-slate-200',
                        highlightColor === color && 'ring-2 ring-slate-400 ring-offset-1',
                      )}
                      style={{ backgroundColor: color }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyHighlightColorChoice(color)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="mt-2 w-full rounded-md px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHighlightColorChoice(null)}
                >
                  No Color
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <Button
              ref={textColorTriggerRef}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-0.5 px-1.5"
              title="Font color"
              aria-label="Font color"
              aria-expanded={colorMenuOpen === 'text'}
              aria-haspopup="menu"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setCaseMenuOpen(false)
                setColorMenuOpen((open) => (open === 'text' ? null : 'text'))
              }}
            >
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-[12px] font-semibold leading-none">A</span>
                <span className="h-0.5 w-3.5 rounded-sm" style={{ backgroundColor: textColor }} />
              </span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </Button>
            {colorMenuOpen === 'text' ? (
              <div
                ref={colorMenuPanelRef}
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 w-[11.5rem] rounded-lg border border-border bg-popover p-2 shadow-lg"
              >
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font Color</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {KB_TEXT_COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      role="menuitem"
                      title={color}
                      className={cn(
                        'h-5 w-5 rounded-sm border border-slate-200',
                        textColor === color && 'ring-2 ring-slate-400 ring-offset-1',
                      )}
                      style={{ backgroundColor: color }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTextColorChoice(color)}
                    />
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 rounded-md px-1 py-1 text-[11px] text-foreground hover:bg-muted">
                  <span>Custom</span>
                  <input
                    type="color"
                    value={textColor}
                    className="h-5 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => applyTextColorChoice(e.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </div>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            ref={stylesTriggerRef}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-[11px] font-medium"
            title="Styles"
            aria-label="Document styles"
            aria-expanded={stylesOpen}
            aria-haspopup="dialog"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault()
              const editor = editorRef.current
              if (editor) {
                const active = readActiveKbDocStyleId(editor)
                if (active) setActiveDocStyle(active)
              }
            }}
            onClick={(e) => {
              e.stopPropagation()
              setStylesOpen((open) => !open)
            }}
          >
            <Type className="h-3.5 w-3.5" />
            <span className="max-w-[5.5rem] truncate">
              {getKbDocStyleById(activeDocStyle)?.label ?? 'Styles'}
            </span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>
          {stylesOpen && typeof document !== 'undefined'
            ? createPortal(
                <div
                  ref={stylesPanelRef}
                  role="dialog"
                  aria-label="Styles"
                  className="fixed z-[1200] w-[36rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border/60 bg-white p-3 shadow-2xl"
                  style={{ top: stylesPos.top, left: stylesPos.left }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="pb-2 text-xs font-semibold text-slate-800">Styles</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {KB_DOC_STYLES.map((style) => {
                      const selected = activeDocStyle === style.id
                      return (
                        <button
                          key={style.id}
                          type="button"
                          title={style.label}
                          className={cn(
                            'flex h-[4.25rem] flex-col items-center justify-center rounded-md border px-1.5 text-center transition-colors hover:bg-slate-50',
                            selected
                              ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300'
                              : 'border-transparent hover:border-slate-200',
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyDocStyleChoice(style.id)}
                        >
                          <span className={cn('line-clamp-2 w-full', style.previewClassName)}>{style.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>,
                document.body,
              )
            : null}
          <span className="mx-1 h-4 w-px bg-border" />
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.justifyLeft && 'bg-muted text-foreground shadow-sm')} title="Rata kiri" aria-label="Align left" aria-pressed={toolbarActive.justifyLeft} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('justifyLeft')}>
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.justifyCenter && 'bg-muted text-foreground shadow-sm')} title="Rata tengah" aria-label="Align center" aria-pressed={toolbarActive.justifyCenter} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('justifyCenter')}>
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.justifyRight && 'bg-muted text-foreground shadow-sm')} title="Rata kanan" aria-label="Align right" aria-pressed={toolbarActive.justifyRight} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('justifyRight')}>
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.justifyFull && 'bg-muted text-foreground shadow-sm')} title="Rata kiri-kanan" aria-label="Align justify" aria-pressed={toolbarActive.justifyFull} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('justifyFull')}>
            <AlignJustify className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Kurangi indent" aria-label="Decrease indent" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('outdent')}>
            <IndentDecrease className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Tambah indent" aria-label="Increase indent" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('indent')}>
            <IndentIncrease className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.unorderedList && 'bg-muted text-foreground shadow-sm')} aria-pressed={toolbarActive.unorderedList} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('insertUnorderedList')}>
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className={cn('h-8 px-2', toolbarActive.orderedList && 'bg-muted text-foreground shadow-sm')} aria-pressed={toolbarActive.orderedList} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand('insertOrderedList')}>
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={applyCodeBlock}>
            <Code2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            ref={tableInsertTriggerRef}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            title="Sisipkan tabel"
            aria-expanded={tableInsertOpen}
            aria-haspopup="dialog"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation()
              setTableInsertOpen((open) => {
                if (open) setTableInsertHover({ rows: 0, cols: 0 })
                return !open
              })
            }}
          >
            <Table2 className="h-3.5 w-3.5" />
          </Button>
          {tableInsertOpen && typeof document !== 'undefined'
            ? createPortal(
                <div
                  ref={tableInsertPanelRef}
                  role="dialog"
                  aria-label="Insert Table"
                  className="fixed z-[1200] w-auto rounded-xl border border-border/60 bg-white p-3 shadow-2xl"
                  style={{ top: tableInsertPos.top, left: tableInsertPos.left }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="pb-2 text-xs font-semibold text-slate-800">Insert Table</div>
                  <div
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: `repeat(${KB_TABLE_INSERT_MAX_COLS}, 1fr)` }}
                    onMouseLeave={() => setTableInsertHover({ rows: 0, cols: 0 })}
                  >
                    {Array.from({ length: KB_TABLE_INSERT_MAX_ROWS * KB_TABLE_INSERT_MAX_COLS }, (_, index) => {
                      const row = Math.floor(index / KB_TABLE_INSERT_MAX_COLS) + 1
                      const col = (index % KB_TABLE_INSERT_MAX_COLS) + 1
                      const active = tableInsertHover.rows >= row && tableInsertHover.cols >= col
                      return (
                        <button
                          key={`kb-table-cell-${row}-${col}`}
                          type="button"
                          aria-label={`Sisipkan tabel ${row} baris × ${col} kolom`}
                          className={cn(
                            'h-4 w-4 rounded-[2px] border transition-colors',
                            active
                              ? 'border-sky-500 bg-sky-100'
                              : 'border-slate-300 bg-white hover:border-slate-400',
                          )}
                          onMouseEnter={() => setTableInsertHover({ rows: row, cols: col })}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyTable(row, col)}
                        />
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
                    {tableInsertHover.rows > 0
                      ? `${tableInsertHover.rows} × ${tableInsertHover.cols}`
                      : 'Pilih ukuran tabel'}
                  </p>
                  <div className="my-2 border-t border-slate-200" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-700">
                    {([
                      ['headerRow', 'Header Row'],
                      ['firstColumn', 'First Column'],
                      ['totalRow', 'Total Row'],
                      ['lastColumn', 'Last Column'],
                      ['bandedRows', 'Banded Rows'],
                      ['bandedColumns', 'Banded Columns'],
                    ] as const).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={tableInsertOptions[key]}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setTableInsertOptions((current) => ({
                              ...current,
                              [key]: checked,
                            }))
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-sky-600"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background/80">
        <div className="relative min-w-0 max-w-full space-y-1 p-1">
          {showPlaceholder ? (
            <p className="pointer-events-none absolute left-3 top-3 z-[1] text-xs text-muted-foreground">
              {placeholder}
            </p>
          ) : null}
          <div
            id={id}
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            className={`min-h-[170px] max-w-full px-3 py-3 outline-none ${KB_RICH_CONTENT_PROSE_CLASSES} ${KB_RICH_TABLE_CLASSES}`}
            onInput={handleInput}
            onKeyUp={syncToolbarActive}
            onMouseUp={syncToolbarActive}
            onClick={syncToolbarActive}
            onPaste={handlePaste}
            onFocus={() => setEditorFocused(true)}
            onBlur={() => setEditorFocused(false)}
          />
        </div>
      </div>

      {showCharCount ? (
        <p className="text-[11px] text-muted-foreground">
          {plainTextLength} / {maxPlainTextLength}
        </p>
      ) : null}
    </div>
  )
}
