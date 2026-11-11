import { useEffect, useState } from 'react'
import { EditableDiagramCanvas } from '../../../src/modules/project-management/components/EditableDiagramCanvas'
import { parseUseCaseDiagram } from '../../../src/modules/project-management/lib/useCasePlantUml'
import '../../../src/index.css'

const source = (label: string) => `@startuml\nactor Customer as customer\nusecase "${label}" as order\ncustomer -- order\n@enduml`

export function Fixture() {
  const [key, setKey] = useState('one')
  const [request, setRequest] = useState(0)
  const [received, setReceived] = useState<{ key: string; graph: ReturnType<typeof parseUseCaseDiagram> }>()
  const [finishedRequest, setFinishedRequest] = useState('')
  useEffect(() => {
    if (!request) return
    let active = true
    void fetch(`/fixture-saved-graph?key=${key}&request=${request}`).then(response => response.json()).then((data: { title: string }) => {
      if (active) setReceived({ key, graph: parseUseCaseDiagram(source(data.title)) })
      setFinishedRequest(`${key}:${request}`)
    })
    return () => { active = false }
  }, [key, request])

  return (
    <main className="flex h-screen flex-col">
      <div className="flex flex-wrap gap-3 p-2">
        <button type="button" onClick={() => setRequest(value => value + 1)}>Request saved graph</button>
        <button type="button" onClick={() => setReceived(undefined)}>Withdraw response</button>
        <button type="button" onClick={() => { setKey('two'); setRequest(0); setReceived(undefined) }}>Switch diagram</button>
        <output aria-label="Fixture response">{received?.graph.nodes[1]?.data.title ?? 'Waiting'}</output>
        <output aria-label="Finished fixture request">{finishedRequest}</output>
      </div>
      <div className="min-h-0 flex-1">
        <EditableDiagramCanvas ideaId="fixture" diagramKey={key} format="use-case" editable fillHeight
          source={source(`Source ${key}`)} savedGraph={received?.key === key ? received.graph : undefined} />
      </div>
    </main>
  )
}
