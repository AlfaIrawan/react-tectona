import { BookOpen, ExternalLink, FileText, Globe2 } from 'lucide-react'
import {
  evidenceHref,
  evidenceLabel,
  evidenceSourceKind,
  filterCitedEvidence,
  type AssistantEvidenceItem,
  type EvidenceSourceKind,
} from './assistantEvidence'

type AssistantEvidenceFootnotesProps = {
  evidence: AssistantEvidenceItem[]
}

const SOURCE_PRESENTATION = {
  internal: { label: 'Internal KB', Icon: BookOpen },
  document: { label: 'Document', Icon: FileText },
  web: { label: 'Web', Icon: Globe2 },
} satisfies Record<EvidenceSourceKind, { label: string; Icon: typeof BookOpen }>

export function AssistantEvidenceFootnotes({ evidence }: AssistantEvidenceFootnotesProps) {
  const citedEntries = filterCitedEvidence(evidence)
  if (citedEntries.length === 0) return null

  return (
    <div className="mt-2 border-t border-border/60 pt-2" aria-label="Evidence sources">
      <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        Evidence ({citedEntries.length})
      </p>
      <ul className="space-y-1.5">
        {citedEntries.map((item) => {
          const kind = evidenceSourceKind(item)
          const { label, Icon } = SOURCE_PRESENTATION[kind]
          const href = evidenceHref(item)
          const content = (
            <>
              <Icon className="h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="mr-1.5 font-medium text-muted-foreground">{label}</span>
                <span className="break-words text-sky-800 dark:text-sky-200">
                  {evidenceLabel(item)}
                </span>
              </span>
              {kind === 'web' && href ? (
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
            </>
          )

          return (
            <li key={`${item.source_service}:${item.key_ref}`} className="text-xs leading-4">
              {href ? (
                <a
                  href={href}
                  className="flex items-start gap-1.5 underline-offset-2 hover:underline"
                  target={kind === 'web' ? '_blank' : undefined}
                  rel={kind === 'web' ? 'noreferrer' : undefined}
                >
                  {content}
                </a>
              ) : (
                <div className="flex items-start gap-1.5">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
