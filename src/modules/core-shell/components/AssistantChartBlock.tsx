import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MeasuredResponsiveContainer } from '@/components/charts/MeasuredResponsiveContainer'
import { cn } from '@/lib/utils'

/**
 * Renders a colorful data chart from a ```tecchart``` JSON block, using the same Recharts
 * library + palette as the dashboards. Spec:
 *   { "type": "pie" | "bar" | "line", "title"?: string,
 *     "data": [{ "name": string, "value": number }], "valueLabel"?: string }
 */

type ChartType = 'pie' | 'bar' | 'line'
type ChartDatum = { name: string; value: number }
type ChartSpec = { type: ChartType; title?: string; data: ChartDatum[]; valueLabel?: string }

// Semantic colors matching the workspace dashboard (health/status/compliance).
const SEMANTIC_COLORS: Record<string, string> = {
  healthy: '#10b981',
  'at risk': '#f59e0b',
  'at-risk': '#f59e0b',
  watch: '#f59e0b',
  critical: '#ef4444',
  active: '#10b981',
  aktif: '#10b981',
  archived: '#94a3b8',
  compliant: '#10b981',
  'needs review': '#f59e0b',
  'non-compliant': '#ef4444',
  unconfigured: '#94a3b8',
  partial: '#f59e0b',
}
const PALETTE = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#64748b']

function colorFor(name: string, index: number): string {
  return SEMANTIC_COLORS[name.trim().toLowerCase()] ?? PALETTE[index % PALETTE.length]
}

function parseSpec(source: string): ChartSpec | null {
  try {
    const raw = JSON.parse(source) as Partial<ChartSpec>
    if (!raw || !['pie', 'bar', 'line'].includes(raw.type as string)) return null
    const data = (Array.isArray(raw.data) ? raw.data : [])
      .filter((d): d is ChartDatum => !!d && typeof d.name === 'string' && typeof d.value === 'number')
    if (data.length === 0) return null
    return { type: raw.type as ChartType, title: raw.title, data, valueLabel: raw.valueLabel }
  } catch {
    return null
  }
}

export function AssistantChartBlock({ source, className }: { source: string; className?: string }) {
  const spec = parseSpec(source)

  if (!spec) {
    // Invalid spec → show the raw block (don't crash the message).
    return (
      <pre
        className={cn(
          'my-2 overflow-x-auto rounded-md border border-amber-200/80 bg-amber-50/80 p-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30',
          className,
        )}
      >
        {source}
      </pre>
    )
  }

  const chart =
    spec.type === 'pie' ? (
      <PieChart>
        <Pie data={spec.data} dataKey="value" nameKey="name" outerRadius="78%" label>
          {spec.data.map((d, i) => (
            <Cell key={`${d.name}-${i}`} fill={colorFor(d.name, i)} />
          ))}
        </Pie>
        <RechartsTooltip />
        <Legend />
      </PieChart>
    ) : spec.type === 'bar' ? (
      <BarChart data={spec.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <RechartsTooltip />
        <Bar dataKey="value" name={spec.valueLabel ?? 'Nilai'} radius={[4, 4, 0, 0]}>
          {spec.data.map((d, i) => (
            <Cell key={`${d.name}-${i}`} fill={colorFor(d.name, i)} />
          ))}
        </Bar>
      </BarChart>
    ) : (
      <LineChart data={spec.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <RechartsTooltip />
        <Line dataKey="value" name={spec.valueLabel ?? 'Nilai'} stroke={PALETTE[0]} strokeWidth={2} dot />
      </LineChart>
    )

  return (
    <div
      className={cn(
        'my-2 w-full min-w-0 rounded-md border border-[#d1d7db]/80 bg-white p-3 dark:border-[#3b4a54] dark:bg-[#111b21]',
        className,
      )}
    >
      {spec.title ? (
        <div className="mb-1 text-center text-xs font-semibold text-[#111b21] dark:text-[#e9edef]">
          {spec.title}
        </div>
      ) : null}
      <div style={{ height: 240 }}>
        <MeasuredResponsiveContainer>{chart}</MeasuredResponsiveContainer>
      </div>
    </div>
  )
}
