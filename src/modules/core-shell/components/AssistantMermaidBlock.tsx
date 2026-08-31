import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pushGlobalToast } from '@/components/ui/toast'
import { buildFlowchartFallbackSvg, rewriteBareMermaidSource } from '@/lib/chat/mermaidFallbackSvg'
import { renderMermaidFlowchartAsBpmnPng } from '@/lib/api/tectonaAgentRuntimeApi'
import { cn } from '@/lib/utils'

type AssistantMermaidBlockProps = {
  source: string
  className?: string
}

const MERMAID_INIT = {
  startOnLoad: false,
  theme: 'neutral' as const,
  securityLevel: 'loose' as const,
  fontFamily: 'inherit',
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis' as const,
    padding: 20,
    nodeSpacing: 55,
    rankSpacing: 72,
  },
  sequence: {
    useMaxWidth: false,
    diagramMarginX: 24,
    diagramMarginY: 16,
    boxMargin: 12,
  },
  themeVariables: {
    fontSize: '14px',
  },
}

type MermaidApi = {
  initialize: (config: typeof MERMAID_INIT) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

let mermaidModulePromise: Promise<MermaidApi> | null = null
let mermaidInitialized = false
let mermaidRenderSeq = 0

async function getMermaid(): Promise<MermaidApi> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((mod) => mod.default as MermaidApi)
  }
  const mermaid = await mermaidModulePromise
  if (!mermaidInitialized) {
    mermaid.initialize(MERMAID_INIT)
    mermaidInitialized = true
  }
  return mermaid
}

function cleanMermaidFence(source: string): string {
  return source
    .replace(/^\s*```(?:mermaid)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/i, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim()
}

/** Quote flowchart node/edge labels so spaces and & / <> do not break Mermaid. */
function sanitizeMermaidSource(source: string): string {
  let text = cleanMermaidFence(source)
  // Common LLM typo: `-->|label|> Next` instead of `-->|label| Next`
  text = text.replace(/(\|[^\n|]+)\|>(\s*[A-Za-z])/g, '$1|$2')

  text = text.replace(/([A-Za-z][\w-]*)\[(?!["\[])([^\]]+)\]/g, (_m, id: string, label: string) => {
    return `${id}["${label.replace(/"/g, "'")}"]`
  })
  text = text.replace(/([A-Za-z][\w-]*)\{(?!")([^}]+)\}/g, (_m, id: string, label: string) => {
    return `${id}{"${label.replace(/"/g, "'")}"}`
  })
  text = text.replace(/([A-Za-z][\w-]*)\((?!")([^)]+)\)/g, (_m, id: string, label: string) => {
    return `${id}("${label.replace(/"/g, "'")}")`
  })
  text = text.replace(/(\|--?)(?!")([^|\n]+)(\|)/g, (_m, left: string, label: string, right: string) => {
    return `${left}"${label.replace(/"/g, "'")}"${right}`
  })
  return rewriteBareMermaidSource(text)
}

function removeStaleMermaidDom(renderId: string) {
  if (typeof document === 'undefined') return
  document.getElementById(renderId)?.remove()
  document.getElementById(`d${renderId}`)?.remove()
  document.querySelectorAll(`body > #${CSS.escape(renderId)}, body > [id="${renderId}"]`).forEach((el) => {
    el.remove()
  })
}

function measureSvgNaturalSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n) && n > 0)) {
      return { width: parts[2], height: parts[3] }
    }
  }
  const width = Number.parseFloat(svg.getAttribute('width') ?? '') || svg.getBoundingClientRect().width
  const height = Number.parseFloat(svg.getAttribute('height') ?? '') || svg.getBoundingClientRect().height
  return {
    width: Math.max(width, 320),
    height: Math.max(height, 160),
  }
}

function normalizeRenderedSvg(svg: SVGSVGElement): { width: number; height: number } {
  svg.removeAttribute('height')
  svg.style.display = 'block'
  svg.style.width = '100%'
  svg.style.height = 'auto'
  svg.style.maxWidth = '100%'
  return measureSvgNaturalSize(svg)
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

type MermaidToolbarProps = {
  onCopy: () => void
  onFullscreen: () => void
}

function MermaidToolbar({ onCopy, onFullscreen }: MermaidToolbarProps) {
  return (
    <div className="absolute right-2 top-2 z-10 flex gap-0.5 rounded-md border border-[#d1d7db]/80 bg-white/95 p-0.5 shadow-sm dark:border-[#3b4a54] dark:bg-[#202c33]/95">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-[#54656f] hover:text-[#111b21] dark:text-[#aebac1] dark:hover:text-[#e9edef]"
        onClick={onCopy}
        title="Copy diagram code"
        aria-label="Copy diagram code"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-[#54656f] hover:text-[#111b21] dark:text-[#aebac1] dark:hover:text-[#e9edef]"
        onClick={onFullscreen}
        title="Fullscreen"
        aria-label="Fullscreen"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

type MermaidFullscreenModalProps = {
  svgHtml: string
  source: string
  onClose: () => void
}

function MermaidFullscreenModal({ svgHtml, source, onClose }: MermaidFullscreenModalProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!canvasRef.current) return
    canvasRef.current.innerHTML = svgHtml
    const svg = canvasRef.current.querySelector('svg')
    if (svg instanceof SVGSVGElement) {
      normalizeRenderedSvg(svg)
    }
  }, [svgHtml])

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(source)
    pushGlobalToast({
      title: ok ? 'Diagram copied' : 'Copy failed',
      description: ok ? 'Mermaid code is in the clipboard.' : 'Try again from a browser that supports clipboard access.',
      variant: ok ? 'success' : 'error',
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-xl border border-[#d1d7db] bg-white shadow-2xl dark:border-[#3b4a54] dark:bg-[#111b21]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Fullscreen diagram"
      >
        <div className="flex items-center justify-end gap-0.5 border-b border-[#d1d7db]/80 px-2 py-1.5 dark:border-[#3b4a54]">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(1)} title="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleCopy()} title="Copy">
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <div
            ref={canvasRef}
            className="mx-auto inline-block min-w-min origin-top [&_svg]:max-w-none"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

async function renderMermaidSvg(source: string, reactId: string): Promise<{ svg: string; viaFallback: boolean }> {
  const safeSource = sanitizeMermaidSource(source)
  if (!safeSource) {
    throw new Error('Diagram is empty')
  }

  try {
    const mermaid = await getMermaid()
    let lastError: unknown = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      mermaidRenderSeq += 1
      const renderId = `mermaid-${reactId}-${mermaidRenderSeq}-${attempt}`
      removeStaleMermaidDom(renderId)
      try {
        const { svg } = await mermaid.render(renderId, safeSource)
        removeStaleMermaidDom(renderId)
        if (!svg?.trim()) throw new Error('SVG is empty')
        return { svg, viaFallback: false }
      } catch (err) {
        lastError = err
        removeStaleMermaidDom(renderId)
        const message = err instanceof Error ? err.message : String(err)
        if (/already exists|duplicate|GetBBox|null/i.test(message) && attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 40 * (attempt + 1)))
          continue
        }
        break
      }
    }
    if (lastError) {
      // Prefer drawable fallback over surfacing parse errors as code.
      const fallback = buildFlowchartFallbackSvg(safeSource) ?? buildFlowchartFallbackSvg(source)
      if (fallback) return { svg: fallback, viaFallback: true }
      throw lastError
    }
  } catch {
    const fallback = buildFlowchartFallbackSvg(safeSource) ?? buildFlowchartFallbackSvg(source)
    if (fallback) return { svg: fallback, viaFallback: true }
  }

  const fallback = buildFlowchartFallbackSvg(safeSource) ?? buildFlowchartFallbackSvg(source)
  if (fallback) return { svg: fallback, viaFallback: true }
  throw new Error('Diagram could not be rendered')
}

export function AssistantMermaidBlock({ source, className }: AssistantMermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reactId = useId().replace(/:/g, '')
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [bpmnUrl, setBpmnUrl] = useState<string | null>(null)
  const [viaFallback, setViaFallback] = useState(false)
  const [previewHeight, setPreviewHeight] = useState<number>(180)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const [isRendering, setIsRendering] = useState(false)
  const [hardError, setHardError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const timer = window.setTimeout(() => {
      void (async () => {
        setIsRendering(true)
        setBpmnUrl(null)
        const looksLikeFlowchart = /\b(flowchart|graph)\s+(TD|TB|LR|RL)\b/i.test(source)
        if (looksLikeFlowchart) {
          try {
            objectUrl = await renderMermaidFlowchartAsBpmnPng(source, 'id')
            if (cancelled) {
              URL.revokeObjectURL(objectUrl)
              return
            }
            setBpmnUrl(objectUrl)
            setSvgHtml(null)
            setViaFallback(false)
            setHardError(null)
            setIsRendering(false)
            return
          } catch {
            if (objectUrl) {
              URL.revokeObjectURL(objectUrl)
              objectUrl = null
            }
          }
        }
        try {
          const result = await renderMermaidSvg(source, reactId)
          if (cancelled) return
          setSvgHtml(result.svg)
          setViaFallback(result.viaFallback)
          setHardError(null)
        } catch (err) {
          if (!cancelled) {
            const fallback = buildFlowchartFallbackSvg(source)
            if (fallback) {
              setSvgHtml(fallback)
              setViaFallback(true)
              setHardError(null)
            } else {
              setSvgHtml(null)
              setHardError(err instanceof Error ? err.message : 'Diagram could not be rendered')
            }
          }
        } finally {
          if (!cancelled) setIsRendering(false)
        }
      })()
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [reactId, source, retryTick])

  useEffect(() => {
    return () => {
      if (bpmnUrl) URL.revokeObjectURL(bpmnUrl)
    }
  }, [bpmnUrl])

  useEffect(() => {
    if (!svgHtml || !containerRef.current) return
    containerRef.current.innerHTML = svgHtml
    const svg = containerRef.current.querySelector('svg')
    if (!(svg instanceof SVGSVGElement)) return

    const natural = normalizeRenderedSvg(svg)
    const hostWidth = containerRef.current.clientWidth || 480
    const widthScale = hostWidth / natural.width
    const scaledHeight = Math.ceil(natural.height * Math.min(1, widthScale))
    setPreviewHeight(Math.max(160, scaledHeight + 24))
  }, [svgHtml])

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(source.trim())
    pushGlobalToast({
      title: ok ? 'Diagram copied' : 'Copy failed',
      description: ok ? 'Mermaid code is in the clipboard.' : 'Try again from a browser that supports clipboard access.',
      variant: ok ? 'success' : 'error',
    })
  }, [source])

  // Only if both Mermaid and SVG fallback fail (rare non-flowchart diagrams).
  if (hardError && !svgHtml && !bpmnUrl) {
    return (
      <div
        className={cn(
          'my-2 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#3b4a54] dark:bg-[#111b21]',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-1.5 dark:border-[#3b4a54]">
          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Diagram not ready yet{isRendering ? '…' : ''}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={isRendering}
            onClick={() => setRetryTick((n) => n + 1)}
          >
            <RotateCcw className={cn('mr-1 h-3 w-3', isRendering && 'animate-spin')} />
            Retry
          </Button>
        </div>
        <div className="flex min-h-[120px] items-center justify-center p-4 text-center text-xs text-slate-500">
          Rebuilding the diagram image…
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'relative my-2 w-full min-w-0 rounded-md border border-[#d1d7db]/80 bg-white dark:border-[#3b4a54] dark:bg-[#111b21]',
          className,
        )}
      >
        {(svgHtml || bpmnUrl) ? (
          <MermaidToolbar onCopy={() => void handleCopy()} onFullscreen={() => setFullscreenOpen(true)} />
        ) : null}
        {bpmnUrl ? (
          <p className="absolute left-2 top-2 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-[#202c33]/90 dark:text-slate-300">
            BPMN 2.0
          </p>
        ) : null}
        {viaFallback && svgHtml && !bpmnUrl ? (
          <p className="absolute left-2 top-2 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-[#202c33]/90 dark:text-slate-300">
            Preview diagram
          </p>
        ) : null}
        {bpmnUrl ? (
          <div className="overflow-x-auto p-3">
            <img
              src={bpmnUrl}
              alt="Diagram proses bisnis BPMN"
              className="mx-auto max-h-[min(70vh,640px)] w-auto max-w-full object-contain"
              onLoad={(event) => {
                const height = event.currentTarget.naturalHeight
                const width = event.currentTarget.naturalWidth
                const host = event.currentTarget.parentElement?.clientWidth || 480
                const scale = width > 0 ? Math.min(1, host / width) : 1
                setPreviewHeight(Math.max(180, Math.ceil(height * scale) + 24))
              }}
            />
          </div>
        ) : (
          <div
            ref={containerRef}
            className={cn(
              'overflow-x-auto overflow-y-hidden p-3 [&_svg]:mx-auto [&_svg]:block',
              '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
              !svgHtml && 'min-h-[120px] animate-pulse bg-slate-50/80 dark:bg-slate-900/40',
            )}
            style={{ height: previewHeight }}
            aria-label="Diagram or chart"
            aria-busy={!svgHtml}
          />
        )}
      </div>
      {fullscreenOpen && bpmnUrl ? (
        <MermaidFullscreenModal
          svgHtml={`<img src="${bpmnUrl}" alt="BPMN" style="max-width:100%;height:auto;display:block;margin:0 auto" />`}
          source={source}
          onClose={() => setFullscreenOpen(false)}
        />
      ) : null}
      {fullscreenOpen && svgHtml && !bpmnUrl ? (
        <MermaidFullscreenModal svgHtml={svgHtml} source={source} onClose={() => setFullscreenOpen(false)} />
      ) : null}
    </>
  )
}
