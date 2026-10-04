import { Fragment, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { FileStack, FileType, FolderKanban, FolderPlus, GitBranch, Link2, Plus, ShieldCheck, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { EnterpriseColumnFilterDropdown } from '@/components/enterprise/EnterpriseColumnFilterDropdown'
import { EnterpriseSortableHeaderCell } from '@/components/enterprise/EnterpriseSortableHeaderCell'
import { useEnterpriseSortableColumns } from '@/components/enterprise/useEnterpriseSortableColumns'
import type { DocumentResponse, DocumentTemplateResponse } from '@/lib/api/documentKnowledgeApi'
import type { DocumentFolder } from '@/lib/api/documentFolderApi'
import { cn } from '@/lib/utils'
import { enterprisePrimarySolidButtonClass, enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { DocumentRepositoryExplorerView } from '@/modules/document-knowledge-management/components/DocumentRepositoryExplorerView'
import { DocumentRepositoryFolderCard } from '@/modules/document-knowledge-management/components/DocumentRepositoryFolderCard'
import { type RepositoryLayoutMode } from '@/modules/document-knowledge-management/components/RepositoryViewModeSwitch'
import { DocumentRepositoryPaginationControls } from '@/modules/document-knowledge-management/components/DocumentRepositoryTableView'
import { getFileTypeIcon } from '@/modules/document-knowledge-management/fileTypeIcon'
import { statusBadgeClass } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'

type GroupBy = 'none' | 'type' | 'category'
type TemplateColumnKey = 'template' | 'type' | 'category' | 'version' | 'status' | 'usage'

const TEMPLATE_HEADERS: Array<{ key: TemplateColumnKey; label: string; icon: typeof FileStack }> = [
  { key: 'template', label: 'Template', icon: FileStack },
  { key: 'type', label: 'Type', icon: FileType },
  { key: 'category', label: 'Category', icon: FolderKanban },
  { key: 'version', label: 'Version', icon: GitBranch },
  { key: 'status', label: 'Status', icon: ShieldCheck },
  { key: 'usage', label: 'Usage', icon: Link2 },
]

const TEMPLATE_FILTER_COLUMNS = new Set<TemplateColumnKey>(['type', 'category', 'status'])
const TEMPLATE_CELL_CLASS = 'border-b border-slate-200/20 px-3 py-2 align-top transition-colors group-hover:bg-accent/20 dark:border-slate-700/20'

function countColumnOptions(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    const next = value.trim()
    if (!next) continue
    counts.set(next, (counts.get(next) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))
}

function label(value?: string | null): string {
  if (!value) return '-'
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function updatedLabel(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '-'
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function categoryFolder(code: string, count: number): DocumentFolder {
  const name = label(code)
  return {
    id: code || 'uncategorized',
    name,
    description: null,
    parent_id: null,
    owner_id: 'system',
    workspace_id: null,
    document_count: count,
    children_count: 0,
    created_date: '',
    updated_date: null,
  }
}

export function IdeaTemplateLibrary({ templates, documents, loading, layout, onUseTemplate, onUploadTemplate, onNewTemplate, onNewFolder }: {
  templates: DocumentTemplateResponse[]
  documents: DocumentResponse[]
  loading: boolean
  layout: RepositoryLayoutMode
  onUseTemplate: (templateId: string) => void
  onUploadTemplate: () => void
  onNewTemplate: () => void
  onNewFolder: () => void
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState<{ key: TemplateColumnKey; dir: 'asc' | 'desc' } | null>(null)
  const [columnFilters, setColumnFilters] = useState<Partial<Record<TemplateColumnKey, Set<string>>>>({})
  const columns = useEnterpriseSortableColumns<TemplateColumnKey>({
    initialOrder: TEMPLATE_HEADERS.map((header) => header.key),
    pinnedFirstKey: 'template',
    hasSelectionColumn: false,
  })

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const template of templates) {
      const code = template.category_code || 'uncategorized'
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => label(a[0]).localeCompare(label(b[0])))
      .map(([code, count]) => categoryFolder(code, count))
  }, [templates])

  const columnValue = (template: DocumentTemplateResponse, key: TemplateColumnKey) => {
    const fileName = template.latest_file_name || template.template_code || template.name
    const usage = documents.filter((document) => document.template_id === template.id).length
    switch (key) {
      case 'template':
        return template.name
      case 'type':
        return label(template.document_type_code)
      case 'category':
        return label(template.category_code)
      case 'version':
        return `v${template.version}`
      case 'status':
        return label(template.status_code)
      case 'usage':
        return usage ? `${usage} document${usage === 1 ? '' : 's'}` : 'Not used yet'
      default:
        return fileName
    }
  }

  const filtered = useMemo(() => {
    const rows = (categoryId
      ? templates.filter((template) => (template.category_code || 'uncategorized') === categoryId)
      : templates
    ).filter((template) =>
      (['type', 'category', 'status'] as const).every((key) => {
        const selected = columnFilters[key]
        return !selected || selected.size === 0 || selected.has(columnValue(template, key))
      }),
    )
    if (!sort) return [...rows].sort((a, b) => a.name.localeCompare(b.name))
    return [...rows].sort((left, right) => {
      const compared = columnValue(left, sort.key).localeCompare(columnValue(right, sort.key), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return sort.dir === 'asc' ? compared : -compared
    })
  }, [categoryId, columnFilters, documents, sort, templates])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function selectCategory(nextId: string) {
    setCategoryId((current) => (current === nextId ? null : nextId))
    setPage(1)
  }

  const ignoreDrag = (event: DragEvent) => event.preventDefault()
  const ignoreFolderMenu = (event: MouseEvent) => event.preventDefault()

  const toggleSort = (key: TemplateColumnKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const toggleFilter = (key: TemplateColumnKey, value: string) => {
    setColumnFilters((current) => {
      const next = new Set(current[key] ?? [])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...current, [key]: next }
    })
    setPage(1)
  }

  const table = (
    <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto scrollbar-hide">
      <DndContext sensors={columns.dndSensors} onDragEnd={columns.handleColumnDragEnd}>
      <table
        ref={columns.tableRef}
        className={cn(
          'border-collapse text-xs select-none',
          columns.hasAnyCustomWidth || columns.resizingKey ? 'table-fixed w-full' : 'w-full',
        )}
      >
        <colgroup>
          {columns.visibleColumnOrder.map((key) => (
            <col key={key} style={columns.columnWidthStyle(key)} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="text-left text-muted-foreground">
            <SortableContext items={columns.visibleColumnOrder} strategy={rectSortingStrategy}>
              {columns.visibleColumnOrder.map((key) => {
                const header = TEMPLATE_HEADERS.find((item) => item.key === key)
                if (!header) return null
                const selected = columnFilters[key] ?? new Set<string>()
                return (
                  <EnterpriseSortableHeaderCell
                    key={key}
                    columnKey={key}
                    label={header.label}
                    icon={header.icon}
                    isPinned={columns.isPinnedColumn(key)}
                    isFirstColumn={columns.isFirstColumn(key)}
                    isLastColumn={columns.isLastColumn(key)}
                    widthStyle={columns.columnWidthStyle(key)}
                    sortDir={sort?.key === key ? sort.dir : null}
                    onToggleSort={toggleSort}
                    filterSlot={
                      TEMPLATE_FILTER_COLUMNS.has(key) ? (
                        <EnterpriseColumnFilterDropdown
                          label={header.label}
                          ariaLabel={`Filter ${header.label} in table`}
                          options={countColumnOptions(templates.map((template) => columnValue(template, key)))}
                          selected={selected}
                          onShowAll={() => {
                            setColumnFilters((current) => ({ ...current, [key]: new Set() }))
                            setPage(1)
                          }}
                          onToggleOption={(value) => toggleFilter(key, value)}
                        />
                      ) : undefined
                    }
                    frozenColumnClass={columns.frozenColumnHeaderClass}
                    firstColumnTintClass={columns.firstColumnTintHeaderClass}
                    isResizing={columns.resizingKey === key}
                    onBeginResize={columns.beginColumnResize}
                    onContextMenu={(event, columnKey) =>
                      columns.setHeaderContextMenu({ x: event.clientX, y: event.clientY, columnKey })
                    }
                  />
                )
              })}
            </SortableContext>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((template, index) => {
            const groupValue = groupBy === 'type' ? label(template.document_type_code) : groupBy === 'category' ? label(template.category_code) : null
            const previous = pageRows[index - 1]
            const previousGroup = groupBy === 'type' ? label(previous?.document_type_code) : groupBy === 'category' ? label(previous?.category_code) : null
            const fileName = template.latest_file_name || template.template_code || template.name
            const statusLabel = label(template.status_code)
            return (
              <Fragment key={template.id}>
                {groupValue && groupValue !== previousGroup ? (
                  <tr>
                    <td colSpan={columns.visibleColumnOrder.length} className="bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {groupBy === 'type' ? 'Type' : 'Category'}: {groupValue}
                    </td>
                  </tr>
                ) : null}
                <tr className="group transition-colors">
                  {columns.visibleColumnOrder.map((key) => {
                    const isFirst = columns.isFirstColumn(key)
                    return (
                      <td
                        key={key}
                        className={cn(
                          TEMPLATE_CELL_CLASS,
                          isFirst && columns.firstColumnTintBodyClass,
                          isFirst && columns.freezeFirstColumn && columns.frozenColumnBodyClass,
                          key === 'type' && 'max-w-[8.5rem] whitespace-normal leading-4 text-foreground',
                          (key === 'category' || key === 'usage') && 'text-foreground',
                          key === 'version' && 'font-semibold text-foreground',
                        )}
                      >
                        {key === 'template' ? (
                          <button type="button" className="flex min-w-0 items-start gap-3 text-left" onClick={() => onUseTemplate(template.id)}>
                            <img src={getFileTypeIcon(fileName)} alt="" className="size-14 shrink-0 object-contain object-center" draggable={false} aria-hidden />
                            <span className="min-w-0">
                              <span className="block line-clamp-1 text-sm font-semibold leading-snug text-slate-900">{template.name}</span>
                              {template.template_code ? (
                                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{template.template_code}</span>
                              ) : null}
                              <span className="mt-0.5 block text-[11px] text-slate-500">Updated {updatedLabel(template.updated_date || template.created_date)}</span>
                            </span>
                          </button>
                        ) : key === 'status' ? (
                          <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', statusBadgeClass(statusLabel))}>
                            {statusLabel}
                          </Badge>
                        ) : (
                          columnValue(template, key)
                        )}
                      </td>
                    )
                  })}
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
      </DndContext>
      {!loading && filtered.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center text-center text-muted-foreground">
          <FileStack className="mb-3 h-8 w-8" />
          <p className="text-sm font-medium">No reusable templates are available for this workspace.</p>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onUploadTemplate} className={cn('group', enterprisePrimarySolidButtonClass())}>
            <Upload className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden />
            Upload template
          </button>
          <button
            type="button"
            onClick={onNewTemplate}
            className={cn(
              'group',
              enterpriseSecondaryButtonClass(),
              'border-indigo-600 bg-indigo-600 text-white shadow-sm hover:border-indigo-700 hover:bg-indigo-700 hover:text-white dark:border-indigo-500 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-500',
            )}
          >
            <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
            New template
          </button>
          <button type="button" onClick={onNewFolder} className={cn('group', enterpriseSecondaryButtonClass())}>
            <FolderPlus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" aria-hidden />
            New folder
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2">
            <span>Group by</span>
            <Select className="h-10 w-32" value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)}>
              <option value="none">None</option>
              <option value="type">Type</option>
              <option value="category">Category</option>
            </Select>
          </label>
          <DocumentRepositoryPaginationControls
            page={safePage}
            pageSize={pageSize}
            totalCount={filtered.length}
            loading={loading}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1) }}
          />
        </div>
      </div>

      {layout === 'explorer' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <DocumentRepositoryExplorerView
            folders={categoryId ? [] : categories}
            documents={pageRows.map((template) => ({
              id: template.id,
              name: template.name,
              fileName: template.latest_file_name || template.template_code || template.name,
              updatedAt: template.updated_date || template.created_date || '',
            }))}
            selectedDocumentId={null}
            dropTargetFolderId={null}
            onOpenFolder={selectCategory}
            onOpenDocument={onUseTemplate}
            onFolderContextMenu={ignoreFolderMenu}
            onDocumentContextMenu={(event) => event.preventDefault()}
            onFolderDragOver={ignoreDrag}
            onFolderDragLeave={() => undefined}
            onFolderDrop={ignoreDrag}
          />
        </div>
      ) : (
        <div className={cn('flex min-h-0 w-full flex-1 overflow-hidden', layout === 'split' ? 'flex-row gap-3' : 'flex-col')}>
          {layout === 'folders' && categories.length > 0 ? (
            <div className="mb-3 flex w-full min-w-0 shrink-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-hide">
                {categories.map((folder) => (
                  <DocumentRepositoryFolderCard
                    key={folder.id}
                    folder={folder}
                    folders={categories}
                    isRenaming={false}
                    isDragOver={false}
                    selected={categoryId === folder.id}
                    onOpen={() => selectCategory(folder.id)}
                    onStartRename={() => undefined}
                    onRename={() => undefined}
                    onCancelRename={() => undefined}
                    onContextMenu={ignoreFolderMenu}
                    onDragOver={ignoreDrag}
                    onDragLeave={() => undefined}
                    onDrop={ignoreDrag}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {layout === 'split' ? (
            <div className="flex w-60 shrink-0 flex-col overflow-y-auto rounded-xl border border-border/60 bg-background/70">
              <button
                type="button"
                className={cn('border-b border-border/40 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40', !categoryId && 'bg-muted/50')}
                onClick={() => { setCategoryId(null); setPage(1) }}
              >
                All templates
              </button>
              {categories.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 border-b border-border/40 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/40',
                    categoryId === folder.id && 'bg-muted/50',
                  )}
                  onClick={() => selectCategory(folder.id)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{folder.document_count}</span>
                </button>
              ))}
            </div>
          ) : null}
          {table}
        </div>
      )}
    </div>
  )
}
