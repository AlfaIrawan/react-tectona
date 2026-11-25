import { expect, it } from 'vitest'
import { replaceExtractedTextControls } from './replaceExtractedTextControls'

it.each(['', ' '] as const)('preserves the original ASCII control policy with replacement %j', (replacement) => {
  for (let code = 0; code <= 255; code++) {
    const character = String.fromCharCode(code)
    const isControl = code < 32 || code === 127
    const isLineWhitespace = [9, 10, 13].includes(code)
    expect(replaceExtractedTextControls('a' + character + 'b', replacement))
      .toBe('a' + (isControl && !isLineWhitespace ? replacement : character) + 'b')
    expect(replaceExtractedTextControls(character, replacement, false))
      .toBe(isControl ? replacement : character)
  }
})

it('preserves Unicode and replaces adjacent controls individually', () => {
  expect(replaceExtractedTextControls('A\0\b\u007f\r\n\u00e9\u{1f4c4}', ' '))
    .toBe('A   \r\n\u00e9\u{1f4c4}')
})
