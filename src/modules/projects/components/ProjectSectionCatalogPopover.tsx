import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  PROJECT_PANEL_CATALOG,
  getProjectPanelCatalogEntry,
  type ProjectPanelKey,
} from '../lib/projectPanelCatalog'

export function ProjectSectionCatalogPopover({
  open,
  anchorEl,
  navSections,
  onClose,
  onAddSection,
  onRemoveSection,
}: {
  open: boolean
  anchorEl: HTMLElement | null
  navSections: ProjectPanelKey[]
  onClose: () => void
  onAddSection: (key: ProjectPanelKey) => void
  onRemoveSection: (key: ProjectPanelKey) => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [selectedKey, setSelectedKey] = useState<ProjectPanelKey>('deployments')
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const availableEntries = useMemo(
    () => PROJECT_PANEL_CATALOG.filter((entry) => !navSections.includes(entry.key)),
    [navSections],
  )

  const selectedEntry =
    availableEntries.length === 0
      ? null
      : getProjectPanelCatalogEntry(
          availableEntries.some((entry) => entry.key === selectedKey)
            ? selectedKey
            : availableEntries[0]!.key,
        )

  const updatePosition = () => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const width = 560
    const height = 460
    let left = rect.left - width - 12
    let top = rect.top - 8

    if (left < 12) left = 12
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - height - 12)
    }
    if (top < 12) top = 12

    setPosition({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, anchorEl])

  useEffect(() => {
    if (!open) return
    const firstAvailable = availableEntries[0]
    if (firstAvailable) {
      setSelectedKey(firstAvailable.key)
    }
  }, [open, availableEntries])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const closeIfOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (anchorEl?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', closeIfOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', closeIfOutside)
    }
  }, [open, onClose, anchorEl])

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Add project section"
      className="fixed z-[1200] flex w-[min(560px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border/70 bg-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.45)] dark:bg-slate-950"
      style={{ top: position.top, left: position.left }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-[440px] w-full">
        <div className="w-[220px] shrink-0 border-r border-border/60 bg-muted/15">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Views</p>
          </div>
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {availableEntries.length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted-foreground">
                All catalog sections are already added.
              </li>
            ) : (
              availableEntries.map((entry) => {
                const Icon = entry.icon
                const active = selectedKey === entry.key
                return (
                  <li key={entry.key}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition',
                        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50',
                      )}
                      onClick={() => setSelectedKey(entry.key)}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end border-b border-border/60 px-3 py-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              aria-label="Close section catalog"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 flex-col px-5 py-4">
            {availableEntries.length === 0 || !selectedEntry ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-foreground">All sections added</p>
                <p className="text-sm text-muted-foreground">
                  Every view from the catalog is already in your project menu.
                </p>
                <Button type="button" variant="outline" className="mt-4 w-full justify-center" onClick={onClose}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    'mb-4 flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-xl',
                    !selectedEntry.illustrationSrc && 'min-h-28 border border-dashed border-border/70 bg-muted/20',
                  )}
                >
                  {selectedEntry.illustrationSrc ? (
                    <img
                      src={selectedEntry.illustrationSrc}
                      alt=""
                      className="max-h-full max-w-full object-contain object-center"
                    />
                  ) : (
                    <selectedEntry.icon className="h-10 w-10 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground">{selectedEntry.label}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{selectedEntry.description}</p>
                <Button
                  type="button"
                  className={cn(registerServicePrimaryButtonClass(), 'mt-4 w-full justify-center gap-2')}
                  onClick={() => onAddSection(selectedEntry.key)}
                >
                  <Plus className="h-4 w-4" />
                  Add section
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
