import { describe, expect, it } from 'vitest'
import {
  buildKbTableColumnVisibilityCss,
  clampKbVisibleColumnIndexes,
  defaultKbVisibleColumnIndexes,
  KB_TABLE_MAX_VISIBLE_COLUMNS,
  stampKbTableIndexesInHtml,
  toggleKbVisibleColumnIndex,
} from './kbTableColumnVisibility'

describe('kbTableColumnVisibility', () => {
  it('defaults first N columns for density mode', () => {
    expect(defaultKbVisibleColumnIndexes(8, 'maximize')).toEqual([0, 1, 2, 3, 4])
    expect(defaultKbVisibleColumnIndexes(8, 'minimize')).toEqual([0, 1])
    expect(defaultKbVisibleColumnIndexes(1, 'minimize')).toEqual([0])
    expect(KB_TABLE_MAX_VISIBLE_COLUMNS.maximize).toBe(5)
    expect(KB_TABLE_MAX_VISIBLE_COLUMNS.minimize).toBe(2)
  })

  it('clamps selection when switching to minimize', () => {
    expect(clampKbVisibleColumnIndexes([0, 2, 4, 5], 6, 'minimize')).toEqual([0, 2])
    expect(clampKbVisibleColumnIndexes([0, 1, 2], 3, 'maximize')).toEqual([0, 1, 2])
  })

  it('toggles columns without exceeding max or emptying the set', () => {
    expect(toggleKbVisibleColumnIndex([0, 1], 1, 4, 'minimize')).toEqual([0])
    expect(toggleKbVisibleColumnIndex([0], 0, 4, 'minimize')).toEqual([0])
    expect(toggleKbVisibleColumnIndex([0, 1], 2, 4, 'minimize')).toEqual([0, 1])
    expect(toggleKbVisibleColumnIndex([0, 1], 2, 4, 'maximize')).toEqual([0, 1, 2])
  })

  it('builds CSS that hides non-visible columns with important', () => {
    const css = buildKbTableColumnVisibilityCss('#scope table[data-kb-table-index="0"]', 4, [0, 1])
    expect(css).toContain('display: none !important')
    expect(css).toContain('th:nth-child(1)')
    expect(css).toContain('td:nth-child(2)')
    expect(css).toContain('display: table-cell !important')
    expect(css).toContain('width: 100% !important')
    expect(css).toContain('width: 50.0000% !important')
    expect(css).not.toContain('nth-child(3)')
    expect(css).not.toContain('nth-child(4)')
  })

  it('stamps stable table indexes into HTML', () => {
    const out = stampKbTableIndexesInHtml('<p>x</p><table class="a" width="420"><tr></tr></table><table><tr></tr></table>')
    expect(out).toContain('data-kb-table-index="0"')
    expect(out).toContain('data-kb-table-index="1"')
    expect(out).toContain('kb-table-column-limited')
    expect(out).toContain('class="a kb-table-column-limited"')
    expect(out).not.toContain('width="420"')
  })
})
