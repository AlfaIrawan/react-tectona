type Match = { application: string; documented_function: string; proposed_fit: string }

export function BrainstormCatalogComparison({ matches = [], mode, status, indonesian }: {
  matches?: Match[]
  mode?: 'current' | 'proposed' | null
  status?: 'matched' | 'no_match' | 'unavailable' | null
  indonesian: boolean
}) {
  if (!status) return null
  if (status !== 'matched') return <p className="my-3 text-sm text-muted-foreground">{status === 'unavailable'
    ? (indonesian ? 'Application Catalog belum dapat dibandingkan pada giliran ini; belum ada kesimpulan kecocokan.' : 'Application Catalog could not be compared this turn; fit has not been established.')
    : (indonesian ? 'Belum ditemukan kandidat relevan dari Application Catalog yang dibaca.' : 'No relevant candidate was found in the Application Catalog reviewed.')}</p>
  const heads = indonesian ? ['Aplikasi', 'Fungsi terdokumentasi di KB', 'Hipotesis kecocokan'] : ['Application', 'Documented KB capability', 'Potential fit']
  return <section className="my-3 space-y-2 text-sm leading-6" aria-label="Application Catalog">
    <p className="font-semibold">{mode === 'current'
      ? (indonesian ? 'Kandidat aplikasi saat ini untuk dikonfirmasi' : 'Current-system candidates to confirm')
      : (indonesian ? 'Usulan penggunaan kembali atau integrasi aplikasi' : 'Proposed application reuse or integration')}</p>
    {matches.length > 1 ? <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
      <thead><tr>{heads.map(head => <th key={head} className="border-b px-2 py-2 align-top font-semibold">{head}</th>)}</tr></thead>
      <tbody>{matches.map(match => <tr key={match.application}><th className="break-words border-b px-2 py-2 align-top font-medium">{match.application}</th><td className="break-words border-b px-2 py-2 align-top">{match.documented_function}</td><td className="break-words border-b px-2 py-2 align-top">{match.proposed_fit}</td></tr>)}</tbody>
    </table></div> : matches.map(match => <div key={match.application} className="space-y-1">
      <p className="font-semibold">{match.application}</p>
      <p><span className="font-medium">{heads[1]}: </span>{match.documented_function}</p>
      <p><span className="font-medium">{heads[2]}: </span>{match.proposed_fit}</p>
    </div>)}
    <p className="text-muted-foreground">{mode === 'current'
      ? (indonesian ? 'Keberadaan di katalog bukan bukti pemakaian saat ini. Konfirmasikan aplikasi yang benar-benar digunakan.' : 'A catalogue entry does not establish current use. Confirm which application is actually used.')
      : (indonesian ? 'Ketersediaan API, izin akses, dan kesiapan integrasi masih perlu divalidasi dengan pemilik aplikasi.' : 'API availability, access permissions, and integration readiness still need validation with the application owner.')}</p>
  </section>
}
