import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  Archive,
  Trash2,
  RotateCcw,
  User,
  Users,
  Brain,
  Image,
  TrendingUp,
  ShoppingCart,
  FileText,
  Database,
  Code,
  Sparkles,
  BarChart3,
  Zap,
  Package,
  Rocket,
  Cpu,
  MessageSquare,
  StickyNote,
  ListTodo,
  Share2,
  Palette,
  Pencil,
  FolderInput,
  Tag,
  ChevronRight,
  X,
} from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { Project } from '@/modules/projects'
import { cn } from '@/lib/utils'
import { extractPlainTextFromHtml } from '@/lib/richHtmlEditor'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from '@/components/ui/context-menu'
import { useNavigate } from 'react-router-dom'
import { useProjectStore, useFolderStore } from '@/modules/projects'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import { createTodo, TECTONA_TODO_APP_ID, buildTodoEntityLinks } from '@/lib/api/todoApi'
import { getSession } from '@/auth/authService'
import { Tooltip } from '@/components/ui/tooltip'
import { DeleteProjectsConfirmModal } from './DeleteProjectsConfirmModal'
import { AddProjectMembersDrawer } from './AddProjectMembersDrawer'
import type { GridSelectionModifiers } from '../lib/gridSelection'
import {
  formatProjectTagLabel,
  getProjectTagBadgeClass,
  resolveProjectOwnerDisplay,
} from '../lib/projectDisplay'

interface ProjectCardProps {
  project: Project
  /** True when this project has at least one linked todo */
  hasTodos?: boolean
  /** Tooltip text: list of todo titles for this project (e.g. newline-joined) */
  todoListTooltip?: string
  isSelected?: boolean
  onSelect?: (projectId: string, modifiers: GridSelectionModifiers) => void
  showCheckbox?: boolean
  onDoubleClick?: () => void
  isDragActive?: boolean
  draggedProjectIds?: Set<string>
  /** Saat true, drag ditangani oleh parent (SortableContext); card tidak pakai useDraggable ref/listeners. */
  sortableMode?: boolean
  /** When true (multiple items selected), context menu shows Archive/Restore, Move to folder, Add member, Share, and Delete (archived). */
  multiSelectActive?: boolean
  /** When multiSelectActive, pindahkan semua project terpilih ke folder ini (dipanggil dari submenu Move to folder). */
  onMoveSelectedToFolder?: (folderId: string | null) => void | Promise<void>
  /** When multiSelectActive, archive semua project terpilih (dipanggil dari context menu Archive). */
  onArchiveSelected?: () => void | Promise<void>
  /** When multiSelectActive, restore semua project terpilih (dipanggil dari context menu Restore). */
  onRestoreSelected?: () => void | Promise<void>
  /** When multiSelectActive, hapus semua project archived terpilih (dipanggil dari context menu Delete). */
  onDeleteSelected?: () => void | Promise<void>
}

export function ProjectCard({
  project,
  hasTodos = false,
  todoListTooltip = '',
  isSelected = false,
  onSelect,
  showCheckbox = false,
  onDoubleClick,
  isDragActive = false,
  draggedProjectIds,
  sortableMode = false,
  multiSelectActive = false,
  onMoveSelectedToFolder,
  onArchiveSelected,
  onRestoreSelected,
  onDeleteSelected,
}: ProjectCardProps) {
  const navigate = useNavigate()
  const { archiveProject, restoreProject, deleteProject, updateProject, moveProjectToFolder } =
    useProjectStore()
  const { folders } = useFolderStore()
  const { addToast } = useToast()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `project-${project.id}`,
    data: {
      type: 'project',
      project,
    },
  })

  // When using DragOverlay, only the overlay should move. Do not apply transform
  // to the source card when dragging so overlay coordinates stay correct.
  // In sortableMode, parent handles drag so we don't attach transform/ref/listeners.
  const style =
    !sortableMode && transform && !isDragging
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : undefined

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [addTodoPopover, setAddTodoPopover] = useState<{ x: number; y: number } | null>(null)
  const [addTodoTitle, setAddTodoTitle] = useState('')
  const addTodoInputRef = useRef<HTMLInputElement>(null)
  const addTodoPopoverRef = useRef<HTMLDivElement>(null)
  const [addTodoSubmitting, setAddTodoSubmitting] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [tagsEditList, setTagsEditList] = useState<string[]>(project.tags ?? [])
  const [tagInputValue, setTagInputValue] = useState('')
  const tagsInputRef = useRef<HTMLInputElement>(null)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionEditValue, setDescriptionEditValue] = useState(project.description ?? '')
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [addMembersOpen, setAddMembersOpen] = useState(false)
  const [shareProjectOverride, setShareProjectOverride] = useState<Project | null>(null)
  const closeContextMenu = () => setContextMenu(null)

  const closeContextMenuPreservingScroll = (saved?: { x: number; y: number }) => {
    const x = saved?.x ?? window.scrollX
    const y = saved?.y ?? window.scrollY
    setContextMenu(null)
    const restore = () => window.scrollTo(x, y)
    requestAnimationFrame(restore)
    // Restore lagi setelah re-render dari store (fetchProjects) selesai, agar tidak auto scroll ke atas
    setTimeout(restore, 0)
    setTimeout(restore, 80)
    setTimeout(restore, 200)
  }

  const openAddMembersDrawer = () => {
    closeContextMenu()
    setShareProjectOverride(null)
    setAddMembersOpen(true)
  }

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(project.name)
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [isRenaming, project.name])

  useEffect(() => {
    if (isEditingTags) {
      setTagsEditList(project.tags ?? [])
      setTagInputValue('')
      tagsInputRef.current?.focus()
    }
  }, [isEditingTags, project.tags])

  useEffect(() => {
    if (isEditingDescription) {
      setDescriptionEditValue(project.description ?? '')
      descriptionInputRef.current?.focus()
    }
  }, [isEditingDescription, project.description])

  useEffect(() => {
    if (addTodoPopover) {
      setAddTodoTitle(`Todo for ${project.name}`)
      const t = requestAnimationFrame(() => addTodoInputRef.current?.focus())
      return () => cancelAnimationFrame(t)
    }
  }, [addTodoPopover, project.name])

  useEffect(() => {
    if (!addTodoPopover) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddTodoPopover(null)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (addTodoPopoverRef.current?.contains(e.target as Node)) return
      setAddTodoPopover(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [addTodoPopover])

  const saveDescription = async () => {
    const trimmed = descriptionEditValue.trim()
    const current = project.description ?? ''
    if (trimmed === current) {
      setIsEditingDescription(false)
      return
    }
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    try {
      await updateProject(project.id, { description: trimmed || undefined })
      addToast({ title: 'Description updated', variant: 'success' })
      notifyEvent({ type_code: 'project', title: 'Project description updated', body: `Description for "${project.name}" was updated.` })
    } catch (e) {
      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update', variant: 'error' })
    }
    setIsEditingDescription(false)
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
  }

  const cancelDescriptionEdit = () => {
    setDescriptionEditValue(project.description ?? '')
    setIsEditingDescription(false)
  }

  const saveRename = async () => {
    const trimmed = renameValue.trim()
    if (trimmed === '' || trimmed === project.name) {
      setIsRenaming(false)
      return
    }
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    try {
      await updateProject(project.id, { name: trimmed })
      addToast({ title: 'Project renamed', description: `Renamed to "${trimmed}".`, variant: 'success' })
      notifyEvent({ type_code: 'project', title: 'Project renamed', body: `Renamed to "${trimmed}".` })
    } catch (e) {
      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to rename', variant: 'error' })
    }
    setIsRenaming(false)
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
  }

  const cancelRename = () => {
    setRenameValue(project.name)
    setIsRenaming(false)
  }

  const addTagFromInput = () => {
    const t = tagInputValue.trim().toLowerCase()
    if (!t) return
    if (tagsEditList.includes(t)) {
      setTagInputValue('')
      return
    }
    setTagsEditList((prev) => [...prev, t])
    setTagInputValue('')
  }

  const removeTag = (index: number) => {
    setTagsEditList((prev) => prev.filter((_, i) => i !== index))
  }

  const saveTags = async () => {
    const currentTags = project.tags ?? []
    if (tagsEditList.length === currentTags.length && tagsEditList.every((t, i) => currentTags[i] === t)) {
      setIsEditingTags(false)
      return
    }
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    try {
      await updateProject(project.id, { tags: tagsEditList })
      addToast({ title: 'Tags updated', variant: 'success' })
      notifyEvent({ type_code: 'project', title: 'Project tags updated', body: `Tags for "${project.name}" were updated.` })
    } catch (e) {
      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update', variant: 'error' })
    }
    setIsEditingTags(false)
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
  }

  const cancelTagsEdit = () => {
    setTagsEditList(project.tags ?? [])
    setTagInputValue('')
    setIsEditingTags(false)
  }

  // Urutan spektrum: merah → pink → jingga → kuning → hijau → teal → cyan → biru → ungu
  const availableColors = [
    '#f43f5e', '#ec4899', '#f97316', '#f59e0b', '#84cc16', '#10b981',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  ]
  const availableIcons = [
    { name: 'brain', icon: Brain }, { name: 'image', icon: Image },
    { name: 'trending-up', icon: TrendingUp }, { name: 'shopping-cart', icon: ShoppingCart },
    { name: 'database', icon: Database }, { name: 'code', icon: Code },
    { name: 'sparkles', icon: Sparkles }, { name: 'bar-chart-3', icon: BarChart3 },
    { name: 'zap', icon: Zap }, { name: 'package', icon: Package },
    { name: 'rocket', icon: Rocket }, { name: 'cpu', icon: Cpu }, { name: 'file-text', icon: FileText },
  ]

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await archiveProject(project.id)
      addToast({
        title: 'Project archived',
        description: `Project "${project.name}" has been archived.`,
        variant: 'success'
      })
      notifyEvent({ type_code: 'project', title: 'Project archived', body: `Project "${project.name}" has been archived.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to archive project'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    }
  }

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await restoreProject(project.id)
      addToast({
        title: 'Project restored',
        description: `Project "${project.name}" has been restored to active status.`,
        variant: 'success'
      })
      notifyEvent({ type_code: 'project', title: 'Project restored', body: `Project "${project.name}" has been restored to active status.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to restore project'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteProject(project.id)
      addToast({
        title: 'Project deleted',
        description: `Project "${project.name}" has been deleted.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'project',
        title: 'Project deleted',
        body: `Project "${project.name}" has been deleted.`,
      })
      setDeleteConfirmOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const getColorIndex = (key: string) => {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0
    }
    return hash
  }

  const avatarColors = [
    { bg: 'bg-blue-500/15', text: 'text-blue-600', border: 'border-blue-500/30' },
    { bg: 'bg-purple-500/15', text: 'text-purple-600', border: 'border-purple-500/30' },
    { bg: 'bg-emerald-500/15', text: 'text-emerald-600', border: 'border-emerald-500/30' },
    { bg: 'bg-orange-500/15', text: 'text-orange-600', border: 'border-orange-500/30' },
    { bg: 'bg-pink-500/15', text: 'text-pink-600', border: 'border-pink-500/30' },
    { bg: 'bg-cyan-500/15', text: 'text-cyan-600', border: 'border-cyan-500/30' },
    { bg: 'bg-indigo-500/15', text: 'text-indigo-600', border: 'border-indigo-500/30' },
    { bg: 'bg-teal-500/15', text: 'text-teal-600', border: 'border-teal-500/30' },
  ] as const

  const getAvatarColor = (key: string) => {
    const idx = getColorIndex(key) % avatarColors.length
    return avatarColors[idx]
  }

  const borderColorValues = [
    '#3b82f6', // blue-500
    '#a855f7', // purple-500
    '#10b981', // emerald-500
    '#f97316', // orange-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
    '#f43f5e', // rose-500
    '#f59e0b', // amber-500
    '#84cc16', // lime-500
    '#8b5cf6', // violet-500
  ] as const

  // Warna border dari DB; kalau belum diset pakai satu default tetap agar tidak berubah-berubah
  const cardBorderColor =
    project.borderColor && project.borderColor.trim()
      ? project.borderColor
      : '#e5e7eb' /* neutral gray when not set */

  const iconMap: Record<string, typeof Brain> = {
    'brain': Brain,
    'image': Image,
    'trending-up': TrendingUp,
    'shopping-cart': ShoppingCart,
    'database': Database,
    'code': Code,
    'sparkles': Sparkles,
    'bar-chart-3': BarChart3,
    'zap': Zap,
    'package': Package,
    'rocket': Rocket,
    'cpu': Cpu,
    'file-text': FileText,
  }

  const getProjectIcon = () => {
    // Use icon from project data if available
    if (project.iconName && iconMap[project.iconName]) {
      return iconMap[project.iconName]
    }

    // Fallback to auto-detect based on tags/name
    const tags = (project.tags ?? []).map(t => t.toLowerCase())
    const name = project.name.toLowerCase()

    // Check tags first, then name
    if (tags.some(t => t.includes('nlp') || t.includes('sentiment') || t.includes('ner') || t.includes('entity'))) {
      return Brain
    }
    if (tags.some(t => t.includes('vision') || t.includes('image') || t.includes('cv') || t.includes('classification'))) {
      return Image
    }
    if (tags.some(t => t.includes('forecast') || t.includes('time-series') || t.includes('lstm') || t.includes('trend'))) {
      return TrendingUp
    }
    if (tags.some(t => t.includes('recommendation') || t.includes('e-commerce') || t.includes('collaborative'))) {
      return ShoppingCart
    }
    if (tags.some(t => t.includes('data') || t.includes('database'))) {
      return Database
    }
    if (tags.some(t => t.includes('finance') || t.includes('analytics'))) {
      return BarChart3
    }
    if (name.includes('nlp') || name.includes('sentiment') || name.includes('entity')) {
      return Brain
    }
    if (name.includes('image') || name.includes('vision') || name.includes('classification')) {
      return Image
    }
    if (name.includes('forecast') || name.includes('time') || name.includes('series')) {
      return TrendingUp
    }
    if (name.includes('recommendation')) {
      return ShoppingCart
    }
    
    // Default icon based on project name hash
    const iconOptions = [Brain, Image, TrendingUp, ShoppingCart, Database, Code, Sparkles, Zap]
    const iconIdx = getColorIndex(project.name) % iconOptions.length
    return iconOptions[iconIdx]
  }

  const ownerName = resolveProjectOwnerDisplay(project)
  const members = (project.members ?? []).filter((m) => m.roleCode !== 'owner')
  const shownMembers = members.slice(0, 3)
  const extraCount = Math.max(0, members.length - shownMembers.length)

  const handleCardClick = (e: React.MouseEvent) => {
    if (isRenaming || isEditingTags || isEditingDescription) return
    // Ignore clicks on dropdown menu
    if ((e.target as HTMLElement).closest('[role="menuitem"]')) {
      return
    }
    // Plain click = single; Ctrl/Cmd = toggle; Shift = range (handled in parent).
    onSelect?.(project.id, {
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    })
  }

  const handleCardDoubleClick = (e: React.MouseEvent) => {
    if (isRenaming || isEditingTags || isEditingDescription) return
    // Ignore double clicks on dropdown menu
    if ((e.target as HTMLElement).closest('[role="menuitem"]')) {
      return
    }
    // Double click = open
    if (onDoubleClick) {
      onDoubleClick()
    } else {
      navigate(`/projects/${project.id}`)
    }
  }

  return (
    <div
      ref={sortableMode ? undefined : setNodeRef}
      data-project-card
      {...(sortableMode ? {} : { ...listeners, ...attributes })}
      className={cn(
        // NOTE:
        // `.glass-card` mendefinisikan `box-shadow` custom, jadi `ring-*`/`shadow-*` Tailwind bisa tidak terlihat.
        // Untuk konsistensi dengan Base Models, indikator selected pakai inline `border` + `boxShadow`.
        'glass-card rounded-xl p-4 transition-all cursor-pointer relative h-full flex flex-col select-none outline-none focus:outline-none',
        // Keyboard focus indicator pakai outline agar tidak ketimpa `box-shadow`
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        project.status === 'archived' && 'opacity-60',
        // Saat drag: sembunyikan SEMUA card yang ikut dipilih agar hanya preview overlay yang terlihat
        (isDragging || (isDragActive && isSelected && draggedProjectIds?.has(project.id))) && 'opacity-0 pointer-events-none',
        // Hover state
        !isSelected && !isDragActive && 'hover:shadow-lg',
        // Selected state (visual indicator handled via inline style)
        isSelected && !isDragging && !(isDragActive && draggedProjectIds?.has(project.id)) && 'bg-primary/10'
      )}
      style={{
        ...(sortableMode ? undefined : style),
        // Hanya border bawah yang pakai warna card (dari DB atau default)
        borderBottom: `4px solid ${cardBorderColor}`,
        ...(isSelected && {
          border: '2px solid hsl(var(--primary))',
          borderBottom: '2px solid hsl(var(--primary))',
          boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.35), 0 20px 40px rgba(0, 0, 0, 0.15)',
        }),
      }}
      onClick={handleCardClick}
      onDoubleClick={handleCardDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Bagian atas: title + description — pakai flex-1 agar tinggi card seragam di grid */}
      <div className="flex items-start justify-between mb-3 flex-1 min-h-0">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
            {(() => {
              const IconComponent = getProjectIcon()
              return <IconComponent className="w-4 h-4 text-primary" />
            })()}
          </div>
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                  if (e.key === 'Escape') {
                    cancelRename()
                    e.currentTarget.blur()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-base font-semibold text-foreground mb-1 px-1 py-0.5 rounded border border-primary/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Project name"
              />
            ) : (
              <h3 className="text-base font-semibold text-foreground mb-1 truncate">
                {project.name}
              </h3>
            )}
          {(isEditingDescription || project.description) ? (
            isEditingDescription ? (
              <textarea
                ref={descriptionInputRef}
                value={descriptionEditValue}
                onChange={(e) => setDescriptionEditValue(e.target.value)}
                onBlur={saveDescription}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Escape') {
                    cancelDescriptionEdit()
                    e.currentTarget.blur()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-xs text-muted-foreground mb-1.5 px-2 py-1 rounded border border-primary/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-[3rem]"
                placeholder="Add description..."
                rows={2}
              />
            ) : (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                {extractPlainTextFromHtml(project.description ?? '').trim() || project.description}
              </p>
            )
          ) : null}
          </div>
        </div>
        {hasTodos && (() => {
          const todoCount = todoListTooltip ? todoListTooltip.split('\n').filter(Boolean).length : 0
          const iconBox = (
            <div
              className="shrink-0 relative flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary cursor-default"
              role="img"
              aria-label={todoCount ? `Project todos (${todoCount})` : 'Project has todos'}
            >
              <ListTodo className="w-4 h-4" aria-hidden />
              {todoCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold"
                  aria-hidden
                >
                  {todoCount > 99 ? '99+' : todoCount}
                </span>
              )}
            </div>
          )
          return todoListTooltip ? (
            <Tooltip
              content={
                <>
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    Todo for {project.name}
                  </div>
                  <div className="border-t border-slate-200/80 dark:border-slate-600/80 mt-2 pt-2" />
                  <ul className="space-y-1.5 text-[13px] font-normal text-slate-700 dark:text-slate-300 leading-relaxed list-none mt-2">
                    {todoListTooltip.split('\n').filter(Boolean).map((line, i) => {
                      const colon = line.indexOf(': ')
                      const label = colon >= 0 ? line.slice(colon + 2) : line
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-slate-400 dark:text-slate-500 shrink-0">•</span>
                          <span>{label}</span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              }
              side="bottom"
            >
              {iconBox}
            </Tooltip>
          ) : (
            iconBox
          )
        })()}
      </div>

      <ContextMenu
        open={!!contextMenu}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={closeContextMenu}
      >
        {multiSelectActive ? (
          <>
            {project.status === 'active' && (
              <ContextMenuItem
                onClick={async () => {
                  if (onArchiveSelected) {
                    try {
                      await onArchiveSelected()
                      closeContextMenu()
                    } catch {
                      // toast handled by parent
                    }
                  } else {
                    handleArchive({ stopPropagation: () => {} } as React.MouseEvent)
                    closeContextMenu()
                  }
                }}
                className="text-destructive"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </ContextMenuItem>
            )}
            {project.status === 'archived' && (
              <ContextMenuItem
                onClick={async () => {
                  if (onRestoreSelected) {
                    try {
                      await onRestoreSelected()
                      closeContextMenu()
                    } catch {
                      // toast handled by parent
                    }
                  } else {
                    handleRestore({ stopPropagation: () => {} } as React.MouseEvent)
                    closeContextMenu()
                  }
                }}
                className="text-primary"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore
              </ContextMenuItem>
            )}
            <ContextMenuSubmenu
              trigger={
                <>
                  <FolderInput className="w-4 h-4 mr-2" />
                  Move to folder
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </>
              }
            >
              <div className="py-1 max-h-60 overflow-y-auto min-w-[10rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer rounded-lg mx-1 hover:bg-accent/80 hover:text-accent-foreground text-left"
                  onClick={async () => {
                    const scroll = { x: window.scrollX, y: window.scrollY }
                    try {
                      if (multiSelectActive && onMoveSelectedToFolder) {
                        await onMoveSelectedToFolder(null)
                      } else {
                        await moveProjectToFolder(project.id, null)
                        addToast({ title: 'Project moved', description: 'Moved to All Projects.', variant: 'success' })
                        notifyEvent({ type_code: 'project', title: 'Project moved', body: 'Moved to All Projects.' })
                      }
                      closeContextMenuPreservingScroll(scroll)
                    } catch (e) {
                      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'error' })
                    }
                  }}
                >
                  All Projects
                </button>
                {folders.filter((f) => f.id !== project.folderId).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer rounded-lg mx-1 hover:bg-accent/80 hover:text-accent-foreground text-left"
                    onClick={async () => {
                      const scroll = { x: window.scrollX, y: window.scrollY }
                      try {
                        if (multiSelectActive && onMoveSelectedToFolder) {
                          await onMoveSelectedToFolder(f.id)
                        } else {
                          await moveProjectToFolder(project.id, f.id)
                          addToast({ title: 'Project moved', description: `Moved to "${f.name}".`, variant: 'success' })
                          notifyEvent({ type_code: 'project', title: 'Project moved', body: `Moved to "${f.name}".` })
                        }
                        closeContextMenuPreservingScroll(scroll)
                      } catch (e) {
                        addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'error' })
                      }
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </ContextMenuSubmenu>
            <ContextMenuItem onClick={openAddMembersDrawer}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </ContextMenuItem>
            {project.status === 'archived' && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={async () => {
                    if (onDeleteSelected) {
                      try {
                        await onDeleteSelected()
                        closeContextMenu()
                      } catch {
                        // toast handled by parent
                      }
                    } else {
                      handleDelete({ stopPropagation: () => {} } as React.MouseEvent)
                      closeContextMenu()
                    }
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </ContextMenuItem>
              </>
            )}
          </>
        ) : (
          <>
            <ContextMenuItem onClick={() => { navigate(`/projects/${project.id}`); closeContextMenu(); }}>
              View Details
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => { addToast({ title: 'Create Comment', description: 'This feature is coming soon.', variant: 'default' }); closeContextMenu(); }}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Create comment
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { addToast({ title: 'Add Notes', description: 'This feature is coming soon.', variant: 'default' }); closeContextMenu(); }}>
              <StickyNote className="w-4 h-4 mr-2" />
              Add notes
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const pos = contextMenu ? { x: contextMenu.x, y: contextMenu.y } : { x: 0, y: 0 }
                closeContextMenu()
                setAddTodoPopover(pos)
              }}
            >
              <ListTodo className="w-4 h-4 mr-2" />
              Add todo
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuSubmenu
              trigger={
                <>
                  <Palette className="w-4 h-4 mr-2" />
                  Change color
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </>
              }
            >
              <div className="w-[13rem] grid grid-cols-6 gap-3 p-3">
                {availableColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition shrink-0 flex items-center justify-center',
                      project.borderColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border hover:scale-110'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={async (e) => {
                      e.stopPropagation()
                      const scroll = { x: window.scrollX, y: window.scrollY }
                      try {
                        await updateProject(project.id, { borderColor: color })
                        addToast({ title: 'Color updated', variant: 'success' })
                        notifyEvent({ type_code: 'project', title: 'Project color updated', body: `Color for "${project.name}" was updated.` })
                        closeContextMenuPreservingScroll(scroll)
                      } catch (err) {
                        addToast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'error' })
                      }
                    }}
                  />
                ))}
              </div>
            </ContextMenuSubmenu>
            <ContextMenuItem onClick={openAddMembersDrawer}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                closeContextMenu()
                setIsRenaming(true)
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Rename project
            </ContextMenuItem>
            <ContextMenuSubmenu
              trigger={
                <>
                  <Image className="w-4 h-4 mr-2" />
                  Change icon
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </>
              }
            >
              <div className="w-[12rem] grid grid-cols-5 gap-2 p-2">
                {availableIcons.map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      'w-8 h-8 flex items-center justify-center rounded-lg border transition shrink-0',
                      project.iconName === name ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground'
                    )}
                    onClick={async (e) => {
                      e.stopPropagation()
                      const scroll = { x: window.scrollX, y: window.scrollY }
                      try {
                        await updateProject(project.id, { iconName: name })
                        addToast({ title: 'Icon updated', variant: 'success' })
                        notifyEvent({ type_code: 'project', title: 'Project icon updated', body: `Icon for "${project.name}" was updated.` })
                        closeContextMenuPreservingScroll(scroll)
                      } catch (err) {
                        addToast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'error' })
                      }
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </ContextMenuSubmenu>
            <ContextMenuItem
              onClick={() => {
                closeContextMenu()
                setIsEditingDescription(true)
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Change description
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                closeContextMenu()
                setIsEditingTags(true)
              }}
            >
              <Tag className="w-4 h-4 mr-2" />
              Update tag
            </ContextMenuItem>
            <ContextMenuSubmenu
              trigger={
                <>
                  <FolderInput className="w-4 h-4 mr-2" />
                  Move to folder
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </>
              }
            >
              <div className="py-1 max-h-60 overflow-y-auto min-w-[10rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer rounded-lg mx-1 hover:bg-accent/80 hover:text-accent-foreground text-left"
                  onClick={async () => {
                    const scroll = { x: window.scrollX, y: window.scrollY }
                    try {
                      await moveProjectToFolder(project.id, null)
                      addToast({ title: 'Project moved', description: 'Moved to All Projects.', variant: 'success' })
                      notifyEvent({ type_code: 'project', title: 'Project moved', body: 'Moved to All Projects.' })
                      closeContextMenuPreservingScroll(scroll)
                    } catch (e) {
                      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'error' })
                    }
                  }}
                >
                  All Projects
                </button>
                {folders.filter((f) => f.id !== project.folderId).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer rounded-lg mx-1 hover:bg-accent/80 hover:text-accent-foreground text-left"
                    onClick={async () => {
                    const scroll = { x: window.scrollX, y: window.scrollY }
                    try {
                      await moveProjectToFolder(project.id, f.id)
                      addToast({ title: 'Project moved', description: `Moved to "${f.name}".`, variant: 'success' })
                      notifyEvent({ type_code: 'project', title: 'Project moved', body: `Moved to "${f.name}".` })
                      closeContextMenuPreservingScroll(scroll)
                    } catch (e) {
                      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'error' })
                    }
                  }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </ContextMenuSubmenu>
            <ContextMenuSeparator />
            {project.status === 'active' && (
              <ContextMenuItem onClick={() => { handleArchive({ stopPropagation: () => {} } as React.MouseEvent); closeContextMenu(); }} className="text-destructive">
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </ContextMenuItem>
            )}
            {project.status === 'archived' && (
              <>
                <ContextMenuItem onClick={() => { handleRestore({ stopPropagation: () => {} } as React.MouseEvent); closeContextMenu(); }} className="text-primary">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => { handleDelete({ stopPropagation: () => {} } as React.MouseEvent); closeContextMenu(); }} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenu>

      {addTodoPopover &&
        createPortal(
          <div
            ref={addTodoPopoverRef}
            className="fixed z-[1200] w-[280px] rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xl p-3 flex flex-col gap-3"
            style={{
              left: Math.min(addTodoPopover.x, window.innerWidth - 296),
              top: addTodoPopover.y + 8,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium text-muted-foreground">Add todo</p>
            <input
              ref={addTodoInputRef}
              type="text"
              value={addTodoTitle}
              onChange={(e) => setAddTodoTitle(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (addTodoTitle.trim()) {
                    const userId = getSession()?.user.id
                    if (!userId) {
                      addToast({ title: 'Failed to add todo', description: 'Sesi tidak ditemukan. Silakan login ulang.', variant: 'error' })
                      return
                    }
                    setAddTodoSubmitting(true)
                    createTodo({
                      title: addTodoTitle.trim(),
                      app_id: TECTONA_TODO_APP_ID,
                      owned_by: userId,
                      entity_links: buildTodoEntityLinks({ projectId: project.id }),
                    })
                      .then(() => {
                        addToast({ title: 'Todo added', variant: 'success' })
                        setAddTodoPopover(null)
                        window.dispatchEvent(new CustomEvent('tectona-todos-changed'))
                        window.dispatchEvent(new CustomEvent('sequoia-todos-changed'))
                      })
                      .catch((err) => {
                        addToast({ title: 'Failed to add todo', description: err instanceof Error ? err.message : 'Error', variant: 'error' })
                      })
                      .finally(() => setAddTodoSubmitting(false))
                  }
                }
              }}
              placeholder="Todo title..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddTodoPopover(null)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!addTodoTitle.trim() || addTodoSubmitting}
                onClick={() => {
                  if (!addTodoTitle.trim()) return
                  const userId = getSession()?.user.id
                  if (!userId) {
                    addToast({ title: 'Failed to add todo', description: 'Sesi tidak ditemukan. Silakan login ulang.', variant: 'error' })
                    return
                  }
                  setAddTodoSubmitting(true)
                  createTodo({
                    title: addTodoTitle.trim(),
                    app_id: TECTONA_TODO_APP_ID,
                    owned_by: userId,
                    entity_links: buildTodoEntityLinks({ projectId: project.id }),
                  })
                    .then(() => {
                      addToast({ title: 'Todo added', variant: 'success' })
                      setAddTodoPopover(null)
                      window.dispatchEvent(new CustomEvent('tectona-todos-changed'))
                      window.dispatchEvent(new CustomEvent('sequoia-todos-changed'))
                    })
                    .catch((err) => {
                      addToast({ title: 'Failed to add todo', description: err instanceof Error ? err.message : 'Error', variant: 'error' })
                    })
                    .finally(() => setAddTodoSubmitting(false))
                }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {addTodoSubmitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>,
          document.body
        )}

      {(ownerName || members.length > 0) && (
        <div className="mt-1.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>Owner</span>
            <Tooltip content={ownerName} side="bottom">
              <div
                className={cn(
                  'ml-auto w-6 h-6 rounded-full border cursor-default',
                  'flex items-center justify-center text-[9px] font-semibold',
                  getAvatarColor(ownerName).bg,
                  getAvatarColor(ownerName).text,
                  getAvatarColor(ownerName).border
                )}
              >
                {getInitials(ownerName)}
              </div>
            </Tooltip>
          </div>
          <div className="flex items-center justify-between pb-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>Members</span>
            </div>
            <div className="flex items-center">
              {shownMembers.map((m, idx) => (
                <Tooltip key={m.userId} content={`${m.displayName} (${m.roleName})`} side="bottom">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border cursor-default',
                      'flex items-center justify-center text-[9px] font-semibold',
                      getAvatarColor(m.userId || m.displayName).bg,
                      getAvatarColor(m.userId || m.displayName).text,
                      getAvatarColor(m.userId || m.displayName).border,
                      idx > 0 && '-ml-2'
                    )}
                  >
                    {getInitials(m.displayName)}
                  </div>
                </Tooltip>
              ))}
              {extraCount > 0 && (
                <Tooltip content={`${extraCount} other members`} side="bottom">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border border-border bg-muted/60 cursor-default',
                      'flex items-center justify-center text-[9px] font-medium text-muted-foreground',
                      shownMembers.length > 0 && '-ml-2'
                    )}
                  >
                    +{extraCount}
                  </div>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(project.createdAt)}</span>
        </div>
        <div
          className={cn(
            'px-1.5 py-0.5 rounded-md text-xs font-medium',
            project.status === 'active'
              ? 'bg-green-500/10 text-green-500'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {project.status === 'active' ? 'Active' : 'Archived'}
        </div>
      </div>

      {(isEditingTags || (project.tags && project.tags.length > 0)) && (
        <div className="mt-2">
          {isEditingTags ? (
            <div
              className="w-full min-h-[2rem] flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50"
              onClick={(e) => e.stopPropagation()}
            >
              {tagsEditList.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md',
                    getProjectTagBadgeClass(tag)
                  )}
                >
                  {formatProjectTagLabel(tag)}
                  <button
                    type="button"
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTag(index)
                    }}
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagsInputRef}
                type="text"
                value={tagInputValue}
                onChange={(e) => setTagInputValue(e.target.value)}
                onBlur={() => setTimeout(saveTags, 0)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addTagFromInput()
                  }
                  if (e.key === 'Escape') {
                    cancelTagsEdit()
                    e.currentTarget.blur()
                  }
                }}
                className="flex-1 min-w-[5rem] text-xs py-0.5 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                placeholder="Add tag..."
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {project.tags!.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className={cn(
                    'px-1.5 py-0.5 text-xs rounded-md font-medium',
                    getProjectTagBadgeClass(tag)
                  )}
                >
                  {formatProjectTagLabel(tag)}
                </span>
              ))}
              {project.tags!.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{project.tags!.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <AddProjectMembersDrawer
        open={addMembersOpen}
        onOpenChange={setAddMembersOpen}
        project={shareProjectOverride ?? project}
        onProjectUpdated={setShareProjectOverride}
      />

      <DeleteProjectsConfirmModal
        open={deleteConfirmOpen}
        onClose={() => {
          if (!isDeleting) setDeleteConfirmOpen(false)
        }}
        onConfirm={() => void confirmDelete()}
        busy={isDeleting}
        projects={[project]}
      />
    </div>
  )
}
