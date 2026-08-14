import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ManageActionControlListModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description: string
  placeholder: string
  emptyMessage: string
  footerNote: string
  items: string[]
  reservedItems?: string[]
  onCreateItem: (label: string) => void
  onUpdateItem: (previousLabel: string, nextLabel: string) => void
  onDeleteItem: (label: string) => void
}

function itemSlug(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-')
}

export function ManageActionControlListModal({
  open,
  onClose,
  title,
  description,
  placeholder,
  emptyMessage,
  footerNote,
  items,
  reservedItems = [],
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
}: ManageActionControlListModalProps) {
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemError, setNewItemError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editingItemLabel, setEditingItemLabel] = useState('')
  const [editingItemError, setEditingItemError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNewItemLabel('')
    setNewItemError(null)
    setEditingItem(null)
    setEditingItemLabel('')
    setEditingItemError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (editingItem) {
        setEditingItem(null)
        setEditingItemLabel('')
        setEditingItemError(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose, editingItem])

  const isReservedItem = (label: string) => (
    reservedItems.some((item) => item.toLowerCase() === label.toLowerCase())
  )

  const addItem = () => {
    const label = newItemLabel.trim()
    if (!label) {
      setNewItemError('Label is required.')
      return
    }
    if (isReservedItem(label)) {
      setNewItemError('This label is reserved.')
      return
    }
    if (items.some((item) => item.toLowerCase() === label.toLowerCase())) {
      setNewItemError('Item already exists.')
      return
    }
    onCreateItem(label)
    setNewItemLabel('')
    setNewItemError(null)
  }

  const startEditItem = (item: string) => {
    setEditingItem(item)
    setEditingItemLabel(item)
    setEditingItemError(null)
  }

  const commitEditItem = () => {
    const previousLabel = editingItem
    if (!previousLabel) return
    const label = editingItemLabel.trim()
    if (!label) {
      setEditingItemError('Label is required.')
      return
    }
    if (isReservedItem(label)) {
      setEditingItemError('This label is reserved.')
      return
    }
    if (items.some((item) => item !== previousLabel && item.toLowerCase() === label.toLowerCase())) {
      setEditingItemError('Item already exists.')
      return
    }
    onUpdateItem(previousLabel, label)
    setEditingItem(null)
    setEditingItemLabel('')
    setEditingItemError(null)
  }

  if (typeof document === 'undefined' || !open) return null

  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-modal-title`

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1200] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[1250] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={`Close ${title}`}
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="flex gap-2">
              <Input
                value={newItemLabel}
                onChange={(event) => {
                  setNewItemLabel(event.target.value)
                  setNewItemError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addItem()
                }}
                placeholder={placeholder}
                className="h-10 flex-1 text-sm"
              />
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={addItem}
                aria-label={`Add ${title}`}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {newItemError ? (
              <p className="text-xs text-red-600 dark:text-red-400">{newItemError}</p>
            ) : null}

            <div className="max-h-72 overflow-y-auto rounded-xl border border-border/70">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      {editingItem === item ? (
                        <div className="space-y-1">
                          <Input
                            value={editingItemLabel}
                            onChange={(event) => {
                              setEditingItemLabel(event.target.value)
                              setEditingItemError(null)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                commitEditItem()
                              }
                              if (event.key === 'Escape') {
                                setEditingItem(null)
                                setEditingItemLabel('')
                                setEditingItemError(null)
                              }
                            }}
                            className="h-9 text-sm"
                            autoFocus
                          />
                          {editingItemError ? (
                            <p className="text-xs text-red-600 dark:text-red-400">{editingItemError}</p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <p className="font-mono text-[10px] text-muted-foreground">{itemSlug(item)}</p>
                          <p className="truncate text-sm font-semibold text-foreground">{item}</p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {editingItem === item ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={commitEditItem}
                        >
                          Save
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEditItem(item)}
                          aria-label={`Edit ${item}`}
                        >
                          <PencilLine className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDeleteItem(item)}
                        aria-label={`Delete ${item}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
            {footerNote}
          </p>
        </div>
      </div>
    </>,
    document.body,
  )
}
