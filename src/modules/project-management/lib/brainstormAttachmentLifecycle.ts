export type DiagramAttachment = { dataUrl: string; name: string }
export type AttachmentState = { attachment: DiagramAttachment | null; preparing: string | null; generation: number; error: string }
export function brainstormAttachmentStatus(state: AttachmentState, indonesian: boolean): string {
  if (state.preparing) return `${indonesian ? 'Menyiapkan gambar' : 'Preparing image'}: ${state.preparing}`
  if (state.attachment) return `${indonesian ? 'Terlampir' : 'Attached'}: ${state.attachment.name}`
  return indonesian ? 'Tidak ada gambar terlampir.' : 'No image attached.'
}
type Selection = { scope: number; selection: number }
export type BrainstormRequest = Selection & { request: number; attachment: DiagramAttachment | null }

// Pure state machine: asynchronous work must present its original token before publishing.
export class BrainstormAttachmentLifecycle {
  private scope = 0
  private selection = 0
  private request = 0
  private activeRequest: BrainstormRequest | null = null
  private key: string | null = null
  private alive = true
  state: AttachmentState = { attachment: null, preparing: null, generation: 0, error: '' }

  private readonly publish: (state: AttachmentState) => void
  constructor(publish: (state: AttachmentState) => void = () => {}) { this.publish = publish }
  get busy() { return this.activeRequest !== null }
  private update(state: Omit<AttachmentState, 'generation' | 'error'> & { error?: string }) {
    this.state = { ...state, error: state.error ?? '', generation: this.scope }
    this.publish(this.state)
  }
  bind(key: string | null) {
    if (this.alive && this.key === key) return
    this.alive = true
    this.key = key
    this.reset()
  }
  reset() {
    this.scope++
    this.selection++
    this.activeRequest = null
    this.update({ attachment: null, preparing: null })
  }
  dispose() {
    this.alive = false
    this.scope++
    this.selection++
    this.activeRequest = null
    // Drop owned local state without publishing to an unmounted component.
    this.state = { attachment: null, preparing: null, generation: this.scope, error: '' }
  }
  clear() {
    this.selection++
    this.update({ attachment: null, preparing: null })
  }
  select(name: string): Selection | null {
    if (!this.alive || !this.key || this.activeRequest) return null
    this.selection++
    this.update({ attachment: null, preparing: name })
    return { scope: this.scope, selection: this.selection }
  }
  isSelectionCurrent(token: Selection) {
    return this.alive && token.scope === this.scope && token.selection === this.selection
  }
  resolve(token: Selection, attachment: DiagramAttachment | null, error = '') {
    if (!this.isSelectionCurrent(token)) return false
    this.update({ attachment, preparing: null, error })
    return true
  }
  begin(includeAttachment: boolean, expectedJobId?: string): BrainstormRequest | null {
    if (!this.alive || !this.key || (expectedJobId !== undefined && expectedJobId !== this.key)
      || this.activeRequest || this.state.preparing) return null
    const token = { scope: this.scope, selection: this.selection, request: ++this.request,
      attachment: includeAttachment ? this.state.attachment : null }
    this.activeRequest = token
    if (includeAttachment) this.update({ attachment: null, preparing: null })
    return token
  }
  isRequestCurrent(token: BrainstormRequest) {
    return this.alive && token.scope === this.scope && this.activeRequest === token
  }
  // Server recovery may replace a job ID while continuing this same captured request.
  adopt(token: BrainstormRequest, key: string) {
    if (!this.isRequestCurrent(token)) return false
    this.key = key
    return true
  }
  restore(token: BrainstormRequest) {
    if (!this.isRequestCurrent(token) || !this.isSelectionCurrent(token)) return false
    if (token.attachment) this.update({ attachment: token.attachment, preparing: null })
    return true
  }
  finish(token: BrainstormRequest) {
    if (!this.isRequestCurrent(token)) return false
    this.activeRequest = null
    return true
  }
}
