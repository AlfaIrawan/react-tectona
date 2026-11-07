import { describe, expect, it } from 'vitest'
import { defaultIntegrationEdgeArrange, defaultIntegrationEdgeTextStyle, defaultIntegrationEdgeVisual, resolveEdgeVisual } from './integrationEdgeAppearance'
import { edgeInteractionPermissions, edgeLabelContentStyle, edgeMarkerStyle, safeDiagramEdgeLabelHtml } from './diagramEdgePresentation'

describe('edge presentation property effects', () => {
  it('honors explicit no-wrap even for a manually sized label', () => {
    expect(edgeLabelContentStyle({ ...defaultIntegrationEdgeTextStyle(), wordWrap: false, boxWidth: 200, boxHeight: 100 })).toMatchObject({ whiteSpace: 'nowrap', overflowWrap: 'normal' })
    expect(edgeLabelContentStyle({ ...defaultIntegrationEdgeTextStyle(), wordWrap: true })).toMatchObject({ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' })
  })
  it.each(['left', 'center', 'right'] as const)('aligns %s inside a full-width text child', align => {
    expect(edgeLabelContentStyle({ ...defaultIntegrationEdgeTextStyle(), align })).toMatchObject({ width: '100%', textAlign: align })
  })
  it('retains basic formatting without scripts, handlers, links or remote resources', () => {
    const html = safeDiagramEdgeLabelHtml('<b>Bold</b><br><i>Italic</i><img src="https://example.com/pixel"><script>alert(1)</script><span onclick="evil()" style="color:red">safe</span><a href="javascript:evil()">link</a>')
    expect(html).toBe('<b>Bold</b><br><i>Italic</i><span>safe</span>link')
  })
  it('hides markers when lines are disabled and separates fill and stroke opacity', () => {
    const visual = { ...defaultIntegrationEdgeVisual(), opacity: 50 }
    const arrange = { ...defaultIntegrationEdgeArrange(), fillOpacity: 20, strokeOpacity: 70 }
    expect(edgeMarkerStyle(visual, arrange)).toMatchObject({ opacity: 0.5, fillOpacity: 0.2, strokeOpacity: 0.7 })
    expect(edgeMarkerStyle({ ...visual, lineEnabled: false }, arrange).opacity).toBe(0)
    expect(edgeMarkerStyle({ ...visual, opacity: 200 }, { ...arrange, fillOpacity: -1 }).fillOpacity).toBe(0)
  })
  it('disables all mutations on read-only canvases', () => {
    expect(edgeInteractionPermissions(false, defaultIntegrationEdgeArrange())).toEqual({ editLabel: false, moveLabel: false, reconnect: false, bend: false })
  })
  it('separates inline editing, moving, bending and dialog permission', () => {
    const arrange = defaultIntegrationEdgeArrange()
    expect(edgeInteractionPermissions(true, { ...arrange, editable: false })).toMatchObject({ editLabel: false, moveLabel: true })
    expect(edgeInteractionPermissions(true, { ...arrange, movable: false })).toEqual({ editLabel: true, moveLabel: false, reconnect: false, bend: false })
    expect(edgeInteractionPermissions(true, { ...arrange, bendable: false, editDialog: false })).toMatchObject({ editLabel: true, reconnect: true, bend: false })
  })
})

describe('UML decoration appearance fallbacks', () => {
  it.each([['triangle', 'block', false], ['diamond', 'diamond', false], ['filled-diamond', 'diamond', true], ['arrow', 'open', false], ['none', 'none', false]])('renders %s in either direction', (decoration, arrow, filled) => {
    expect(resolveEdgeVisual({ data: { sourceDecoration: decoration, targetDecoration: decoration, lineStyle: 'dashed' } })).toMatchObject({ startArrow: arrow, endArrow: arrow, startFill: filled, endFill: filled, lineStyle: 'dashed' })
  })
  it('keeps explicit user visual overrides', () => {
    expect(resolveEdgeVisual({ data: { sourceDecoration: 'diamond', targetDecoration: 'triangle', lineStyle: 'dashed', visual: { startArrow: 'oval', startFill: true, endArrow: 'none', endFill: true, lineStyle: 'solid' } } })).toMatchObject({ startArrow: 'oval', startFill: true, endArrow: 'none', endFill: true, lineStyle: 'solid' })
  })
})
