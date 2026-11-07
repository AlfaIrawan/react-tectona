/** Review-only SQL profiles. These targets are syntax baselines, not a claim that
 * generated SQL has been accepted by an engine or by a user's existing schema. */
export type ErdSqlDialect = 'postgresql' | 'mysql' | 'mariadb' | 'oracle' | 'sqlserver' | 'sybase-ase' | 'sql-anywhere' | 'db2' | 'ingres' | 'openedge' | 'informix' | 'firebird' | 'sqlite' | 'h2' | 'cache' | 'hsqldb'
export type ErdSqlType = { sql: string; keyEligible: boolean; warnings: string[]; check?: 'boolean' | 'json' }
export type ErdSqlProfile = {
  label: string
  target: string
  identifierLimit: number
  identifierUnit: 'bytes' | 'characters' | 'utf16'
  quote: (name: string) => string
  mapType: (input: string) => ErdSqlType
  notes: string[]
  foreignKeyPlacement: 'inline' | 'alter'
  engineConfirmed: false
  validateIdentifier?: (name: string) => boolean
  preamble?: string[]
  explicitNullable?: boolean
  enabled?: boolean
  unavailableReason?: string
  sources?: string[]
  nullableUnique?: 'supported' | 'omit'
  forwardReferences?: boolean
  tableSuffix?: string
}
const doubleQuote = (name: string) => '"' + name.replace(/"/g, '""') + '"'
const backtick = (name: string) => '`' + name.replace(/`/g, '``') + '`'
const brackets = (name: string) => '[' + name.replace(/]/g, ']]') + ']'

function mappedType(input: string, dialect: ErdSqlDialect): ErdSqlType {
  const warnings: string[] = []
  const mysqlFamily = dialect === 'mysql' || dialect === 'mariadb'
  const text = dialect === 'oracle' ? 'CLOB' : dialect === 'sqlserver' ? 'NVARCHAR(MAX)' : 'TEXT'
  const fallback = (message: string): ErdSqlType => ({ sql: text, keyEligible: false, warnings: [...warnings, `${message}; replaced with ${text}. Review required.`] })
  let type = input.replace(/^INTEGER$/, 'INT').replace(/^BOOL$/, 'BOOLEAN')
  if (!/^(SMALLINT|INT|BIGINT|TEXT|BOOLEAN|DATE|DATETIME|TIMESTAMP|TIME|REAL|DOUBLE PRECISION|FLOAT|JSON|UUID|VARCHAR\([1-9]\d{0,3}\)|CHAR\([1-9]\d{0,2}\)|(?:DECIMAL|NUMERIC)\([1-9]\d?(?:,\d{1,2})?\))$/.test(type)) return fallback(`Unsupported or missing type ${type || '(empty)'}`)
  const decimal = type.match(/^(?:DECIMAL|NUMERIC)\((\d+)(?:,(\d+))?\)$/)
  if (decimal) {
    const precision = +decimal[1], scale = +(decimal[2] || 0)
    const limit = mysqlFamily ? 65 : dialect === 'postgresql' ? 99 : 38
    const scaleLimit = dialect === 'mysql' ? 30 : dialect === 'mariadb' ? 38 : limit
    if (precision > limit || scale > precision || scale > scaleLimit) return fallback(`Unsupported precision/scale for ${dialect}`)
    if (dialect === 'oracle') type = `NUMBER(${precision},${scale})`
  }
  const sized = type.match(/^(VARCHAR|CHAR)\((\d+)\)$/)
  if (sized) {
    const length = +sized[2], char = sized[1] === 'CHAR'
    const limit = mysqlFamily && char ? 255 : dialect === 'oracle' ? char ? 2000 : 4000 : dialect === 'sqlserver' ? 8000 : 9999
    if (length > limit) return fallback(`${dialect} ${sized[1]} length exceeds ${limit}`)
    if (dialect === 'oracle') { type = `${char ? 'CHAR' : 'VARCHAR2'}(${length} BYTE)`; warnings.push('Oracle string length uses bytes, not characters; review your database character set.') }
    if (dialect === 'sqlserver') warnings.push('VARCHAR/CHAR use database collation encoding, not guaranteed Unicode; review collation and byte lengths.')
  }
  let check: ErdSqlType['check']
  if (type === 'UUID') {
    type = dialect === 'oracle' ? 'RAW(16)' : dialect === 'sqlserver' ? 'UNIQUEIDENTIFIER' : dialect === 'mysql' ? 'CHAR(36)' : 'UUID'
    if (dialect !== 'postgresql') warnings.push(`UUID represented as ${type}; no identifier generation/default is added. Review application serialization.`)
  }
  if (type === 'BOOLEAN') {
    if (dialect === 'oracle') { type = 'NUMBER(1)'; check = 'boolean'; warnings.push('Oracle 19c SQL has no BOOLEAN column type; NUMBER(1) with a 0/1 CHECK is used.') }
    else if (dialect === 'sqlserver') { type = 'BIT'; warnings.push('BOOLEAN represented as BIT; SQL Server conversion rules may coerce nonzero inputs.') }
    else if (mysqlFamily) { check = 'boolean'; warnings.push('BOOLEAN is a TINYINT alias; a 0/1 CHECK is added for this target version.') }
  }
  if (type === 'TEXT') type = text
  if (type === 'JSON') {
    if (dialect === 'oracle') { type = 'CLOB'; check = 'json'; warnings.push('Oracle 19c JSON represented as CLOB with IS JSON CHECK.') }
    if (dialect === 'sqlserver') { type = 'NVARCHAR(MAX)'; check = 'json'; warnings.push('SQL Server 2022 JSON represented as NVARCHAR(MAX) with ISJSON CHECK; only objects/arrays pass ISJSON without a type constraint.') }
    if (dialect === 'mariadb') warnings.push('MariaDB JSON is a validated LONGTEXT alias, not MySQL binary JSON.')
  }
  if (dialect === 'oracle') {
    const types: Record<string, string> = { INT: 'NUMBER(10)', SMALLINT: 'NUMBER(5)', BIGINT: 'NUMBER(19)', REAL: 'BINARY_FLOAT', FLOAT: 'BINARY_DOUBLE', 'DOUBLE PRECISION': 'BINARY_DOUBLE', DATETIME: 'TIMESTAMP(0)', TIME: 'VARCHAR2(18 BYTE)' }
    if (types[type]) { const before = type; type = types[type]; warnings.push(`${before} represented as ${type}; review range, precision and application semantics.`) }
    if (type === 'DATE') warnings.push('Oracle DATE includes time to seconds; date-only semantics are not enforced.')
  } else if (dialect === 'sqlserver') {
    if (type === 'TIMESTAMP' || type === 'DATETIME') { warnings.push(`${type} interpreted as a temporal value and represented as DATETIME2(6), not SQL Server rowversion.`); type = 'DATETIME2(6)' }
    if (type === 'DOUBLE PRECISION') type = 'FLOAT(53)'
  } else if (dialect === 'postgresql' && type === 'DATETIME') { type = 'TIMESTAMP'; warnings.push('DATETIME represented as TIMESTAMP WITHOUT TIME ZONE.') }
  else if (mysqlFamily && type === 'TIMESTAMP') warnings.push('TIMESTAMP range/time-zone conversion depend on the target engine and session; review before use.')
  const keyEligible = input !== 'JSON' && !['CLOB', 'NVARCHAR(MAX)'].includes(type) && !(mysqlFamily && type === 'TEXT')
  return { sql: type, keyEligible, warnings, check }
}

type MainDialect = 'postgresql' | 'mysql' | 'mariadb' | 'oracle' | 'sqlserver'
type LegacyDialect = Exclude<ErdSqlDialect, MainDialect>
function legacyType(input: string, dialect: LegacyDialect): ErdSqlType {
  const warnings: string[] = []
  const textTypes: Record<LegacyDialect, string> = { 'sybase-ase': 'TEXT', 'sql-anywhere': 'LONG VARCHAR', db2: 'CLOB(1M)', ingres: 'LONG VARCHAR', openedge: 'CLOB', informix: 'TEXT', firebird: 'BLOB SUB_TYPE TEXT', sqlite: 'TEXT', h2: 'CLOB', cache: 'LONGVARCHAR', hsqldb: 'CLOB' }
  const fallback = (message: string): ErdSqlType => ({ sql: textTypes[dialect], keyEligible: false, warnings: [`${message}; represented as ${textTypes[dialect]}. Review required.`] })
  let type = input.replace(/^INTEGER$/, 'INT').replace(/^BOOL$/, 'BOOLEAN')
  if (!/^(SMALLINT|INT|BIGINT|TEXT|BOOLEAN|DATE|DATETIME|TIMESTAMP|TIME|REAL|DOUBLE PRECISION|FLOAT|JSON|UUID|VARCHAR\([1-9]\d{0,3}\)|CHAR\([1-9]\d{0,2}\)|(?:DECIMAL|NUMERIC)\([1-9]\d?(?:,\d{1,2})?\))$/.test(type)) return fallback(`Unsupported or missing type ${type || '(empty)'}`)
  if (type === 'JSON') return fallback('No native JSON validation is generated for this target')
  const decimal = type.match(/^(?:DECIMAL|NUMERIC)\((\d+)(?:,(\d+))?\)$/)
  if (decimal) {
    const p = +decimal[1], scale = +(decimal[2] || 0)
    const limit = dialect === 'db2' ? 31 : dialect === 'openedge' ? 50 : dialect === 'informix' ? 32 : dialect === 'sqlite' || dialect === 'h2' || dialect === 'hsqldb' ? 99 : 38
    if (p > limit || scale > p || (dialect === 'openedge' && scale > 10)) return fallback('Precision/scale exceeds this conservative target profile')
  }
  let check: ErdSqlType['check']
  if (dialect === 'sqlite') {
    if (['INT', 'SMALLINT', 'BIGINT', 'BOOLEAN'].includes(type)) { if (type === 'BOOLEAN') check = 'boolean'; type = 'INTEGER' }
    else if (decimal) { type = 'NUMERIC'; warnings.push('SQLite NUMERIC affinity is not exact fixed-precision DECIMAL; precision and scale are not enforced.') }
    else if (['REAL', 'FLOAT', 'DOUBLE PRECISION'].includes(type)) type = 'REAL'
    else { if (['DATE', 'TIME', 'DATETIME', 'TIMESTAMP'].includes(type)) warnings.push('Date/time represented as ISO-formatted TEXT by convention; no format, timezone or calendar validation is generated.'); else if (type !== 'TEXT') warnings.push(`${type} represented as TEXT; declared length/UUID format is not enforced.`); type = 'TEXT' }
    return { sql: type, keyEligible: true, warnings, check }
  }
  const sized = type.match(/^(VARCHAR|CHAR)\((\d+)\)$/)
  if (sized) {
    const n = +sized[2], char = sized[1] === 'CHAR'
    const limit = dialect === 'cache' ? 3641144 : dialect === 'sybase-ase' ? 255 : dialect === 'firebird' ? 8191 : dialect === 'informix' ? char ? 255 : 32739 : 9999
    if (n > limit) return fallback(`Length exceeds conservative ${dialect} string limit ${limit}`)
    if (dialect === 'informix' && !char && n > 255) { type = `LVARCHAR(${n})`; warnings.push('VARCHAR over 255 bytes represented as LVARCHAR; review byte limits and indexing.') }
  }
  if (type === 'UUID') {
    type = ['sql-anywhere', 'cache'].includes(dialect) ? 'UNIQUEIDENTIFIER' : ['ingres', 'h2', 'hsqldb'].includes(dialect) ? 'UUID' : 'CHAR(36)'
    warnings.push(`UUID represented as ${type}; no default/generator or string-format check is added.`)
  }
  if (type === 'BOOLEAN') {
    if (dialect === 'sybase-ase') { type = 'SMALLINT'; check = 'boolean' }
    else if (['sql-anywhere', 'openedge', 'cache'].includes(dialect)) type = 'BIT'
  }
  if (type === 'TEXT') return { sql: textTypes[dialect], keyEligible: false, warnings }
  if (['TIMESTAMP', 'DATETIME'].includes(type)) {
    type = dialect === 'sybase-ase' ? 'BIGDATETIME' : dialect === 'informix' ? 'DATETIME YEAR TO FRACTION(5)' : dialect === 'ingres' ? 'TIMESTAMP WITHOUT TIME ZONE' : 'TIMESTAMP'
    if (dialect === 'sybase-ase') warnings.push('Logical timestamp mapped to BIGDATETIME, never ASE binary TIMESTAMP/row version.')
    if (dialect === 'informix') warnings.push('Temporal value uses Informix DATETIME with fractional-second precision 5.')
  }
  if (dialect === 'informix' && type === 'TIME') type = 'DATETIME HOUR TO SECOND'
  if (dialect === 'ingres' && type === 'DATE') type = 'ANSIDATE'
  if (dialect === 'ingres' && type === 'TIME') type = 'TIME WITHOUT TIME ZONE'
  if (type === 'INT') type = 'INTEGER'
  return { sql: type, keyEligible: true, warnings, check }
}
const legacy = (dialect: LegacyDialect, config: Omit<ErdSqlProfile, 'mapType' | 'engineConfirmed' | 'quote' | 'foreignKeyPlacement'> & Partial<Pick<ErdSqlProfile, 'quote' | 'foreignKeyPlacement'>>): ErdSqlProfile => ({ quote: doubleQuote, foreignKeyPlacement: 'inline', engineConfirmed: false, mapType: input => legacyType(input, dialect), ...config })

export const ERD_SQL_DIALECTS: Record<ErdSqlDialect, ErdSqlProfile> = {
  postgresql: { label: 'PostgreSQL', target: 'PostgreSQL 16', foreignKeyPlacement: 'alter', engineConfirmed: false, identifierLimit: 63, identifierUnit: 'bytes', quote: doubleQuote, mapType: type => mappedType(type, 'postgresql'), notes: ['Quoted names preserve case. No schema, ownership, defaults, identity, extensions or migrations are generated.', 'Index size limits depend on row values and encoding; review large/composite keys.'] },
  mysql: { label: 'MySQL', target: 'MySQL 8.4 LTS / InnoDB', foreignKeyPlacement: 'alter', engineConfirmed: false, validateIdentifier: name => [...name].every(c => c.codePointAt(0)! <= 0xffff), identifierLimit: 64, identifierUnit: 'characters', quote: backtick, mapType: type => mappedType(type, 'mysql'), tableSuffix: ' ENGINE=InnoDB', sources: ['https://www.mysql.com/support/eol-notice.html', 'https://dev.mysql.com/doc/refman/8.4/en/create-table.html', 'https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html'], notes: ['Targets MySQL 8.4 LTS with InnoDB and enforced CHECK constraints; MySQL 8.0 reached end of life in April 2026.', 'Table-name case sensitivity varies by operating system. Charset, collation, row-size and index-byte limits must be reviewed.'] },
  mariadb: { label: 'MariaDB', target: 'MariaDB 10.11 / InnoDB', foreignKeyPlacement: 'alter', engineConfirmed: false, validateIdentifier: name => [...name].every(c => c.codePointAt(0)! <= 0xffff), identifierLimit: 64, identifierUnit: 'characters', quote: backtick, mapType: type => mappedType(type, 'mariadb'), tableSuffix: ' ENGINE=InnoDB', notes: ['Targets MariaDB 10.11, including native UUID (introduced in 10.7). JSON is a LONGTEXT alias.', 'Charset, collation, row-size and index-byte limits must be reviewed. Do not assume MySQL feature equivalence.'] },
  oracle: { label: 'Oracle', target: 'Oracle Database 19c / COMPATIBLE >= 12.2', foreignKeyPlacement: 'alter', engineConfirmed: false, validateIdentifier: name => !name.includes('"') && name !== 'ROWID', identifierLimit: 128, identifierUnit: 'bytes', quote: doubleQuote, mapType: type => mappedType(type, 'oracle'), notes: ['Targets Oracle 19c with COMPATIBLE >= 12.2 and standard MAX_STRING_SIZE. Quoted names are case-sensitive.', 'Empty strings become NULL. Time-only values are represented as text. Key-byte limits depend on block size/encoding. No sequences, identity, defaults or schema owner are inferred.'] },
  sqlserver: { label: 'SQL Server', target: 'Microsoft SQL Server 2022', foreignKeyPlacement: 'alter', engineConfirmed: false, explicitNullable: true, identifierLimit: 128, identifierUnit: 'utf16', quote: brackets, mapType: type => mappedType(type, 'sqlserver'), notes: ['Targets SQL Server 2022. Bracket-quoted names follow database collation. No identity/defaults/schema owner are inferred.', 'TIMESTAMP input means a temporal timestamp and maps to DATETIME2, never rowversion. Review clustered PK (900 bytes), index width and collation limits.'] },
  'sybase-ase': legacy('sybase-ase', { label: 'Sybase ASE', target: 'SAP ASE 16.0 SP03', identifierLimit: 253, identifierUnit: 'bytes', explicitNullable: true, preamble: ['SET QUOTED_IDENTIFIER ON;'], notes: ['Requires quoted identifiers and appropriate enhanced quoted identifier configuration. Column nullability is emitted explicitly.', 'TIMESTAMP means logical time and maps to BIGDATETIME, not row version. VARCHAR is conservatively limited to 255 bytes; larger input falls back to TEXT. Review page-size-dependent key limits.'], sources: ['https://help.sap.com/docs/SAP_ASE/ff2a4810a3f54c1aa6af0e904aa2e3d8/ab13df1bbc2b1014a0d4879777d5158b.html'] }),
  'sql-anywhere': legacy('sql-anywhere', { label: 'Sybase SQL Anywhere', target: 'SQL Anywhere 17.0 SP01', identifierLimit: 128, identifierUnit: 'bytes', explicitNullable: true, validateIdentifier: name => !/["\\[\]`]/.test(name), preamble: ["SET TEMPORARY OPTION quoted_identifier = 'On';"], notes: ['Quoted names remain case-insensitive. Quotes, backslashes, square brackets and backticks are rejected in identifiers.', 'Explicit NULL is emitted, including for BIT. Review index and row-size limits.'], sources: ['https://help.sap.com/doc/0ad6ee207bdc48c58ab2acfcad1b2300/17.0.01/en-US/SQL-Anywhere-Server-SQL-Reference-en.pdf'] }),
  db2: legacy('db2', { label: 'IBM Db2 LUW', target: 'IBM Db2 LUW 11.5', identifierLimit: 128, identifierUnit: 'bytes', notes: ['Specific to Db2 LUW 11.5, not Db2 for z/OS or IBM i. Quoted names preserve case.', 'TEXT uses CLOB(1M), a bounded representation; review required capacity. Review key sizes and database encoding.'], sources: ['https://www.ibm.com/docs/en/db2/11.5.x?topic=statements-create-table'] }),
  ingres: legacy('ingres', { label: 'Ingres', target: 'Actian Ingres 12 (traditional engine)', identifierLimit: 256, identifierUnit: 'bytes', nullableUnique: 'omit', notes: ['Not the Vector engine. Identifier case behavior is configured by the database; ANSI entry mode may limit names to 18 bytes.', 'DATE maps to ANSIDATE. UNIQUE on nullable one-to-one foreign keys is omitted with a warning, since Ingres UNIQUE requires NOT NULL.'], sources: ['https://docs.actian.com/actianingres/12.0/SQLRef/CREATE_TABLE.htm', 'https://docs.actian.com/actianingres/12.0/SQLRef/Constraints.htm'] }),
  openedge: legacy('openedge', { label: 'OpenEdge', target: 'Progress OpenEdge SQL 12.8', identifierLimit: 32, identifierUnit: 'characters', validateIdentifier: name => [...name].every(c => c.charCodeAt(0) < 128), explicitNullable: true, notes: ['SQL dialect, not ABL. Identifier profile is conservative: 32 ASCII characters; names differing only by case are rejected.', 'Decimal limits are conservative (precision 50, scale 10). UUID uses CHAR(36). Review engine key limits.'], sources: ['https://docs.progress.com/bundle/openedge-sql-reference-128/page/CREATE-TABLE.html'] }),
  informix: legacy('informix', { label: 'Informix', target: 'IBM Informix 14.10 / DELIMIDENT enabled', identifierLimit: 128, identifierUnit: 'bytes', notes: ['Enable DELIMIDENT in the client environment before using quoted identifiers; the export does not change environment settings.', 'Uses unnamed inline constraints. TIMESTAMP becomes DATETIME YEAR TO FRACTION(5); TIME becomes DATETIME HOUR TO SECOND. UUID is CHAR(36).'], sources: ['https://www.ibm.com/docs/en/informix-servers/14.10.0?topic=statements-create-table-statement'] }),
  firebird: legacy('firebird', { label: 'Firebird', target: 'Firebird 5 / SQL dialect 3', identifierLimit: 63, identifierUnit: 'characters', validateIdentifier: name => new TextEncoder().encode(name).length <= 252, notes: ['Requires SQL dialect 3. Identifiers are limited to 63 UTF-8 characters / 252 bytes; server configuration may impose a lower limit.', 'TEXT becomes BLOB SUB_TYPE TEXT. UUID uses CHAR(36). String lengths are conservatively capped for UTF-8; review index limits and charset.'], sources: ['https://firebirdsql.org/file/documentation/html/en/refdocs/fblangref50/firebird-50-language-reference.html'] }),
  sqlite: legacy('sqlite', { label: 'SQLite', target: 'SQLite 3 / ordinary non-STRICT tables', identifierLimit: Infinity, identifierUnit: 'characters', forwardReferences: true, preamble: ['PRAGMA foreign_keys = ON;'], notes: ['Enable foreign_keys on each connection outside a transaction. Inline foreign keys are used; ALTER ADD FOREIGN KEY is unsupported.', 'Ordinary non-STRICT affinity rules apply. Dates/UUIDs use TEXT, BOOLEAN uses INTEGER with a 0/1 CHECK; decimal precision is not enforced.', 'A single INTEGER PRIMARY KEY aliases rowid, even without AUTOINCREMENT. Review rowid and key semantics before execution.'], sources: ['https://www.sqlite.org/lang_createtable.html', 'https://www.sqlite.org/datatype3.html', 'https://www.sqlite.org/foreignkeys.html'] }),
  h2: legacy('h2', { label: 'H2', target: 'H2 2.x / regular mode', identifierLimit: 256, identifierUnit: 'characters', notes: ['Targets H2 2.x regular mode, not 1.4 or vendor compatibility modes. Quoted names preserve case.', 'No identity syntax or defaults are inferred. Verify decimal/string sizes and production database compatibility separately.'], sources: ['https://h2database.com/html/datatypes.html', 'https://h2database.com/html/commands.html#create_table'] }),
  cache: legacy('cache', { label: 'InterSystems Cach\u00e9', target: 'InterSystems Cach\u00e9 2018.1.4-2018.1.12 (not IRIS)', identifierLimit: 96, identifierUnit: 'characters', validateIdentifier: name => !/[,.^]|->|^\*/.test(name) && /[A-Za-z0-9]/.test(name), explicitNullable: true, notes: ['Legacy Cach\u00e9, not InterSystems IRIS. Quoted names are case-insensitive. The conservative 96-character limit accommodates object projection.', 'Rejects commas, periods, carets, arrow sequences and leading *. UUID maps to UNIQUEIDENTIFIER; automatic system RowID is not invented as an ERD column.'], sources: ['https://docs.intersystems.com/latest/csp/docbook/DocBook.UI.Page.cls?KEY=RSQL_createtable', 'https://docs.intersystems.com/latest/csp/docbook/DocBook.UI.Page.cls?KEY=GSQL_identifiers'] }),
  hsqldb: legacy('hsqldb', { label: 'HSQLDB / HyperSQL', target: 'HSQLDB / HyperSQL 2.7.4', identifierLimit: 128, identifierUnit: 'characters', notes: ['Separate from H2; targets HyperSQL 2.7.4, not 1.8. Quoted names preserve case; native UUID is used.', 'Uses the default table type; no MEMORY/CACHED persistence choice is forced. Nullable UNIQUE assumes default sql.unique_nulls behavior; review database settings.'], sources: ['https://www.hsqldb.org/doc/2.0/guide/databaseobjects-chapt.html', 'https://www.hsqldb.org/doc/2.0/guide/sqlgeneral-chapt.html'] }),

}
