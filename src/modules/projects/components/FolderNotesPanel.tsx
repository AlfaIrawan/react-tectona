import { useState } from 'react'
import { ChevronDown, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFolderNotesStore } from '../store/folderNotesStore'
import { FolderNotesManager } from './FolderNotesManager'
import styles from './FolderNotesManager.module.css'

type FolderNotesPanelProps = {
  folderId: string
  folderName: string
}

export function FolderNotesPanel({ folderId, folderName }: FolderNotesPanelProps) {
  const noteCount = useFolderNotesStore(
    (state) => state.notesByFolderId[folderId]?.length ?? 0,
  )
  const [expanded, setExpanded] = useState(noteCount > 0)

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d9cbb8]/80 bg-[#f5efe6]/90 shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#d9cbb8]/70 bg-[#ebe2d3]/70 px-5 py-3 sm:px-6">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setExpanded((value) => !value)}
        >
          <div
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-900"
            style={{
              background: 'linear-gradient(165deg, #fffef0 0%, #fff9b1 100%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            <StickyNote className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#3d3224]">
              Notes {noteCount > 0 ? `(${noteCount})` : ''}
            </p>
            <p className="truncate text-xs text-[#6b5f4a]">Sticky notes on cork board</p>
          </div>
          <ChevronDown
            className={cn(
              'ml-auto h-4 w-4 shrink-0 text-[#6b5f4a] transition-transform',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </div>

      {expanded ? (
        <div className={styles.boardPanel}>
          <FolderNotesManager folderId={folderId} folderName={folderName} compact embedded />
        </div>
      ) : null}
    </section>
  )
}
