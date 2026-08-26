import type { TemplateAgentSchema } from '@/lib/api/documentKnowledgeApi'

const DOCUMENT_KINDS = ['general', 'brd', 'urd', 'memo_internal', 'fsd'] as const
const PLACEHOLDER_TYPES = ['text', 'date', 'number', 'list', 'rich_text'] as const
const SECTION_KINDS = ['paragraph', 'list', 'table'] as const

export type TemplateDocumentKind = (typeof DOCUMENT_KINDS)[number]
export type TemplatePlaceholderType = (typeof PLACEHOLDER_TYPES)[number]
export type TemplateSectionKind = (typeof SECTION_KINDS)[number]

export { DOCUMENT_KINDS, PLACEHOLDER_TYPES, SECTION_KINDS }

export function emptyTemplateAgentSchema(): TemplateAgentSchema {
  return {
    document_kind: 'general',
    placeholders: [],
    sections: [],
    repeaters: [],
  }
}

export function parseTemplateAgentSchema(metadata: Record<string, unknown> | undefined | null): TemplateAgentSchema {
  const raw = metadata?.agent_schema
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyTemplateAgentSchema()
  }
  const obj = raw as Record<string, unknown>
  const document_kind =
    typeof obj.document_kind === 'string' && obj.document_kind.trim()
      ? obj.document_kind.trim()
      : 'general'
  const compiler = obj.compiler && typeof obj.compiler === 'object' && !Array.isArray(obj.compiler)
    ? obj.compiler as TemplateAgentSchema['compiler']
    : undefined

  const placeholders = Array.isArray(obj.placeholders)
    ? obj.placeholders
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
          key: String(item.key ?? '').trim(),
          label: typeof item.label === 'string' ? item.label : undefined,
          type: typeof item.type === 'string' ? item.type : 'text',
          required: Boolean(item.required),
          location:
            item.location && typeof item.location === 'object' && !Array.isArray(item.location)
              ? (item.location as { table_index: number; row_index: number })
              : null,
          instruction: typeof item.instruction === 'string' ? item.instruction : null,
        }))
        .filter((item) => item.key.length > 0)
    : []

  const sections = Array.isArray(obj.sections)
    ? obj.sections
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
          id: String(item.id ?? '').trim(),
          heading: typeof item.heading === 'string' ? item.heading : undefined,
          kind: typeof item.kind === 'string' ? item.kind : 'paragraph',
          min_paragraphs:
            typeof item.min_paragraphs === 'number' && Number.isFinite(item.min_paragraphs)
              ? Math.max(1, Math.floor(item.min_paragraphs))
              : 1,
        }))
        .filter((item) => item.id.length > 0)
    : []

  const repeaters = Array.isArray(obj.repeaters)
    ? obj.repeaters
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
          id: String(item.id ?? '').trim(),
          collection: String(item.collection ?? item.id ?? '').trim(),
          kind: typeof item.kind === 'string' ? item.kind : 'row',
          fields: Array.isArray(item.fields) ? item.fields.map(String).filter(Boolean) : [],
          image_fields: Array.isArray(item.image_fields) ? item.image_fields.map(String).filter(Boolean) : [],
          marker: typeof item.marker === 'string' ? item.marker : null,
          start_marker: typeof item.start_marker === 'string' ? item.start_marker : null,
          end_marker: typeof item.end_marker === 'string' ? item.end_marker : null,
          numbering_prefix: typeof item.numbering_prefix === 'string' ? item.numbering_prefix : null,
          parent_collection: typeof item.parent_collection === 'string' ? item.parent_collection : null,
        }))
        .filter((item) => item.id.length > 0 && item.collection.length > 0)
    : []

  return { document_kind, compiler, placeholders, sections, repeaters }
}

export function mergeAgentSchemaIntoMetadata(
  metadata: Record<string, unknown> | undefined | null,
  schema: TemplateAgentSchema,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  return {
    ...base,
    ...extras,
    agent_schema: {
      document_kind: schema.document_kind ?? 'general',
      compiler: schema.compiler,
      placeholders: (schema.placeholders ?? []).map((item) => ({
        key: item.key,
        label: item.label ?? item.key,
        type: item.type ?? 'text',
        required: Boolean(item.required),
        location: item.location ?? null,
        instruction: item.instruction ?? null,
      })),
      sections: (schema.sections ?? []).map((item) => ({
        id: item.id,
        heading: item.heading ?? item.id,
        kind: item.kind ?? 'paragraph',
        min_paragraphs: item.min_paragraphs ?? 1,
      })),
      repeaters: (schema.repeaters ?? []).map((item) => ({
        id: item.id,
        collection: item.collection,
        kind: item.kind,
        fields: item.fields ?? [],
        image_fields: item.image_fields ?? [],
        marker: item.marker ?? null,
        start_marker: item.start_marker ?? null,
        end_marker: item.end_marker ?? null,
        numbering_prefix: item.numbering_prefix ?? null,
        parent_collection: item.parent_collection ?? null,
      })),
    },
  }
}
