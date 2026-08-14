import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TEMPLATE_COMPARE_ZOOM_DEFAULT,
  TEMPLATE_COMPARE_ZOOM_MAX,
  TEMPLATE_COMPARE_ZOOM_MIN,
  TEMPLATE_COMPARE_ZOOM_STEP,
} from '@/modules/document-knowledge-management/lib/templateCompareDocxHighlight'

const WORD_FOOTER_BG = '#FAFAFA'
const WORD_FOOTER_BORDER = '#EDEBE9'
const WORD_FOOTER_TEXT = '#605E5C'

export type TemplateCompareFooterDocumentStats = {
  currentPage: number
  pageCount: number
  serverWordCount: number
  uploadWordCount: number
  removedCount: number | null
  addedCount: number | null
}

type TemplateCompareZoomFooterProps = {
  zoom: number
  onZoomChange: (zoom: number) => void
  documentStats: TemplateCompareFooterDocumentStats
  className?: string
}

function clampZoom(value: number): number {
  return Math.min(TEMPLATE_COMPARE_ZOOM_MAX, Math.max(TEMPLATE_COMPARE_ZOOM_MIN, value))
}

function footerButtonClassName(disabled: boolean) {
  return cn(
    'inline-flex h-7 w-7 items-center justify-center rounded border-0 bg-transparent text-[#323130] transition-colors',
    'hover:bg-[#EDEBE9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4]/40',
    disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
  )
}

function formatWordCount(serverWordCount: number, uploadWordCount: number): string {
  if (serverWordCount === uploadWordCount) {
    return `${serverWordCount.toLocaleString()} word${serverWordCount === 1 ? '' : 's'}`
  }
  return `Server ${serverWordCount.toLocaleString()} · Upload ${uploadWordCount.toLocaleString()} words`
}

function FooterStatusItems({ documentStats }: { documentStats: TemplateCompareFooterDocumentStats }) {
  const items: string[] = [
    `Page ${documentStats.currentPage} of ${documentStats.pageCount}`,
    formatWordCount(documentStats.serverWordCount, documentStats.uploadWordCount),
  ]

  if (documentStats.removedCount != null && documentStats.addedCount != null) {
    items.push(`${documentStats.removedCount} removed · ${documentStats.addedCount} added`)
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#605E5C]">
      {items.map((item) => (
        <span key={item} className="whitespace-nowrap">
          {item}
        </span>
      ))}
    </div>
  )
}

const TEMPLATE_COMPARE_ZOOM_INPUT_ID = 'template-compare-zoom-level'

function CompareZoomSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <>
      <style>{`
        .compare-zoom-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 28px;
          margin: 0;
          background: transparent;
          cursor: pointer;
        }
        .compare-zoom-slider:focus-visible {
          outline: none;
        }
        .compare-zoom-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.35), 0 1px 2px rgba(0, 0, 0, 0.12);
        }
        .compare-zoom-slider::-webkit-slider-runnable-track {
          height: 2px;
          background: transparent;
          border: none;
        }
        .compare-zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          margin-top: -4px;
          border-radius: 9999px;
          background: #ffffff;
          border: 1px solid #8a8886;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
        }
        .compare-zoom-slider::-moz-range-track {
          height: 2px;
          background: transparent;
          border: none;
        }
        .compare-zoom-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #ffffff;
          border: 1px solid #8a8886;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
        }
      `}</style>

      <div className="relative flex h-7 w-24 items-center sm:w-32">
        <label htmlFor={TEMPLATE_COMPARE_ZOOM_INPUT_ID} className="sr-only">
          Zoom level
        </label>
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[#C8C6C4]"
          aria-hidden
        />
        <input
          id={TEMPLATE_COMPARE_ZOOM_INPUT_ID}
          name={TEMPLATE_COMPARE_ZOOM_INPUT_ID}
          type="range"
          min={TEMPLATE_COMPARE_ZOOM_MIN}
          max={TEMPLATE_COMPARE_ZOOM_MAX}
          step={TEMPLATE_COMPARE_ZOOM_STEP}
          value={value}
          className="compare-zoom-slider relative z-[1]"
          onChange={(event) => onChange(clampZoom(Number(event.target.value)))}
        />
      </div>
    </>
  )
}

export function TemplateCompareZoomFooter({
  zoom,
  onZoomChange,
  documentStats,
  className,
}: TemplateCompareZoomFooterProps) {
  const zoomPercent = Math.round(zoom * 100)
  const atMin = zoom <= TEMPLATE_COMPARE_ZOOM_MIN + 0.001
  const atMax = zoom >= TEMPLATE_COMPARE_ZOOM_MAX - 0.001
  const atDefault = Math.abs(zoom - TEMPLATE_COMPARE_ZOOM_DEFAULT) < 0.001

  return (
    <div
      className={cn('flex shrink-0 items-center justify-between gap-4 border-t px-4 py-1.5', className)}
      style={{
        backgroundColor: WORD_FOOTER_BG,
        borderColor: WORD_FOOTER_BORDER,
        color: WORD_FOOTER_TEXT,
      }}
    >
      <FooterStatusItems documentStats={documentStats} />

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className={footerButtonClassName(atMin)}
          aria-label="Zoom out"
          disabled={atMin}
          onClick={() => onZoomChange(clampZoom(zoom - TEMPLATE_COMPARE_ZOOM_STEP))}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </button>

        <CompareZoomSlider value={zoom} onChange={onZoomChange} />

        <button
          type="button"
          className={footerButtonClassName(atMax)}
          aria-label="Zoom in"
          disabled={atMax}
          onClick={() => onZoomChange(clampZoom(zoom + TEMPLATE_COMPARE_ZOOM_STEP))}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>

        <span className="min-w-[2.75rem] text-right text-[11px] font-medium tabular-nums text-[#323130]">
          {zoomPercent}%
        </span>

        <button
          type="button"
          className={cn(
            'rounded px-2 py-1 text-[11px] font-medium text-[#323130] transition-colors',
            'hover:bg-[#EDEBE9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4]/40',
            atDefault && 'bg-[#EDEBE9]/80',
          )}
          onClick={() => onZoomChange(TEMPLATE_COMPARE_ZOOM_DEFAULT)}
        >
          Fit width
        </button>
      </div>
    </div>
  )
}
