import { ChevronDown, Send } from 'lucide-react'

export function MobileIdeaSectionNav<T extends string>({ sections, active, onChange, publishing, publish }: {
  sections: { key: T; label: string }[]
  active: T
  onChange: (key: T) => void
  publishing?: boolean
  publish?: { disabled: boolean; hint: string; onClick: () => void; publishedAt?: string | null }
}) {
  return <nav aria-label="Idea sections" className="mobile-idea-sections min-w-0 space-y-2 border-b border-border pb-4">
    <label htmlFor="mobile-idea-section" className="block text-xs font-medium text-muted-foreground">Idea section</label>
    <div className="relative">
      <select id="mobile-idea-section" value={sections.some((section) => section.key === active) ? active : ''} disabled={!sections.length} onChange={(event) => onChange(event.target.value as T)} className="h-12 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-10 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {!sections.length && <option value="">Loading sections...</option>}
        {sections.length > 0 && !sections.some((section) => section.key === active) && <option value="" disabled>Select section</option>}
        {sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-muted-foreground" />
    </div>
    {publish && <div className="space-y-1.5"><button type="button" disabled={publish.disabled || publishing} onClick={publish.onClick} title={publish.hint} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{publishing ? 'Publishing...' : 'Publish to organization'}</button>{publish.publishedAt && <p className="text-xs text-muted-foreground">{publish.publishedAt}</p>}</div>}
  </nav>
}
