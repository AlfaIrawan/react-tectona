/**
 * RoadmapHint - Educational hint component for future module capabilities
 * 
 * This is a READ-ONLY informational component. It provides educational context
 * about future modules without implying active capabilities.
 * 
 * Scope: Module 2 - Projects & Workspace (non-operational)
 */

interface RoadmapHintProps {
  variant?: 'runs' | 'connectors'
}

export function RoadmapHint({ variant = 'runs' }: RoadmapHintProps) {
  const hints = {
    runs: {
      description: 'Training run akan tersedia pada tahap berikutnya.',
    },
    connectors: {
      description: 'Connector akan tersedia untuk dikonfigurasi pada tahap berikutnya.',
    },
  }

  const hint = hints[variant]

  return (
    <div className="mt-2 pt-2 border-t border-border/20">
      <p className="text-sm text-muted-foreground leading-snug">
        {hint.description}
      </p>
    </div>
  )
}
