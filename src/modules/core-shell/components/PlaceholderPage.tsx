import { Activity, Settings, LayoutDashboard } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Breadcrumb } from '@/components/ui/breadcrumb'

interface PlaceholderPageProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: title }]} />

      <PageHeader title={title} description={description} />

      <div className="glass-card rounded-2xl p-6">
        {Icon && (
          <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <p className="text-muted-foreground">
          This is a placeholder page for the Tectona Project Management workspace.
          {title === 'Roadmap' && (
            <span className="block mt-2 text-sm">
              This navigation entry is a placeholder for roadmap planning capabilities.
              No domain logic or capabilities are implemented at this stage.
            </span>
          )}
          {title === 'Settings' && (
            <span className="block mt-2 text-sm">
              This navigation entry is a placeholder for the future System/Cross-cutting module.
              No domain logic or capabilities are implemented at this stage.
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

// Route configuration for Module 1
// Note: "Roadmap" and "Settings" are placeholder navigation entries only.
// They have no domain logic, no submenus, and no implied capabilities.
// They exist solely as navigation placeholders for future modules.
export const module1Routes = [
  {
    path: '/',
    title: 'Workspace',
    description: 'Workspace lifecycle, governance, and portfolio visibility',
    icon: LayoutDashboard,
  },
  {
    path: '/roadmap',
    title: 'Roadmap',
    description: 'Placeholder: Future roadmap planning module entry point',
    icon: Activity,
    // This is NOT a module - just a navigation placeholder
    // Future roadmap module will implement actual functionality
  },
  {
    path: '/settings',
    title: 'Settings',
    description: 'Placeholder: Future System/Cross-cutting module entry point',
    icon: Settings,
    // This is NOT a module - just a navigation placeholder
    // Future System module will implement actual functionality
  },
]
