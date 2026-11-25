import { describe, expect, it } from 'vitest'
import { ERD_SQL_DIALECTS, type ErdSqlDialect } from './erdDdlDialects'
import { generateErdDdl } from './erdDdl'
const dialects = Object.keys(ERD_SQL_DIALECTS) as ErdSqlDialect[]
for (const dialect of dialects) describe(`${dialect} SQL target profile`, () => {
 it('states its version baseline without claiming engine validation', () => {
  const profile = ERD_SQL_DIALECTS[dialect]
  const result = generateErdDdl({ nodes: [{ id: 'a', type: 'erdEntity', position: { x: 0, y: 0 }, data: { kind: 'element', title: 'Order', description: ['*id : INT', 'active : BOOLEAN', 'data : JSON', 'created : TIMESTAMP', 'token : UUID'] } }], edges: [] }, dialect)
  expect(result.sql).toContain(`-- Target: ${profile.target}`); expect(result.engineConfirmed).toBe(false); expect(result.tableCount).toBe(1); expect(result.errors).toEqual([]); expect(result.sql).toContain(profile.quote('Order')); expect(result.sql).toContain(profile.mapType('UUID').sql)
 })
 it('maps untrusted input to a safe literal type and validates decimal bounds', () => {
  const profile = ERD_SQL_DIALECTS[dialect]
  for (const type of ['INT); DROP TABLE a;--', 'VARCHAR(2) DEFAULT evil()', 'DECIMAL(9,10)', 'VARCHAR(-1)', 'INT\u0000']) {
   const mapped = profile.mapType(type); expect(mapped.sql).not.toContain('DROP'); expect(mapped.sql).not.toContain('DEFAULT'); expect(mapped.warnings.length).toBeGreaterThan(0); expect(mapped.keyEligible).toBe(false)
  }
 })
 it('rejects over-limit identifiers and unsupported JSON keys', () => {
  const result = generateErdDdl({ nodes: [{ id: 'a', type: 'erdEntity', position: { x: 0, y: 0 }, data: { kind: 'element', title: 'a'.repeat(Number.isFinite(ERD_SQL_DIALECTS[dialect].identifierLimit) ? ERD_SQL_DIALECTS[dialect].identifierLimit + 1 : 300), description: ['*id : INT'] } }], edges: [] }, dialect)
  if (Number.isFinite(ERD_SQL_DIALECTS[dialect].identifierLimit)) { expect(result.tableCount).toBe(0); expect(result.sql).toBe('') } else expect(result.tableCount).toBe(1); expect(ERD_SQL_DIALECTS[dialect].mapType('JSON').keyEligible).toBe(false)
 })
})
it('maps the five primary targets distinctly', () => {
 expect(ERD_SQL_DIALECTS.postgresql.mapType('UUID').sql).toBe('UUID')
 expect(ERD_SQL_DIALECTS.mysql.mapType('UUID').sql).toBe('CHAR(36)')
 expect(ERD_SQL_DIALECTS.mariadb.mapType('UUID').sql).toBe('UUID')
 expect(ERD_SQL_DIALECTS.oracle.mapType('UUID').sql).toBe('RAW(16)')
 expect(ERD_SQL_DIALECTS.sqlserver.mapType('UUID').sql).toBe('UNIQUEIDENTIFIER')
 expect(ERD_SQL_DIALECTS.oracle.mapType('BOOLEAN')).toMatchObject({ sql: 'NUMBER(1)', check: 'boolean' })
 expect(ERD_SQL_DIALECTS.sqlserver.mapType('BOOLEAN').sql).toBe('BIT')
 expect(ERD_SQL_DIALECTS.oracle.mapType('JSON')).toMatchObject({ sql: 'CLOB', check: 'json' })
 expect(ERD_SQL_DIALECTS.sqlserver.mapType('JSON')).toMatchObject({ sql: 'NVARCHAR(MAX)', check: 'json' })
 expect(ERD_SQL_DIALECTS.sqlserver.mapType('TIMESTAMP').sql).toBe('DATETIME2(6)')
})
it('quotes delimiters correctly and rejects Oracle quoted-name restrictions', () => {
 expect(ERD_SQL_DIALECTS.sqlserver.quote('a]b')).toBe('[a]]b]'); expect(ERD_SQL_DIALECTS.mariadb.quote('a`b')).toBe('`a``b`'); expect(ERD_SQL_DIALECTS.postgresql.quote('a"b')).toBe('"a""b"')
 expect(ERD_SQL_DIALECTS.oracle.validateIdentifier?.('a"b')).toBe(false); expect(ERD_SQL_DIALECTS.oracle.validateIdentifier?.('ROWID')).toBe(false)
})
it('enforces dialect-specific string and numeric limits', () => {
 expect(ERD_SQL_DIALECTS.oracle.mapType('VARCHAR(4001)').sql).toBe('CLOB'); expect(ERD_SQL_DIALECTS.sqlserver.mapType('VARCHAR(8001)').sql).toBe('NVARCHAR(MAX)')
 expect(ERD_SQL_DIALECTS.oracle.mapType('DECIMAL(39,0)').keyEligible).toBe(false); expect(ERD_SQL_DIALECTS.sqlserver.mapType('DECIMAL(39,0)').keyEligible).toBe(false)
 expect(ERD_SQL_DIALECTS.mysql.mapType('DECIMAL(65,31)').keyEligible).toBe(false); expect(ERD_SQL_DIALECTS.mariadb.mapType('DECIMAL(65,31)').keyEligible).toBe(true)
})
it.each([
 ['postgresql', '"', 'INT', '', ''], ['mysql', '`', 'INT', ' ENGINE=InnoDB', ''], ['mariadb', '`', 'INT', ' ENGINE=InnoDB', ''], ['oracle', '"', 'NUMBER(10)', '', ''], ['sqlserver', '[', 'INT', '', ''],
 ['sybase-ase', '"', 'INTEGER', '', 'SET QUOTED_IDENTIFIER ON;\n\n'], ['sql-anywhere', '"', 'INTEGER', '', "SET TEMPORARY OPTION quoted_identifier = 'On';\n\n"], ['db2', '"', 'INTEGER', '', ''], ['ingres', '"', 'INTEGER', '', ''], ['openedge', '"', 'INTEGER', '', ''], ['informix', '"', 'INTEGER', '', ''], ['firebird', '"', 'INTEGER', '', ''], ['sqlite', '"', 'INTEGER', '', 'PRAGMA foreign_keys = ON;\n\n'], ['h2', '"', 'INTEGER', '', ''], ['cache', '"', 'INTEGER', '', ''], ['hsqldb', '"', 'INTEGER', '', ''],
] as const)('emits exact one-table SQL for %s', (dialect, delimiter, type, suffix, preamble) => {
 const result = generateErdDdl({ nodes: [{ id: 'a', type: 'erdEntity', position: { x: 0, y: 0 }, data: { kind: 'element', title: 'item', description: ['*id : INT'] } }], edges: [] }, dialect)
 const q = (value: string) => delimiter + value + (delimiter === '[' ? ']' : delimiter)
 expect(result.sql).toBe(`-- Target: ${ERD_SQL_DIALECTS[dialect].target}\n-- Review-only generated DDL. Structural checks only; not validated by a database.\n${preamble}CREATE TABLE ${q('item')} (\n  ${q('id')} ${type} NOT NULL,\n  PRIMARY KEY (${q('id')})\n)${suffix};`)
})
it('keeps all 16 active products separate and excludes retired or unverified targets', () => {
 expect(dialects).toHaveLength(16); expect(dialects).not.toContain('derby'); expect(dialects).not.toContain('frontbase'); expect(dialects).toContain('h2'); expect(dialects).toContain('hsqldb'); expect(dialects).toContain('cache')
})

it('renders the accented Cache product name without encoding loss', () => {
 expect(ERD_SQL_DIALECTS.cache.label).toBe('InterSystems Cach\u00e9')
 expect(JSON.stringify(ERD_SQL_DIALECTS)).not.toContain('\uFFFD')
})

it('targets supported MySQL 8.4 LTS rather than the retired 8.0 baseline', () => {
 expect(ERD_SQL_DIALECTS.mysql.target).toBe('MySQL 8.4 LTS / InnoDB')
 expect(ERD_SQL_DIALECTS.mysql.notes.join(' ')).toContain('April 2026')
})
