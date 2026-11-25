/** Labels describe source notation without changing renderer or persistence selection. */
export function diagramPresentation(source: string, renderedNotation: 'plantuml' | 'bpmn') {
  if (renderedNotation === 'bpmn') return { caption: 'BPMN process flow', alt: 'BPMN process diagram' }
  const explicit = /tectona-view:\s*([\w-]+)/i.exec(source)?.[1]?.toLowerCase()
  let kind = 'PlantUML'
  if (explicit === 'archimate' || /!include\s*<\s*archimate\//i.test(source)) kind = 'ArchiMate'
  else if (explicit === 'c4' || /!include\s*<\s*C4\//i.test(source)) kind = 'C4'
  else if (explicit === 'use-case' || /^\s*usecase\b/im.test(source)) kind = 'Use Case'
  else if (explicit === 'erd' || /^\s*entity\b/im.test(source)) kind = 'ERD'
  else if (explicit === 'class' || /^\s*(?:class|interface|enum)\b/im.test(source)) kind = 'Class'
  else if (explicit === 'sequence' || /^\s*participant\b/im.test(source)) kind = 'Sequence'
  return { caption: `${kind} diagram`, alt: `${kind} diagram` }
}

export function diagramSourceDescription(source: string): string {
  const language = /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|mindmap)\b/m.test(source) ? 'Mermaid' : /^\s*@startuml/m.test(source) ? 'PlantUML' : 'Diagram'
  return `${language} source is in the clipboard.`
}
