import { describe, expect, it } from 'vitest'
import { parseErdDdl } from './erdDdlImport'
import { generateErdDdl } from './erdDdl'
import { ERD_SQL_DIALECTS, type ErdSqlDialect } from './erdDdlDialects'

it.each(Object.keys(ERD_SQL_DIALECTS) as ErdSqlDialect[])('structurally round-trips an integer PK/FK fixture for %s (no database execution)', dialect => {
  const fixture = {
    nodes: [
      { id: 'p', type: 'erdEntity', position: { x: 0, y: 0 }, selected: true, data: { kind: 'element', title: 'parent', description: ['*id : INT'] } },
      { id: 'c', type: 'erdEntity', position: { x: 0, y: 0 }, selected: true, data: { kind: 'element', title: 'child', description: ['*id : INT', 'parent_id : INT NOT NULL <<FK>>'] } },
    ],
    edges: [{ id: 'fk', source: 'c', target: 'p', selected: true, data: { sourceMany: true, sourceOptional: true, targetMany: false, targetOptional: false } }],
  }
  const generated = generateErdDdl(fixture, dialect)
  expect(generated.errors).toEqual([])
  const imported = parseErdDdl(generated.sql, dialect)
  expect(imported.errors).toEqual([])
  expect(imported.tables).toHaveLength(2)
  expect(imported.diagram.links).toHaveLength(1)
  const regenerated = generateErdDdl({
    nodes: imported.diagram.boxes.map(b => ({ id: b.id, type: 'erdEntity', position: { x: 0, y: 0 }, selected: true, data: { kind: 'element', title: b.title, description: b.members } })),
    edges: imported.diagram.links.map((l, i) => ({ id: String(i), source: l.source, target: l.target, selected: true, data: { sourceMany: l.sourceEnd?.many, sourceOptional: l.sourceEnd?.optional, targetMany: l.targetEnd?.many, targetOptional: l.targetEnd?.optional } })),
  }, dialect)
  expect(regenerated.errors).toEqual([])
  expect(regenerated.sql).toContain('FOREIGN KEY')
  expect(parseErdDdl(regenerated.sql, dialect).diagram.links).toHaveLength(1)
})

describe('parseErdDdl', () => {
  it('reads quoted names, nested types, comments and composite keys', () => {
    const result = parseErdDdl(`-- local input only
      CREATE TABLE "Parent" ("a" INT, b DECIMAL(10,2), PRIMARY KEY ("a",b));
      CREATE TABLE child (a INT NOT NULL, b DECIMAL(10,2) NOT NULL, note VARCHAR(50) DEFAULT 'a,b); --',
        CONSTRAINT fk FOREIGN KEY(a,b) REFERENCES "Parent"("a",b) ON DELETE CASCADE);`)
    expect(result.errors).toEqual([])
    expect(result.tables).toHaveLength(2)
    expect(result.tables[0].primaryKey).toEqual(['a', 'b'])
    expect(result.tables[1].columns[2].type).toBe('VARCHAR(50)')
    expect(result.diagram.links[0]).toMatchObject({ sourceEnd: { many: true, optional: true }, targetEnd: { many: false, optional: false } })
    expect(result.warnings.join(' ')).toMatch(/ON DELETE CASCADE/)
    expect(result.warnings.join(' ')).toMatch(/composite FK/)
  })
  it('resolves deferred ALTER keys, one-to-one uniqueness and nullable children', () => {
    const r = parseErdDdl('CREATE TABLE p (id INT); CREATE TABLE c (pid INT); ALTER TABLE p ADD CONSTRAINT pk PRIMARY KEY(id); ALTER TABLE c ADD UNIQUE(pid); ALTER TABLE c ADD FOREIGN KEY(pid) REFERENCES p;')
    expect(r.errors).toEqual([])
    expect(r.diagram.links[0]).toMatchObject({ sourceEnd: { many: false, optional: true }, targetEnd: { many: false, optional: true } })
  })
  it('supports SQL Server and MySQL escaped identifiers and defaults', () => {
    const r = parseErdDdl('CREATE TABLE [a]]b] ([i]]d] INT PRIMARY KEY, [text] VARCHAR(40) DEFAULT (concat(\'a;\',\'b\')));', 'sqlserver')
    expect(r.errors).toEqual([])
    expect(r.tables[0].name).toBe('a]b')
    expect(r.tables[0].primaryKey).toEqual(['i]d'])
    expect(parseErdDdl('CREATE TABLE `a``b` (`id` INT PRIMARY KEY) ENGINE=InnoDB;', 'mysql').tables[0].name).toBe('a`b')
  })
  it('reports missing references and unknown statements without inventing nodes', () => {
    const r = parseErdDdl('CREATE TABLE c (pid INT REFERENCES missing(id)); DROP TABLE danger; CREATE INDEX idx ON c(pid);')
    expect(r.diagram.boxes).toHaveLength(1)
    expect(r.diagram.links).toHaveLength(0)
    expect(r.warnings.join(' ')).toMatch(/missing/)
    expect(r.warnings.filter(w => w.startsWith('Unsupported statement'))).toHaveLength(2)
  })
  it('rejects malformed lexical input without a partial diagram', () => {
    for (const sql of ['CREATE TABLE t (id INT', 'CREATE TABLE t (x TEXT DEFAULT \'oops)', '/* unfinished']) {
      const r = parseErdDdl(sql)
      expect(r.errors.length).toBeGreaterThan(0)
      expect(r.tables).toHaveLength(0)
    }
  })
  it('does not infer valid cardinalities from non-unique parent columns', () => {
    const r = parseErdDdl('CREATE TABLE p (id INT); CREATE TABLE c (pid INT REFERENCES p(id));')
    expect(r.diagram.links).toEqual([])
    expect(r.warnings.join(' ')).toMatch(/cardinality cannot be verified/)
  })
  it('preserves dollar strings and ignores delimiter-like comments', () => {
    const r = parseErdDdl('CREATE TABLE t (id INT PRIMARY KEY, note TEXT DEFAULT $$hello; (world),$$ /* ; */);')
    expect(r.tables[0].columns).toHaveLength(2)
    expect(r.errors).toEqual([])
    expect(r.warnings.join(' ')).toContain('$$hello; (world),$$')
  })
})

it('keeps DEFAULT expressions separate from following NOT NULL and PRIMARY KEY clauses', () => {
  const r = parseErdDdl("CREATE TABLE t (id INT DEFAULT (abs(-1)) NOT NULL PRIMARY KEY, txt TEXT DEFAULT 'NOT NULL, REFERENCES nope(id)' NOT NULL);")
  expect(r.errors).toEqual([])
  expect(r.tables[0].columns.every(c => !c.nullable)).toBe(true)
  expect(r.tables[0].primaryKey).toEqual(['id'])
})

it('warns about unsupported named CHECK constraints rather than adding fake columns', () => {
  const r = parseErdDdl('CREATE TABLE t (id INT, CONSTRAINT valid CHECK(id > 0));')
  expect(r.errors).toEqual([])
  expect(r.tables[0].columns).toHaveLength(1)
  expect(r.warnings.join(' ')).toContain('unsupported table clause')
})

it('retains Oracle physical types while normalizing diagram attributes conservatively', () => {
  const r = parseErdDdl('CREATE TABLE "t" ("id" NUMBER(10) PRIMARY KEY, "name" VARCHAR2(100 BYTE));', 'oracle')
  expect(r.errors).toEqual([])
  expect(r.tables[0].columns[0].type).toBe('NUMBER(10)')
  expect(r.diagram.boxes[0].members[0]).toContain('DECIMAL(10,0)')
  expect(r.diagram.boxes[0].members[1]).toContain('VARCHAR(100)')
  expect(r.warnings.join(' ')).toContain('Original type is retained')
})
