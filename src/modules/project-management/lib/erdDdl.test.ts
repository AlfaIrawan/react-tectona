import { describe, expect, it } from 'vitest'
import type { Node, Edge } from 'reactflow'
import { generateErdDdl, selectErdDdlScope } from './erdDdl'
import { ERD_SQL_DIALECTS, type ErdSqlDialect } from './erdDdlDialects'
const header = (dialect: ErdSqlDialect) => `-- Target: ${ERD_SQL_DIALECTS[dialect].target}\n-- Review-only generated DDL. Structural checks only; not validated by a database.\n`
const node = (id: string, title: string, description: string[], selected = true): Node => ({ id, type: 'erdEntity', position: { x: 0, y: 0 }, selected, data: { kind: 'element', title, description } })
const fixture = () => ({ nodes: [node('p', 'person', ['*id : INT']), node('c', 'order', ['*id : INT', 'person_id : INT NOT NULL <<FK>>', 'note : VARCHAR(100) NULL'])], edges: [{ id: 'pc', source: 'p', target: 'c', selected: true, data: { sourceMany: false, targetMany: true, sourceOptional: false, targetOptional: true } } as Edge] })
describe('ERD DDL generation', () => {
 it('generates exact reviewable PostgreSQL DDL and preserves PK/FK and explicit nullability', () => {
  expect(generateErdDdl(fixture(), 'postgresql')).toEqual({ tableCount: 2, target: ERD_SQL_DIALECTS.postgresql.target, engineConfirmed: false, warnings: [], errors: [], sql: header('postgresql') + 'CREATE TABLE "person" (\n  "id" INT NOT NULL,\n  PRIMARY KEY ("id")\n);\n\nCREATE TABLE "order" (\n  "id" INT NOT NULL,\n  "person_id" INT NOT NULL,\n  "note" VARCHAR(100),\n  PRIMARY KEY ("id")\n);\n\nALTER TABLE "order" ADD FOREIGN KEY ("person_id") REFERENCES "person" ("id");' })
 })
 it('quotes MySQL identifiers and supports composite primary keys', () => {
  expect(generateErdDdl({ nodes: [node('a', 'ta`ble', ['*a : INT', '*b : INT'])], edges: [] }, 'mysql').sql).toBe(header('mysql') + 'CREATE TABLE `ta``ble` (\n  `a` INT NOT NULL,\n  `b` INT NOT NULL,\n  PRIMARY KEY (`a`, `b`)\n) ENGINE=InnoDB;')
 })
 it('contains hostile identifiers and rejects injected types/control characters', () => {
  const result = generateErdDdl({ nodes: [node('a', 'a"; DROP TABLE x;--', ['id : INT); DROP TABLE x;--', 'bad\u0000name : INT'])], edges: [] }, 'postgresql')
  expect(result.sql).toBe(header('postgresql') + 'CREATE TABLE "a""; DROP TABLE x;--" (\n  "id" TEXT\n);'); expect(result.errors).toHaveLength(1); expect(result.warnings).toHaveLength(2)
 })
 it('reports duplicates, missing types and empty tables rather than emitting invalid definitions', () => {
  const result = generateErdDdl({ nodes: [node('a', 'a', ['id', 'ID : INT']), node('b', 'A', ['x : INT']), node('c', 'empty', [])], edges: [] }, 'postgresql')
  expect(result.tableCount).toBe(1); expect(result.errors).toHaveLength(3); expect(result.warnings.join(' ')).toContain('nullability unspecified')
 })
 it('does not infer nullability from cardinality or synthesize many-to-many junction tables', () => {
  const graph = fixture(); graph.nodes[1].data.description[1] = 'person_id : INT <<FK>>'; graph.edges[0].data.sourceMany = true
  const result = generateErdDdl(graph, 'postgresql'); expect(result.sql).not.toContain('ALTER TABLE'); expect(result.tableCount).toBe(2); expect(result.warnings.join(' ')).toContain('many-to-many'); expect(result.warnings.join(' ')).toContain('nullability unspecified')
 })
 it('generates only clicked entity and warns about dependencies outside selection', () => {
  const graph = fixture(); graph.nodes.forEach(n => n.selected = false)
  const scope = selectErdDdlScope(graph.nodes, graph.edges, 'c'); const result = generateErdDdl(scope, 'postgresql'); expect(result.tableCount).toBe(1); expect(result.sql).not.toContain('CREATE TABLE "person"'); expect(result.sql).not.toContain('ALTER TABLE'); expect(result.warnings.join(' ')).toContain('outside the selected')
 })
 it('requires selected relationships, explicit FK markers and unambiguous keys', () => {
  const graph = fixture(); graph.edges[0].selected = false; expect(generateErdDdl(graph, 'postgresql').sql).not.toContain('ALTER TABLE'); graph.edges[0].selected = true; graph.nodes[1].data.description[1] = 'person_id : INT'; expect(generateErdDdl(graph, 'postgresql').sql).not.toContain('ALTER TABLE')
  graph.nodes[1].data.description[1] = 'person_id : INT <<FK>>'; graph.edges.push({ ...graph.edges[0], id: 'duplicate' }); expect(generateErdDdl(graph, 'postgresql').sql).not.toContain('ALTER TABLE')
 })
})
it('supports one-to-one only with an unambiguous FK direction and adds UNIQUE', () => {
 const graph = fixture(); graph.edges[0].data.targetMany = false
 const result = generateErdDdl(graph, 'postgresql'); expect(result.sql).toContain('ALTER TABLE "order" ADD UNIQUE ("person_id");'); expect(result.sql).toContain('ADD FOREIGN KEY')
})
it('infers optionality only from a mapped relationship and preserves explicit nullability conflicts', () => {
 const graph = fixture(); graph.nodes[1].data.description[1] = 'person_id : INT <<FK>>'
 let result = generateErdDdl(graph, 'postgresql'); expect(result.sql).toContain('"person_id" INT NOT NULL'); expect(result.warnings.join(' ')).toContain('inferred from selected relationship')
 graph.edges[0].data.sourceOptional = true; result = generateErdDdl(graph, 'postgresql'); expect(result.sql).toContain('"person_id" INT,')
 graph.nodes[1].data.description[1] = 'person_id : INT NOT NULL <<FK>>'; result = generateErdDdl(graph, 'postgresql'); expect(result.warnings.join(' ')).toContain('conflicts with relationship')
})
it('omits unsupported key types and warns about MySQL string key limits', () => {
 expect(generateErdDdl({ nodes: [node('a', 'a', ['*id : TEXT'])], edges: [] }, 'mysql').tableCount).toBe(0)
 expect(generateErdDdl({ nodes: [node('a', 'a', ['*id : JSON'])], edges: [] }, 'postgresql').tableCount).toBe(0)
 expect(generateErdDdl({ nodes: [node('a', 'a', ['*id : VARCHAR(9999)'])], edges: [] }, 'mysql').warnings.join(' ')).toContain('charset')
})
it('normalizes equivalent FK type aliases and rejects oversized MySQL CHAR', () => {
 const graph = fixture(); graph.nodes[1].data.description[1] = 'person_id : INTEGER NOT NULL <<FK>>'; expect(generateErdDdl(graph, 'postgresql').sql).toContain('ADD FOREIGN KEY')
 const result = generateErdDdl({ nodes: [node('a', 'a', ['value : CHAR(256)'])], edges: [] }, 'mysql'); expect(result.sql).toContain('`value` TEXT'); expect(result.warnings.join(' ')).toContain('exceeds 255')
})
for (const dialect of ['sybase-ase', 'sql-anywhere', 'db2', 'ingres', 'openedge', 'informix', 'firebird', 'sqlite', 'h2', 'cache', 'hsqldb'] as const) it(`${dialect} emits FK inline after selected parent creation without adding dependencies`, () => {
 const graph = fixture(); graph.nodes.reverse()
 const result = generateErdDdl(graph, dialect); const profile = ERD_SQL_DIALECTS[dialect]
 expect(result.sql).toContain(`FOREIGN KEY (${profile.quote('person_id')}) REFERENCES ${profile.quote('person')} (${profile.quote('id')})`); expect(result.sql).not.toContain('ALTER TABLE')
 if (dialect !== 'sqlite') expect(result.sql.indexOf(`CREATE TABLE ${profile.quote('person')}`)).toBeLessThan(result.sql.indexOf(`CREATE TABLE ${profile.quote('order')}`))
})
it('omits cyclic inline dependencies explicitly but preserves SQLite forward references', () => {
 const graph = fixture(); graph.nodes[0].data.description.push('order_id : INT <<FK>>'); graph.edges.push({ id: 'cp', source: 'c', target: 'p', selected: true, data: { sourceMany: false, targetMany: true } })
 const result = generateErdDdl(graph, 'informix'); expect(result.sql).not.toContain('FOREIGN KEY'); expect(result.warnings.join(' ')).toContain('cyclic or cycle-dependent'); expect(result.tableCount).toBe(2)
 expect(generateErdDdl(graph, 'sqlite').sql.match(/FOREIGN KEY/g)).toHaveLength(2)
})
it('warns instead of emitting unsupported nullable UNIQUE for Ingres', () => {
 const graph = fixture(); graph.edges[0].data.targetMany = false; graph.edges[0].data.sourceOptional = true; graph.nodes[1].data.description[1] = 'person_id : INT NULL <<FK>>'
 const result = generateErdDdl(graph, 'ingres'); expect(result.sql).not.toContain('UNIQUE'); expect(result.sql).toContain('FOREIGN KEY'); expect(result.warnings.join(' ')).toContain('nullable UNIQUE is not supported')
 const sqlServer = generateErdDdl(graph, 'sqlserver'); expect(sqlServer.sql).toContain('CREATE UNIQUE INDEX'); expect(sqlServer.sql).toContain('WHERE [person_id] IS NOT NULL')
})

 it('warns that imported SQL metadata is not replayed during regeneration', () => {
  const imported = node('a', 'account', ['*id : INT'])
  imported.data.erdDdlImport = { source: 'CREATE TABLE account (id INT DEFAULT 7 PRIMARY KEY)' }
  const result = generateErdDdl({ nodes: [imported], edges: [] }, 'postgresql')
  expect(result.warnings.join(' ')).toContain('not the retained SQL source')
  expect(result.sql).not.toContain('DEFAULT 7')
 })
