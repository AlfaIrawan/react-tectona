import type { SampleDocumentKind } from '@/modules/document-knowledge-management/lib/sampleDocumentKind'
import type { SampleKindClassification } from '@/modules/document-knowledge-management/lib/classifyFromSamples'

export type WorkspaceSampleKindVote = {
  workspaceId: string
  workspaceName: string
  role: 'home' | 'overlay'
  hasGoldSet: boolean
  kind: SampleDocumentKind | 'unknown'
  confidence: number
  reason: string
}

export type OrgSampleKindReconcile =
  | {
    outcome: 'auto'
    kind: SampleDocumentKind | 'unknown'
    source: SampleKindClassification['source'] | 'organization_fallback' | 'org_consensus'
    confidence: number
    reason: string
    votes: WorkspaceSampleKindVote[]
  }
  | {
    outcome: 'conflict'
    kind: 'unknown'
    source: 'unknown'
    confidence: number
    reason: string
    votes: WorkspaceSampleKindVote[]
    choices: Array<{ kind: SampleDocumentKind; workspaceIds: string[]; workspaceNames: string[] }>
  }

function classifiedKind(vote: WorkspaceSampleKindVote): SampleDocumentKind | null {
  if (!vote.hasGoldSet) return null
  if (vote.kind === 'unknown') return null
  return vote.kind
}

/**
 * Home org is canonical when overlays have no Samples.
 * When overlays have Samples, agreeing kinds auto-apply; disagreeing kinds need user confirm.
 */
export function reconcileOrgSampleKindVotes(
  home: WorkspaceSampleKindVote,
  overlays: readonly WorkspaceSampleKindVote[],
): OrgSampleKindReconcile {
  const votes = [home, ...overlays]
  const overlaysWithSamples = overlays.filter((vote) => vote.hasGoldSet)

  if (overlaysWithSamples.length === 0) {
    return {
      outcome: 'auto',
      kind: home.kind,
      source: home.kind === 'unknown' ? 'unknown' : 'organization_fallback',
      confidence: home.confidence,
      reason: overlays.length === 0
        ? (home.reason || 'Used Organization Samples (no sibling workspaces).')
        : home.kind === 'unknown'
          ? 'Sibling workspaces have no Samples; Organization Samples were also inconclusive.'
          : 'Sibling workspaces have no Samples; used Organization Samples.',
      votes,
    }
  }

  const labeled = votes
    .map((vote) => ({ vote, kind: classifiedKind(vote) }))
    .filter((row): row is { vote: WorkspaceSampleKindVote; kind: SampleDocumentKind } => row.kind !== null)

  if (labeled.length === 0) {
    return {
      outcome: 'auto',
      kind: 'unknown',
      source: 'unknown',
      confidence: Math.max(home.confidence, ...overlaysWithSamples.map((vote) => vote.confidence), 0),
      reason: 'Organization and sibling Samples did not agree on a document kind.',
      votes,
    }
  }

  const byKind = new Map<SampleDocumentKind, WorkspaceSampleKindVote[]>()
  for (const row of labeled) {
    const list = byKind.get(row.kind) ?? []
    list.push(row.vote)
    byKind.set(row.kind, list)
  }

  if (byKind.size === 1) {
    const kind = [...byKind.keys()][0]
    if (!kind) {
      return {
        outcome: 'auto',
        kind: 'unknown',
        source: 'unknown',
        confidence: 0,
        reason: 'Organization and sibling Samples did not agree on a document kind.',
        votes,
      }
    }
    const supporters = byKind.get(kind) ?? []
    const best = supporters.reduce((acc, vote) => (vote.confidence > acc.confidence ? vote : acc), supporters[0])
    const names = supporters.map((vote) => vote.workspaceName).join(', ')
    return {
      outcome: 'auto',
      kind,
      source: 'org_consensus',
      confidence: best.confidence,
      reason: `Organization and sibling Samples agree: ${kind} (${names}).`,
      votes,
    }
  }

  const choices = [...byKind.entries()].map(([kind, group]) => ({
    kind,
    workspaceIds: group.map((vote) => vote.workspaceId),
    workspaceNames: group.map((vote) => vote.workspaceName),
  }))

  return {
    outcome: 'conflict',
    kind: 'unknown',
    source: 'unknown',
    confidence: Math.max(...labeled.map((row) => row.vote.confidence)),
    reason: 'Samples in Organization and sibling workspaces classified this file as different document kinds.',
    votes,
    choices,
  }
}

export function sampleKindVoteFromClassification(
  workspace: { id: string; name: string; role: 'home' | 'overlay' },
  hasGoldSet: boolean,
  classification: SampleKindClassification,
): WorkspaceSampleKindVote {
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: workspace.role,
    hasGoldSet,
    kind: classification.kind,
    confidence: classification.confidence,
    reason: classification.reason,
  }
}
