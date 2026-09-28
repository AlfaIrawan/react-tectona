/**
 * Small Indonesian subtitles under the English card titles of the Idea Summary,
 * shown only when the summary itself is written in Indonesian (the language the
 * brainstorm was held in). A fixed UI vocabulary, not a translation service:
 * instant, consistent, and never sent anywhere.
 */

const ID_TITLES: Record<string, string> = {
  'executive ai brief': 'Ringkasan eksekutif AI',
  'core pressure': 'Tekanan utama',
  'strategic response': 'Respons strategis',
  'value thesis': 'Nilai yang diharapkan',
  'business value score': 'Skor nilai bisnis',
  'roi estimate': 'Estimasi ROI',
  'technical feasibility': 'Kelayakan teknis',
  'composite idea score': 'Skor gabungan ide',
  'priority band': 'Tingkat prioritas',
  'target sla breach reduction': 'Target penurunan pelanggaran SLA',
  'decision signal': 'Sinyal keputusan',
  'enterprise readiness': 'Kesiapan enterprise',
  priority: 'Prioritas',
  'overall score': 'Skor keseluruhan',
  'decision bias': 'Kecenderungan keputusan',
  'board note': 'Catatan untuk direksi',
  'strategic framing': 'Kerangka strategis',
  'where enterprise value is expected': 'Di mana nilai bisnis diharapkan',
  'execution plan': 'Rencana eksekusi',
  'sprint zero focus': 'Fokus Sprint 0',
  'dependency watch': 'Pantauan dependensi',
  'governance readiness': 'Kesiapan tata kelola',
  'execution posture': 'Postur eksekusi',
  'stakeholder readiness': 'Kesiapan stakeholder',
  'delivery control': 'Kontrol delivery',
  'signals supporting next-stage approval': 'Sinyal pendukung persetujuan tahap berikutnya',
  'scoring dimensions': 'Dimensi penilaian',
  'enterprise scoring signal': 'Sinyal penilaian enterprise',
  'primary strength': 'Kekuatan utama',
  'board recommendation': 'Rekomendasi untuk direksi',
  'enterprise investment signal': 'Sinyal investasi enterprise',
  'scoring posture': 'Postur penilaian',
  'main watchpoint': 'Titik pantau utama',
  'ai commentary': 'Komentar AI',
  'positive signal': 'Sinyal positif',
  'watchpoint signal': 'Titik pantau',
  'business value': 'Nilai bisnis',
  roi: 'ROI',
  effort: 'Upaya',
  risk: 'Risiko',
}

// Governance Readiness signals were generated with Indonesian titles before
// they became fixed English labels like every other card (agent-runtime
// orchestrator/summary_titles.py). Older summaries map onto the same labels.
const READINESS_ENGLISH: Record<string, string> = {
  'postur eksekusi': 'Execution Posture',
  'kesiapan stakeholder': 'Stakeholder Readiness',
  'kontrol delivery': 'Delivery Control',
}

/** The fixed English label for a readiness signal title (older Indonesian titles included). */
export function englishReadinessTitle(title: string | null | undefined): string {
  const raw = (title ?? '').trim()
  return READINESS_ENGLISH[raw.toLowerCase()] ?? raw
}

/** The Indonesian subtitle for an English card title, or null when there is none. */
export function indonesianSubtitle(englishTitle: string | null | undefined): string | null {
  const key = (englishTitle ?? '').trim().toLowerCase()
  const subtitle = ID_TITLES[key] ?? null
  // A term that reads the same in both languages (ROI) needs no subtitle.
  return subtitle && subtitle.toLowerCase() !== key ? subtitle : null
}

// Common Indonesian function words; English text almost never contains them.
const ID_MARKERS = new Set([
  'yang', 'dan', 'untuk', 'dengan', 'pada', 'ini', 'itu', 'dari', 'dalam', 'akan', 'belum', 'sudah',
  'tidak', 'serta', 'sebagai', 'agar', 'karena', 'atau', 'juga', 'masih', 'menjadi', 'bisnis', 'adalah',
])

/** True when the text reads as Indonesian (at least ~6% of words are Indonesian function words). */
export function looksIndonesian(text: string | null | undefined): boolean {
  const words = (text ?? '').toLowerCase().match(/[a-z]+/g) ?? []
  if (words.length < 8) return false
  const hits = words.filter((w) => ID_MARKERS.has(w)).length
  return hits / words.length >= 0.06
}
