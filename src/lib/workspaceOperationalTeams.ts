export type OperationalTeamOption = {
  id: string
  value: string
  label: string
}

export const DEFAULT_OPERATIONAL_TEAM_VALUE = 'program_delivery'

export function operationalTeamSlugFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function toTitleCaseText(value: string): string {
  return value.replace(/\b\p{L}/gu, (ch) => ch.toLocaleUpperCase('id-ID'))
}

export function normalizeOperationalTeamLabelInput(value: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9&()\-\s]/g, '')
    .replace(/^\s+/g, '')
    .replace(/\s{2,}/g, ' ')
  return toTitleCaseText(cleaned)
}

export function normalizeOperationalTeamLabelForSubmit(value: string): string {
  return normalizeOperationalTeamLabelInput(value).trim()
}

export function isOperationalTeamLabelValid(value: string): boolean {
  return /^[A-Za-z0-9&()\-]+(?: [A-Za-z0-9&()\-]+)*$/.test(value)
}

export function operationalTeamLabelForValue(
  options: OperationalTeamOption[],
  value: string
): string | undefined {
  return options.find((o) => o.value === value)?.label
}

export function mapWacOperationalTeamDto(dto: {
  id: string
  team_code: string
  display_name: string
}): OperationalTeamOption {
  return {
    id: dto.id,
    value: dto.team_code,
    label: dto.display_name,
  }
}
