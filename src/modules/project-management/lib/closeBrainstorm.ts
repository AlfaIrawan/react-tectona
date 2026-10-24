type CloseToast = {
  title: string
  description: string
  variant: 'info' | 'error' | 'success'
}

/** Closing is a saved pause, never a cancellation or a draft-generation request. */
export function closeBrainstorm({ busy, save, close, notify }: {
  busy: boolean
  save: () => boolean
  close: () => void
  notify: (toast: CloseToast) => void
}): boolean {
  if (busy) {
    notify({
      title: 'Please wait',
      description: 'Wait for the current request to finish before closing the brainstorm.',
      variant: 'info',
    })
    return false
  }
  let saved = false
  try {
    saved = save()
  } catch {
    // Keep the conversation open even when browser storage is unavailable.
  }
  if (!saved) {
    notify({
      title: 'Could not save brainstorm',
      description: 'Your conversation is still open. Use Retry save or try closing it again.',
      variant: 'error',
    })
    return false
  }
  close()
  notify({
    title: 'Brainstorm saved',
    description: 'You can continue it anytime from the Chat panel.',
    variant: 'success',
  })
  return true
}
