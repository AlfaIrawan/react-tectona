export type RectLike = {
  left: number
  right: number
  top: number
  bottom: number
}

export type ContextSubmenuPlacement = {
  left: number
  top: number
  maxHeight: number
}

const DEFAULT_MARGIN = 8
/** Slight overlap keeps the pointer on the submenu when leaving the trigger. */
const DEFAULT_OVERLAP = 4

/**
 * Place a context submenu inside the viewport. Prefer the right of the trigger;
 * flip left, then clamp. Cap height and shift up so the panel is not clipped.
 */
export function computeContextSubmenuPosition(options: {
  trigger: RectLike
  submenuWidth: number
  submenuHeight: number
  viewportWidth: number
  viewportHeight: number
  margin?: number
  overlap?: number
}): ContextSubmenuPlacement {
  const margin = options.margin ?? DEFAULT_MARGIN
  const overlap = options.overlap ?? DEFAULT_OVERLAP
  const { trigger, viewportWidth, viewportHeight } = options
  const width = Math.max(1, options.submenuWidth)
  const availableHeight = Math.max(48, viewportHeight - margin * 2)
  const maxHeight = Math.min(Math.max(1, options.submenuHeight), availableHeight)

  const spaceRight = viewportWidth - margin - trigger.right + overlap
  const spaceLeft = trigger.left - margin + overlap
  const fitsRight = spaceRight >= width
  const fitsLeft = spaceLeft >= width

  let left: number
  if (fitsRight || (!fitsLeft && spaceRight >= spaceLeft)) {
    left = trigger.right - overlap
  } else {
    left = trigger.left + overlap - width
  }

  const maxLeft = Math.max(margin, viewportWidth - margin - width)
  left = Math.min(Math.max(margin, left), maxLeft)

  let top = trigger.top
  if (top + maxHeight > viewportHeight - margin) {
    top = viewportHeight - margin - maxHeight
  }
  if (top < margin) {
    top = margin
  }

  return { left, top, maxHeight }
}
