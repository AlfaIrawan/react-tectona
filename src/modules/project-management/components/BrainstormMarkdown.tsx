import { AssistantChatMarkdown } from '@/modules/core-shell/components/AssistantChatMarkdown'
import { cn } from '@/lib/utils'
import { normalizeBrainstormDisplayText } from '../lib/brainstormDisplayText'

/** Brainstorm-only typography. The saved text, facts and assumption labels are unchanged. */
export function BrainstormMarkdown({ content, className }: { content: string; className?: string }) {
  return <AssistantChatMarkdown content={normalizeBrainstormDisplayText(content)} className={cn(
    'min-w-0 max-w-full text-[15px] leading-7 text-foreground [overflow-wrap:anywhere]',
    '[&_p]:my-3 [&_p]:whitespace-pre-line [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
    '[&_strong]:font-semibold [&_strong]:!text-inherit dark:[&_strong]:!text-inherit',
    '[&_ul]:my-3 [&_ol]:my-3 [&_ul]:space-y-2 [&_ol]:space-y-2 [&_li]:leading-7',
    '[&_li>ul]:my-2 [&_li>ol]:my-2 [&_li>p]:my-1',
    '[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-lg [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold',
    '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4',
    '[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-sm [&_table]:leading-6',
    '[&_th]:min-w-32 [&_th]:py-2 [&_td]:min-w-32 [&_td]:py-2 [&_td]:whitespace-normal',
    className,
  )} />
}

/** Questions keep their emphasis without flattening lists or showing Markdown syntax. */
export function BrainstormQuestion({ text, className }: { text: string; className?: string }) {
  return <div data-brainstorm-question className={cn('my-4 min-w-0 border-l-2 border-primary/40 pl-4', className)}>
    <BrainstormMarkdown content={text} className="[&>p:first-child]:font-medium [&_strong]:font-semibold" />
  </div>
}
