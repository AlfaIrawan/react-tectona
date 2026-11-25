import DOMPurify from 'dompurify'
import type { CSSProperties } from 'react'
import type { IntegrationEdgeArrangeOptions, IntegrationEdgeTextStyle, IntegrationEdgeVisualStyle } from './integrationArchitectureTypes'

/** Formatting deliberately excludes URLs, embedded resources, styles and event handlers. */
export function safeDiagramEdgeLabelHtml(label: string): string {
  // UML stereotypes are text, not HTML tags. Escape only these known tokens
  // before the unchanged allowlist sanitizer; all other markup stays sanitized.
  const withUmlText = label.replace(/<<\s*(?:include|extend)\s*>>/gi, token => token.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
  return DOMPurify.sanitize(withUmlText, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'br', 'sub', 'sup', 'span', 'p'],
    ALLOWED_ATTR: [], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
  })
}
export function edgeLabelContentStyle(text: Required<IntegrationEdgeTextStyle>): CSSProperties {
  return { width: '100%', minWidth: 0, textAlign: text.align,
    whiteSpace: text.wordWrap ? 'pre-wrap' : 'nowrap', overflowWrap: text.wordWrap ? 'break-word' : 'normal' }
}
export function edgeMarkerStyle(visual: Required<IntegrationEdgeVisualStyle>, arrange: Required<IntegrationEdgeArrangeOptions>): CSSProperties {
  const fraction = (value: number) => Math.max(0, Math.min(100, value)) / 100
  return { opacity: visual.lineEnabled ? fraction(visual.opacity) : 0,
    strokeOpacity: fraction(arrange.strokeOpacity), fillOpacity: fraction(arrange.fillOpacity), pointerEvents: 'none' }
}
export function edgeInteractionPermissions(editableCanvas: boolean, arrange: Required<IntegrationEdgeArrangeOptions>) {
  return { editLabel: editableCanvas && arrange.editable, moveLabel: editableCanvas && arrange.movable,
    reconnect: editableCanvas && arrange.movable, bend: editableCanvas && arrange.movable && arrange.bendable }
}
