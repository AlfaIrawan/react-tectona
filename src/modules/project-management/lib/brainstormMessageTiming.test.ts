import { describe, expect, it } from 'vitest'
import { brainstormMessageSnapshot, mergeBrainstormUiMessages, type BrainstormUiMessage } from './brainstormMessageTiming'

const first = '2026-11-07T09:54:40.000Z'
const last = '2026-11-07T10:06:47.000Z'
const now = '2026-11-07T10:11:24.000Z'
const saved: BrainstormUiMessage[] = [
  { role: 'assistant', text: 'Apa tujuannya?', respondedAt: first },
  { role: 'user', text: 'Helpdesk', sentAt: '2026-11-07T10:06:00.000Z' },
  { role: 'assistant', text: 'Konfirmasi tujuan.', respondedAt: last },
]
const withoutTiming = (messages: BrainstormUiMessage[]) => messages.map(message => {
  const result = { ...message }
  delete result.sentAt
  delete result.respondedAt
  return result
})

describe('brainstorm message timing', () => {
  it('restores separate genuine receipt times from the saved snapshot', () => {
    const restored = mergeBrainstormUiMessages(saved, withoutTiming(saved))
    expect(restored.map(message => message.respondedAt)).toEqual([first, undefined, last])
    expect(restored[1].sentAt).toBe(saved[1].sentAt)
  })
  it('does not fabricate unknown legacy times from the time history was loaded', () => {
    expect(mergeBrainstormUiMessages([], withoutTiming(saved), now).every(message => !message.respondedAt && !message.sentAt)).toBe(true)
  })
  it('preserves incoming valid metadata even with no prior local snapshot', () => {
    expect(mergeBrainstormUiMessages([], saved).map(message => message.respondedAt)).toEqual([first, undefined, last])
  })
  it('timestamps only a newly received suffix, leaving unknown older replies unknown', () => {
    const previous: BrainstormUiMessage[] = [...withoutTiming(saved), { role: 'user', text: 'Ya', sentAt: last }]
    const incoming: BrainstormUiMessage[] = [...withoutTiming(previous), { role: 'assistant', text: 'Berikutnya?' }]
    const merged = mergeBrainstormUiMessages(previous, incoming, now)
    expect(merged[0].respondedAt).toBeUndefined()
    expect(merged[2].respondedAt).toBeUndefined()
    expect(merged[4].respondedAt).toBe(now)
  })
  it('does not conflate identical replies at different positions', () => {
    const repeated = saved.map(message => message.role === 'assistant' ? { ...message, text: 'Sudah dicatat.' } : message)
    expect(mergeBrainstormUiMessages(repeated, withoutTiming(repeated)).map(message => message.respondedAt)).toEqual([first, undefined, last])
  })
  it('aligns a saved tail with full server history without relabeling older messages', () => {
    const incoming: BrainstormUiMessage[] = [{ role: 'user', text: 'Pembuka' }, ...withoutTiming(saved)]
    const result = mergeBrainstormUiMessages(saved, incoming)
    expect(result[0].sentAt).toBeUndefined()
    expect(result[1].respondedAt).toBe(first)
    expect(result[3].respondedAt).toBe(last)
  })
  it('does not transfer timing into an ambiguous repeated transcript', () => {
    const prior: BrainstormUiMessage[] = [{ role: 'assistant', text: 'Sama', respondedAt: first }]
    expect(mergeBrainstormUiMessages(prior, [{ role: 'assistant', text: 'Sama' }, { role: 'assistant', text: 'Sama' }]).every(message => !message.respondedAt)).toBe(true)
  })
  it('keeps genuine timing in JSON snapshots while dropping image previews', () => {
    const snapshot = JSON.parse(JSON.stringify(brainstormMessageSnapshot(saved.map(message => ({ ...message, imagePreview: 'data:image/png;base64,local' })))))
    expect(snapshot).toEqual(saved)
    expect(mergeBrainstormUiMessages(snapshot, withoutTiming(saved))[2].respondedAt).toBe(last)
  })
  it('rejects invalid dates and does not copy timing to corrected suffixes', () => {
    const incoming: BrainstormUiMessage[] = [saved[0], { role: 'user', text: 'Revised' }, { role: 'assistant', text: 'New answer', respondedAt: 'invalid' }]
    const merged = mergeBrainstormUiMessages(saved, incoming)
    expect(merged[0].respondedAt).toBe(first)
    expect(merged[1].sentAt).toBeUndefined()
    expect(merged[2].respondedAt).toBeUndefined()
  })
})
