type Props = {
  config: Record<string, string>
  onChange: (patch: Record<string, string>) => void
}

export function IdeaApprovalContentControls({ config, onChange }: Props) {
  return (
    <fieldset className="space-y-3 border-t border-border pt-3">
      <legend className="text-xs font-medium">Idea review</legend>
      <label className="flex items-start gap-2 text-xs leading-5">
        <input
          type="checkbox"
          className="mt-1 shrink-0"
          checked={config.showIdeaDiagramsBeforeApproval === 'true'}
          onChange={event => onChange({ showIdeaDiagramsBeforeApproval: String(event.target.checked) })}
        />
        <span>Show Diagrams to the Idea creator before approval</span>
      </label>
      <label className="flex items-start gap-2 text-xs leading-5">
        <input
          type="checkbox"
          className="mt-1 shrink-0"
          checked={config.lockIdeaContentOnApproval === 'true'}
          onChange={event => onChange({ lockIdeaContentOnApproval: String(event.target.checked) })}
        />
        <span>Lock Idea content and documents on submission</span>
      </label>
    </fieldset>
  )
}
