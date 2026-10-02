// @vitest-environment jsdom
import { createElement, useEffect, useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TYPING_MAX_TICKS, TYPING_TICK_MS, useTypingReveal } from './useTypingReveal'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const LONG_PROSE = Array.from({ length: 400 }, (_, i) => `kata${i}`).join(' ')
const TEXT = `${LONG_PROSE}\n\n\`\`\`plantuml\n@startuml\n:A;\n@enduml\n\`\`\``

function Harness({ onDone, onShown }: { onDone: () => void; onShown: (text: string) => void }) {
  // The brainstorm page re-renders constantly while a reply is typed (polling, scroll,
  // timers) and passes a NEW inline onComplete every time.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 10)
    return () => window.clearInterval(id)
  }, [])
  const { displayText, isTyping } = useTypingReveal({
    text: TEXT,
    typingTarget: LONG_PROSE,
    animate: true,
    onComplete: () => onDone(),
  })
  if (!isTyping) onShown(displayText)
  return null
}

describe('useTypingReveal', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('finishes a long reply while the parent keeps re-rendering, within the tick cap', () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onDone = vi.fn()
    let shown = ''
    act(() => {
      root.render(createElement(Harness, { onDone, onShown: (text: string) => { shown = text } }))
    })
    // Small steps, each committed: the parent's re-renders happen between typing ticks.
    for (let elapsed = 0; elapsed < (TYPING_MAX_TICKS + 2) * TYPING_TICK_MS; elapsed += 10) {
      act(() => {
        vi.advanceTimersByTime(10)
      })
    }
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(shown).toContain('```plantuml') // the diagram is shown once typing is done
    act(() => root.unmount())
  })
})
