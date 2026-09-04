import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Components } from 'react-markdown'
import { cn } from '@/lib/utils'
import {
  type AssistantChoiceUiState,
  parseAssistantMessageContent,
  splitAssistantGreetingLead,
} from '@/lib/chat/assistantMessageContent'
import { AssistantChoiceGroup } from './AssistantChoiceGroup'
import { AssistantChartBlock } from './AssistantChartBlock'
import { AssistantMermaidBlock } from './AssistantMermaidBlock'
import { splitMermaidContent } from '@/lib/chat/normalizeMermaidFences'

/** User-visible label for Gen AI assistant in sidebar chat. */
export const TECTONA_ASSISTANT_LABEL = 'Smith'

const CHAT_MARKDOWN_CLASS = cn(
  'min-w-0 flex-1 text-left text-sm leading-[1.45] text-[#111b21] dark:text-[#e9edef]',
  '[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_strong]:font-semibold [&_strong]:text-[#0f766e] dark:[&_strong]:text-[#5eead4]',
  '[&_em]:italic',
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5',
  '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5',
  '[&_li]:my-0 [&_li]:py-0 [&_li]:leading-snug [&_li]:pl-0.5',
  '[&_ol>li]:marker:font-medium',
  '[&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold',
  '[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold',
  '[&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_h3]:text-sm [&_h3]:font-medium',
  '[&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] dark:[&_code]:bg-white/10',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/5 [&_pre]:p-2 dark:[&_pre]:bg-white/10',
  '[&_a]:text-[#027eb5] [&_a]:underline dark:[&_a]:text-[#53bdeb]',
  // Tables (GFM) — bordered, padded, horizontally scrollable when wide.
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.85em]',
  '[&_thead]:bg-black/5 dark:[&_thead]:bg-white/10',
  '[&_th]:border [&_th]:border-black/10 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold dark:[&_th]:border-white/15',
  '[&_td]:border [&_td]:border-black/10 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top dark:[&_td]:border-white/15',
  // Images — fit the bubble, rounded.
  '[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-black/10 dark:[&_img]:border-white/15',
  // Highlight + underline.
  '[&_mark]:rounded [&_mark]:bg-amber-200/80 [&_mark]:px-0.5 [&_mark]:text-inherit dark:[&_mark]:bg-amber-300/30',
  '[&_u]:underline [&_u]:decoration-from-font',
  '[overflow-wrap:anywhere]',
)

const GREETING_LEAD_CLASS = cn(
  'mb-2.5 block text-[1.3rem] font-medium leading-snug tracking-tight text-[#0f766e]',
  'dark:text-[#5eead4]',
)

// Semantic color/badge classes the assistant may use via <span class="...">. Mapping to
// explicit Tailwind utilities keeps it XSS-safe (no inline `style`, no arbitrary CSS) and
// reliable (JIT sees the literal utility strings here).
const SPAN_CLASS_MAP: Record<string, string> = {
  'tec-success': 'text-emerald-600 font-medium dark:text-emerald-400',
  'tec-warning': 'text-amber-600 font-medium dark:text-amber-400',
  'tec-danger': 'text-red-600 font-medium dark:text-red-400',
  'tec-info': 'text-sky-600 font-medium dark:text-sky-400',
  'tec-muted': 'text-slate-500 dark:text-slate-400',
  'tec-badge':
    'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.75em] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'tec-badge-success':
    'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[0.75em] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'tec-badge-warning':
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.75em] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'tec-badge-danger':
    'inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[0.75em] font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300',
}

const ALLOWED_SPAN_CLASSES = Object.keys(SPAN_CLASS_MAP)

// Extend the default (safe) sanitize schema: allow <mark>, <u>, and <span> restricted to
// the semantic class allowlist. `style` and other tags stay stripped (XSS protection).
const CHAT_SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'u', 'span'],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    // Keep fenced-code language classes so Mermaid / tecchart can render.
    code: [['className', /^language-./, 'math-inline', 'math-display']],
    span: [['className', ...ALLOWED_SPAN_CLASSES]],
    mark: [],
    u: [],
    img: ['src', 'alt'],
  },
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    src: [...new Set([...(defaultSchema.protocols?.src ?? ['http', 'https']), 'data'])],
  },
}

const MARKDOWN_COMPONENTS: Components = {
  span({ className, children, ...props }) {
    const mapped = (className ?? '')
      .split(/\s+/)
      .map((cls) => SPAN_CLASS_MAP[cls])
      .filter(Boolean)
      .join(' ')
    return (
      <span className={mapped || undefined} {...props}>
        {children}
      </span>
    )
  },
  img({ src, alt }) {
    if (!src || !/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(src)) {
      return null
    }
    return (
      <img
        src={src}
        alt={alt || 'Diagram'}
        className="my-2 max-w-full rounded-md border border-black/10 dark:border-white/15"
      />
    )
  },
  code({ className, children, ...props }) {
    const value = String(children ?? '').replace(/\n$/, '')
    if (/language-mermaid/i.test(className ?? '')) {
      return <AssistantMermaidBlock source={value} />
    }
    if (/language-tecchart/i.test(className ?? '')) {
      return <AssistantChartBlock source={value} />
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children
    const el = child as { type?: unknown; props?: { className?: string } } | null | undefined
    // After `code` swaps in AssistantMermaidBlock / AssistantChartBlock, unwrap <pre>.
    if (el && typeof el.type !== 'string' && el.type != null) {
      return <>{children}</>
    }
    if (el?.props?.className && /language-(mermaid|tecchart)/i.test(el.props.className)) {
      return <>{children}</>
    }
    return <pre>{children}</pre>
  },
}

type AssistantChatMarkdownProps = {
  content: string
  className?: string
  /** Opening contextual greet only — later casual greetings stay normal text. */
  emphasizeGreetingLead?: boolean
  choiceUiState?: AssistantChoiceUiState | null
  onChoiceSubmit?: (labels: string[], mode: 'single' | 'multiple') => void
}

function NarrativeMarkdown({ content }: { content: string }) {
  const segments = useMemo(() => splitMermaidContent(content), [content])

  if (segments.length === 0) return null

  // Prefer direct Mermaid/Chart mounts — do not depend on react-markdown code fences.
  const hasDiagram = segments.some((s) => s.type === 'mermaid' || s.type === 'tecchart')
  if (!hasDiagram) {
    const prose = segments.map((s) => (s.type === 'prose' ? s.text : '')).join('\n\n').trim()
    if (!prose) return null
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, CHAT_SANITIZE_SCHEMA]]}
        components={MARKDOWN_COMPONENTS}
      >
        {prose}
      </ReactMarkdown>
    )
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'mermaid') {
          return <AssistantMermaidBlock key={`mermaid-${index}`} source={segment.source} />
        }
        if (segment.type === 'tecchart') {
          return <AssistantChartBlock key={`tecchart-${index}`} source={segment.source} />
        }
        const prose = segment.text.trim()
        if (!prose) return null
        return (
          <ReactMarkdown
            key={`prose-${index}`}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeSanitize, CHAT_SANITIZE_SCHEMA]]}
            components={MARKDOWN_COMPONENTS}
          >
            {prose}
          </ReactMarkdown>
        )
      })}
    </>
  )
}

function GreetingLeadBlock({ greeting }: { greeting: string }) {
  return (
    <div className="mb-1 border-b border-teal-100/80 pb-2 dark:border-teal-900/50">
      <p className={GREETING_LEAD_CLASS}>{greeting}</p>
    </div>
  )
}

export function AssistantChatMarkdown({
  content,
  className,
  emphasizeGreetingLead = false,
  choiceUiState,
  onChoiceSubmit,
}: AssistantChatMarkdownProps) {
  const greetingLead = useMemo(
    () => (emphasizeGreetingLead ? splitAssistantGreetingLead(content) : null),
    [content, emphasizeGreetingLead],
  )
  const parsed = useMemo(() => {
    if (greetingLead) {
      if (!greetingLead.body.trim()) return { body: '', choices: [] as string[] }
      return parseAssistantMessageContent(greetingLead.body)
    }
    return parseAssistantMessageContent(content)
  }, [content, greetingLead])

  if (!content.trim()) return null

  const choiceMode: 'single' | 'multiple' = 'single'
  const choiceActive = choiceUiState?.kind === 'active'
  const choiceSubmitted = choiceUiState?.kind === 'submitted'
  const narrativeBody = parsed.body
  const showGreetingLead = emphasizeGreetingLead && Boolean(greetingLead?.greeting?.trim())

  if (parsed.choices.length === 0) {
    return (
      <div className={cn(CHAT_MARKDOWN_CLASS, className)}>
        {showGreetingLead ? <GreetingLeadBlock greeting={greetingLead!.greeting} /> : null}
        {narrativeBody ? <NarrativeMarkdown content={narrativeBody} /> : null}
      </div>
    )
  }

  return (
    <div className={cn(CHAT_MARKDOWN_CLASS, className)}>
      {showGreetingLead ? <GreetingLeadBlock greeting={greetingLead!.greeting} /> : null}
      {narrativeBody ? <NarrativeMarkdown content={narrativeBody} /> : null}
      {choiceActive ? (
        <AssistantChoiceGroup
          options={parsed.choices}
          mode={choiceMode}
          onSubmit={onChoiceSubmit}
          autoSubmitOnPick
          variant="inline"
        />
      ) : null}
      {choiceSubmitted ? (
        <AssistantChoiceGroup
          options={parsed.choices}
          mode={choiceMode}
          readOnly
          selectedLabels={choiceUiState.selectedLabels}
          variant="inline"
        />
      ) : null}
    </div>
  )
}
