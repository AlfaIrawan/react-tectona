import { Card } from '@/components/ui/card'
import type { CatalogItemDto } from '@/lib/api/governanceConfigurationApi'

export function WorkflowPolicyCatalog({ items }: { items: CatalogItemDto[] }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-foreground">Workflow Policy Catalog</h2>
      <CatalogTable items={items} />
    </Card>
  )
}

function CatalogTable({ items }: { items: CatalogItemDto[] }) {
  return (
    <table className="mt-3 w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-2">Code</th>
          <th className="py-2">Name</th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id} className="border-t border-border/40">
            <td className="py-2 font-mono">{t.code}</td>
            <td className="py-2">{t.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
