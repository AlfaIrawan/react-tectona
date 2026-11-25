$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$env:TECTONA_DEV_HTTPS = '1'
$env:TECTONA_DEV_HOST = 'tectona-dev.adira.co.id'
$env:TECTONA_DEV_TLS_KEY = Join-Path $env:USERPROFILE 'Downloads/private.key'
$env:TECTONA_DEV_TLS_CERT = Join-Path $env:LOCALAPPDATA 'Tectona/dev-https/domain-fullchain.pem'
foreach ($file in @($env:TECTONA_DEV_TLS_KEY, $env:TECTONA_DEV_TLS_CERT)) {
    if (-not (Test-Path $file)) { throw "Missing TLS file: $file" }
}
Push-Location $project
try {
    & "$env:ProgramFiles/nodejs/node.exe" node_modules/vite/bin/vite.js --host 0.0.0.0 --port 443 --strictPort
} finally { Pop-Location }
