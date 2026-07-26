import { ArrowUpDown, Folder, FileText, CheckCircle, Archive, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type TypeFilter = 'all' | 'folders' | 'projects'
export type SortOrder = 'name-asc' | 'name-desc'

interface FiltersBarV2Props {
  statusFilter: 'all' | 'active' | 'archived'
  onStatusFilterChange: (filter: 'all' | 'active' | 'archived') => void
  typeFilter: TypeFilter
  onTypeFilterChange: (filter: TypeFilter) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  totalProjects: number
  activeProjects: number
  archivedProjects: number
  totalFolders: number
}

export function FiltersBarV2({
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  sortOrder,
  onSortOrderChange,
  totalProjects,
  activeProjects,
  archivedProjects,
  totalFolders,
}: FiltersBarV2Props) {
  return (
    <div className="space-y-3">
      {/* Type Filter - Card Style */}
      <div className="glass-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filter by Type</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onTypeFilterChange('all')}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
              'hover:border-primary/50',
              typeFilter === 'all'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-background/50'
            )}
          >
            <div className={cn(
              'text-2xl font-bold',
              typeFilter === 'all' ? 'text-primary' : 'text-muted-foreground'
            )}>
              {totalProjects + totalFolders}
            </div>
            <div className={cn(
              'text-xs font-medium',
              typeFilter === 'all' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              All Items
            </div>
          </button>
          <button
            onClick={() => onTypeFilterChange('folders')}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
              'hover:border-primary/50',
              typeFilter === 'folders'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-background/50'
            )}
          >
            <Folder className={cn(
              'w-5 h-5',
              typeFilter === 'folders' ? 'text-primary' : 'text-muted-foreground'
            )} />
            <div className={cn(
              'text-xs font-medium',
              typeFilter === 'folders' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              Folders
            </div>
            <div className={cn(
              'text-lg font-bold',
              typeFilter === 'folders' ? 'text-primary' : 'text-muted-foreground'
            )}>
              {totalFolders}
            </div>
          </button>
          <button
            onClick={() => onTypeFilterChange('projects')}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
              'hover:border-primary/50',
              typeFilter === 'projects'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-background/50'
            )}
          >
            <FileText className={cn(
              'w-5 h-5',
              typeFilter === 'projects' ? 'text-primary' : 'text-muted-foreground'
            )} />
            <div className={cn(
              'text-xs font-medium',
              typeFilter === 'projects' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              Projects
            </div>
            <div className={cn(
              'text-lg font-bold',
              typeFilter === 'projects' ? 'text-primary' : 'text-muted-foreground'
            )}>
              {totalProjects}
            </div>
          </button>
        </div>
      </div>

      {/* Status Filter - Horizontal Pills */}
      <div className="glass-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Status</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStatusFilterChange('all')}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              All ({totalProjects})
            </button>
            <button
              onClick={() => onStatusFilterChange('active')}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                statusFilter === 'active'
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Active ({activeProjects})
            </button>
            <button
              onClick={() => onStatusFilterChange('archived')}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                statusFilter === 'archived'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <Archive className="w-3.5 h-3.5" />
              Archived ({archivedProjects})
            </button>
          </div>
        </div>
      </div>

      {/* Sort - Compact */}
      {(typeFilter === 'folders' || typeFilter === 'projects') && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="w-4 h-4" />
                Sort: {sortOrder === 'name-asc' ? 'A → Z' : 'Z → A'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortOrderChange('name-asc')}>
                A → Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortOrderChange('name-desc')}>
                Z → A
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
