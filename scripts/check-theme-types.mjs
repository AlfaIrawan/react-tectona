/** Focused typecheck for theme changes without hiding the full app's separate type debt. */
import ts from 'typescript'
import path from 'node:path'
const config = ts.readConfigFile('tsconfig.app.json', ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
const names = [
  'src/lib/tectonaThemes.ts', 'src/stores/preferences-store.ts',
  'src/components/settings/ThemeSettingsPanel.tsx', 'src/components/layout/AppBackgroundVideo.tsx',
  'src/components/ui/button.tsx', 'src/components/ui/input.tsx', 'src/components/ui/textarea.tsx',
  'src/components/ui/card.tsx',
  'src/components/ui/dialog.tsx', 'src/components/ui/dropdown-menu.tsx', 'src/components/ui/select.tsx', 'src/components/ui/tabs.tsx',
  'src/components/ui/tooltip.tsx', 'src/components/ui/toast.tsx',
  'src/lib/enterpriseButtonClasses.ts',
]
const own = new Set(names.map(name => path.resolve(name).toLowerCase()))
const options = { ...parsed.options, incremental: false, composite: false, tsBuildInfoFile: undefined }
const program = ts.createProgram(names, options)
const diagnostics = ts.getPreEmitDiagnostics(program)
const relevant = diagnostics.filter(d => !d.file || own.has(path.resolve(d.file.fileName).toLowerCase()))
if (relevant.length) console.error(ts.formatDiagnosticsWithColorAndContext(relevant, {
  getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
}))
console.log(JSON.stringify({themeModulesChecked: names.length, themeErrors: relevant.length, separateImportedDependencyDiagnostics: diagnostics.length - relevant.length, fullProjectTypecheck: false}))
process.exitCode = relevant.length ? 1 : 0
