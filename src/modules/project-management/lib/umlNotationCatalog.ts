export type UmlPaletteNodeKind = 'class' | 'interface' | 'enumeration' | 'entity' | 'actor' | 'usecase' | 'system-boundary'
export type UmlPaletteRelation =
  | 'include'
  | 'extend'
  | 'realization'
  | 'directed-association'
  | 'one-to-zero-or-one'
  | 'one-to-zero-or-many'
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'dependency'
  | 'one-to-many'
  | 'one-to-one'
  | 'many-to-many'

export type UmlPaletteItem = {
  id: string
  group: 'element' | 'relation'
  label: string
  nodeKind?: UmlPaletteNodeKind
  relation?: UmlPaletteRelation
}

export const CLASS_ITEMS: UmlPaletteItem[] = [
  { id: 'class', group: 'element', label: 'Class', nodeKind: 'class' },
  { id: 'interface', group: 'element', label: 'Interface', nodeKind: 'interface' },
  { id: 'enumeration', group: 'element', label: 'Enumeration', nodeKind: 'enumeration' },
  { id: 'association', group: 'relation', label: 'Association', relation: 'association' },
  { id: 'aggregation', group: 'relation', label: 'Aggregation', relation: 'aggregation' },
  { id: 'composition', group: 'relation', label: 'Composition', relation: 'composition' },
  { id: 'generalization', group: 'relation', label: 'Generalization', relation: 'generalization' },
  { id: 'realization', group: 'relation', label: 'Realization', relation: 'realization' },
  { id: 'directed-association', group: 'relation', label: 'Directed association', relation: 'directed-association' },
  { id: 'dependency', group: 'relation', label: 'Dependency', relation: 'dependency' },
]

export const ERD_ITEMS: UmlPaletteItem[] = [
  { id: 'entity', group: 'element', label: 'Entity', nodeKind: 'entity' },
  { id: 'one-to-zero-or-one', group: 'relation', label: 'One to zero or one', relation: 'one-to-zero-or-one' },
  { id: 'one-to-zero-or-many', group: 'relation', label: 'One to zero or many', relation: 'one-to-zero-or-many' },
  { id: 'one-to-many', group: 'relation', label: 'One to many', relation: 'one-to-many' },
  { id: 'one-to-one', group: 'relation', label: 'One to one', relation: 'one-to-one' },
  { id: 'many-to-many', group: 'relation', label: 'Many to many', relation: 'many-to-many' },
]


export const USE_CASE_ITEMS: UmlPaletteItem[] = [
  { id: 'actor', group: 'element', label: 'Actor', nodeKind: 'actor' },
  { id: 'usecase', group: 'element', label: 'Use case', nodeKind: 'usecase' },
  { id: 'system-boundary', group: 'element', label: 'System boundary', nodeKind: 'system-boundary' },
  { id: 'association', group: 'relation', label: 'Association (actor to use case)', relation: 'association' },
  { id: 'generalization', group: 'relation', label: 'Generalization (specific to general)', relation: 'generalization' },
  { id: 'include', group: 'relation', label: '<<include>> (base to included)', relation: 'include' },
  { id: 'extend', group: 'relation', label: '<<extend>> (extension to base)', relation: 'extend' },
]
