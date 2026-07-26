import type { ReactNode } from 'react'
import { ChevronLeft, Download, Forward, Star, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'

type PeopleChatMessageSelectionBarProps = {
  selectedCount: number
  onClose: () => void
  onStar: () => void
  onDelete: () => void
  onForward: () => void
  onDownload: () => void
}

function SelectionActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition-colors',
        'hover:bg-black/5 active:bg-black/10 disabled:pointer-events-none disabled:opacity-35',
        'dark:text-[#aebac1] dark:hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}

export function PeopleChatMessageSelectionBar({
  selectedCount,
  onClose,
  onStar,
  onDelete,
  onForward,
  onDownload,
}: PeopleChatMessageSelectionBarProps) {
  const disabled = selectedCount === 0
  const label =
    selectedCount === 1 ? '1 selected' : `${selectedCount} selected`

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-[#d1d7db] bg-[#f0f2f5] px-2 py-2 dark:border-[#2a3942] dark:bg-[#202c33]">
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
        aria-label="Cancel message selection"
        onClick={onClose}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <p className="min-w-0 flex-1 text-[14px] font-medium text-[#111b21] dark:text-[#e9edef]">
        {label}
      </p>
      <div className="flex shrink-0 items-center gap-0.5">
        <SelectionActionButton label="Star selected messages" disabled={disabled} onClick={onStar}>
          <Star className="h-5 w-5" aria-hidden />
        </SelectionActionButton>
        <SelectionActionButton label="Delete selected messages" disabled={disabled} onClick={onDelete}>
          <Trash2 className="h-5 w-5" aria-hidden />
        </SelectionActionButton>
        <SelectionActionButton label="Forward selected messages" disabled={disabled} onClick={onForward}>
          <Forward className="h-5 w-5" aria-hidden />
        </SelectionActionButton>
        <SelectionActionButton label="Download selected messages" disabled={disabled} onClick={onDownload}>
          <Download className="h-5 w-5" aria-hidden />
        </SelectionActionButton>
      </div>
    </div>
  )
}
