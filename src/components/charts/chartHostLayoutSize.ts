type LayoutBox = Pick<HTMLElement, 'clientWidth' | 'clientHeight' | 'offsetWidth' | 'offsetHeight'>

/** Use layout dimensions; a bounding rectangle includes the page's visual zoom. */
export function readChartHostLayoutSize(el: LayoutBox): { width: number; height: number } {
  const width = Math.max(0, Math.floor(el.clientWidth || el.offsetWidth))
  const height = Math.max(0, Math.floor(el.clientHeight || el.offsetHeight))
  return { width, height }
}
