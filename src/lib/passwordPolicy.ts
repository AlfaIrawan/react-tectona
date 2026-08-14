export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export type PasswordRequirementId =
  | 'min_length'
  | 'uppercase'
  | 'lowercase'
  | 'digit'
  | 'special'
  | 'not_common'

export type PasswordRequirement = {
  id: PasswordRequirementId
  label: string
  passed: boolean
}

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/
const UPPERCASE_PATTERN = /[A-Z]/
const LOWERCASE_PATTERN = /[a-z]/
const DIGIT_PATTERN = /[0-9]/

const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'admin123',
  'welcome123',
  'letmein123',
  'changeme123',
  'tectona123',
  'adira123',
])

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  const normalized = password.trim().toLowerCase()
  return [
    {
      id: 'min_length',
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      passed: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A–Z)',
      passed: UPPERCASE_PATTERN.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a–z)',
      passed: LOWERCASE_PATTERN.test(password),
    },
    {
      id: 'digit',
      label: 'At least one number (0–9)',
      passed: DIGIT_PATTERN.test(password),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$…)',
      passed: SPECIAL_CHAR_PATTERN.test(password),
    },
    {
      id: 'not_common',
      label: 'Not a commonly used password',
      passed: password.length > 0 && !COMMON_WEAK_PASSWORDS.has(normalized),
    },
  ]
}

export function isStrongPassword(password: string): boolean {
  return getPasswordRequirements(password).every((req) => req.passed)
}

export function getPasswordStrengthScore(password: string): { passed: number; total: number } {
  const requirements = getPasswordRequirements(password)
  return {
    passed: requirements.filter((req) => req.passed).length,
    total: requirements.length,
  }
}

export function passwordPolicyErrorMessage(password: string): string | null {
  const failed = getPasswordRequirements(password).find((req) => !req.passed)
  if (!failed) return null
  return `Password requirement not met: ${failed.label}.`
}
