export function ScoringModelPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {['APPROVAL', 'SLA', 'WORKFLOW', 'NAMING', 'EVIDENCE'].map((d, i) => (
          <div key={d} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground">{d}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{15 + i * 5}%</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Contributes to composite score with caps and conflict resolution in engine.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
