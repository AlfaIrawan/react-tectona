export type ErdForeignKeyMapping = {
  childNodeId: string
  parentNodeId: string
  columns: string[]
  referencedColumns: string[]
}
export function isErdForeignKeyMapping(value: unknown): value is ErdForeignKeyMapping {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ErdForeignKeyMapping>
  return typeof item.childNodeId === 'string' && typeof item.parentNodeId === 'string'
    && Array.isArray(item.columns) && item.columns.length > 0 && item.columns.every(c => typeof c === 'string' && c.length > 0)
    && Array.isArray(item.referencedColumns) && item.referencedColumns.length > 0 && item.referencedColumns.every(c => typeof c === 'string' && c.length > 0)
}
/** Preserve malformed metadata so export fails closed instead of guessing. */
export function remapErdForeignKey(value: unknown, ids: ReadonlyMap<string, string>): unknown {
  if (!isErdForeignKeyMapping(value)) return value
  return { ...value, columns: [...value.columns], referencedColumns: [...value.referencedColumns], childNodeId: ids.get(value.childNodeId) ?? value.childNodeId, parentNodeId: ids.get(value.parentNodeId) ?? value.parentNodeId }
}
