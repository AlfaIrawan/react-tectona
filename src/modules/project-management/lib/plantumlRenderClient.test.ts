import { afterEach, expect, it, vi } from 'vitest'
import { fetchPlantUmlPng } from './plantumlRenderClient'
afterEach(() => vi.unstubAllGlobals())
it('does not expose raw upstream HTML for a failed render service', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => '<html><body>nginx error</body></html>' }))
  await expect(fetchPlantUmlPng('@startuml\n@enduml')).rejects.toThrow('Layanan render diagram belum tersedia (502)')
  await expect(fetchPlantUmlPng('@startuml\n@enduml')).rejects.not.toThrow('<html>')
})
