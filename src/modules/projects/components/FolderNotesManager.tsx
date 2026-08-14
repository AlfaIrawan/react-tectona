import { useMemo, useState, type CSSProperties } from 'react'
import { Loader2, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  FOLDER_NOTE_BODY_MAX,
  FOLDER_NOTE_TITLE_MAX,
  formatFolderNoteTimestamp,
} from '../lib/folderNotesLimits'
import {
  DEFAULT_COMPOSER_THEME,
  getStickyNoteRotation,
  getStickyNoteTheme,
  stickyNoteThemeToCssVars,
} from '../lib/folderStickyNoteTheme'
import {
  EMPTY_FOLDER_NOTES,
  sortNotesNewestFirst,
  useFolderNotesStore,
  type FolderStickyNote,
} from '../store/folderNotesStore'
import styles from './FolderNotesManager.module.css'

type FolderNotesManagerProps = {
  folderId: string
  folderName: string
  compact?: boolean
  autoFocusComposer?: boolean
  /** Hide duplicate subtitle when drawer/panel already shows folder name. */
  embedded?: boolean
}

type ComposerMode =
  | { kind: 'create' }
  | { kind: 'edit'; noteId: string }

function stickyStyle(
  noteId: string,
  extra?: CSSProperties,
): CSSProperties {
  const theme = getStickyNoteTheme(noteId)
  return {
    ...stickyNoteThemeToCssVars(theme),
    '--sticky-rotate': `${getStickyNoteRotation(noteId)}deg`,
    ...extra,
  } as CSSProperties
}

export function FolderNotesManager({
  folderId,
  folderName,
  compact = false,
  autoFocusComposer = false,
  embedded = false,
}: FolderNotesManagerProps) {
  const { addToast } = useToast()
  const rawNotes = useFolderNotesStore(
    (state) => state.notesByFolderId[folderId] ?? EMPTY_FOLDER_NOTES,
  )
  const notes = useMemo(() => sortNotesNewestFirst(rawNotes), [rawNotes])
  const addNote = useFolderNotesStore((state) => state.addNote)
  const updateNote = useFolderNotesStore((state) => state.updateNote)
  const deleteNote = useFolderNotesStore((state) => state.deleteNote)

  const [composerMode, setComposerMode] = useState<ComposerMode | null>(
    autoFocusComposer ? { kind: 'create' } : null,
  )
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const composerOpen = composerMode != null
  const composerNoteId =
    composerMode?.kind === 'edit' ? composerMode.noteId : `composer-${folderId}`
  const editingNote = useMemo(
    () => (composerMode?.kind === 'edit' ? notes.find((note) => note.id === composerMode.noteId) : undefined),
    [composerMode, notes],
  )

  const resetComposer = () => {
    setComposerMode(null)
    setTitle('')
    setBody('')
  }

  const openCreateComposer = () => {
    setComposerMode({ kind: 'create' })
    setTitle('')
    setBody('')
  }

  const openEditComposer = (note: FolderStickyNote) => {
    setComposerMode({ kind: 'edit', noteId: note.id })
    setTitle(note.title)
    setBody(note.body)
  }

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      addToast({ title: 'Note title is required', variant: 'error' })
      return
    }
    setSubmitting(true)
    try {
      if (composerMode?.kind === 'edit') {
        updateNote(folderId, composerMode.noteId, { title: trimmedTitle, body })
        addToast({ title: 'Note updated', variant: 'success' })
      } else {
        addNote(folderId, { title: trimmedTitle, body })
        addToast({ title: 'Note added', variant: 'success' })
      }
      resetComposer()
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save note',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (note: FolderStickyNote) => {
    setPendingDeleteId(note.id)
    try {
      deleteNote(folderId, note.id)
      if (composerMode?.kind === 'edit' && composerMode.noteId === note.id) {
        resetComposer()
      }
      addToast({ title: 'Note deleted', variant: 'success' })
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete note',
        variant: 'error',
      })
    } finally {
      setPendingDeleteId(null)
    }
  }

  const emptyThemeStyle = {
    ...stickyNoteThemeToCssVars(DEFAULT_COMPOSER_THEME),
    '--sticky-rotate': '-1.5deg',
  } as CSSProperties

  return (
    <div
      className={cn(
        styles.board,
        embedded && !compact && styles.boardDrawer,
        compact && !embedded && styles.boardPanel,
      )}
    >
      <div className={cn(styles.toolbar, compact && styles.toolbarCompact)}>
        <div className={styles.countBadge}>
          <StickyNote className="h-3.5 w-3.5 text-amber-700" aria-hidden />
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </div>
        {!composerOpen ? (
          <button type="button" className={styles.addBtn} onClick={openCreateComposer}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add note
          </button>
        ) : null}
      </div>

      {!embedded ? (
        <p className="mb-3 text-xs text-[#6b5f4a]">
          Sticky notes for <span className="font-semibold text-[#4a3f2d]">{folderName}</span>
        </p>
      ) : null}

      {notes.length === 0 && !composerOpen ? (
        <div className={styles.emptyBoard} style={emptyThemeStyle}>
          <div className={styles.emptySticky}>
            <p className={styles.emptyTitle}>No notes yet</p>
            <p className={styles.emptyHint}>
              Pin a sticky note for meetings, decisions, or important links for this folder.
            </p>
          </div>
          <button type="button" className={styles.addBtn} onClick={openCreateComposer}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add your first note
          </button>
        </div>
      ) : (
        <div className={styles.noteGrid}>
          {composerOpen ? (
            <div className={styles.composerCell}>
              <section
                className={cn(styles.stickyNote, styles.composer, editingNote && styles.stickyNoteEditing)}
                style={stickyStyle(composerNoteId, { '--sticky-rotate': '0.8deg' } as CSSProperties)}
              >
                <input
                  id={`folder-note-title-${folderId}`}
                  className={styles.composerTitle}
                  value={title}
                  maxLength={FOLDER_NOTE_TITLE_MAX}
                  autoFocus
                  placeholder="Note title..."
                  aria-label="Note title"
                  onChange={(event) => setTitle(event.target.value)}
                />
                <textarea
                  id={`folder-note-body-${folderId}`}
                  className={styles.composerBody}
                  value={body}
                  maxLength={FOLDER_NOTE_BODY_MAX}
                  rows={compact ? 4 : 6}
                  placeholder="Write a short note here..."
                  aria-label="Note content"
                  onChange={(event) => setBody(event.target.value)}
                />
                <div className={styles.composerFooter}>
                  <span className={styles.charCount}>
                    {title.length}/{FOLDER_NOTE_TITLE_MAX} · {body.length}/{FOLDER_NOTE_BODY_MAX}
                  </span>
                  <div className={styles.composerActions}>
                    <button
                      type="button"
                      className={styles.composerBtn}
                      disabled={submitting}
                      onClick={resetComposer}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={cn(styles.composerBtn, styles.composerBtnPrimary)}
                      disabled={submitting || !title.trim()}
                      onClick={() => void handleSave()}
                    >
                      {submitting ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                      {composerMode?.kind === 'edit' ? 'Save' : 'Pin note'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
          {notes.map((note) => {
            const isEditingThis =
              composerMode?.kind === 'edit' && composerMode.noteId === note.id
            if (isEditingThis) return null

            return (
              <article
                key={note.id}
                className={styles.stickyNote}
                style={stickyStyle(note.id)}
              >
                <h4 className={styles.noteTitle}>{note.title}</h4>
                <p className={styles.noteMeta}>{formatFolderNoteTimestamp(note.updatedAt)}</p>
                {note.body ? (
                  <p className={styles.noteBody}>{note.body}</p>
                ) : (
                  <p className={cn(styles.noteBody, styles.noteBodyEmpty)}>—</p>
                )}
                <div className={styles.noteFooter}>
                  <div className={styles.noteActions}>
                    <button
                      type="button"
                      className={styles.noteActionBtn}
                      aria-label={`Edit ${note.title}`}
                      onClick={() => openEditComposer(note)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={cn(styles.noteActionBtn, styles.noteActionBtnDanger)}
                      aria-label={`Delete ${note.title}`}
                      disabled={pendingDeleteId === note.id}
                      onClick={() => void handleDelete(note)}
                    >
                      {pendingDeleteId === note.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
