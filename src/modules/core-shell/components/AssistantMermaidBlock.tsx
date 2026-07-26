import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pushGlobalToast } from '@/components/ui/toast'
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

/** Quote flowchart node/edge labels so spaces and & / <> do not break Mermaid. */
function sanitizeMermaidSource(source: string): string {
  let text = source.trim()
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
  return text
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
        title="Salin kode diagram"
        aria-label="Salin kode diagram"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-[#54656f] hover:text-[#111b21] dark:text-[#aebac1] dark:hover:text-[#e9edef]"
        onClick={onFullscreen}
        title="Layar penuh"
        aria-label="Layar penuh"
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
  const viewportRef = useRef<HTMLDivElement>(null)
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
      title: ok ? 'Diagram disalin' : 'Gagal menyalin',
      description: ok ? 'Kode Mermaid ada di clipboard.' : 'Coba lagi dari browser yang mendukung clipboard.',
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
        aria-label="Diagram layar penuh"
      >
        <div className="flex items-center justify-end gap-0.5 border-b border-[#d1d7db]/80 px-2 py-1.5 dark:border-[#3b4a54]">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} title="Perbesar">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))} title="Perkecil">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(1)} title="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleCopy()} title="Salin">
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
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

export function AssistantMermaidBlock({ source, className }: AssistantMermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reactId = useId().replace(/:/g, '')
  const [error, setError] = useState<string | null>(null)
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [previewHeight, setPreviewHeight] = useState<number>(180)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize(MERMAID_INIT)
        // Strip accidental fence markers / trailing prose that break parse.
        const cleaned = source
          .replace(/^\s*```(?:mermaid)?\s*/i, '')
          .replace(/\s*```[\s\S]*$/i, '')
          .trim()
        const safeSource = sanitizeMermaidSource(cleaned)
        const { svg } = await mermaid.render(`mermaid-${reactId}`, safeSource)
        if (cancelled) return
        setSvgHtml(svg)
        setError(null)
      } catch (err) {
        if (!cancelled) {
          setSvgHtml(null)
          setError(err instanceof Error ? err.message : 'Diagram tidak dapat ditampilkan')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reactId, source])

  useEffect(() => {
    if (!svgHtml || !containerRef.current) return
    containerRef.current.innerHTML = svgHtml
    const svg = containerRef.current.querySelector('svg')
    if (!(svg instanceof SVGSVGElement)) return

    const natural = normalizeRenderedSvg(svg)
    const hostWidth = containerRef.current.clientWidth || 480
    const widthScale = hostWidth / natural.width
    const scaledHeight = Math.ceil(natural.height * Math.min(1, widthScale))
    // Fit full diagram height — avoid a capped box that forces a vertical scrollbar.
    setPreviewHeight(Math.max(160, scaledHeight + 24))
  }, [svgHtml])

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(source.trim())
    pushGlobalToast({
      title: ok ? 'Diagram disalin' : 'Gagal menyalin',
      description: ok ? 'Kode Mermaid ada di clipboard.' : 'Coba lagi dari browser yang mendukung clipboard.',
      variant: ok ? 'success' : 'error',
    })
  }, [source])

  if (error) {
    return (
      <pre
        className={cn(
          'my-2 overflow-x-auto rounded-md border border-amber-200/80 bg-amber-50/80 p-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30',
          className,
        )}
      >
        {source}
      </pre>
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
        {svgHtml ? (
          <MermaidToolbar onCopy={() => void handleCopy()} onFullscreen={() => setFullscreenOpen(true)} />
        ) : null}
        <div
          ref={containerRef}
          className={cn(
            'overflow-x-auto overflow-y-hidden p-3 [&_svg]:mx-auto [&_svg]:block',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          )}
          style={{ height: previewHeight }}
          aria-label="Diagram atau chart"
        />
      </div>
      {fullscreenOpen && svgHtml ? (
        <MermaidFullscreenModal svgHtml={svgHtml} source={source} onClose={() => setFullscreenOpen(false)} />
      ) : null}
    </>
  )
}
