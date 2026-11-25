import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrainstormSessionHeading, resolveBrainstormWorkspaceName } from './BrainstormSessionHeading'

describe('selected brainstorm workspace', () => {
  const options = [{ id: 'source', name: 'Alfa Irawan WS' }, { id: 'target', name: 'IT Business Partner WS' }]
  it('uses the selected target, not the source or the first available workspace', () => {
    expect(resolveBrainstormWorkspaceName('target', options)).toBe('IT Business Partner WS')
    expect(resolveBrainstormWorkspaceName('source', options)).toBe('Alfa Irawan WS')
  })
  it('keeps the saved session name while options load and uses the latest available name', () => {
    expect(resolveBrainstormWorkspaceName('target', [], 'IT Business Partner WS')).toBe('IT Business Partner WS')
    expect(resolveBrainstormWorkspaceName('target', options, 'Old name')).toBe('IT Business Partner WS')
  })
  it('never guesses another workspace when the selection or its name is missing', () => {
    expect(resolveBrainstormWorkspaceName('', options, 'Old name')).toBeNull()
    expect(resolveBrainstormWorkspaceName('unknown', options)).toBeNull()
  })
  it('renders the idea title and the target name as text, without an interactive selector', () => {
    const node = document.createElement('div')
    node.innerHTML = renderToStaticMarkup(createElement(BrainstormSessionHeading, {
      title: 'Pembuatan Chat Gen AI untuk Collection', workspaceId: 'target', workspaceName: 'Risk & Compliance <WS>',
    }))
    expect(node.querySelector('h3')?.textContent).toBe('Tectona Assistant')
    expect(node.textContent).toContain('Pembuatan Chat Gen AI untuk Collection')
    expect(node.querySelector('[data-brainstorm-workspace]')?.textContent).toBe('Risk & Compliance <WS>')
    expect(node.querySelector('[title="Workspace tujuan: Risk & Compliance <WS>"]')).not.toBeNull()
    expect(node.querySelector('select, button, input')).toBeNull()
  })
  it('uses explicit empty states rather than an unrelated workspace', () => {
    const markup = (workspaceId: string) => renderToStaticMarkup(createElement(BrainstormSessionHeading, { title: '', workspaceId }))
    expect(markup('')).toContain('Belum dipilih')
    expect(markup('target')).toContain('Nama belum tersedia')
  })
})
