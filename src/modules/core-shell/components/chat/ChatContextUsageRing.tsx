import type { ContextUsageLevel } from '@/lib/api/tectonaAgentRuntimeApi'
import { contextRingColor } from '@/lib/chat/contextUsageFormat'

interface ChatContextUsageRingProps {
  usagePercent: number
  level?: ContextUsageLevel
  size?: number
  strokeWidth?: number
  className?: string
  title?: string
}

export function ChatContextUsageRing({
  usagePercent,
  level = 'ok',
  size = 22,
  strokeWidth = 2.5,
  className = '',
  title = 'Show context usage',
}: ChatContextUsageRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, usagePercent))
  const offset = circumference - (clamped / 100) * circumference
  const stroke = contextRingColor(level, clamped)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
