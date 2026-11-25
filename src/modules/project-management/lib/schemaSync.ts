import type { SchemaSnapshot, SchemaTable, SchemaPlan } from '@/lib/api/schemaSyncApi'

export type SchemaMergeChange = { name: string; kind: 'add' | 'update' | 'remove' | 'conflict'; incoming?: SchemaTable; safeAddition: boolean }
export type SchemaMergeChoice = 'keep' | 'database'
const signature = (table?: SchemaTable) => table ? JSON.stringify({ ...table, columns: [...table.columns].sort((a, b) => a.name.localeCompare(b.name)), dependencies: [...table.dependencies].sort() }) : ''
/** Three-way review never mutates the local draft. Missing baseline is a conflict,
 * not permission to overwrite a same-name table. Deletions remain review-only. */
export function previewSchemaMerge(baseline: SchemaSnapshot | null, local: SchemaSnapshot, incoming: SchemaSnapshot): SchemaMergeChange[] {
  const names = new Set([...incoming.tables, ...(baseline?.tables ?? [])].map(t => t.name))
  return [...names].flatMap(name => {
    const before = baseline?.tables.find(t => t.name === name)
    const ours = local.tables.find(t => t.name === name)
    const theirs = incoming.tables.find(t => t.name === name)
    if (signature(ours) === signature(theirs) || (baseline && signature(before) === signature(theirs))) return []
    const conflict = !!ours && (!before || signature(ours) !== signature(before)) || (!!before && !ours && !!theirs)
    const kind = conflict ? 'conflict' : !theirs ? 'remove' : !ours ? 'add' : 'update'
    const referenced = incoming.tables.some(t => t.dependencies.includes(name)) || local.tables.some(t => t.dependencies.includes(name))
    return [{ name, kind, incoming: theirs, safeAddition: kind === 'add' && !theirs!.dependencies.length && !referenced } as SchemaMergeChange]
  })
}
export function mergeReviewedSchema(local: SchemaSnapshot, changes: SchemaMergeChange[], choices: Record<string, SchemaMergeChoice>): SchemaSnapshot {
  const tables = [...local.tables]
  for (const change of changes) {
    // Destructive changes are blocked even if a caller accidentally chooses them.
    if (choices[change.name] !== 'database' || !change.incoming || change.kind === 'remove') continue
    const index = tables.findIndex(t => t.name === change.name)
    if (index < 0) tables.push(change.incoming)
    else tables[index] = change.incoming
  }
  return { tables }
}
export function canAutoApplyPlan(plan: SchemaPlan, enabled: boolean, now = Date.now()): boolean {
  return enabled && !plan.requires_confirmation && !plan.blockers.length && plan.operations.length > 0 && plan.operations.every(op => op.kind === 'create_table') && plan.expires_at * 1000 > now
}
export function canApplyPlan(plan: SchemaPlan, fingerprint: string, now = Date.now()): boolean {
  return !!plan.id && plan.baseline_fingerprint === fingerprint && !plan.blockers.length && plan.operations.length > 0 && plan.expires_at * 1000 > now
}

/** Update only reviewed schema fields. IDs, positions, styles and user labels survive.
 * sourceName is separate from the user-editable title and is never a connection ID. */
export type SchemaDiagramNode = { id: string; position: { x: number; y: number }; data: { title?: string; schemaSource?: { sourceName: string; baseline: SchemaTable; fingerprint: string }; [key: string]: unknown }; [key: string]: unknown }
export function mergeSchemaNodes<T extends SchemaDiagramNode>(nodes: T[], reviewed: SchemaSnapshot, fingerprint: string, makeNode: (table: SchemaTable, index: number) => T): T[] {
  const result = [...nodes]
  for (const table of reviewed.tables) {
    const index = result.findIndex(node => node.data.schemaSource?.sourceName === table.name)
    if (index >= 0) {
      const node = result[index]
      if (signature(node.data.schemaSource?.baseline) === signature(table) && node.data.schemaSource?.fingerprint === fingerprint) continue
      result[index] = { ...node, data: { ...node.data, schemaSource: { sourceName: table.name, baseline: table, fingerprint } } }
    } else {
      const node = makeNode(table, result.length)
      result.push({ ...node, data: { ...node.data, schemaSource: { sourceName: table.name, baseline: table, fingerprint } } })
    }
  }
  return result
}

