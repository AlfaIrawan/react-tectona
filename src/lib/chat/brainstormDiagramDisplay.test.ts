import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { splitBrainstormDisplayParts } from './brainstormDiagramDisplay'

const image = '![Diagram](data:image/png;base64,YWJj)'
const processSource = '```mermaid\nflowchart TD\na --> b\n```'
const technical = "```plantuml\n@startuml\n' tectona-view: c4\n@enduml\n```"

describe('mixed brainstorm visibility without verified image/source identity', () => {
  it.each([processSource, technical])('keeps image and independent source: %s', source => {
    expect(splitBrainstormDisplayParts(`${image}\n${source}`).map(part => part.type)).toEqual(['png', source === processSource ? 'mermaid' : 'plantuml'])
  })
  it('preserves multiple sources, images and prose order', () => {
    const parts = splitBrainstormDisplayParts(`Before\n${processSource}\nBetween\n${image}\n${technical}\n${image}\nAfter`)
    expect(parts.map(part => part.type)).toEqual(['prose','mermaid','prose','png','plantuml','png','prose'])
    expect(parts.filter(part => part.type === 'prose').map(part => part.text.trim())).toEqual(['Before','Between','After'])
  })
  it('does not treat matching captions or proximity as proof of duplicate identity', () => {
    const parts = splitBrainstormDisplayParts(`Diagram AS-IS\n${image}\nDiagram AS-IS\n${processSource}`)
    expect(parts.filter(part => part.type !== 'prose').map(part => part.type)).toEqual(['png','mermaid'])
  })
  it.each([['source only', processSource, ['mermaid']], ['image only', image, ['png']], ['empty', '', []]])('retains existing %s behavior', (_name, input, types) => {
    expect(splitBrainstormDisplayParts(input as string).map(part => part.type)).toEqual(types)
  })
  it('leaves malformed images as prose without suppressing valid sources', () => {
    const parts = splitBrainstormDisplayParts(`![bad](data:image/png;base64,@@@)\n${processSource}`)
    expect(parts.map(part => part.type)).toEqual(['prose','mermaid'])
    expect(parts[0]).toEqual({ type: 'prose', text: '![bad](data:image/png;base64,@@@)\n' })
  })
  it('keeps existing BPMN-fence hiding without dropping another diagram', () => {
    expect(splitBrainstormDisplayParts(`Before\n\`\`\`bpmn\n<definitions/>\n\`\`\`\n${image}\n${technical}`).map(part => part.type)).toEqual(['prose','png','plantuml'])
  })
  it('static source check only: prefetch and rendering share splitter; inline image alt is neutral', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/modules/project-management/pages/IdeaBacklogManagementPage.tsx'), 'utf8')
    expect(page).toContain('for (const part of splitBrainstormDisplayParts(text))')
    expect(page).toContain('const parts = splitBrainstormDisplayParts(displayText)')
    const pngBranch = page.slice(page.indexOf("if (part.type === 'png')"), page.indexOf("if (part.type === 'mermaid' || part.type === 'plantuml')", page.indexOf("if (part.type === 'png')")))
    expect(pngBranch).toContain('src={part.src}')
    expect(pngBranch).toContain('alt="Gambar dalam percakapan"')
    expect(pngBranch).not.toContain('BPMN')
  })
})
