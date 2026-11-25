import { isErdForeignKeyMapping } from './erdForeignKeyMapping'
import type { Edge, Node } from 'reactflow'

import { ERD_SQL_DIALECTS, type ErdSqlDialect, type ErdSqlType } from './erdDdlDialects'
export type { ErdSqlDialect } from './erdDdlDialects'
export type ErdDdlSelection = { nodes: Node[]; edges: Edge[] }
export type ErdDdlResult = { sql: string; warnings: string[]; errors: string[]; tableCount: number; target: string; engineConfirmed: false }
type Column = { name: string; type: string; pk: boolean; fk: boolean; nullable: boolean | undefined; keyEligible: boolean; check?: ErdSqlType['check'] }
type Table = { id: string; name: string; columns: Column[] }

/** Capture only the right-clicked entity or the selected entities. Edges outside this
 * selection are retained solely to explain omissions, never to add more tables. */
export function selectErdDdlScope(nodes: Node[], edges: Edge[], clickedId: string): ErdDdlSelection {
  const clicked = nodes.find(n => n.id === clickedId)
  const chosen = nodes.filter(n => n.type === 'erdEntity' && n.data?.kind === 'element' && (clicked?.selected ? n.selected : n.id === clickedId))
  const ids = new Set(chosen.map(n => n.id))
  return { nodes: chosen, edges: edges.filter(e => ids.has(e.source) || ids.has(e.target)) }
}

export function generateErdDdl(scope: ErdDdlSelection, dialect: ErdSqlDialect): ErdDdlResult {
  const warnings: string[] = [], errors: string[] = [], tables: Table[] = []
  const profile = ERD_SQL_DIALECTS[dialect]
  if (profile.enabled === false) return { sql: '', warnings: [], errors: [profile.unavailableReason ?? 'Dialect generation unavailable.'], tableCount: 0, target: profile.target, engineConfirmed: false }
  const quote = profile.quote
  const validName = (s: string) => {
    const length = profile.identifierUnit === 'bytes' ? new TextEncoder().encode(s).length : profile.identifierUnit === 'utf16' ? s.length : [...s].length
    return !!s.trim() && ![...s].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && length <= profile.identifierLimit && (profile.validateIdentifier?.(s) ?? true)
  }
  const names = new Set<string>()
  for (const node of scope.nodes) {
    if (node.type !== 'erdEntity' || node.data?.kind !== 'element') continue
    const name = String(node.data.title ?? '').trim()
    if (node.data.erdDdlImport) warnings.push(`${name}: regenerated from editable ERD attributes and selected relationships, not the retained SQL source. Original defaults, CHECK/UNIQUE constraints, identity, indexes, schema qualification, referential actions and physical type details may be lost. Compare with the original SQL before use.`)
    if (!validName(name) || names.has(name.toLowerCase())) { errors.push(`Invalid or duplicate table name: ${name || '(empty)'}. Table omitted.`); continue }
    names.add(name.toLowerCase())
    const columns: Column[] = [], seen = new Set<string>()
    const members: unknown[] = Array.isArray(node.data.description) ? node.data.description : []
    for (const raw of members) {
      if (typeof raw !== 'string' || !raw.trim() || /^(--|\.\.|__)$/.test(raw.trim())) continue
      const pk = /^\s*\*/.test(raw) || /<<\s*PK\s*>>/i.test(raw), fk = /<<\s*FK\s*>>/i.test(raw)
      if (/<<(?!(?:PK|FK)\s*>>)[^>]*>>/i.test(raw)) warnings.push(`${name}: unsupported column annotation ignored: ${raw}`)
      const clean = raw.replace(/^\s*\*\s*/, '').replace(/<<[^>]+>>/g, '').trim()
      const colon = clean.indexOf(':')
      const columnName = (colon < 0 ? clean : clean.slice(0, colon)).trim()
      let type = colon < 0 ? '' : clean.slice(colon + 1).trim().toUpperCase()
      let nullable: boolean | undefined
      if (/\s+NOT NULL$/.test(type)) { nullable = false; type = type.replace(/\s+NOT NULL$/, '') }
      else if (/\s+NULL$/.test(type)) { nullable = true; type = type.replace(/\s+NULL$/, '') }
      if (!validName(columnName) || seen.has(columnName.toLowerCase())) { errors.push(`${name}: invalid or duplicate column ${columnName || '(empty)'}. Column omitted.`); continue }
      seen.add(columnName.toLowerCase())
      type = type.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',')
      const mapped = profile.mapType(type)
      warnings.push(...mapped.warnings.map(w => `${name}.${columnName}: ${w}`))
      type = mapped.sql
      if (pk && nullable) warnings.push(`${name}.${columnName}: PRIMARY KEY overrides explicit NULL.`)
      columns.push({ name: columnName, type, pk, fk, nullable, keyEligible: mapped.keyEligible, check: mapped.check })
    }
    if (!columns.length) { errors.push(`${name}: no usable columns. Table omitted.`); continue }
    if (columns.some(c => c.pk && !c.keyEligible)) { errors.push(`${name}: unsupported primary-key type for ${dialect}; table omitted.`); continue }
    if (columns.some(c => c.pk && /^(VARCHAR|CHAR|NVARCHAR|TEXT)/.test(c.type))) warnings.push(`${name}: string key length limits depend on target charset, collation and storage settings; verify before execution.`)
    tables.push({ id: node.id, name, columns })
  }
  const inlineConstraints = new Map<string, string[]>()
  const inlineForeignKeys: { child: string; parent: string; sql: string }[] = []
  const constraints: string[] = [], mapped = new Set<Column>()
  const pending: { child: Table; parent: Table; column: Column; key: Column; unique: boolean; optional: unknown }[] = []
  for (const edge of scope.edges) {
    const source = tables.find(t => t.id === edge.source), target = tables.find(t => t.id === edge.target)
    const label = `Relationship ${edge.id}`
    if (!source || !target) { warnings.push(`${label}: foreign key omitted because an endpoint is outside the selected usable tables.`); continue }
    if (!edge.selected) { warnings.push(`${label}: foreign key omitted because the relationship is not selected.`); continue }
    const d = edge.data ?? {}
    if (typeof d.sourceMany !== 'boolean' || typeof d.targetMany !== 'boolean' || (d.sourceMany && d.targetMany)) {
      warnings.push(`${label}: ${d.sourceMany && d.targetMany ? 'many-to-many needs an explicit selected junction entity' : 'ambiguous cardinality'}; no foreign key generated.`); continue
    }
    if (d.erdForeignKey !== undefined) {
      const fk = d.erdForeignKey
      if (!isErdForeignKeyMapping(fk) || fk.columns.length !== 1 || fk.referencedColumns.length !== 1) {
        warnings.push(`${label}: explicit FK mapping is invalid or composite (currently unsupported); constraint omitted without guessing.`); continue
      }
      const child = [source, target].find(t => t.id === fk.childNodeId), parent = [source, target].find(t => t.id === fk.parentNodeId)
      const childIsSource = child?.id === edge.source
      const keys = parent?.columns.filter(c => c.pk) ?? []
      const column = child?.columns.find(c => c.name === fk.columns[0] && c.fk)
      const key = keys.length === 1 && keys[0].name === fk.referencedColumns[0] ? keys[0] : undefined
      const parentMany = childIsSource ? d.targetMany : d.sourceMany
      if (!child || !parent || !column || !key || parentMany || column.type !== key.type) {
        warnings.push(`${label}: explicit FK mapping no longer matches selected endpoints, columns, primary key, types or cardinality; constraint omitted without guessing.`); continue
      }
      pending.push({ child, parent, column, key, unique: !d.sourceMany && !d.targetMany, optional: childIsSource ? d.targetOptional : d.sourceOptional })
      continue
    }
    const directions = d.sourceMany ? [[source, target, d.targetOptional]] as const : d.targetMany ? [[target, source, d.sourceOptional]] as const : [[source, target, d.targetOptional], [target, source, d.sourceOptional]] as const
    const candidates: typeof pending = []
    for (const [child, parent, optional] of directions) {
      const keys = parent.columns.filter(c => c.pk)
      if (keys.length !== 1) continue
      const key = keys[0]
      const matches = child.columns.filter(c => c.fk && [key.name.toLowerCase(), `${parent.name}_${key.name}`.toLowerCase()].includes(c.name.toLowerCase()) && c.type.replace(/^INTEGER$/, 'INT').replace(/^BOOL$/, 'BOOLEAN') === key.type.replace(/^INTEGER$/, 'INT').replace(/^BOOL$/, 'BOOLEAN'))
      if (matches.length === 1) candidates.push({ child, parent, column: matches[0], key, unique: !d.sourceMany && !d.targetMany, optional })
    }
    if (candidates.length !== 1) { warnings.push(`${label}: no unambiguous explicitly marked FK column matching a single primary key name/type and direction; constraint omitted.`); continue }
    pending.push(candidates[0])
  }
  for (const { child, parent, column, key, unique, optional } of pending) {
    if (pending.filter(p => p.column === column).length !== 1) { warnings.push(`${child.name}.${column.name}: multiple relationships map to this column; constraints omitted.`); continue }
    if (typeof optional === 'boolean') {
      if (column.nullable === undefined && !column.pk) { column.nullable = optional; warnings.push(`${child.name}.${column.name}: ${optional ? 'NULL allowed' : 'NOT NULL'} inferred from selected relationship parent-end cardinality; review this assumption.`) }
      else if ((column.pk ? false : column.nullable) !== optional) warnings.push(`${child.name}.${column.name}: column nullability conflicts with relationship cardinality; explicit column/PK constraint preserved.`)
    }
    if (unique && profile.nullableUnique === 'omit' && !column.pk && column.nullable !== false) warnings.push(`${child.name}.${column.name}: nullable UNIQUE is not supported by this target; one-to-one uniqueness omitted. Review relationship cardinality.`)
    else if (unique) {
      if (profile.foreignKeyPlacement === 'inline') inlineConstraints.set(child.id, [...(inlineConstraints.get(child.id) ?? []), `UNIQUE (${quote(column.name)})`])
      else if (dialect === 'sqlserver' && !column.pk && column.nullable !== false) constraints.push(`CREATE UNIQUE INDEX ${quote(`erd_uq_${constraints.length + 1}`)} ON ${quote(child.name)} (${quote(column.name)}) WHERE ${quote(column.name)} IS NOT NULL;`)
      else constraints.push(`ALTER TABLE ${quote(child.name)} ADD UNIQUE (${quote(column.name)});`)
    }
    mapped.add(column)
    const foreignKey = `FOREIGN KEY (${quote(column.name)}) REFERENCES ${quote(parent.name)} (${quote(key.name)})`
    if (profile.foreignKeyPlacement === 'inline') inlineForeignKeys.push({ child: child.id, parent: parent.id, sql: foreignKey })
    else constraints.push(`ALTER TABLE ${quote(child.name)} ADD ${foreignKey};`)
  }
  for (const table of tables) for (const column of table.columns) if (column.fk && !mapped.has(column)) warnings.push(`${table.name}.${column.name}: FK marker has no generated reference; review the omitted relationship warnings.`)
  for (const table of tables) for (const column of table.columns) if (!column.pk && column.nullable === undefined) warnings.push(`${table.name}.${column.name}: nullability unspecified; left nullable.`)
  // Most engines require the referenced table to exist when an inline FK is
  // created. SQLite permits forward references. Never invent tables for a cycle.
  const ordered: Table[] = [], remaining = [...tables]
  while (remaining.length) {
    const index = profile.forwardReferences ? 0 : remaining.findIndex(t => !inlineForeignKeys.some(fk => fk.child === t.id && fk.parent !== t.id && remaining.some(parent => parent.id === fk.parent)))
    if (index < 0) {
      const ids = new Set(remaining.map(t => t.id))
      for (let i = inlineForeignKeys.length - 1; i >= 0; i--) {
        const fk = inlineForeignKeys[i]
        if (fk.child !== fk.parent && ids.has(fk.child) && ids.has(fk.parent)) { warnings.push(`Relationship ${fk.child} to ${fk.parent}: cyclic or cycle-dependent inline foreign key omitted; create/review this constraint separately after all tables exist.`); inlineForeignKeys.splice(i, 1) }
      }
      continue
    }
    ordered.push(...remaining.splice(index, 1))
  }
  for (const fk of inlineForeignKeys) inlineConstraints.set(fk.child, [...(inlineConstraints.get(fk.child) ?? []), fk.sql])
  const statements = ordered.map(t => {
    const definitions = t.columns.map(c => `  ${quote(c.name)} ${c.type}${c.pk || c.nullable === false ? ' NOT NULL' : profile.explicitNullable ? ' NULL' : ''}`)
    for (const c of t.columns) {
      if (c.check === 'boolean') definitions.push(`  CHECK (${quote(c.name)} IN (0, 1))`)
      if (c.check === 'json') definitions.push(`  CHECK (${dialect === 'sqlserver' ? `ISJSON(${quote(c.name)}) = 1` : `${quote(c.name)} IS JSON`})`)
    }
    definitions.push(...(inlineConstraints.get(t.id) ?? []).map(constraint => `  ${constraint}`))
    const keys = t.columns.filter(c => c.pk)
    if (keys.length) definitions.push(`  PRIMARY KEY (${keys.map(c => quote(c.name)).join(', ')})`)
    return `CREATE TABLE ${quote(t.name)} (\n${definitions.join(',\n')}\n)${profile.tableSuffix ?? ''};`
  })
  if (!tables.length) errors.push('No usable ERD entities in this selection.')
  const header = `-- Target: ${profile.target}\n-- Review-only generated DDL. Structural checks only; not validated by a database.\n`
  return { sql: tables.length ? header + [...(profile.preamble ?? []), ...statements, ...constraints].join('\n\n') : '', warnings: [...new Set(warnings)], errors, tableCount: tables.length, target: profile.target, engineConfirmed: false }
}
