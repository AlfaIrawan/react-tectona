import { describe, expect, it } from 'vitest'
import { canApplyPlan, canAutoApplyPlan, mergeReviewedSchema, mergeSchemaNodes, previewSchemaMerge } from './schemaSync'
import type { SchemaPlan, SchemaSnapshot, SchemaTable } from '@/lib/api/schemaSyncApi'
const table = (name = 'items', type = 'text'): SchemaTable => ({ name, columns: [{ name: 'label', data_type: type, nullable: true }], dependencies: [] })
const schema = (...tables: SchemaTable[]): SchemaSnapshot => ({ tables })
describe('conservative schema merge', () => {
 it('adds remote-only tables only after review and retains local-only edits', () => {
  const local = schema(table('items', 'integer'))
  const changes = previewSchemaMerge(schema(table()), local, schema(table(), table('new_table')))
  expect(changes.map(c => c.name)).toEqual(['new_table']); expect(changes[0].safeAddition).toBe(true)
  expect(mergeReviewedSchema(local, changes, {})).toEqual(local)
  expect(mergeReviewedSchema(local, changes, { new_table: 'database' }).tables).toEqual([...local.tables, table('new_table')])
 })
 it('flags simultaneous divergence and never silently replaces same-name tables without a baseline', () => {
  expect(previewSchemaMerge(schema(table()), schema(table('items', 'integer')), schema(table('items', 'boolean')))[0].kind).toBe('conflict')
  expect(previewSchemaMerge(null, schema(table()), schema(table('items', 'integer')))[0].kind).toBe('conflict')
 })
 it('retains remote deletion plus local edits and blocks destructive resolutions', () => {
  const local = schema(table('items', 'integer')); const changes = previewSchemaMerge(schema(table()), local, schema())
  expect(changes[0].kind).toBe('conflict'); expect(mergeReviewedSchema(local, changes, { items: 'database' })).toEqual(local)
 })
 it('does not mark additions with dependencies as safe', () => {
  const dependent = { ...table('dependent'), dependencies: ['items'] }
  expect(previewSchemaMerge(null, schema(), schema(table(), dependent)).every(c => !c.safeAddition)).toBe(true)
 })
 it('preserves positions, styles, IDs and user visual labels on no-change refresh', () => {
  const node = { id: 'node', position: { x: 991, y: -12 }, style: { color: 'red' }, data: { title: 'User visual label', description: ['local annotation'], schemaSource: { sourceName: 'items', baseline: table(), fingerprint: 'f' } } }
  const result = mergeSchemaNodes([node], schema(table()), 'f', () => { throw new Error('not called') })
  expect(result[0]).toBe(node)
  const updated = mergeSchemaNodes([node], schema(table('items', 'integer')), 'g', () => { throw new Error('not called') })[0]
  expect(updated.position).toBe(node.position); expect(updated.style).toBe(node.style); expect(updated.data.title).toBe('User visual label'); expect(updated.data.description).toEqual(['local annotation']); expect(updated.data.schemaSource.baseline.columns[0].data_type).toBe('integer')
 })
})
const plan: SchemaPlan = { id: 'p', expires_at: 4070908800, baseline_fingerprint: 'f', operations: [{ kind: 'create_table', table: 'new_table', sql: 'CREATE TABLE new_table (label text)' }], requires_confirmation: false, blockers: [] }
it('requires explicit opt-in and blocks stale, expired, conflicted or existing-structure auto plans', () => {
 expect(canAutoApplyPlan(plan, false)).toBe(false); expect(canAutoApplyPlan(plan, true)).toBe(true)
 expect(canAutoApplyPlan({ ...plan, operations: [{ ...plan.operations[0], kind: 'add_column' }] }, true)).toBe(false)
 expect(canAutoApplyPlan({ ...plan, blockers: ['dependency'] }, true)).toBe(false)
 expect(canAutoApplyPlan({ ...plan, requires_confirmation: true }, true)).toBe(false)
 expect(canApplyPlan(plan, 'stale')).toBe(false); expect(canApplyPlan({ ...plan, expires_at: 946684800 }, 'f')).toBe(false)
})

