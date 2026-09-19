import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const TOKEN_SPLIT =
  /("(?:[^"\\]|\\.)*")|(@\w+|!\w[\w/<>.-]*)|\b(Person_Ext|Person|System_Boundary|System_Ext|SystemDb|System|Container_Boundary|Container_Ext|ContainerDb|Container|Component_Ext|ComponentDb|Component|Enterprise_Boundary|Boundary|BiRel|Rel_U|Rel_D|Rel_L|Rel_R|Rel|package|component|rectangle|database|cloud|node|actor|interface|queue|folder|frame|title|caption|legend|skinparam|left|right|up|down|as|endif|else|if|then|start|stop|end)\b|([()[\]{}])|(<?[-.]+>?)|('.*$)/g

const KEYWORD_CLASS = new Set([
  'Person',
  'Person_Ext',
  'System',
  'System_Ext',
  'SystemDb',
  'System_Boundary',
  'Enterprise_Boundary',
  'Boundary',
  'Container',
  'Container_Ext',
  'ContainerDb',
  'Container_Boundary',
  'Component',
  'Component_Ext',
  'ComponentDb',
  'BiRel',
  'Rel',
  'Rel_U',
  'Rel_D',
  'Rel_L',
  'Rel_R',
  'package',
  'component',
  'rectangle',
  'database',
  'cloud',
  'node',
  'actor',
  'interface',
  'queue',
  'folder',
  'frame',
  'title',
  'caption',
  'legend',
  'skinparam',
  'left',
  'right',
  'up',
  'down',
  'as',
  'endif',
  'else',
  'if',
  'then',
  'start',
  'stop',
  'end',
])

const EDITOR_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
const EDITOR_TEXT = 'font-mono text-xs'

function editorBoxStyle(wordWrap: boolean, showLineNumbers: boolean): CSSProperties {
  return {
    boxSizing: 'border-box',
    fontFamily: EDITOR_FONT,
    fontSize: '12px',
    fontWeight: 400,
    fontStyle: 'normal',
    lineHeight: '20px',
    letterSpacing: '0px',
    tabSize: 4,
    margin: 0,
    border: 0,
    paddingTop: 8,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: showLineNumbers ? 48 : 12,
    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
    wordBreak: wordWrap ? 'break-word' : 'normal',
    overflowWrap: wordWrap ? 'anywhere' : 'normal',
  }
}

function PlantUmlHighlightedText({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, lineIndex) => (
        <Fragment key={`line-${lineIndex}`}>
          {line ? line.split(TOKEN_SPLIT).map((token, index) => {
            if (!token) return null
            let className = 'text-slate-800'
            if (token.startsWith('"')) className = 'text-red-600'
            else if (token.startsWith('@') || token.startsWith('!')) className = 'text-fuchsia-600'
            else if (KEYWORD_CLASS.has(token)) className = 'text-sky-700'
            else if (['[', ']', '{', '}', '(', ')'].includes(token) || /^<?[-.]+>?$/.test(token)) className = 'text-violet-600'
            else if (token.startsWith("'")) className = 'text-emerald-700'
            return (
              <span className={className} key={`${lineIndex}-${index}-${token.slice(0, 24)}`}>
                {token}
              </span>
            )
          }) : null}
          {lineIndex < lines.length - 1 ? '\n' : null}
        </Fragment>
      ))}
    </>
  )
}

export function PlantUmlSourceEditor({
  value,
  onChange,
  onBlur,
  languageLabel = 'PlantUML',
}: {
  value: string
  onChange: (value: string) => void
  onBlur: (value: string) => void
  languageLabel?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [wordWrap, setWordWrap] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const sourceLines = useMemo(() => (value.length ? value.split('\n') : ['']), [value])
  const boxStyle = editorBoxStyle(wordWrap, showLineNumbers)

  const syncHighlightScroll = useCallback((source: HTMLTextAreaElement) => {
    const highlight = highlightRef.current
    if (!highlight) return
    highlight.scrollTop = source.scrollTop
    highlight.scrollLeft = wordWrap ? 0 : source.scrollLeft
    setScrollTop(source.scrollTop)
  }, [wordWrap])

  const syncSelection = (target: HTMLTextAreaElement) => {
    const start = target.selectionStart
    const end = target.selectionEnd
    const beforeCursor = value.slice(0, start)
    const parts = beforeCursor.split('\n')
    setSelection({ start, end })
    setCursor({ line: parts.length, column: (parts.at(-1)?.length ?? 0) + 1 })
  }

  useEffect(() => {
    if (!wordWrap) return
    const source = textareaRef.current
    if (!source) return
    source.scrollLeft = 0
    syncHighlightScroll(source)
  }, [syncHighlightScroll, wordWrap])

  useLayoutEffect(() => {
    const source = textareaRef.current
    if (!source) return
    source.scrollLeft = 0
    source.scrollTop = 0
    const highlight = highlightRef.current
    if (highlight) {
      highlight.scrollLeft = 0
      highlight.scrollTop = 0
    }
  }, [])

  const wrapClass = wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
  const selected = value.slice(selection.start, selection.end)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{languageLabel}</span>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-slate-600">
            <Switch checked={showLineNumbers} onCheckedChange={setShowLineNumbers} className="scale-75" />
            Line numbers
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-slate-600">
            <Switch checked={wordWrap} onCheckedChange={setWordWrap} className="scale-75" />
            Word wrap
          </label>
        </div>
      </div>
      <div className={cn('relative min-h-0 flex-1 overflow-hidden bg-white', EDITOR_TEXT)}>
        {showLineNumbers ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-30 w-10 overflow-hidden border-r border-slate-200 bg-slate-50 pt-2 text-right text-sky-700">
            <div style={{ transform: `translateY(-${scrollTop}px)` }}>
              {sourceLines.map((_, index) => (
                <div key={index} className="h-5 pr-2 leading-5">
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          style={boxStyle}
        >
          <pre
            className="m-0 bg-transparent p-0 font-inherit text-inherit leading-[20px]"
            style={{
              ...boxStyle,
              display: 'block',
              padding: 0,
              width: wordWrap ? '100%' : 'max-content',
              minWidth: '100%',
            }}
          >
            <PlantUmlHighlightedText text={value.slice(0, selection.start)} />
            {selection.end > selection.start ? (
              <span className="rounded-[2px] bg-sky-200/90">
                <PlantUmlHighlightedText text={selected} />
              </span>
            ) : null}
            <PlantUmlHighlightedText text={value.slice(selection.end)} />
          </pre>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            syncSelection(event.target)
          }}
          onBlur={(event) => onBlur(event.target.value)}
          onSelect={(event) => syncSelection(event.currentTarget)}
          onKeyUp={(event) => syncSelection(event.currentTarget)}
          onClick={(event) => syncSelection(event.currentTarget)}
          onScroll={(event) => syncHighlightScroll(event.currentTarget)}
          wrap={wordWrap ? 'soft' : 'off'}
          spellCheck={false}
          className={cn(
            'source-editor-scroll absolute inset-0 z-20 h-full min-h-0 w-full resize-none overflow-auto rounded-none bg-transparent',
            EDITOR_TEXT,
            'text-transparent caret-slate-900 shadow-none outline-none ring-0 focus:outline-none focus-visible:ring-0',
            'selection:bg-transparent selection:text-transparent',
            wrapClass,
          )}
          style={boxStyle}
        />
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-1 text-[10px] text-slate-500">
        <span>{showLineNumbers ? 'Line numbers on' : 'Line numbers off'}</span>
        <span>{wordWrap ? 'Wrap on' : 'Wrap off'}</span>
        <span className="ml-auto">
          Ln {cursor.line} / Col {cursor.column}
        </span>
        <span>{sourceLines.length} lines</span>
      </div>
    </div>
  )
}
