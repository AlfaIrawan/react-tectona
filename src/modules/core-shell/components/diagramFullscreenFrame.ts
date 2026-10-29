export type FrameSize = { width: number; height: number }

/** Whole diagram at zoom 1. A small image stays at its natural size; a wide one shrinks to the viewer. */
export function fittedDiagramSize(natural: FrameSize, viewport: FrameSize, zoom: number): FrameSize | null {
  if (natural.width <= 0 || natural.height <= 0 || zoom <= 0) return null
  const fit =
    viewport.width > 0 && viewport.height > 0
      ? Math.min(viewport.width / natural.width, viewport.height / natural.height)
      : 1
  const scale = Math.min(fit, 1) * zoom
  return { width: natural.width * scale, height: natural.height * scale }
}

/**
 * The scroll box has to be at least as large as the scaled diagram.
 * Centering an image inside a smaller box pushes the edges outside the scroll range, so zooming crops them.
 */
export function diagramScrollSurface(display: FrameSize, viewport: FrameSize): FrameSize {
  return {
    width: Math.max(display.width, viewport.width, 0),
    height: Math.max(display.height, viewport.height, 0),
  }
}
