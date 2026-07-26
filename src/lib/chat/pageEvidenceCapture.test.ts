import { describe, expect, it } from 'vitest'
import {
  buildDynamicUiSurfaceNotes,
  buildEvidenceFocusCandidates,
  extractUserMessageFocusTerms,
} from './pageEvidenceCapture'

describe('extractUserMessageFocusTerms', () => {
  it('pulls focus phrase from status explanation question', () => {
    const terms = extractUserMessageFocusTerms('Jelaskan arti status At Risk?')
    expect(terms.some((t) => t.includes('at risk'))).toBe(true)
  })
})

describe('buildEvidenceFocusCandidates', () => {
  it('prefers user topic over page title', () => {
    const candidates = buildEvidenceFocusCandidates('Jelaskan arti status At Risk?', {
      pathname: '/workspace-management',
      module_label: 'Workspace Management',
      page_title: 'Workspace Management',
      view_label: 'Directory',
    })
    expect(candidates.some((c) => c.includes('at risk'))).toBe(true)
    expect(candidates).not.toContain('workspace management')
  })
})

describe('buildDynamicUiSurfaceNotes', () => {
  it('returns live DOM notes without hardcoded topic templates', () => {
    document.body.innerHTML = `
      <div data-chat-evidence-root>
        <section data-chat-evidence-region="workspace-kpi-strip">
          <div class="card"><span>At Risk</span><span>0</span></div>
        </section>
        <div data-chat-evidence-region="workspace-status-filters">
          <button type="button"><span>At Risk</span><span>0</span></button>
        </div>
      </div>
    `

    const regions = document.querySelectorAll('[data-chat-evidence-region]')
    regions.forEach((node, index) => {
      const el = node as HTMLElement
      el.getBoundingClientRect = () => new DOMRect(0, index * 140, 400, 120)
      for (const child of el.querySelectorAll('span,button,div')) {
        ;(child as HTMLElement).getBoundingClientRect = () => new DOMRect(0, index * 140, 200, 40)
      }
    })
    const root = document.querySelector('[data-chat-evidence-root]') as HTMLElement
    root.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600)

    const notes = buildDynamicUiSurfaceNotes('Jelaskan arti status At Risk?')
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.some((n) => n.startsWith('ui_label_match:'))).toBe(true)
    expect(notes.some((n) => n.startsWith('ui_label_match_count:'))).toBe(true)
    expect(notes.join(' ')).not.toMatch(/jelaskan|WAJIB/i)
  })
})
