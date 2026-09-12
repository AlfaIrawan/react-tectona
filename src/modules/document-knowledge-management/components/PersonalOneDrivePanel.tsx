/**
 * OneDrive (Microsoft Graph /me/drive) browser for a personal Tectona workspace.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cloud,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  HardDrive,
  Home,
  Layers3,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EnterpriseColumnFilterDropdown } from '@/components/enterprise/EnterpriseColumnFilterDropdown'
import { getEnterpriseGroupTint } from '@/components/enterprise/enterpriseTableGroupTint'
import { startSocialOAuthLogin } from '@/lib/authProviders'
import {
  fetchMicrosoftDriveChildren,
  MicrosoftGraphConsentRequiredError,
  type MicrosoftDriveItem,
  type MicrosoftDriveListing,
} from '@/lib/api/microsoftGraphApi'
import { cn } from '@/lib/utils'
import { formatRelativeTimestamp } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import {
  ONEDRIVE_DRAG_MIME,
  encodeOneDriveDragPayload,
} from '@/modules/document-knowledge-management/lib/onedriveCopyToRepository'
import { storeOAuthIntent } from '@/lib/oauthPkce'
import folderCardStyles from '@/modules/projects/components/FolderCard.module.css'
import {
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS,
} from '@/modules/projects/lib/projectListTableClasses'
import compactStyles from './DocumentRepositoryFolderCard.module.css'
import {
  EXPLORER_FOLDER_TYPE_LABEL,
  formatExplorerDateTime,
  getExplorerFileTypeLabel,
  getFileTypeIcon,
} from '../fileTypeIcon'

export type OneDriveViewMode = 'folders' | 'split' | 'grouped' | 'explorer'

type PersonalOneDrivePanelProps = {
  className?: string
  viewMode?: OneDriveViewMode
  groupByType?: boolean
  groupByFolder?: boolean
  page?: number
  pageSize?: number
  /**
   * Adds the same breadcrumb-to-table gap the repository pane has. Used by Split
   * View, where the two panes sit side by side and any difference in vertical
   * rhythm reads as one table being misaligned with the other.
   */
  matchRepositorySpacing?: boolean
  onStatsChange?: (stats: { total: number; loading: boolean }) => void
  onFolderNavigate?: () => void
}

type SortKey = 'name' | 'dateModified' | 'type' | 'size'
type SortDir = 'asc' | 'desc'
type FolderCrumb = { id: string; name: string }

const HEADER_CELL_CLASS =
  'select-none border-b-[3px] border-double border-slate-300/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80'
const BODY_CELL_CLASS =
  'border-b border-slate-200/20 px-3 py-2 align-middle transition-colors dark:border-slate-700/20'

function FileTypeIconImg({ fileName, large = false }: { fileName: string; large?: boolean }) {
  return (
    <img
      src={getFileTypeIcon(fileName)}
      alt=""
      className={cn('shrink-0 object-contain object-center', large ? 'size-14' : 'h-4 w-4')}
      draggable={false}
      aria-hidden
    />
  )
}

function formatSize(bytes?: number | null, kind?: MicrosoftDriveItem['kind']) {
  if (kind === 'folder') return '—'
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

function itemTypeLabel(item: MicrosoftDriveItem) {
  return item.kind === 'folder' ? EXPLORER_FOLDER_TYPE_LABEL : getExplorerFileTypeLabel(item.name)
}

function compareText(left: string, right: string, dir: SortDir) {
  const result = left.localeCompare(right, undefined, { sensitivity: 'base' })
  return dir === 'asc' ? result : -result
}

function sortItems(items: MicrosoftDriveItem[], sort: { key: SortKey; dir: SortDir } | null) {
  if (!sort) {
    const folders = [...items.filter((item) => item.kind === 'folder')].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
    const files = [...items.filter((item) => item.kind !== 'folder')].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
    return [...folders, ...files]
  }
  return [...items].sort((left, right) => {
    if (sort.key === 'dateModified') {
      const delta =
        new Date(left.last_modified || 0).getTime() - new Date(right.last_modified || 0).getTime()
      return sort.dir === 'asc' ? delta : -delta
    }
    if (sort.key === 'size') {
      const leftSize = left.kind === 'folder' ? -1 : left.size ?? 0
      const rightSize = right.kind === 'folder' ? -1 : right.size ?? 0
      return sort.dir === 'asc' ? leftSize - rightSize : rightSize - leftSize
    }
    if (sort.key === 'type') return compareText(itemTypeLabel(left), itemTypeLabel(right), sort.dir)
    return compareText(left.name, right.name, sort.dir)
  })
}

function OneDriveFolderCard({ item, onOpen }: { item: MicrosoftDriveItem; onOpen: () => void }) {
  const childCount = item.child_count ?? 0
  const hasItems = childCount > 0
  return (
    <div
      className={cn(
        folderCardStyles.folderCard,
        compactStyles.compactCard,
        'group/folder shrink-0',
        hasItems && folderCardStyles.hasProjects,
      )}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        onOpen()
      }}
    >
      <div className={cn(folderCardStyles.folderTab, compactStyles.compactTab, 'folder-tab')} aria-hidden="true" />
      <div className={cn(folderCardStyles.folderBody, compactStyles.compactBody, 'folder-body')}>
        {hasItems ? (
          <div className={cn(folderCardStyles.folderPapers, compactStyles.compactPapers)} aria-hidden="true">
            <span className={folderCardStyles.paper} />
            <span className={folderCardStyles.paper} />
            <span className={folderCardStyles.paper} />
            <span className={folderCardStyles.paper} />
          </div>
        ) : null}
        <div className={cn(folderCardStyles.folderTitleRow, compactStyles.compactTitleRow)}>
          <button
            type="button"
            className={cn(folderCardStyles.folderTitle, compactStyles.compactTitle, 'min-w-0 flex-1 text-left hover:text-sky-700')}
            title={item.name}
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
          >
            <span className="min-w-0 truncate">{item.name}</span>
          </button>
        </div>
        <button
          type="button"
          className={cn(
            folderCardStyles.folderMeta,
            compactStyles.compactMeta,
            'folder-meta block w-full text-left',
            !hasItems && folderCardStyles.folderMetaMuted,
          )}
          title="Open folder"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          {childCount} {childCount === 1 ? 'item' : 'items'}
        </button>
      </div>
    </div>
  )
}

export function PersonalOneDrivePanel({
  className,
  viewMode = 'explorer',
  groupByType = false,
  groupByFolder = false,
  page = 1,
  pageSize = 10,
  matchRepositorySpacing = false,
  onStatsChange,
  onFolderNavigate,
}: PersonalOneDrivePanelProps) {
  const [listing, setListing] = useState<MicrosoftDriveListing | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<FolderCrumb[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [consentRequired, setConsentRequired] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)
  const [typeFilters, setTypeFilters] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const folderSliderRef = useRef<HTMLDivElement>(null)
  const [folderSlider, setFolderSlider] = useState({ canPrev: false, canNext: false })

  const load = useCallback(async (itemId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchMicrosoftDriveChildren(itemId)
      setListing(next)
      setConsentRequired(false)
    } catch (err) {
      if (err instanceof MicrosoftGraphConsentRequiredError) {
        setListing(null)
        setConsentRequired(true)
        setError(null)
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load OneDrive.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(folderId)
  }, [folderId, load])

  useEffect(() => {
    setTypeFilters(new Set())
    setCollapsed(new Set())
    setSort(null)
  }, [folderId])

  const connect = async () => {
    setConnecting(true)
    try {
      storeOAuthIntent('graph')
      sessionStorage.setItem('tectona:oauth-next', `${window.location.pathname}${window.location.search}`)
      await startSocialOAuthLogin('microsoft', { oauthIntent: 'graph' })
    } catch (err) {
      setConnecting(false)
      setError(err instanceof Error ? err.message : 'Could not start Microsoft sign-in.')
    }
  }

  const openFolder = (folder: MicrosoftDriveItem) => {
    onFolderNavigate?.()
    setFolderPath((prev) => {
      const existing = prev.findIndex((crumb) => crumb.id === folder.id)
      if (existing >= 0) return prev.slice(0, existing + 1)
      return [...prev, { id: folder.id, name: folder.name }]
    })
    setFolderId(folder.id)
  }

  const goHome = () => {
    onFolderNavigate?.()
    setFolderPath([])
    setFolderId(null)
  }

  const goToCrumb = (index: number) => {
    const crumb = folderPath[index]
    if (!crumb) return
    onFolderNavigate?.()
    setFolderPath((prev) => prev.slice(0, index + 1))
    setFolderId(crumb.id)
  }

  const openItem = (item: MicrosoftDriveItem) => {
    if (item.kind === 'folder') {
      openFolder(item)
      return
    }
    if (item.web_url) {
      window.open(item.web_url, '_blank', 'noopener,noreferrer')
    }
  }

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of listing?.items ?? []) {
      const label = itemTypeLabel(item)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([value, count]) => ({ value, count }))
  }, [listing?.items])

  const visibleItems = useMemo(() => {
    const items = listing?.items ?? []
    const filtered =
      typeFilters.size === 0 ? items : items.filter((item) => typeFilters.has(itemTypeLabel(item)))
    return sortItems(filtered, sort)
  }, [listing?.items, typeFilters, sort])

  const folderItems = useMemo(
    () => visibleItems.filter((item) => item.kind === 'folder'),
    [visibleItems],
  )
  const fileItems = useMemo(
    () => visibleItems.filter((item) => item.kind !== 'folder'),
    [visibleItems],
  )
  const tableItems = viewMode === 'explorer' ? visibleItems : fileItems
  const showFolderCards = viewMode === 'folders'
  const showSplitFolders = viewMode === 'split'
  const useFolderGroups = viewMode === 'grouped' || groupByFolder

  useEffect(() => {
    onStatsChange?.({ total: tableItems.length, loading })
  }, [tableItems.length, loading, onStatsChange])

  const totalPages = Math.max(1, Math.ceil(tableItems.length / pageSize))
  const pageSafe = Math.min(Math.max(1, page), totalPages)
  const pageStart = tableItems.length === 0 ? 0 : (pageSafe - 1) * pageSize
  const pagedItems = tableItems.slice(pageStart, pageStart + pageSize)

  const groups = useMemo(() => {
    if (useFolderGroups) {
      return [{ label: listing?.folder.name || 'My files', items: pagedItems }]
    }
    if (!groupByType) return [{ label: '', items: pagedItems }]
    const byType = new Map<string, MicrosoftDriveItem[]>()
    for (const item of pagedItems) {
      const label = itemTypeLabel(item)
      const rows = byType.get(label) ?? []
      rows.push(item)
      byType.set(label, rows)
    }
    return [...byType.keys()]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((label) => ({ label, items: byType.get(label) ?? [] }))
  }, [groupByType, listing?.folder.name, pagedItems, useFolderGroups])

  const updateFolderSlider = useCallback(() => {
    const slider = folderSliderRef.current
    if (!slider) {
      setFolderSlider({ canPrev: false, canNext: false })
      return
    }
    const max = slider.scrollWidth - slider.clientWidth
    setFolderSlider({
      canPrev: slider.scrollLeft > 4,
      canNext: max - slider.scrollLeft > 4,
    })
  }, [])

  useLayoutEffect(() => {
    updateFolderSlider()
  }, [folderItems, showFolderCards, updateFolderSlider])

  const scrollFolders = (direction: 'previous' | 'next') => {
    const slider = folderSliderRef.current
    if (!slider) return
    const distance = Math.max(slider.clientWidth * 0.82, 240)
    slider.scrollBy({ left: direction === 'next' ? distance : -distance, behavior: 'smooth' })
  }

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const toggleGroup = (label: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  useEffect(() => {
    if (!listing || !folderId || folderPath.length > 0) return
    if (!listing.folder.id) return
    setFolderPath([{ id: listing.folder.id, name: listing.folder.name }])
  }, [folderId, folderPath.length, listing])

  const breadcrumb = listing ? (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-muted/50 hover:text-foreground',
          folderId === null ? 'text-foreground' : 'text-muted-foreground',
        )}
        title="OneDrive home"
        onClick={goHome}
      >
        <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Home
      </button>
      {folderPath.map((folder, index) => (
        <span key={folder.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <button
            type="button"
            className={cn(
              'rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              index === folderPath.length - 1 && 'text-foreground',
            )}
            onClick={() => goToCrumb(index)}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </div>
  ) : null

  const tableBody =
    tableItems.length === 0 ? (
      <p className="px-3 py-16 text-center text-sm text-muted-foreground">
        {folderItems.length > 0 && viewMode !== 'explorer' ? 'No files in this folder.' : 'This folder is empty.'}
      </p>
    ) : (
      <div className="relative min-h-0 w-full flex-1 overflow-auto rounded-xl scrollbar-hide">
        {loading ? (
          <div className="pointer-events-none absolute right-3 top-3 z-20">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : null}
        <table className="w-full min-w-[720px] table-fixed border-collapse select-none text-xs">
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[18%]" />
            <col className="w-[28%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-muted-foreground">
              <OneDriveHeaderCell
                label="Name"
                icon={FileText}
                sortKey="name"
                sort={sort}
                onToggleSort={toggleSort}
                firstColumn
              />
              <OneDriveHeaderCell
                label="Date modified"
                icon={CalendarClock}
                sortKey="dateModified"
                sort={sort}
                onToggleSort={toggleSort}
              />
              <OneDriveHeaderCell
                label="Type"
                icon={Layers3}
                sortKey="type"
                sort={sort}
                onToggleSort={toggleSort}
                filterSlot={
                  <EnterpriseColumnFilterDropdown
                    label="Type"
                    ariaLabel="Filter type in table"
                    options={typeOptions}
                    selected={typeFilters}
                    onToggleOption={(value) => {
                      setTypeFilters((prev) => {
                        const next = new Set(prev)
                        if (next.has(value)) next.delete(value)
                        else next.add(value)
                        return next
                      })
                    }}
                    onShowAll={() => setTypeFilters(new Set())}
                  />
                }
              />
              <OneDriveHeaderCell
                label="Size"
                icon={HardDrive}
                sortKey="size"
                sort={sort}
                onToggleSort={toggleSort}
                alignRight
              />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const grouped = Boolean(group.label)
              const isCollapsed = grouped && collapsed.has(group.label)
              const groupTint = grouped
                ? getEnterpriseGroupTint(useFolderGroups ? 'folder' : 'type', group.label)
                : null
              return (
                <OneDriveGroup
                  key={group.label || 'all'}
                  label={group.label}
                  groupKind={useFolderGroups ? 'folder' : 'type'}
                  items={group.items}
                  collapsed={isCollapsed}
                  groupTint={groupTint}
                  richRows={showFolderCards}
                  onToggle={() => toggleGroup(group.label)}
                  onOpenItem={openItem}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      {consentRequired ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-6 text-center">
          <Cloud className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">Connect OneDrive to this personal workspace</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Sign in with Microsoft so Tectona can list items in your drive (`Files.Read`). Use
            alfa.irawan@adira.co.id for the first check.
          </p>
          <Button type="button" className="mt-3 h-9" disabled={connecting} onClick={() => void connect()}>
            {connecting ? 'Redirecting…' : 'Sign in with Microsoft'}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {!consentRequired && listing ? (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            showSplitFolders && 'grid grid-cols-[220px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-3',
          )}
        >
          <div className={cn(showSplitFolders && 'col-span-2', matchRepositorySpacing && 'mb-3')}>
            {breadcrumb}
          </div>

          {showSplitFolders ? (
            <div className="col-start-1 row-start-2 flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-background/50 p-2">
              <div className="flex items-center gap-2 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" aria-hidden />
                Folders
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scrollbar-hide">
                {folderItems.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="group flex min-h-12 w-full items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 text-left text-foreground transition-colors hover:border-blue-200 hover:bg-blue-50/60 dark:hover:border-blue-900 dark:hover:bg-blue-950/30"
                    onClick={() => openItem(folder)}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {folder.child_count ?? 0} items
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                ))}
                {folderItems.length === 0 ? (
                  <p className="px-2 py-4 text-xs text-muted-foreground">No subfolders here.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {showFolderCards && folderItems.length > 0 ? (
            <div className="mb-5 flex min-w-0 shrink-0 items-center gap-2 pt-1">
              <button
                type="button"
                aria-label="Previous folders"
                title="Previous folders"
                disabled={!folderSlider.canPrev}
                onClick={() => scrollFolders('previous')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div
                ref={folderSliderRef}
                className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-hidden overflow-y-visible scrollbar-hide"
                onScroll={updateFolderSlider}
              >
                {folderItems.map((folder) => (
                  <OneDriveFolderCard key={folder.id} item={folder} onOpen={() => openItem(folder)} />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next folders"
                title="Next folders"
                disabled={!folderSlider.canNext}
                onClick={() => scrollFolders('next')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col min-h-[360px] md:min-h-[420px]',
              showSplitFolders && 'col-start-2 row-start-2 min-w-0',
            )}
          >
            {tableBody}
          </div>
        </div>
      ) : null}

      {loading && !listing && !consentRequired ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading OneDrive…
        </p>
      ) : null}
    </div>
  )
}

function OneDriveHeaderCell({
  label,
  icon: HeaderIcon,
  sortKey,
  sort,
  onToggleSort,
  firstColumn = false,
  alignRight = false,
  filterSlot,
}: {
  label: string
  icon: typeof FileText
  sortKey: SortKey
  sort: { key: SortKey; dir: SortDir } | null
  onToggleSort: (key: SortKey) => void
  firstColumn?: boolean
  alignRight?: boolean
  filterSlot?: ReactNode
}) {
  const isSorted = sort?.key === sortKey
  return (
    <th
      className={cn(
        HEADER_CELL_CLASS,
        firstColumn ? PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS : 'bg-white/90 dark:bg-slate-900/90',
      )}
    >
      <div className={cn('flex items-center gap-1.5', alignRight && 'justify-end')}>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400/80" aria-hidden />
        <button
          type="button"
          onClick={() => onToggleSort(sortKey)}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          title="Sort: ascending → descending → default"
        >
          <HeaderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
          <span>{label}</span>
          {isSorted ? (
            sort?.dir === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          )}
        </button>
        {filterSlot}
      </div>
    </th>
  )
}

function OneDriveGroup({
  label,
  groupKind,
  items,
  collapsed,
  groupTint,
  richRows,
  onToggle,
  onOpenItem,
}: {
  label: string
  groupKind: 'folder' | 'type'
  items: MicrosoftDriveItem[]
  collapsed: boolean
  groupTint: { row: string; first: string } | null
  /**
   * Folder Card View shows the same document-row treatment the repository table
   * uses — large type icon, bold name, relative "Updated" line. The columns stay
   * OneDrive's own; only the row presentation is shared.
   */
  richRows: boolean
  onToggle: () => void
  onOpenItem: (item: MicrosoftDriveItem) => void
}) {
  return (
    <>
      {label ? (
        <tr>
          <td
            colSpan={4}
            className={cn(
              'px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
              groupTint?.first,
            )}
          >
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-background/60"
              aria-expanded={!collapsed}
              onClick={onToggle}
            >
              {collapsed ? (
                <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span>
                {groupKind === 'folder' ? 'Folder' : 'Type'}: {label}
              </span>
            </button>
          </td>
        </tr>
      ) : null}
      {collapsed
        ? null
        : items.map((item) => {
            const tintRow = groupTint?.row
            const tintFirst = groupTint?.first ?? PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS
            const typeLabel = itemTypeLabel(item)
            return (
              <tr
                key={item.id}
                // Dragging a row copies it into the Tectona pane. Folders are draggable
                // too; the drop side expands them rather than asking Graph for bytes.
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    ONEDRIVE_DRAG_MIME,
                    encodeOneDriveDragPayload([{ id: item.id, name: item.name, kind: item.kind }]),
                  )
                  event.dataTransfer.effectAllowed = 'copy'
                }}
                className={cn(
                  'group cursor-pointer transition-colors',
                  tintRow ? cn(tintRow, 'hover:brightness-[0.98] dark:hover:brightness-110') : 'hover:bg-accent/20',
                )}
                onClick={() => onOpenItem(item)}
              >
                <td className={cn(BODY_CELL_CLASS, richRows && 'align-top', tintFirst)}>
                  {richRows ? (
                    <div className="flex items-start gap-3">
                      {item.kind === 'folder' ? (
                        <Folder className="size-14 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                      ) : (
                        <FileTypeIconImg fileName={item.name} large />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-muted-foreground">
                          Updated {formatRelativeTimestamp(item.last_modified)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                      {item.kind === 'folder' ? (
                        <Folder className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                      ) : (
                        <FileTypeIconImg fileName={item.name} />
                      )}
                      <span className="truncate">{item.name}</span>
                    </span>
                  )}
                </td>
                <td
                  className={cn(
                    BODY_CELL_CLASS,
                    'whitespace-nowrap text-muted-foreground',
                    richRows && 'align-top',
                    tintRow,
                  )}
                >
                  {formatExplorerDateTime(item.last_modified)}
                </td>
                <td
                  className={cn(BODY_CELL_CLASS, 'truncate text-muted-foreground', richRows && 'align-top', tintRow)}
                >
                  {typeLabel}
                </td>
                <td
                  className={cn(
                    BODY_CELL_CLASS,
                    'text-right tabular-nums text-muted-foreground',
                    richRows && 'align-top',
                    tintRow,
                  )}
                >
                  {formatSize(item.size, item.kind)}
                </td>
              </tr>
            )
          })}
    </>
  )
}
