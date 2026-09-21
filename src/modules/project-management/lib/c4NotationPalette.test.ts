import { describe, expect, it } from 'vitest'
import {
  findC4ApplicationCatalogMatch,
  normalizeC4ApplicationName,
  type C4ApplicationCatalogItem,
} from '@/modules/project-management/lib/c4NotationPalette'

const catalog: C4ApplicationCatalogItem[] = [
  {
    name: 'Ivanti',
    type: 'Web',
    description: 'Service desk',
    classification: 'External System',
  },
  {
    name: 'Ad1Access',
    type: 'Web',
    description: 'Access management',
    classification: 'System',
  },
]

describe('C4 Application Catalog matching', () => {
  it('normalizes common system prefixes, punctuation, and letter case', () => {
    expect(normalizeC4ApplicationName('  Aplikasi IVANTI  ')).toBe('ivanti')
    expect(normalizeC4ApplicationName('Software-System: Ad1Access')).toBe('ad1access')
  })

  it('matches a node title to its catalog entry', () => {
    expect(findC4ApplicationCatalogMatch('Aplikasi Ivanti', catalog)?.name).toBe('Ivanti')
    expect(findC4ApplicationCatalogMatch('ad1access', catalog)?.name).toBe('Ad1Access')
  })

  it('does not use partial matching', () => {
    expect(findC4ApplicationCatalogMatch('Ivanti Mobile', catalog)).toBeUndefined()
  })
})
