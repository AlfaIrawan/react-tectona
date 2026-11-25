import { useLayoutEffect, useRef, useState } from 'react'
import { BrainstormAttachmentLifecycle, type AttachmentState } from './brainstormAttachmentLifecycle'

export function useBrainstormAttachment(jobId: string | null, open: boolean) {
  const [state, setState] = useState<AttachmentState>({ attachment: null, preparing: null, generation: 0, error: '' })
  const ref = useRef<BrainstormAttachmentLifecycle | null>(null)
  if (!ref.current) ref.current = new BrainstormAttachmentLifecycle(setState)
  const lifecycle = ref.current
  useLayoutEffect(() => {
    lifecycle.bind(open ? jobId : null)
  }, [lifecycle, jobId, open])
  useLayoutEffect(() => () => lifecycle.dispose(), [lifecycle])
  return { ...state, lifecycle }
}
