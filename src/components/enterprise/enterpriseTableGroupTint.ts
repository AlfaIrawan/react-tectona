/** Stable, hash-based color assignment for "group by" row tinting in enterprise data tables. Same
 * algorithm/colors as the Workspace Directory table so grouped tables read as one visual system. */

export const ENTERPRISE_GROUP_TINTS = [
  { row: 'bg-violet-50/75 dark:bg-violet-950/30', first: 'bg-violet-100/90 dark:bg-violet-900/50' },
  { row: 'bg-sky-50/75 dark:bg-sky-950/30', first: 'bg-sky-100/90 dark:bg-sky-900/50' },
  { row: 'bg-emerald-50/75 dark:bg-emerald-950/30', first: 'bg-emerald-100/90 dark:bg-emerald-900/50' },
  { row: 'bg-amber-50/75 dark:bg-amber-950/30', first: 'bg-amber-100/90 dark:bg-amber-900/50' },
  { row: 'bg-rose-50/75 dark:bg-rose-950/30', first: 'bg-rose-100/90 dark:bg-rose-900/50' },
  { row: 'bg-cyan-50/75 dark:bg-cyan-950/30', first: 'bg-cyan-100/90 dark:bg-cyan-900/50' },
  { row: 'bg-fuchsia-50/75 dark:bg-fuchsia-950/30', first: 'bg-fuchsia-100/90 dark:bg-fuchsia-900/50' },
  { row: 'bg-lime-50/75 dark:bg-lime-950/30', first: 'bg-lime-100/90 dark:bg-lime-900/50' },
  { row: 'bg-orange-50/75 dark:bg-orange-950/30', first: 'bg-orange-100/90 dark:bg-orange-900/50' },
  { row: 'bg-indigo-50/75 dark:bg-indigo-950/30', first: 'bg-indigo-100/90 dark:bg-indigo-900/50' },
] as const

function stableEnterpriseGroupTintIndex(groupBy: string, groupLabel: string): number {
  const seed = `${groupBy}:${groupLabel}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % ENTERPRISE_GROUP_TINTS.length
}

export function getEnterpriseGroupTint(groupBy: string, groupLabel: string) {
  return ENTERPRISE_GROUP_TINTS[stableEnterpriseGroupTintIndex(groupBy, groupLabel)]
}
