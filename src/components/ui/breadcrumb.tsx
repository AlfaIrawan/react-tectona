import { ChevronRight, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const location = useLocation()

  return (
    <nav
      className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
      aria-label="Breadcrumb"
    >
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'text-foreground font-medium')}>
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Hook to generate breadcrumb items based on current route
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)

  const items: BreadcrumbItem[] = []

  // Handle project routes
  if (pathSegments[0] === 'projects') {
    if (pathSegments.length === 1) {
      // /projects
      return [{ label: 'Projects' }]
    } else if (pathSegments.length === 2) {
      // /projects/:id
      return [
        { label: 'Projects', href: '/projects' },
        { label: 'Project Details' },
      ]
    } else if (pathSegments.length >= 3) {
      // /projects/:id/:tab or /projects/:projectId/:module/:id
      items.push({ label: 'Projects', href: '/projects' })
      
      // Try to get project name from store (would need to be passed as prop in real implementation)
      items.push({ label: 'Project', href: `/projects/${pathSegments[1]}` })
      
      const module = pathSegments[2]
      const moduleLabels: Record<string, string> = {
        connectors: 'Connectors',
        runs: 'Runs',
        models: 'Models',
        deployments: 'Deployments',
        feedback: 'Feedback',
        governance: 'Governance',
        settings: 'Settings',
        'platform-settings-administration': 'Platform Settings & Administration',
        overview: 'Overview',
      }
      
      if (moduleLabels[module]) {
        if (pathSegments.length === 3) {
          items.push({ label: moduleLabels[module] })
        } else {
          items.push({ label: moduleLabels[module], href: `/projects/${pathSegments[1]}/${module}` })
          if (pathSegments.length === 4) {
            items.push({ label: 'Details' })
          }
        }
      }
    }
  } else {
    // Global routes
    const routeLabels: Record<string, string> = {
      '': 'Workspace',
      models: 'Models',
      feedback: 'Feedback',
      governance: 'Governance',
      portfolio: 'Portfolio',
      settings: 'Settings',
      'knowledge-base-configuration': 'Knowledge Base Configuration',
      'platform-settings-administration': 'Platform Settings & Administration',
    }
    
    const route = pathSegments[0] || ''
    if (routeLabels[route]) {
      items.push({ label: routeLabels[route] })
    }
  }

  return items
}
