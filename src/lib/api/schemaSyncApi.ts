/** Live transport intentionally absent until server-side idea authorization is verified.
 * Adapters may be injected by isolated tests. Never persist connection or credentials. */
export type SchemaColumn = { name: string; data_type: string; nullable: boolean }
export type SchemaTable = { name: string; columns: SchemaColumn[]; dependencies: string[] }
export type SchemaSnapshot = { tables: SchemaTable[] }
export type SchemaInspection = { schema: SchemaSnapshot; fingerprint: string }
export type SchemaConnection = { target: { host: string; port: number; database: string; schema: string }; credentials: { username: string; password: string } }
export type SchemaPlan = {
  id: string; expires_at: number; baseline_fingerprint: string
  operations: { kind: 'create_table' | 'add_column'; table: string; column?: string | null; sql: string }[]
  requires_confirmation: boolean; blockers: string[]
}
export type SchemaSyncAdapter = {
  introspect(connection: SchemaConnection, signal: AbortSignal): Promise<SchemaInspection>
  plan(request: SchemaConnection & { session_id: string; baseline_fingerprint: string; desired_schema: SchemaSnapshot }, signal: AbortSignal): Promise<SchemaPlan>
  apply(request: SchemaConnection & { session_id: string; plan_id: string; confirmed: boolean }, signal: AbortSignal): Promise<SchemaInspection>
}
export const SCHEMA_SYNC_UNAVAILABLE = 'Live database sync is unavailable. Verified idea/workspace authorization and an administrator-approved database target are required before connections can be enabled. No credentials are sent.'

