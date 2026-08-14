import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import { cn } from '@/lib/utils'
import { resolveProjectDescriptionPlain } from '../lib/projectDisplay'
import { useProjectStore, type Project } from '../store/projectStore'

const inlineFieldClass =
  'w-full rounded-lg border border-primary/40 bg-background px-2 py-1 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

type ProjectDetailHeaderFieldsProps = {
  project: Project
  onProjectUpdated: (project: Project) => void
}

export function ProjectDetailHeaderFields({ project, onProjectUpdated }: ProjectDetailHeaderFieldsProps) {
  const { updateProject, getProject } = useProjectStore()
  const { addToast } = useToast()

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)
  const [savingName, setSavingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)

  const displayDescription = useMemo(() => resolveProjectDescriptionPlain(project), [project])

  useEffect(() => {
    if (!isEditingName) setNameValue(project.name)
  }, [isEditingName, project.name])

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditingName])

  useEffect(() => {
    if (isEditingDescription) {
      setDescriptionValue(displayDescription)
      descriptionInputRef.current?.focus()
    }
  }, [displayDescription, isEditingDescription])

  const publishProjectUpdate = (patch: Partial<Project>) => {
    const refreshed = getProject(project.id)
    onProjectUpdated({
      ...(refreshed ?? project),
      ...patch,
      updatedAt: refreshed?.updatedAt ?? new Date().toISOString(),
    })
  }

  const saveName = async () => {
    const trimmed = nameValue.trim()
    if (trimmed === '' || trimmed === project.name) {
      setNameValue(project.name)
      setIsEditingName(false)
      return
    }

    setSavingName(true)
    try {
      await updateProject(project.id, { name: trimmed })
      publishProjectUpdate({ name: trimmed })
      addToast({ title: 'Project renamed', description: `Renamed to "${trimmed}".`, variant: 'success' })
      notifyEvent({ type_code: 'project', title: 'Project renamed', body: `Renamed to "${trimmed}".` })
      setIsEditingName(false)
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to rename project',
        variant: 'error',
      })
      setNameValue(project.name)
    } finally {
      setSavingName(false)
    }
  }

  const cancelNameEdit = () => {
    setNameValue(project.name)
    setIsEditingName(false)
  }

  const saveDescription = async () => {
    const trimmed = descriptionValue.trim()
    if (trimmed === displayDescription) {
      setIsEditingDescription(false)
      return
    }

    setSavingDescription(true)
    try {
      await updateProject(project.id, { description: trimmed || undefined })
      publishProjectUpdate({ description: trimmed || undefined })
      addToast({ title: 'Description updated', variant: 'success' })
      notifyEvent({
        type_code: 'project',
        title: 'Deskripsi project diupdate',
        body: `Deskripsi "${project.name}" diperbarui.`,
      })
      setIsEditingDescription(false)
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update description',
        variant: 'error',
      })
    } finally {
      setSavingDescription(false)
    }
  }

  const cancelDescriptionEdit = () => {
    setDescriptionValue(displayDescription)
    setIsEditingDescription(false)
  }

  return (
    <div className="space-y-0.5">
      {isEditingName ? (
        <input
          ref={nameInputRef}
          type="text"
          value={nameValue}
          disabled={savingName}
          onChange={(event) => setNameValue(event.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              cancelNameEdit()
              event.currentTarget.blur()
            }
          }}
          className={cn(inlineFieldClass, 'text-2xl font-semibold leading-tight text-slate-900')}
          placeholder="Project name"
          aria-label="Project name"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditingName(true)}
          className={cn(
            'group/title flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left transition',
            'hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          )}
          aria-label="Rename project"
        >
          <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight text-slate-900">{project.name}</h1>
          <Pencil
            className="mt-1.5 h-4 w-4 shrink-0 text-slate-400 opacity-0 transition group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
            aria-hidden
          />
        </button>
      )}

      {isEditingDescription ? (
        <textarea
          ref={descriptionInputRef}
          value={descriptionValue}
          disabled={savingDescription}
          onChange={(event) => setDescriptionValue(event.target.value)}
          onBlur={() => void saveDescription()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              cancelDescriptionEdit()
              event.currentTarget.blur()
            }
          }}
          rows={2}
          className={cn(inlineFieldClass, 'min-h-[3.25rem] resize-y text-sm leading-relaxed text-slate-600')}
          placeholder="Add project description…"
          aria-label="Project description"
        />
      ) : displayDescription ? (
        <button
          type="button"
          onClick={() => setIsEditingDescription(true)}
          className={cn(
            'group/description flex w-full max-w-none items-start gap-2 rounded-lg px-1 py-0.5 text-left transition',
            'hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          )}
          aria-label="Edit project description"
          title={displayDescription}
        >
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-2">{displayDescription}</p>
          <Pencil
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 opacity-0 transition group-hover/description:opacity-100 group-focus-visible/description:opacity-100"
            aria-hidden
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditingDescription(true)}
          className={cn(
            'group/description flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left transition',
            'hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          )}
          aria-label="Add project description"
        >
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">Add project description…</p>
          <Pencil
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 opacity-0 transition group-hover/description:opacity-100 group-focus-visible/description:opacity-100"
            aria-hidden
          />
        </button>
      )}
    </div>
  )
}
