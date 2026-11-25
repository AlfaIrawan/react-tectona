import { useEffect, useRef, useState } from 'react'
import { Code2, Plus, Save, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlantUmlSourceEditor } from './PlantUmlSourceEditor'
import { usePlantUmlPngPreview } from '../lib/usePlantUmlPngPreview'
import { fetchPlantUmlPng } from '../lib/plantumlRenderClient'
import { insertSequenceNotation, isSequenceDeclaration, sequenceNotations, sequenceParticipants, type SequenceNotation } from '../lib/sequenceNotation'
import type { C4CanvasGraph } from '../lib/c4ArchitectureService'

type SequenceProps = {
  source: string; locked: boolean; ideaId: string; diagramKey: string; onSave?: (graph: C4CanvasGraph) => void; savedPngBase64?: string
}

export function EditableSequenceDiagram(props: SequenceProps) {
  // A different document or authoritative saved source must never inherit another draft.
  return <SequenceWorkspace key={JSON.stringify([props.ideaId, props.diagramKey, props.source])} {...props} />
}

function SequenceWorkspace({ source, locked, ideaId, diagramKey, onSave, savedPngBase64 }: SequenceProps) {
  const active = useRef(true)
  const lockedRef = useRef(locked)
  useEffect(() => { lockedRef.current = locked }, [locked])
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const [draft, setDraft] = useState(source)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(true)
  const [zoom, setZoom] = useState<number | null>(null)
  const [naturalWidth, setNaturalWidth] = useState(0)
  const [notation, setNotation] = useState<SequenceNotation>('sync')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [label, setLabel] = useState('')
  const participants = sequenceParticipants(draft)
  const sender = participants.includes(from) ? from : participants[0] ?? ''
  const receiver = participants.includes(to) ? to : participants[1] ?? sender
  const declaration = isSequenceDeclaration(notation)
  const savedImage = draft === source && savedPngBase64 ? `data:image/png;base64,${savedPngBase64}` : null
  const preview = usePlantUmlPngPreview(savedImage ? null : draft)
  const image = savedImage || (!preview.isLoading && !preview.error ? preview.objectUrl : null)
  const changeDraft = (value: string) => {
    setDraft(value)
    setError(null)
    window.dispatchEvent(new CustomEvent('tectona-diagram-content-pending', { detail: { ideaId, diagramKey } }))
  }
  const save = async () => {
    if (locked || saving || !onSave) return
    setSaving(true)
    setError(null)
    try {
      let encoded = draft === source ? savedPngBase64 : undefined
      if (!encoded) {
        const blob = await fetchPlantUmlPng(draft)
        encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('SEQUENCE_IMAGE_READ_FAILED'))
          reader.readAsDataURL(blob)
        })
      }
      if (!active.current || lockedRef.current) return
      await onSave({ nodes: [], edges: [], source: draft, canvasPngBase64: encoded })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sequence could not be saved.')
    } finally { setSaving(false) }
  }
  const fieldClass = 'h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs'
  return <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
      <div className="mr-auto"><div className="text-sm font-semibold">Sequence diagram</div><p className="text-xs text-muted-foreground">{locked ? 'Read-only preview' : 'Insert notation, then edit its PlantUML source.'}</p></div>
      {!locked && <Button variant="outline" size="sm" aria-expanded={showSource} onClick={() => setShowSource(value => !value)}><Code2 className="mr-1 h-4 w-4" />{showSource ? 'Hide source' : 'Show source'}</Button>}
      {!locked && <Button size="sm" onClick={() => void save()} disabled={saving || !draft.trim() || !onSave}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save'}</Button>}
    </div>
    {!locked && <fieldset disabled={saving} className="flex flex-wrap items-center gap-2 border-b p-3">
      <select aria-label="Sequence notation" className={fieldClass} value={notation} onChange={event => setNotation(event.target.value as SequenceNotation)}>{sequenceNotations.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>
      {!declaration && <>
        <select aria-label="From participant" className={fieldClass} value={sender} onChange={event => setFrom(event.target.value)}>{participants.length ? participants.map(id => <option key={id}>{id}</option>) : <option value="">Add a participant first</option>}</select>
        {!['self', 'note', 'create'].includes(notation) && <select aria-label="To participant" className={fieldClass} value={receiver} onChange={event => setTo(event.target.value)}>{participants.map(id => <option key={id}>{id}</option>)}</select>}
      </>}
      <input aria-label="Notation label" className={`${fieldClass} flex-1`} placeholder={declaration || notation === 'create' ? 'Participant name' : ['alt', 'opt', 'loop', 'par', 'critical', 'break'].includes(notation) ? 'Condition or guard' : 'Message or note'} value={label} onChange={event => setLabel(event.target.value)} />
      <Button variant="outline" size="sm" disabled={!declaration && !participants.length} onClick={() => { changeDraft(insertSequenceNotation(draft, notation, sender, receiver, label || (declaration ? 'New participant' : 'Message'))); setShowSource(true) }}><Plus className="mr-1 h-4 w-4" />Insert notation</Button>
    </fieldset>}
    {(error || preview.error) && <p role="alert" className="border-b bg-destructive/5 px-3 py-2 text-sm text-destructive">{error || preview.error}</p>}
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {!locked && showSource && <fieldset disabled={saving} className="flex h-56 min-h-0 shrink-0 flex-col overflow-hidden border-b lg:h-auto lg:w-[38%] lg:min-w-72 lg:resize-x lg:border-b-0 lg:border-r"><PlantUmlSourceEditor value={draft} onBlur={() => undefined} onChange={changeDraft} languageLabel="Sequence PlantUML" /></fieldset>}
      <section aria-label="Sequence preview" className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/20">
        <div className="flex items-center gap-1 border-b px-3 py-1.5 text-xs text-muted-foreground">
          <span role="status" className="mr-auto">{preview.isLoading && !savedImage ? 'Rendering preview...' : draft !== source ? 'Unsaved changes' : 'Preview'}</span>
          <Button variant="ghost" size="sm" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(25, (value ?? 100) - 25))}><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-10 text-center">{zoom === null ? 'Fit' : `${zoom}%`}</span>
          <Button variant="ghost" size="sm" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(300, (value ?? 100) + 25))}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setZoom(null)}>Fit</Button>
          <Button variant="ghost" size="sm" onClick={() => setZoom(100)}>100%</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6" aria-busy={preview.isLoading && !savedImage}>
          {image ? <img src={image} alt="Sequence diagram preview" onLoad={event => setNaturalWidth(event.currentTarget.naturalWidth)} className="mx-auto rounded-sm bg-white shadow-sm" style={{ maxWidth: zoom === null ? '100%' : 'none', width: zoom !== null && naturalWidth ? naturalWidth * zoom / 100 : undefined }} /> : <p className="py-12 text-center text-sm text-muted-foreground">{preview.isLoading ? 'Rendering your sequence diagram...' : preview.error ? 'Preview unavailable. Check the source or render service.' : 'Add participants and messages to begin.'}</p>}
        </div>
      </section>
    </div>
  </div>
}
