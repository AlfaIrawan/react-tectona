export function replaceExtractedTextControls(
  text: string,
  replacement: '' | ' ',
  preserveLineWhitespace = true,
): string {
  let result = ''
  let start = 0
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code > 31 && code !== 127) continue
    if (preserveLineWhitespace && (code === 9 || code === 10 || code === 13)) continue
    result += text.slice(start, index) + replacement
    start = index + 1
  }
  return start === 0 ? text : result + text.slice(start)
}
