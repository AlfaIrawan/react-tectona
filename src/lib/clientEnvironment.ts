/** Friendly device/browser labels for session conflict UI and token requests. */

export type ClientEnvironment = {
  device: string
  browser: string
  location: string
}

function normalizeHint(value: string | undefined, maxLen = 128): string | undefined {
  const cleaned = value?.trim().replace(/\s+/g, ' ')
  if (!cleaned) return undefined
  return cleaned.slice(0, maxLen)
}

function parseDeviceLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('iphone')) return 'iPhone'
  if (ua.includes('ipad')) return 'iPad'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS'
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('cros')) return 'ChromeOS'
  if (ua.includes('linux')) return 'Linux'
  return 'Unknown device'
}

function parseBrowserLabel(userAgent: string): string {
  const lower = userAgent.toLowerCase()
  if (lower.includes('edg/') || lower.includes('edge/')) return 'Microsoft Edge'
  if (lower.includes('opr/') || lower.includes('opera')) return 'Opera'
  if (lower.includes('firefox/')) return 'Firefox'
  if (lower.includes('chrome/') && !lower.includes('chromium')) return 'Google Chrome'
  if (lower.includes('safari/') && !lower.includes('chrome') && !lower.includes('chromium')) return 'Safari'
  if (lower.includes('msie') || lower.includes('trident/')) return 'Internet Explorer'
  return 'Unknown browser'
}

const TIMEZONE_LOCATION: Record<string, string> = {
  'Asia/Jakarta': 'Jakarta, Indonesia',
  'Asia/Makassar': 'Makassar, Indonesia',
  'Asia/Jayapura': 'Jayapura, Indonesia',
  'Asia/Singapore': 'Singapore',
  'Asia/Kuala_Lumpur': 'Kuala Lumpur, Malaysia',
  'Asia/Bangkok': 'Bangkok, Thailand',
  'Asia/Manila': 'Manila, Philippines',
  'Asia/Tokyo': 'Tokyo, Japan',
  'Asia/Seoul': 'Seoul, South Korea',
  'Europe/London': 'London, United Kingdom',
  'America/New_York': 'New York, United States',
  'America/Los_Angeles': 'Los Angeles, United States',
}

function locationFromTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!timezone) return 'Unknown location'
    if (TIMEZONE_LOCATION[timezone]) return TIMEZONE_LOCATION[timezone]
    return timezone.replace(/_/g, ' ')
  } catch {
    return 'Unknown location'
  }
}

type IpGeoResponse = {
  city?: string
  region?: string
  country_name?: string
}

export async function resolveClientLocationHint(): Promise<string> {
  if (typeof fetch !== 'undefined') {
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 2500)
      const res = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      window.clearTimeout(timeout)
      if (res.ok) {
        const data = (await res.json()) as IpGeoResponse
        const city = data.city?.trim()
        const region = data.region?.trim()
        const country = data.country_name?.trim()
        if (city && country) return region ? `${city}, ${region}, ${country}` : `${city}, ${country}`
        if (country && region) return `${region}, ${country}`
        if (country) return country
      }
    } catch {
      /* fallback below */
    }
  }
  return locationFromTimezone()
}

export function getClientEnvironment(): ClientEnvironment {
  if (typeof navigator === 'undefined') {
    return { device: 'Unknown device', browser: 'Unknown browser', location: 'Unknown location' }
  }
  const ua = navigator.userAgent
  return {
    device: parseDeviceLabel(ua),
    browser: parseBrowserLabel(ua),
    location: locationFromTimezone(),
  }
}

export function getClientEnvironmentHints(): {
  client_device?: string
  client_browser?: string
} {
  const { device, browser } = getClientEnvironment()
  return {
    client_device: normalizeHint(device),
    client_browser: normalizeHint(browser),
  }
}

export async function getClientEnvironmentHintsAsync(): Promise<{
  client_device?: string
  client_browser?: string
  client_location?: string
}> {
  const base = getClientEnvironmentHints()
  const location = normalizeHint(await resolveClientLocationHint(), 256)
  return {
    ...base,
    client_location: location,
  }
}
