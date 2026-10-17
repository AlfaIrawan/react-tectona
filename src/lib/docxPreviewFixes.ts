/**
 * docx-preview 0.3.7 maps a table cell's w:textDirection "lrTb" (ordinary horizontal text) to
 * writing-mode: vertical-lr, so such cells render as tall vertical columns. That mapping is the
 * only source of vertical-lr; real vertical text (btLr, tbRl) uses vertical-rl and is kept.
 * Call after renderAsync on the element the document was rendered into.
 */
export function fixDocxPreviewCellDirection(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
    if (cell.style.writingMode === 'vertical-lr') {
      cell.style.removeProperty('writing-mode')
      cell.style.removeProperty('transform')
    }
  })
}
