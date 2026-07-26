import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Code2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  RICH_HTML_EDITOR_CONTENT_CLASS,
  escapeRichHtml,
  extractPlainTextFromHtml,
  richHtmlEditorIsEmpty,
  sanitizeRichHtml,
} from '@/lib/richHtmlEditor'

type EnterpriseRichTextEditorProps = {
  id?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
  maxPlainTextLength?: number
  disabled?: boolean
}

function preventToolbarMouseDown(event: React.MouseEvent) {
  event.preventDefault()
}

export function EnterpriseRichTextEditor({
  id,
  value,
  onChange,
  placeholder = 'Add details…',
  maxPlainTextLength = 2000,
  disabled = false,
}: EnterpriseRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const lastCommittedHtmlRef = useRef(value)
  const [editorHtml, setEditorHtml] = useState(value)
  const plainTextLength = extractPlainTextFromHtml(editorHtml).trim().length
  const showPlaceholder = richHtmlEditorIsEmpty(editorHtml)

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
      !richHtmlEditorIsEmpty(editor.innerHTML) &&
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
    const safe = sanitizeRichHtml(editor.innerHTML)
    lastCommittedHtmlRef.current = safe
    setEditorHtml(safe)
    onChange(safe)
  }, [onChange])

  const applyCommand = useCallback(
    (command: string) => {
      if (disabled) return
      const editor = editorRef.current
      if (!editor) return
      editor.focus()
      document.execCommand(command, false)
      commitEditorHtml()
    },
    [commitEditorHtml, disabled],
  )

  const applyCodeBlock = useCallback(() => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    editor.focus()

    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() ?? ''
    const codeText = selectedText || 'code snippet'
    const codeHtml = `<pre><code>${escapeRichHtml(codeText)}</code></pre>`

    document.execCommand('insertHTML', false, codeHtml)
    commitEditorHtml()
  }, [commitEditorHtml, disabled])

  const applyBlock = useCallback(
    (tagName: 'p' | 'h2' | 'h3') => {
      if (disabled) return
      const editor = editorRef.current
      if (!editor) return
      editor.focus()

      const before = sanitizeRichHtml(editor.innerHTML)
      const formatValue = tagName === 'p' ? 'P' : `<${tagName.toUpperCase()}>`
      document.execCommand('formatBlock', false, formatValue)

      let after = sanitizeRichHtml(editor.innerHTML)
      if (after === before) {
        const selection = window.getSelection()
        const anchorNode = selection?.anchorNode ?? null
        const anchorElement = anchorNode
          ? anchorNode.nodeType === Node.ELEMENT_NODE
            ? (anchorNode as HTMLElement)
            : anchorNode.parentElement
          : null
        const currentBlock = anchorElement?.closest('h1,h2,h3,p,div') as HTMLElement | null

        if (currentBlock && editor.contains(currentBlock)) {
          const replacement = document.createElement(tagName)
          replacement.innerHTML = currentBlock.innerHTML || '<br>'
          currentBlock.replaceWith(replacement)
          after = sanitizeRichHtml(editor.innerHTML)
        }
      }

      editor.innerHTML = after
      commitEditorHtml()
    },
    [commitEditorHtml, disabled],
  )

  const handleInput = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const raw = sanitizeRichHtml(editor.innerHTML)
    const plain = extractPlainTextFromHtml(raw)
    if (plain.length > maxPlainTextLength) {
      editor.textContent = plain.slice(0, maxPlainTextLength)
      const safe = sanitizeRichHtml(editor.innerHTML)
      lastCommittedHtmlRef.current = safe
      setEditorHtml(safe)
      onChange(safe)
      return
    }
    lastCommittedHtmlRef.current = raw
    setEditorHtml(raw)
    onChange(raw)
  }, [maxPlainTextLength, onChange])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || event.key !== 'Enter' || event.shiftKey) return

      const editor = editorRef.current
      if (!editor) return

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const anchorNode = selection.anchorNode
      if (!anchorNode) return

      const anchorElement =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as HTMLElement)
          : anchorNode.parentElement
      const heading = anchorElement?.closest('h1,h2,h3') as HTMLElement | null
      if (!heading || !editor.contains(heading)) return

      event.preventDefault()

      const range = selection.getRangeAt(0)
      const afterRange = range.cloneRange()
      afterRange.selectNodeContents(heading)
      afterRange.setStart(range.endContainer, range.endOffset)

      const trailing = afterRange.extractContents()
      const paragraph = document.createElement('p')
      if (trailing.textContent?.replace(/\u00a0/g, ' ').trim()) {
        paragraph.appendChild(trailing)
      } else {
        paragraph.appendChild(document.createElement('br'))
      }

      heading.parentNode?.insertBefore(paragraph, heading.nextSibling)

      const cursor = document.createRange()
      cursor.selectNodeContents(paragraph)
      cursor.collapse(true)
      selection.removeAllRanges()
      selection.addRange(cursor)

      handleInput()
    },
    [disabled, handleInput],
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return
      event.preventDefault()
      const html = event.clipboardData.getData('text/html')
      const safeHtml = html ? sanitizeRichHtml(html) : ''
      if (safeHtml.trim()) {
        document.execCommand('insertHTML', false, safeHtml)
      } else {
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
      }
      handleInput()
    },
    [disabled, handleInput],
  )

  return (
    <div className="space-y-1.5">
      <div className="rounded-xl border border-border bg-background/80">
        <div className="flex flex-wrap items-center gap-1 border-b border-border/70 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyCommand('undo')}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyCommand('redo')}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyCommand('bold')}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyCommand('italic')}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyCommand('underline')}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px] font-semibold"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyBlock('h2')}
          >
            H2
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px] font-semibold"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyBlock('h3')}
          >
            H3
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px]"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyBlock('p')}
          >
            P
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyCommand('insertUnorderedList')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={() => applyCommand('insertOrderedList')}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={disabled}
            onMouseDown={preventToolbarMouseDown}
            onClick={applyCodeBlock}
          >
            <Code2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="relative">
          {showPlaceholder ? (
            <p className="pointer-events-none absolute left-3 top-3 text-xs text-muted-foreground">{placeholder}</p>
          ) : null}
          <div
            id={id}
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            className={RICH_HTML_EDITOR_CONTENT_CLASS}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {plainTextLength} / {maxPlainTextLength}
      </p>
    </div>
  )
}
