import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { cn } from '@/lib/utils'

const KB_MARKDOWN_CLASS = cn(
  'space-y-3 font-sans text-sm leading-7 text-muted-foreground',
  '[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:text-foreground',
  '[&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground',
  '[&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground',
  '[&_p]:mb-2 [&_p:last-child]:mb-0',
  '[&_strong]:font-semibold [&_strong]:text-foreground',
  '[&_em]:italic',
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1',
  '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1',
  '[&_li]:leading-7',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3',
  '[&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-foreground',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:px-3 [&_pre]:py-2',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px]',
  '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top',
  '[overflow-wrap:anywhere]',
)

const KB_SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'u'],
}

function kbLooksLikeHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content)
}

export function kbLooksLikeMarkdown(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed || kbLooksLikeHtml(trimmed)) return false
  return (
    /(^|\n)#{1,6}\s+\S/.test(trimmed)
    || /\*\*[^*\n]+\*\*/.test(trimmed)
    || /`[^`\n]+`/.test(trimmed)
    || /(^|\n)(?:[-*+]|\d+\.)\s+\S/.test(trimmed)
    || /\[.+?\]\([^)]+\)/.test(trimmed)
  )
}

type KbDetailMarkdownProps = {
  content: string
  className?: string
}

export function KbDetailMarkdown({ content, className }: KbDetailMarkdownProps) {
  const trimmed = content.trim()
  if (!trimmed) return null
  return (
    <div className={cn(KB_MARKDOWN_CLASS, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, KB_SANITIZE_SCHEMA]]}>
        {trimmed}
      </ReactMarkdown>
    </div>
  )
}
