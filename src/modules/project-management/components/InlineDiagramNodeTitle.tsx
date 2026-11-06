import { useRef, useState, type KeyboardEvent } from 'react'
import { useReactFlow, useStore } from 'reactflow'

/** Keep a node's identifier stable while editing the visible label directly. */
export function InlineDiagramNodeTitle({ nodeId, value, multiline = false }: { nodeId: string; value: string; multiline?: boolean }) {
  const { setNodes } = useReactFlow()
  const editable = useStore(state => state.elementsSelectable)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const active = useRef(false)
  const finish = (commit: boolean) => {
    if (!active.current) return
    active.current = false
    setEditing(false)
    const title = draft.trim()
    if (!commit || !title || title === value) return
    setNodes(nodes => nodes.map(node => node.id === nodeId ? { ...node, data: { ...node.data, title } } : node))
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); finish(false) }
    if (event.key === 'Enter' && !(multiline && event.shiftKey)) { event.preventDefault(); finish(true) }
  }
  if (!editing) return <span className="contents" onDoubleClick={event => {
    if (!editable) return
    event.stopPropagation()
    setDraft(value)
    active.current = true
    setEditing(true)
  }}>{value}</span>
  const props = {
    value: draft, autoFocus: true, 'aria-label': 'Edit node title',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => event.currentTarget.select(),
    onBlur: () => finish(true), onKeyDown: keyDown,
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
    className: 'nodrag nopan w-full min-w-0 resize-none rounded bg-white/95 px-1 text-center text-inherit outline-none ring-1 ring-sky-500',
    style: { font: 'inherit', letterSpacing: 'inherit' },
  }
  return multiline ? <textarea {...props} rows={2} /> : <input {...props} />
}
