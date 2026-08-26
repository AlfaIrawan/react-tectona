import { Card } from '@/components/ui/card'
import type { GovernanceTemplateDto } from '@/lib/api/governanceConfigurationApi'

export function GovernanceTemplateRegistry({ templates }: { templates: GovernanceTemplateDto[] }) {
  return (
    <Card className="liquid-glass-enterprise-panel p-4">
      <h2 className="text-sm font-semibold text-foreground">Governance Template Registry</h2>
      <p className="mt-1 text-xs text-muted-foreground">Bundle default policy references; status versioning per baris.</p>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2">Code</th>
            <th className="py-2">Name</th>
            <th className="py-2">Version</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t border-border/40">
              <td className="py-2 font-mono">{t.code}</td>
              <td className="py-2">{t.name}</td>
              <td className="py-2 tabular-nums">{t.version}</td>
              <td className="py-2">{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
