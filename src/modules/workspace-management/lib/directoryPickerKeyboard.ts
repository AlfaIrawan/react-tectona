import type { KeyboardEvent, MouseEvent } from 'react'

/** Attribute on listbox container for search + dropdown directory pickers. */
export const DIRECTORY_PICKER_LIST_ATTR = 'data-directory-picker-list'

export function retainFocusForDirectoryPicker(ev: MouseEvent) {
  ev.preventDefault()
}

export function directoryPickerListOpen(hasSelection: boolean, query: string, resultCount: number): boolean {
  return !hasSelection && query.trim().length > 0 && resultCount > 0
}

export function isFocusMovingToDirectoryPickerList(relatedTarget: EventTarget | null): boolean {
  return relatedTarget instanceof HTMLElement && relatedTarget.closest(`[${DIRECTORY_PICKER_LIST_ATTR}]`) != null
}

export function focusDirectoryPickerOption(optionId: string) {
  document.getElementById(optionId)?.focus()
}

/** Drawer: Esc pertama blur field; Esc kedua (tanpa fokus field) tutup drawer. */
export function focusedFormFieldInDrawer(drawerEl: HTMLElement | null): HTMLElement | null {
  const active = document.activeElement
  if (!active || !(active instanceof HTMLElement) || !drawerEl?.contains(active)) return null
  const tag = active.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return active
  if (active.isContentEditable) return active
  return null
}

export function handleDirectoryPickerInputKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  opts: {
    listOpen: boolean
    firstOptionId: string
    onEnter?: () => void
    /** Dipanggil sebelum fokus pindah ke listbox (hindari onBlur revert/commit). */
    onBeforeFocusList?: () => void
  }
): void {
  if (e.key === 'Enter') {
    if (opts.onEnter) {
      e.preventDefault()
      opts.onEnter()
    }
    return
  }
  if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
    if (!opts.listOpen || !opts.firstOptionId) return
    e.preventDefault()
    opts.onBeforeFocusList?.()
    focusDirectoryPickerOption(opts.firstOptionId)
  }
}

export function handleDirectoryPickerOptionKeyDown(
  e: KeyboardEvent<HTMLButtonElement>,
  opts: { inputId: string; optionIds: string[]; index: number; onSelect: () => void }
): void {
  const { inputId, optionIds, index, onSelect } = opts
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    onSelect()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    focusDirectoryPickerOption(inputId)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (index < optionIds.length - 1) focusDirectoryPickerOption(optionIds[index + 1]!)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (index > 0) focusDirectoryPickerOption(optionIds[index - 1]!)
    else focusDirectoryPickerOption(inputId)
  }
}
