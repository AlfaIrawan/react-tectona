import { FolderPlus, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  enterpriseFilterPanelClass,
  enterpriseFilterPanelDividerClass,
  enterpriseFilterTagClass,
} from '@/components/enterprise/enterpriseFilterPanelClasses'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseIndigoGradientActionButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'

export const ALL_PROJECT_TYPE_FILTER_TAGS = ['folders', 'projects'] as const
export type ProjectTypeFilterTag = (typeof ALL_PROJECT_TYPE_FILTER_TAGS)[number]

export const ALL_PROJECT_STATUS_FILTER_TAGS = ['active', 'archived'] as const
export type ProjectStatusFilterTag = (typeof ALL_PROJECT_STATUS_FILTER_TAGS)[number]

export type SortOrder = 'name-asc' | 'name-desc'

function toggleFilterTagSet<T extends string>(
  prev: Set<T>,
  tag: T,
  allTags: readonly T[]
): Set<T> {
  const next = new Set(prev)
  if (next.has(tag)) next.delete(tag)
  else next.add(tag)
  if (next.size === 0) return new Set(allTags)
  return next
}

interface FiltersBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilterTags: Set<ProjectStatusFilterTag>
  onStatusFilterTagsChange: React.Dispatch<React.SetStateAction<Set<ProjectStatusFilterTag>>>
  typeFilterTags: Set<ProjectTypeFilterTag>
  onTypeFilterTagsChange: React.Dispatch<React.SetStateAction<Set<ProjectTypeFilterTag>>>
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  totalProjects: number
  activeProjects: number
  archivedProjects: number
  totalFolders: number
  onCreateFolder?: () => void
  onCreateProject?: () => void
  selectionBar?: React.ReactNode
  folderMode?: boolean
}

export function FiltersBar({
  searchQuery,
  onSearchChange,
  statusFilterTags,
  onStatusFilterTagsChange,
  typeFilterTags,
  onTypeFilterTagsChange,
  totalProjects,
  activeProjects,
  archivedProjects,
  totalFolders,
  onCreateFolder,
  onCreateProject,
  selectionBar,
  folderMode = false,
}: FiltersBarProps) {
  const typeTotal = totalProjects + totalFolders

  return (
    <div className={enterpriseFilterPanelClass}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="h-10 w-full pl-9"
          placeholder={folderMode ? 'Search projects...' : 'Search projects and folders...'}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="relative pt-3">
        <div aria-hidden className={enterpriseFilterPanelDividerClass} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!folderMode && onCreateFolder && (
              <button type="button" onClick={onCreateFolder} className={enterpriseIndigoGradientActionButtonClass()}>
                <FolderPlus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                New folder
              </button>
            )}
            {onCreateProject && (
              <button type="button" onClick={onCreateProject} className={enterpriseCyanGradientActionButtonClass()}>
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                Create Project
              </button>
            )}
            {selectionBar}
          </div>

          {!folderMode && <div className="hidden min-w-[1rem] flex-1 lg:block" aria-hidden />}

          <div
            className={cn(
              'flex min-w-0 items-center gap-x-2 sm:gap-x-3',
              folderMode ? 'ml-auto shrink-0 justify-end' : 'w-full flex-wrap gap-y-2 lg:ml-auto lg:w-auto lg:justify-end'
            )}
          >
            {!folderMode && (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">
                  Type <span className="tabular-nums">({typeTotal})</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onTypeFilterTagsChange((prev) =>
                        toggleFilterTagSet(prev, 'folders', ALL_PROJECT_TYPE_FILTER_TAGS)
                      )
                    }
                    className={enterpriseFilterTagClass(typeFilterTags.has('folders'), 'violet')}
                    aria-pressed={typeFilterTags.has('folders')}
                    title={typeFilterTags.has('folders') ? 'Hide folders' : 'Show folders'}
                  >
                    <span>Folders</span>
                    <span
                      className={cn(
                        'tabular-nums text-[10px]',
                        typeFilterTags.has('folders') ? 'opacity-80' : 'opacity-60'
                      )}
                    >
                      {totalFolders}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onTypeFilterTagsChange((prev) =>
                        toggleFilterTagSet(prev, 'projects', ALL_PROJECT_TYPE_FILTER_TAGS)
                      )
                    }
                    className={enterpriseFilterTagClass(typeFilterTags.has('projects'), 'cyan')}
                    aria-pressed={typeFilterTags.has('projects')}
                    title={typeFilterTags.has('projects') ? 'Hide projects' : 'Show projects'}
                  >
                    <span>Projects</span>
                    <span
                      className={cn(
                        'tabular-nums text-[10px]',
                        typeFilterTags.has('projects') ? 'opacity-80' : 'opacity-60'
                      )}
                    >
                      {totalProjects}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">
                Status <span className="tabular-nums">({totalProjects})</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onStatusFilterTagsChange((prev) =>
                      toggleFilterTagSet(prev, 'active', ALL_PROJECT_STATUS_FILTER_TAGS)
                    )
                  }
                  className={enterpriseFilterTagClass(statusFilterTags.has('active'), 'emerald')}
                  aria-pressed={statusFilterTags.has('active')}
                  title={statusFilterTags.has('active') ? 'Hide active' : 'Show active'}
                >
                  <span>Active</span>
                  <span
                    className={cn(
                      'tabular-nums text-[10px]',
                      statusFilterTags.has('active') ? 'opacity-80' : 'opacity-60'
                    )}
                  >
                    {activeProjects}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onStatusFilterTagsChange((prev) =>
                      toggleFilterTagSet(prev, 'archived', ALL_PROJECT_STATUS_FILTER_TAGS)
                    )
                  }
                  className={enterpriseFilterTagClass(statusFilterTags.has('archived'), 'slate')}
                  aria-pressed={statusFilterTags.has('archived')}
                  title={statusFilterTags.has('archived') ? 'Hide archived' : 'Show archived'}
                >
                  <span>Archived</span>
                  <span
                    className={cn(
                      'tabular-nums text-[10px]',
                      statusFilterTags.has('archived') ? 'opacity-80' : 'opacity-60'
                    )}
                  >
                    {archivedProjects}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
