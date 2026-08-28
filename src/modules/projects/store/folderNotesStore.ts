import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { randomUuid } from '@/lib/randomId'
import { FOLDER_NOTE_BODY_MAX, FOLDER_NOTE_TITLE_MAX } from '../lib/folderNotesLimits'

export interface FolderStickyNote {
  id: string
  folderId: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

interface FolderNotesState {
  notesByFolderId: Record<string, FolderStickyNote[]>
  getNotesForFolder: (folderId: string) => FolderStickyNote[]
  getNoteCount: (folderId: string) => number
  addNote: (folderId: string, input: { title: string; body: string }) => FolderStickyNote
  updateNote: (
    folderId: string,
    noteId: string,
    input: { title?: string; body?: string },
  ) => FolderStickyNote | null
  deleteNote: (folderId: string, noteId: string) => void
  deleteNotesForFolder: (folderId: string) => void
  deleteNotesForFolders: (folderIds: string[]) => void
  duplicateNotesToFolder: (sourceFolderId: string, targetFolderId: string) => void
}

/** Stable empty reference for Zustand selectors — do not use inline `?? []`. */
export const EMPTY_FOLDER_NOTES: FolderStickyNote[] = []

export function sortNotesNewestFirst(notes: FolderStickyNote[]): FolderStickyNote[] {
  return [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

function normalizeNoteInput(title: string, body: string) {
  return {
    title: title.trim().slice(0, FOLDER_NOTE_TITLE_MAX),
    body: body.trim().slice(0, FOLDER_NOTE_BODY_MAX),
  }
}

export const useFolderNotesStore = create<FolderNotesState>()(
  persist(
    (set, get) => ({
      notesByFolderId: {},

      /** Imperative helper only — do not use inside `useFolderNotesStore` selectors (returns new array). */
      getNotesForFolder: (folderId) => {
        return sortNotesNewestFirst(get().notesByFolderId[folderId] ?? EMPTY_FOLDER_NOTES)
      },

      getNoteCount: (folderId) => {
        return get().notesByFolderId[folderId]?.length ?? 0
      },

      addNote: (folderId, input) => {
        const { title, body } = normalizeNoteInput(input.title, input.body)
        if (!title) {
          throw new Error('Note title is required')
        }
        const now = new Date().toISOString()
        const note: FolderStickyNote = {
          id: randomUuid(),
          folderId,
          title,
          body,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          notesByFolderId: {
            ...state.notesByFolderId,
            [folderId]: sortNotesNewestFirst([note, ...(state.notesByFolderId[folderId] ?? [])]),
          },
        }))
        return note
      },

      updateNote: (folderId, noteId, input) => {
        const existing = get().notesByFolderId[folderId] ?? []
        const index = existing.findIndex((note) => note.id === noteId)
        if (index < 0) return null

        const current = existing[index]
        const title = input.title != null ? input.title.trim().slice(0, FOLDER_NOTE_TITLE_MAX) : current.title
        const body = input.body != null ? input.body.trim().slice(0, FOLDER_NOTE_BODY_MAX) : current.body
        if (!title) {
          throw new Error('Note title is required')
        }

        const updated: FolderStickyNote = {
          ...current,
          title,
          body,
          updatedAt: new Date().toISOString(),
        }

        const next = [...existing]
        next[index] = updated
        set((state) => ({
          notesByFolderId: {
            ...state.notesByFolderId,
            [folderId]: sortNotesNewestFirst(next),
          },
        }))
        return updated
      },

      deleteNote: (folderId, noteId) => {
        set((state) => {
          const nextNotes = (state.notesByFolderId[folderId] ?? []).filter((note) => note.id !== noteId)
          const nextMap = { ...state.notesByFolderId }
          if (nextNotes.length === 0) {
            delete nextMap[folderId]
          } else {
            nextMap[folderId] = nextNotes
          }
          return { notesByFolderId: nextMap }
        })
      },

      deleteNotesForFolder: (folderId) => {
        set((state) => {
          if (!(folderId in state.notesByFolderId)) return state
          const nextMap = { ...state.notesByFolderId }
          delete nextMap[folderId]
          return { notesByFolderId: nextMap }
        })
      },

      deleteNotesForFolders: (folderIds) => {
        if (folderIds.length === 0) return
        set((state) => {
          const nextMap = { ...state.notesByFolderId }
          for (const folderId of folderIds) {
            delete nextMap[folderId]
          }
          return { notesByFolderId: nextMap }
        })
      },

      duplicateNotesToFolder: (sourceFolderId, targetFolderId) => {
        const sourceNotes = get().notesByFolderId[sourceFolderId] ?? []
        if (sourceNotes.length === 0) return
        const now = new Date().toISOString()
        const copies = sourceNotes.map((note) => ({
          ...note,
          id: randomUuid(),
          folderId: targetFolderId,
          createdAt: now,
          updatedAt: now,
        }))
        set((state) => ({
          notesByFolderId: {
            ...state.notesByFolderId,
            [targetFolderId]: sortNotesNewestFirst([
              ...copies,
              ...(state.notesByFolderId[targetFolderId] ?? []),
            ]),
          },
        }))
      },
    }),
    {
      name: 'folder-notes-storage',
      partialize: (state) => ({ notesByFolderId: state.notesByFolderId }),
    },
  ),
)
