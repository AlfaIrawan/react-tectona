import { FileText, Folder as FolderIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { Project } from '@/modules/projects'
import styles from './ProjectDragLayer.module.css'

type ProjectDragLayerProps = {
  activeId: string | null
  project: Project | null
  projectCount: number
  overFolderName: string | null
  pointer: { x: number; y: number } | null
}

export function ProjectDragLayer({
  activeId,
  project,
  projectCount,
  overFolderName,
  pointer,
}: ProjectDragLayerProps) {
  if (typeof document === 'undefined' || !pointer) return null

  const isProjectDrag = Boolean(activeId?.startsWith('project-') && project)
  const isFolderDrag = Boolean(activeId?.startsWith('folder-'))
  const showMoveHint = Boolean(overFolderName && (isProjectDrag || isFolderDrag))

  const cursorHint = showMoveHint ? (
    <div
      className={styles.cursorHint}
      style={{ left: pointer.x + 14, top: pointer.y + 18 }}
      role="status"
      aria-live="polite"
    >
      <span className={styles.cursorHintArrow} aria-hidden>
        →
      </span>
      Move to {overFolderName}
    </div>
  ) : null

  const ghost = isProjectDrag ? (
    <div
      className={styles.ghostFollow}
      style={{ left: pointer.x + 12, top: pointer.y + 10 }}
      aria-hidden
    >
      <div className={styles.ghost}>
        <div className={styles.ghostIconWrap}>
          <FileText className={styles.ghostIcon} strokeWidth={1.75} />
        </div>
        {projectCount > 1 ? (
          <span className={styles.ghostBadge}>{projectCount}</span>
        ) : null}
      </div>
    </div>
  ) : isFolderDrag ? (
    <div
      className={styles.ghostFollow}
      style={{ left: pointer.x + 12, top: pointer.y + 10 }}
      aria-hidden
    >
      <div className={styles.ghost}>
        <div className={cn(styles.ghostIconWrap, styles.ghostIconWrapFolder)}>
          <FolderIcon className={styles.ghostIcon} strokeWidth={1.75} />
        </div>
      </div>
    </div>
  ) : null

  if (!ghost && !cursorHint) return null

  return createPortal(
    <>
      {ghost}
      {cursorHint}
    </>,
    document.body,
  )
}
