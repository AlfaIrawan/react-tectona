import { useEffect, useRef, useState } from 'react'

/** At most this many ticks: a long reply reveals several words per tick (~2.5 s in total). */
export const TYPING_MAX_TICKS = 70
export const TYPING_TICK_MS = 36

/**
 * Word-by-word reveal of `typingTarget` (the prose before a diagram), then the full `text`.
 *
 * The callbacks are read through refs on purpose: callers pass inline functions and re-render
 * while typing (job polling, scrolling, timers). As effect dependencies they restarted the
 * reveal from the first word on every render, so a long reply — and the diagram shown only
 * after it — could take very long or never appear.
 */
export function useTypingReveal({
  text,
  typingTarget,
  animate,
  onComplete,
  onProgress,
}: {
  text: string
  typingTarget: string
  animate: boolean
  onComplete?: () => void
  onProgress?: () => void
}): { displayText: string; isTyping: boolean } {
  const [displayText, setDisplayText] = useState(animate ? '' : text)
  const [isTyping, setIsTyping] = useState(animate)
  const onCompleteRef = useRef(onComplete)
  const onProgressRef = useRef(onProgress)
  onCompleteRef.current = onComplete
  onProgressRef.current = onProgress

  useEffect(() => {
    if (!animate) {
      setDisplayText(text)
      setIsTyping(false)
      return
    }
    setDisplayText('')
    setIsTyping(true)
    const tokens = typingTarget.match(/\S+\s*|\s+/g) ?? []
    if (tokens.length === 0) {
      setDisplayText(text)
      setIsTyping(false)
      onCompleteRef.current?.()
      return
    }
    const wordsPerTick = Math.max(1, Math.ceil(tokens.length / TYPING_MAX_TICKS))
    let index = 0
    const timerId = window.setInterval(() => {
      index += wordsPerTick
      if (index >= tokens.length) {
        window.clearInterval(timerId)
        setDisplayText(text)
        setIsTyping(false)
        onCompleteRef.current?.()
        return
      }
      setDisplayText(tokens.slice(0, index).join(''))
      onProgressRef.current?.()
    }, TYPING_TICK_MS)
    return () => window.clearInterval(timerId)
  }, [animate, text, typingTarget])

  return { displayText, isTyping }
}
