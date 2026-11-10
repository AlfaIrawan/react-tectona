import { cn } from '@/lib/utils'

const REASONS = [
  { pattern: /\bINVALID_CITATION\b/, id: 'Rujukan sumber pada sebagian isi draf tidak valid.', en: 'Some draft citations are invalid.' },
  { pattern: /\bMISSING_CITATIONS\b/, id: 'Sebagian isi draf belum menyertakan rujukan sumber.', en: 'Some draft statements are missing citations.' },
  { pattern: /\bUNSUPPORTED_QUOTE_OR_SOURCE:UNKNOWN_SOURCE_ID\b/, id: 'Ada rujukan ke sumber yang tidak dikenali.', en: 'A citation refers to an unrecognized source.' },
  { pattern: /\bUNSUPPORTED_QUOTE_OR_SOURCE:QUOTE_MISMATCH\b/, id: 'Ada kutipan yang tidak cocok dengan sumber yang dirujuk.', en: 'A quotation does not match its cited source.' },
  { pattern: /\bUNSUPPORTED_NUMBERS\b/, id: 'Ada angka dalam draf yang belum didukung sumber.', en: 'Some numbers in the draft are not supported by the sources.' },
  { pattern: /\bUNSUPPORTED_SCOPE_OR_CAUSAL_CLAIM\b/, id: 'Sebagian pernyataan belum didukung bukti atau belum mempertahankan status asumsi dan ketidakpastian.', en: 'Some statements are not supported by evidence or do not preserve assumptions and uncertainty.' },
  { pattern: /\bMissing current evidence coverage\b/, id: 'Draf belum mencakup seluruh bukti yang masih berlaku.', en: 'The draft does not cover all current evidence.' },
] as const

/** Presentation only: retain the original error verbatim for diagnosis. */
export function BrainstormErrorNotice({ message, indonesian, className }: {
  message: string
  indonesian: boolean
  className?: string
}) {
  if (!/^\s*IDEA_DRAFT_FIDELITY:/.test(message)) return <p className={className}>{message}</p>
  const reasons = REASONS.filter(reason => reason.pattern.test(message)).map(reason => indonesian ? reason.id : reason.en)
  return (
    <div role="alert" className={cn(className, 'space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm leading-6 text-destructive')}>
      <p className="font-semibold">{indonesian ? 'Draf belum lolos validasi' : 'Draft validation did not pass'}</p>
      {reasons.length ? <ul className="list-disc space-y-1 pl-5">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>{indonesian ? 'Hasil belum lolos pemeriksaan validasi. Lihat detail teknis untuk informasi yang tersedia.' : 'The result did not pass validation. See technical details for the available information.'}</p>}
      <p>{indonesian ? 'Draf baru belum disimpan. Percakapan dan draf sebelumnya (jika ada) tetap tersimpan.' : 'No new draft was saved. Your conversation and any previous draft are preserved.'}</p>
      <p>{indonesian ? 'Tinjau bukti atau masalah validasi sebelum mencoba Generate draft lagi. Jika pesan yang sama muncul, simpan detail teknis untuk pemeriksaan lebih lanjut.' : 'Review the evidence or validation issue before trying Generate draft again. If the same error returns, keep the technical details for further investigation.'}</p>
      <details>
        <summary className="cursor-pointer font-medium">{indonesian ? 'Detail teknis' : 'Technical details'}</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 [overflow-wrap:anywhere]">{message}</pre>
      </details>
    </div>
  )
}
