/** Text / highlight color helpers for the KB rich-text editor. */

export const KB_TEXT_COLOR_SWATCHES = [
  '#000000',
  '#374151',
  '#6b7280',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ffffff',
] as const

export const KB_HIGHLIGHT_COLOR_SWATCHES = [
  '#fef08a',
  '#fde68a',
  '#fdba74',
  '#fca5a5',
  '#f9a8d4',
  '#c4b5fd',
  '#93c5fd',
  '#6ee7b7',
  '#a3e635',
  '#e5e7eb',
  '#ffffff',
] as const

export function applyKbSelectionTextColor(editor: HTMLElement, color: string): void {
  editor.focus()
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand('foreColor', false, color)
}

export function applyKbSelectionHighlightColor(editor: HTMLElement, color: string | null): void {
  editor.focus()
  document.execCommand('styleWithCSS', false, 'true')
  if (!color) {
    // Clear highlight — browsers vary; try both common commands.
    document.execCommand('hiliteColor', false, 'transparent')
    document.execCommand('backColor', false, 'transparent')
    return
  }
  const ok = document.execCommand('hiliteColor', false, color)
  if (!ok) document.execCommand('backColor', false, color)
}
