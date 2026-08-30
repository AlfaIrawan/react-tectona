import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolderNotesManager } from '@/modules/projects/components/FolderNotesManager'

type IdeaFolderNotesDrawerProps = {
  open: boolean
  folder: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
  autoFocusComposer?: boolean
}

/**
 * Reuses the Projects module's folder sticky-notes board (client-side only,
 * no backend) — notes are keyed by folder id in the same shared local store,
 * so this works for Idea Backlog folders without any API changes.
 */
export function IdeaFolderNotesDrawer({
  open,
  folder,
  onOpenChange,
  autoFocusComposer = false,
}: IdeaFolderNotesDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onOpenChange])

  if (!open || !folder || typeof document === 'undefined') return null

  return createPortal(
    // React bubbles portal events through the React tree, not the DOM tree — this
    // drawer is a React child of the (clickable) folder card, so without this every
    // click inside it would also bubble up and trigger the card's onOpen.
    <div className="fixed inset-0 z-[1400]" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="absolute inset-0 bg-[#2a2118]/55 backdrop-blur-[2px]"
        aria-label="Close folder notes drawer"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-folder-notes-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-[#c9b89a]/60 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)]"
        style={{
          background:
            'radial-gradient(circle at 18% 12%, rgba(255,255,255,0.28), transparent 38%), radial-gradient(circle at 82% 88%, rgba(0,0,0,0.06), transparent 42%), linear-gradient(180deg, #ebe2d3 0%, #d9cbb8 100%)',
        }}
      >
        <div className="flex items-start justify-between border-b border-[#c9b89a]/50 bg-[#f5efe6]/80 px-5 py-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-amber-900 shadow-sm"
              style={{
                background: 'linear-gradient(165deg, #fffef0 0%, #fff9b1 100%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
              }}
            >
              <StickyNote className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="idea-folder-notes-drawer-title" className="text-base font-bold tracking-tight text-[#3d3224]">
                Folder notes
              </h2>
              <p className="mt-0.5 text-sm text-[#6b5f4a]">
                Sticky notes for <span className="font-semibold text-[#4a3f2d]">{folder.name}</span>
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-[#5c4a32] hover:bg-[#ebe2d3]"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FolderNotesManager
            folderId={folder.id}
            folderName={folder.name}
            autoFocusComposer={autoFocusComposer}
            embedded
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
