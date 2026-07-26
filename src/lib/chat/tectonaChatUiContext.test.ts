import { describe, expect, it, afterEach } from 'vitest'
import { buildTectonaUiContextForChat, resolveTectonaUiContext } from './tectonaChatUiContext'
import { useTectonaPageContextStore } from '@/stores/tectona-page-context-store'

describe('resolveTectonaUiContext', () => {
  it('maps idea backlog list route', () => {
    const ctx = resolveTectonaUiContext('/idea-backlog')
    expect(ctx.module_label).toBe('Idea & Backlog')
    expect(ctx.page_title).toBe('Idea & Backlog')
    expect(ctx.pathname).toBe('/idea-backlog')
  })

  it('maps idea detail route with entity id', () => {
    const ctx = resolveTectonaUiContext('/idea-backlog/abc-123')
    expect(ctx.module_label).toBe('Idea & Backlog')
    expect(ctx.page_title).toBe('Detail Ide')
    expect(ctx.entity_type).toBe('idea')
    expect(ctx.entity_id).toBe('abc-123')
  })

  it('maps workspace management route', () => {
    const ctx = resolveTectonaUiContext('/workspace-management')
    expect(ctx.module_label).toBe('Workspace Management')
  })

  it('maps enterprise governance sub-route', () => {
    const ctx = resolveTectonaUiContext('/enterprise-governance-model/overview')
    expect(ctx.module_label).toBe('Enterprise Governance Model')
    expect(ctx.page_title).toContain('Overview')
  })
})

describe('buildTectonaUiContextForChat', () => {
  afterEach(() => {
    useTectonaPageContextStore.getState().clearPageContext('/workspace-management')
  })

  it('merges data_summary from page context store', () => {
    useTectonaPageContextStore.getState().setPageContext('/workspace-management', {
      view_label: 'Overview',
      data_summary: 'Portfolio workspace: total workspace=12',
    })
    const ctx = buildTectonaUiContextForChat({ pathname: '/workspace-management' })
    expect(ctx.view_label).toBe('Overview')
    expect(ctx.data_summary).toBe('Portfolio workspace: total workspace=12')
  })
})
