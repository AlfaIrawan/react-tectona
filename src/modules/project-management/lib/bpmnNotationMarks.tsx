import type { BpmnEventMarker, BpmnGatewayKind, BpmnTaskMarker } from '@/modules/project-management/lib/bpmnNotationSpec'

export function BpmnEventMarkerIcon({ marker, color = '#0f172a' }: { marker: BpmnEventMarker; color?: string }) {
  if (marker === 'none') return null
  if (marker === 'message') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <rect x="4" y="7" width="16" height="11" rx="1.2" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M4.5 8 12 13.2 19.5 8" fill="none" stroke={color} strokeWidth="1.6" />
      </svg>
    )
  }
  if (marker === 'timer') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <circle cx="12" cy="13" r="7" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M12 13V9.5M12 13l3 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9 5h6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (marker === 'error') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <path d="M13 4 7 13h5l-1 7 7-10h-5l1-6z" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    )
  }
  if (marker === 'escalation') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <path d="M12 5 6 19h12L12 5z" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    )
  }
  if (marker === 'compensation') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <path d="M12 6 5 12l7 6V6zM19 6l-7 6 7 6V6z" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  }
  if (marker === 'conditional') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <rect x="6" y="4" width="12" height="16" rx="1" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h5" stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }
  if (marker === 'signal') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <path d="M12 5 20 19H4L12 5z" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    )
  }
  if (marker === 'multiple') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <path d="M12 4 19 9.2 16.4 18H7.6L5 9.2 12 4z" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  }
  if (marker === 'parallelMultiple') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <path d="M12 4 19 9.2 16.4 18H7.6L5 9.2 12 4z" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 8v8M8.5 12h7" stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }
  if (marker === 'terminate') {
    return <span className="block h-[70%] w-[70%] rounded-full" style={{ background: color }} />
  }
  if (marker === 'cancel') {
    return (
      <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
        <path d="M7 7 17 17M17 7 7 17" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
      <path d="M6 12h8M11 8l5 4-5 4" fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

export function BpmnTaskMarkerIcon({ marker, color = '#0f172a' }: { marker: BpmnTaskMarker; color?: string }) {
  if (marker === 'none') return null
  if (marker === 'user') {
    return (
      <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
        <circle cx="10" cy="6" r="2.4" fill="none" stroke={color} strokeWidth="1.4" />
        <path d="M4.5 16c.8-3.2 2.8-4.6 5.5-4.6S15.7 12.8 16.5 16" fill="none" stroke={color} strokeWidth="1.4" />
      </svg>
    )
  }
  if (marker === 'service') {
    return (
      <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
        <circle cx="10" cy="10" r="3" fill="none" stroke={color} strokeWidth="1.4" />
        <path d="M10 4v2M10 14v2M4 10h2M14 10h2M5.8 5.8l1.4 1.4M12.8 12.8l1.4 1.4M14.2 5.8l-1.4 1.4M7.2 12.8l-1.4 1.4" stroke={color} strokeWidth="1.3" />
      </svg>
    )
  }
  if (marker === 'send' || marker === 'receive') {
    return (
      <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
        <rect x="3" y="5" width="14" height="10" rx="1" fill="none" stroke={color} strokeWidth="1.4" />
        <path d="M3.5 6 10 11l6.5-5" fill="none" stroke={color} strokeWidth="1.4" />
        {marker === 'send' ? <path d="M10 11v6" stroke={color} strokeWidth="1.3" /> : null}
      </svg>
    )
  }
  if (marker === 'manual') {
    return (
      <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
        <path d="M8 17V8.5a1.2 1.2 0 0 1 2.4 0V12M10.4 12V8.2a1.1 1.1 0 0 1 2.2 0V12M12.6 12V9a1 1 0 0 1 2 0v5.5c0 1.6-1.3 3.5-4.2 3.5H8" fill="none" stroke={color} strokeWidth="1.3" />
      </svg>
    )
  }
  if (marker === 'businessRule') {
    return (
      <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
        <rect x="3.5" y="4" width="13" height="12" fill="none" stroke={color} strokeWidth="1.4" />
        <path d="M3.5 8h13M8 4v12" stroke={color} strokeWidth="1.3" />
      </svg>
    )
  }
  if (marker === 'script') {
    return (
      <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
        <path d="M6 4.5h7.5c1.2 0 2 .8 2 2v9c0-1-.8-1.8-2-1.8H6.5c-1 0-1.5-.6-1.5-1.4V6c0-.9.8-1.5 2-1.5z" fill="none" stroke={color} strokeWidth="1.3" />
        <path d="M8 8h6M8 11h5" stroke={color} strokeWidth="1.2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
      <rect x="4" y="5" width="12" height="10" rx="1" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

export function BpmnGatewayMarkerIcon({ kind, color = '#0f172a' }: { kind: BpmnGatewayKind; color?: string }) {
  if (kind === 'parallel') {
    return <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="square" />
  }
  if (kind === 'inclusive') {
    return <circle cx="12" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="2.2" />
  }
  if (kind === 'eventBased') {
    return <path d="M12 6 17 10 15 16H9L7 10 12 6z" fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
  }
  if (kind === 'complex') {
    return <path d="M6 6 18 18M18 6 6 18M12 5v14M5 12h14" stroke={color} strokeWidth="1.7" />
  }
  if (kind === 'none') return null
  return <path d="M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5" stroke={color} strokeWidth="2.4" strokeLinecap="square" />
}
