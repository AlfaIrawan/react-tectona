import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlantUmlSourceEditor } from './PlantUmlSourceEditor'
import { usePlantUmlPngPreview } from '../lib/usePlantUmlPngPreview'
import { fetchPlantUmlPng } from '../lib/plantumlRenderClient'
import type { C4CanvasGraph } from '../lib/c4ArchitectureService'

export function EditableSequenceDiagram({ source, locked, ideaId, diagramKey, onSave, savedPngBase64 }: {
  source: string; locked: boolean; ideaId: string; diagramKey: string; onSave?: (graph: C4CanvasGraph) => void; savedPngBase64?: string
}) {
  const [draft, setDraft] = useState(source)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedImage = draft === source && savedPngBase64 ? `data:image/png;base64,${savedPngBase64}` : null
  const preview = usePlantUmlPngPreview(savedImage ? null : draft)
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
      onSave({ nodes: [], edges: [], source: draft, canvasPngBase64: encoded })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sequence could not be saved.')
    } finally { setSaving(false) }
  }
  return <div className="flex h-full min-h-0 flex-col gap-2 p-3">
    {!locked && <>
      <fieldset disabled={saving} className="h-48 shrink-0 overflow-auto rounded-md border">
        <PlantUmlSourceEditor value={draft} onBlur={() => undefined} onChange={value => {
          setDraft(value)
          window.dispatchEvent(new CustomEvent('tectona-diagram-content-pending', { detail: { ideaId, diagramKey } }))
        }} />
      </fieldset>
      <Button className="self-end" onClick={() => void save()} disabled={saving || !draft.trim() || !onSave}>
        <Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save'}
      </Button>
    </>}
    {(error || preview.error) && <p role="alert" className="text-sm text-destructive">{error || preview.error}</p>}
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      {(savedImage || preview.objectUrl) && <img src={savedImage || preview.objectUrl!} alt="Sequence" className="mx-auto max-w-full" />}
    </div>
  </div>
}
