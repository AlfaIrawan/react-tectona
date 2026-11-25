export function resizeBrainstormComposer(element: HTMLTextAreaElement, mobile: boolean): void {
  const limit = mobile ? 96 : 200
  element.style.minHeight = '24px'
  element.style.height = '24px'
  element.style.overflowY = 'hidden'
  if (!element.value.trim()) return
  const contentHeight = element.scrollHeight
  element.style.height = `${Math.min(Math.max(contentHeight, 24), limit)}px`
  element.style.overflowY = contentHeight > limit ? 'auto' : 'hidden'
}
