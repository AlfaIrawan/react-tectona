/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __APP_BUILD_HASH__: string

interface ImportMetaEnv {
  readonly VITE_PLANTUML_BASE_URL?: string
  readonly VITE_WORKFLOW_AUTOMATION_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
