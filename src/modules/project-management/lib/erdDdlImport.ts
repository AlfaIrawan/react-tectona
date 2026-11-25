import type { UmlDiagram } from './classErdPlantUml'
import { ERD_SQL_DIALECTS, type ErdSqlDialect } from './erdDdlDialects'

export type ErdDdlColumn = { name: string; type: string; nullable: boolean; primaryKey: boolean; unique: boolean; source: string }
export type ErdDdlForeignKey = { columns: string[]; referencedTable: string; referencedColumns: string[]; source: string }
export type ErdDdlTable = { id: string; name: string; columns: ErdDdlColumn[]; primaryKey: string[]; uniqueKeys: string[][]; foreignKeys: ErdDdlForeignKey[]; source: string }
export type ErdDdlImportResult = { diagram: UmlDiagram; tables: ErdDdlTable[]; warnings: string[]; errors: string[] }
type Token = { value: string; raw: string; quoted?: boolean }

/** A bounded, local-only DDL reader. This module never executes SQL or contacts a database. */
function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < sql.length) {
    if (/\s/.test(sql[i])) { i++; continue }
    if (sql.startsWith('--', i)) { const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end + 1; continue }
    if (sql.startsWith('/*', i)) {
      let depth = 1; i += 2
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) { depth++; i += 2 }
        else if (sql.startsWith('*/', i)) { depth--; i += 2 }
        else i++
      }
      if (depth) throw new Error('Unterminated SQL comment.')
      continue
    }
    const start = i, ch = sql[i]
    const dollar = ch === '$' ? sql.slice(i).match(/^\$(?:[A-Za-z_]\w*)?\$/)?.[0] : undefined
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length)
      if (end < 0) throw new Error('Unterminated dollar-quoted SQL string.')
      i = end + dollar.length; tokens.push({ value: sql.slice(start, i), raw: sql.slice(start, i), quoted: true }); continue
    }
    if ('\'"`['.includes(ch)) {
      const close = ch === '[' ? ']' : ch; let value = ''; let closed = false; i++
      while (i < sql.length) {
        if (sql[i] === close) {
          if (sql[i + 1] === close) { value += close; i += 2; continue }
          i++; closed = true; break
        }
        if (ch === "'" && sql[i] === '\\' && i + 1 < sql.length) { value += sql.slice(i, i + 2); i += 2; continue }
        value += sql[i++]
      }
      if (!closed) throw new Error('Unterminated SQL quote or identifier.')
      tokens.push({ value, raw: sql.slice(start, i), quoted: true }); continue
    }
    if (/[A-Za-z_\u0080-\uFFFF0-9$#]/.test(ch)) {
      while (i < sql.length && /[A-Za-z_\u0080-\uFFFF0-9$#]/.test(sql[i])) i++
    } else i++
    tokens.push({ value: sql.slice(start, i), raw: sql.slice(start, i) })
  }
  return tokens
}
const word = (t: Token | undefined, s: string) => !!t && !t.quoted && t.value.toUpperCase() === s
const raw = (ts: Token[]) => ts.map(t => t.raw).join(' ')

/** Normalize only reviewable physical equivalents. Raw SQL types always remain in table metadata. */
function diagramType(type: string, dialect: string, warn: (s: string) => void): string {
  const input = type.toUpperCase().replace(/\s+/g, ' ')
  if (/^(SMALLINT|INT|INTEGER|BIGINT|TEXT|BOOL|BOOLEAN|DATE|DATETIME|TIMESTAMP|TIME|REAL|FLOAT|DOUBLE PRECISION|JSON|UUID|(?:VARCHAR|CHAR)\(\d+\)|(?:DECIMAL|NUMERIC)\(\d+(?:,\d+)?\))$/.test(input)) return input
  let mapped: string | undefined
  if (dialect === 'oracle') {
    mapped = input.replace(/^VARCHAR2\((\d+) BYTE\)$/, 'VARCHAR($1)').replace(/^CHAR\((\d+) BYTE\)$/, 'CHAR($1)').replace(/^NUMBER\((\d+),(\d+)\)$/, 'DECIMAL($1,$2)').replace(/^NUMBER\((\d+)\)$/, 'DECIMAL($1,0)')
    if (mapped === input) mapped = undefined
  }
  const profile = ERD_SQL_DIALECTS[dialect as ErdSqlDialect]
  if (!mapped && profile) {
    // Do not infer JSON, UUID or BOOLEAN from storage alone. These require semantic constraints.
    const candidates = ['TEXT', 'SMALLINT', 'INT', 'BIGINT', 'REAL', 'FLOAT', 'DOUBLE PRECISION', 'TIMESTAMP', 'DATETIME', 'TIME']
    const equivalent = candidates.filter(candidate => profile.mapType(candidate).sql.toUpperCase() === input)
    mapped = equivalent[0]
    if (dialect === 'sqlserver' && input === 'UNIQUEIDENTIFIER') mapped = 'UUID'
    if (dialect === 'sqlserver' && input === 'BIT') mapped = 'BOOLEAN'
  }
  if (mapped) { warn(`${type} is displayed as ${mapped} for the ERD logical type format. Original type is retained in metadata; review range, encoding and constraints before re-export.`); return mapped }
  warn(`${type} is retained verbatim; ERD-to-DDL may not support this physical type. Review before re-export.`)
  return type
}
function split(ts: Token[], delimiter: string): Token[][] {
  const result: Token[][] = []; let start = 0, depth = 0
  ts.forEach((t, i) => {
    if (!t.quoted && t.value === '(') depth++
    if (!t.quoted && t.value === ')') depth--
    if (depth < 0) throw new Error('Unbalanced SQL parentheses.')
    if (!depth && word(t, delimiter)) { result.push(ts.slice(start, i)); start = i + 1 }
  })
  if (depth) throw new Error('Unbalanced SQL parentheses.')
  result.push(ts.slice(start)); return result.filter(x => x.length)
}
class Reader {
  i = 0
  ts: Token[]
  constructor(ts: Token[]) { this.ts = ts }
  eat(s: string) { if (word(this.ts[this.i], s)) { this.i++; return true } return false }
  expect(s: string) { if (!this.eat(s)) throw new Error(`Expected ${s}, found ${this.ts[this.i]?.raw ?? 'end of statement'}.`) }
  identifier(): string {
    const t = this.ts[this.i++]
    if (!t || t.raw.startsWith("'") || (!t.quoted && !/^[A-Za-z_\u0080-\uFFFF][\w$#\u0080-\uFFFF]*$/.test(t.value))) throw new Error('Expected an SQL identifier.')
    return t.value
  }
  name(): string { let s = this.identifier(); while (this.eat('.')) s += '.' + this.identifier(); return s }
  group(): Token[] {
    this.expect('('); const start = this.i; let depth = 1
    while (this.i < this.ts.length) {
      const t = this.ts[this.i++]
      if (word(t, '(')) depth++
      if (word(t, ')') && --depth === 0) return this.ts.slice(start, this.i - 1)
    }
    throw new Error('Unclosed SQL parenthesis.')
  }
  columns(): string[] { return split(this.group(), ',').map(part => { const r = new Reader(part); const name = r.identifier(); if (r.i !== part.length) throw new Error(`Unsupported key expression: ${raw(part)}.`); return name }) }
  rest() { return this.ts.slice(this.i) }
}

export function parseErdDdl(sql: string, dialect = 'postgresql'): ErdDdlImportResult {
  const result: ErdDdlImportResult = { diagram: { view: 'erd', boxes: [], links: [] }, tables: [], warnings: [], errors: [] }
  const { tables, warnings, errors } = result
  const warn = (message: string) => warnings.push(message)
  if (!['postgresql', 'mysql', 'mariadb', 'oracle', 'sqlserver'].includes(dialect)) warn(`${dialect}: only the generic CREATE TABLE / ALTER TABLE ADD key subset is parsed; vendor-specific grammar is not validated.`)
  const findTable = (name: string) => tables.find(t => t.name === name)
  function constraint(table: ErdDdlTable, tokens: Token[], inlineColumn?: string): boolean {
    const r = new Reader(tokens)
    if (r.eat('CONSTRAINT')) r.identifier()
    if (r.eat('PRIMARY')) {
      r.expect('KEY'); r.eat('CLUSTERED'); r.eat('NONCLUSTERED')
      const cols = inlineColumn ? [inlineColumn] : r.columns()
      if (table.primaryKey.length) throw new Error(`${table.name}: multiple PRIMARY KEY declarations.`)
      table.primaryKey = cols
    } else if (r.eat('UNIQUE')) {
      r.eat('KEY'); r.eat('INDEX'); r.eat('CLUSTERED'); r.eat('NONCLUSTERED')
      if (!inlineColumn && !word(r.ts[r.i], '(')) r.identifier()
      table.uniqueKeys.push(inlineColumn ? [inlineColumn] : r.columns())
    } else if (r.eat('FOREIGN') || (inlineColumn && word(r.ts[r.i], 'REFERENCES'))) {
      let cols: string[]
      if (inlineColumn) cols = [inlineColumn]
      else { r.expect('KEY'); if (!word(r.ts[r.i], '(')) r.identifier(); cols = r.columns() }
      r.expect('REFERENCES'); const target = r.name()
      const referencedColumns = word(r.ts[r.i], '(') ? r.columns() : []
      table.foreignKeys.push({ columns: cols, referencedTable: target, referencedColumns, source: raw(tokens) })
    } else return false
    if (r.rest().length) warn(`${table.name}: constraint options retained in source but not represented in ERD: ${raw(r.rest())}.`)
    return true
  }
  function column(table: ErdDdlTable, tokens: Token[]) {
    const r = new Reader(tokens), name = r.identifier()
    if (table.columns.some(c => c.name === name)) throw new Error(`${table.name}: duplicate column ${name}.`)
    const clauseWords = new Set(['NOT', 'NULL', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'CONSTRAINT', 'DEFAULT', 'CHECK', 'COLLATE', 'GENERATED', 'IDENTITY', 'AUTO_INCREMENT', 'COMMENT', 'ENCODE', 'DISTKEY', 'SORTKEY'])
    const start = r.i; let depth = 0
    while (r.i < tokens.length) {
      const t = tokens[r.i]
      if (!depth && !t.quoted && clauseWords.has(t.value.toUpperCase())) break
      if (word(t, '(')) depth++; if (word(t, ')')) depth--
      r.i++
    }
    const type = raw(tokens.slice(start, r.i)).replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s*,\s*/g, ',').replace(/\s*\.\s*/g, '.')
    if (!type) throw new Error(`${table.name}.${name}: missing column type (computed columns are unsupported).`)
    const c: ErdDdlColumn = { name, type, nullable: true, primaryKey: false, unique: false, source: raw(tokens) }
    table.columns.push(c)
    while (r.i < tokens.length) {
      if (r.eat('NOT')) { r.expect('NULL'); c.nullable = false }
      else if (r.eat('NULL')) c.nullable = true
      else {
        const begin = r.i
        if (r.eat('CONSTRAINT')) r.identifier()
        if (r.eat('PRIMARY')) { r.expect('KEY'); constraint(table, tokens.slice(begin, r.i), name) }
        else if (r.eat('UNIQUE')) constraint(table, tokens.slice(begin, r.i), name)
        else if (r.eat('REFERENCES')) { constraint(table, tokens.slice(begin), name); r.i = tokens.length }
        else {
          // Skip expression bodies and quoted keywords, but continue at unambiguous column constraints.
          let nesting = 0
          r.i = Math.max(r.i, begin + 1)
          while (r.i < tokens.length) {
            const t = tokens[r.i]
            if (!nesting && (word(t, 'NOT') && word(tokens[r.i + 1], 'NULL') || word(t, 'PRIMARY') && word(tokens[r.i + 1], 'KEY') || word(t, 'UNIQUE') || word(t, 'REFERENCES') || word(t, 'CONSTRAINT'))) break
            if (word(t, '(')) nesting++
            if (word(t, ')')) nesting--
            r.i++
          }
          warn(`${table.name}.${name}: column clauses retained in source but not modeled: ${raw(tokens.slice(begin, r.i))}.`)
        }
      }
    }
  }
  let statements: Token[][]
  try { statements = split(tokenize(sql), ';') } catch (e) { errors.push((e as Error).message); return result }
  const alters: Token[][] = []
  for (const statement of statements) {
    try {
      const r = new Reader(statement)
      if (r.eat('CREATE')) {
        r.eat('TEMPORARY'); r.eat('TEMP'); r.eat('GLOBAL'); r.eat('LOCAL')
        if (!r.eat('TABLE')) { warn(`Unsupported statement omitted: ${raw(statement).slice(0, 180)}.`); continue }
        if (r.eat('IF')) { r.expect('NOT'); r.expect('EXISTS') }
        const name = r.name()
        if (findTable(name)) throw new Error(`Duplicate table ${name}; later declaration omitted.`)
        const body = r.group()
        const table: ErdDdlTable = { id: `ddl_table_${tables.length + 1}`, name, columns: [], primaryKey: [], uniqueKeys: [], foreignKeys: [], source: raw(statement) }
        for (const part of split(body, ',')) {
          try {
            if (constraint(table, part)) continue
            if (['CONSTRAINT', 'CHECK', 'KEY', 'INDEX', 'FULLTEXT', 'EXCLUDE', 'PERIOD'].some(w => word(part[0], w))) { warn(`${name}: unsupported table clause omitted: ${raw(part)}.`); continue }
            column(table, part)
          } catch (e) { errors.push((e as Error).message) }
        }
        if (r.rest().length) warn(`${name}: table options retained in source but not modeled: ${raw(r.rest())}.`)
        if (table.columns.length) tables.push(table)
        else errors.push(`${name}: no usable columns; table omitted.`)
      } else if (r.eat('ALTER')) alters.push(statement)
      else warn(`Unsupported statement omitted: ${raw(statement).slice(0, 180)}.`)
    } catch (e) { errors.push((e as Error).message) }
  }
  for (const statement of alters) {
    try {
      const r = new Reader(statement); r.expect('ALTER'); r.expect('TABLE'); r.eat('ONLY')
      const name = r.name(), table = findTable(name)
      if (!table) throw new Error(`ALTER TABLE target ${name} was not imported.`)
      table.source += ';\n' + raw(statement)
      for (const part of split(r.rest(), ',')) {
        const add = new Reader(part); add.expect('ADD')
        const groups = word(add.ts[add.i], '(') ? split(add.group(), ',') : [add.rest()]
        for (const group of groups) if (!constraint(table, group)) warn(`${name}: unsupported ALTER clause omitted: ${raw(group)}.`)
      }
    } catch (e) { errors.push((e as Error).message) }
  }
  for (const table of tables) {
    if (table.name.includes('.')) warn(`${table.name}: qualified or dotted names are retained for review; ERD-to-DDL export quotes a single table name and does not reproduce schema qualification.`)
    for (const key of [table.primaryKey, ...table.uniqueKeys]) for (const name of key) if (!table.columns.some(c => c.name === name)) errors.push(`${table.name}: key references missing column ${name}.`)
    for (const c of table.columns) { c.primaryKey = table.primaryKey.includes(c.name); c.unique = table.uniqueKeys.some(k => k.length === 1 && k[0] === c.name); if (c.primaryKey) c.nullable = false }
    if (table.uniqueKeys.length) warn(`${table.name}: UNIQUE keys are preserved in import metadata; the editable ERD attribute format does not fully represent unique constraints.`)
    result.diagram.boxes.push({ id: table.id, title: table.name, kind: 'entity', members: table.columns.map(c => {
      if (/[:\r\n]|<<|^\*/.test(c.name)) warn(`${table.name}.${c.name}: identifier contains ERD attribute delimiters; preserved for display but cannot safely round-trip through the current ERD attribute format.`)
      const type = diagramType(c.type, dialect, message => warn(`${table.name}.${c.name}: ${message}`))
      return `${c.primaryKey ? '*' : ''}${c.name} : ${type}${c.nullable ? ' NULL' : ' NOT NULL'}${table.foreignKeys.some(f => f.columns.includes(c.name)) ? ' <<FK>>' : ''}`
    }) })
  }
  for (const table of tables) for (const fk of table.foreignKeys) {
    const target = findTable(fk.referencedTable)
    if (!target) { warn(`${table.name}: foreign key target ${fk.referencedTable} is missing; relationship omitted.`); continue }
    if (!fk.referencedColumns.length) fk.referencedColumns = [...target.primaryKey]
    if (!fk.columns.length || fk.columns.length !== fk.referencedColumns.length || fk.columns.some(n => !table.columns.some(c => c.name === n)) || fk.referencedColumns.some(n => !target.columns.some(c => c.name === n))) { errors.push(`${table.name}: invalid or unresolved foreign key to ${target.name}; relationship omitted.`); continue }
    const same = (a: string[], b: string[]) => a.length === b.length && a.every(n => b.includes(n))
    if (![target.primaryKey, ...target.uniqueKeys].some(k => same(k, fk.referencedColumns))) { warn(`${table.name}: referenced columns in ${target.name} are not a declared PRIMARY/UNIQUE key; cardinality cannot be verified, relationship omitted.`); continue }
    const unique = [table.primaryKey, ...table.uniqueKeys].some(k => k.length > 0 && k.every(n => fk.columns.includes(n)))
    const optional = fk.columns.some(n => table.columns.find(c => c.name === n)!.nullable)
    result.diagram.links.push({ erdForeignKey: { childNodeId: table.id, parentNodeId: target.id, columns: [...fk.columns], referencedColumns: [...fk.referencedColumns] }, source: table.id, target: target.id, label: `${fk.columns.join(', ')} → ${fk.referencedColumns.join(', ')}`, sourceEnd: { many: !unique, optional: true }, targetEnd: { many: false, optional }, lineStyle: 'solid' })
    if (fk.columns.length > 1) warn(`${table.name} → ${target.name}: composite FK mapping is preserved in metadata and relationship label; ERD-to-DDL regeneration may not reproduce composite foreign keys.`)
  }
  if (!tables.length && !errors.length) errors.push('No supported CREATE TABLE definitions found.')
  return result
}
