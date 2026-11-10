import type { IdeaDraftBrainstormMessage } from '@/lib/api/tectonaAgentRuntimeApi'

// Synchronous presentation consistency only. Typed backend approval is authoritative.
// No declared browser-safe synchronous SHA-256 dependency exists in this application.
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
const rotate = (v: number, n: number) => (v >>> n) | (v << (32 - n))
function validString(value: unknown, max: number): value is string {
  if (typeof value !== 'string' || value.length > max) return false
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false
  }
  return true
}

export function uploadDigest(value: string): string | null {
  if (!validString(value, 80000)) return null
  const bytes = new TextEncoder().encode(value)
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64)
  padded.set(bytes); padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, bytes.length * 8, false)
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
  const w = new Int32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2]
      w[i] = (rotate(a,7) ^ rotate(a,18) ^ (a >>> 3)) + w[i - 16]
        + (rotate(b,17) ^ rotate(b,19) ^ (b >>> 10)) + w[i - 7]
    }
    let [a,b,c,d,e,f,g,h] = hash
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const t2 = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0
    }
    for (const [i,v] of [a,b,c,d,e,f,g,h].entries()) hash[i] = (hash[i] + v) | 0
  }
  return hash.map(v => (v >>> 0).toString(16).padStart(8,'0')).join('')
}

type Proposal = NonNullable<IdeaDraftBrainstormMessage['upload_review_proposal']>
export type UploadProjectionEvent = { kind: 'pending' | 'approved' | 'cancel'; lane: 'as_is' | 'to_be'; source: string; id: string }
const hashPattern = /^[a-f0-9]{64}$/
export const hasUploadReviewMetadata = (m: IdeaDraftBrainstormMessage) =>
  Boolean(m.upload_review_status || m.upload_review_id || m.upload_review_proposal)

function shownProposal(message: IdeaDraftBrainstormMessage, index: number): Proposal | null {
  const p = message.upload_review_proposal
  if (!p || message.role !== 'assistant' || message.upload_review_status !== 'pending' || message.evidence_pending !== true
    || p.assistant_turn !== index || !Number.isSafeInteger(p.assistant_turn) || p.proposal_id !== message.upload_review_id
    || !['as_is','to_be'].includes(p.lane) || !validString(p.item_id,320) || !p.item_id
    || !validString(p.reading,12000) || !p.reading || !validString(p.diagram_block,9000) || !p.diagram_block
    || !validString(message.text,30000) || ![p.proposal_id,p.assistant_digest,p.image_digest,p.target_evidence_digest].every(v => typeof v === 'string' && hashPattern.test(v))) return null
  if (uploadDigest(message.text) !== p.assistant_digest || !message.text.includes(p.reading) || !message.text.includes(p.diagram_block)) return null
  // Backend json.dumps([...], ensure_ascii=False): comma-space separators, no normalization.
  const identity = '[' + [p.lane,p.item_id,p.reading,p.diagram_block,p.image_digest,p.assistant_turn,p.target_evidence_digest].map(v => JSON.stringify(v)).join(', ') + ']'
  if (uploadDigest(identity) !== p.proposal_id || !/^```plantuml\n@startuml\n[\s\S]+\n@enduml\n```$/.test(p.diagram_block)) return null
  return p
}

/** Immutable shown proposal plus consecutive typed backend approval pair, never prose approval. */
export function uploadReviewEvents(messages: IdeaDraftBrainstormMessage[] = []): Map<number, UploadProjectionEvent[]> {
  const events = new Map<number, UploadProjectionEvent[]>()
  let active: Proposal | null = null
  const seen = new Set<string>()
  const emit = (i: number, kind: UploadProjectionEvent['kind'], p: Proposal) => {
    const source = p.diagram_block.slice('```plantuml\n'.length, -4).trim()
    events.set(i, [...(events.get(i) ?? []), {kind,lane:p.lane,source,id:p.proposal_id}])
  }
  const cancel = (i: number) => { if (active) emit(i,'cancel',active); active=null }
  messages.forEach((m,i) => {
    if (active && m.invalidated_process_lanes?.includes(active.lane)) cancel(i)
    const proposal = shownProposal(m,i)
    if (proposal) {
      cancel(i)
      if (!seen.has(proposal.proposal_id)) { active=proposal; seen.add(proposal.proposal_id); emit(i,'pending',proposal) }
      return
    }
    if (!active) return
    if (m.upload_review_status==='clarify' && m.upload_review_id===active.proposal_id) return
    if (m.upload_review_status==='approved' && m.upload_review_id===active.proposal_id && m.evidence_pending===false) {
      if (m.role==='user') return
      const previous=messages[i-1]
      if (previous?.role==='user' && previous.upload_review_status==='approved'
        && previous.upload_review_id===active.proposal_id && previous.evidence_pending===false) {
        emit(i,'approved',active); active=null; return
      }
    }
    cancel(i)
  })
  return events
}
