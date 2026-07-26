import { Card } from '@/components/ui/card'
import type { ComplianceRuleDto } from '@/lib/api/governanceConfigurationApi'

export function ComplianceRuleEnginePanel({ rules }: { rules: ComplianceRuleDto[] }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-foreground">Compliance Rule Engine</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Daftar aturan (read-only) yang dipakai server untuk menghitung skor; tidak ada input bebas di sini.
      </p>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2">Code</th>
            <th className="py-2">Title</th>
            <th className="py-2">Dimension</th>
            <th className="py-2">Weight</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-t border-border/40">
              <td className="py-2 font-mono">{r.code}</td>
              <td className="py-2">{r.title}</td>
              <td className="py-2">{r.rule_dimension}</td>
              <td className="py-2 tabular-nums">{r.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
