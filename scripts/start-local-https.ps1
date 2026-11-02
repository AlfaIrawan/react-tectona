$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$tls = Join-Path $env:LOCALAPPDATA 'Tectona/dev-https'
foreach ($file in @('server-key.pem', 'server.pem')) {
    if (-not (Test-Path (Join-Path $tls $file))) {
        throw 'Run python scripts/setup-local-https.py --ip YOUR_LAN_IP first.'
    }
}
$env:TECTONA_DEV_HTTPS = '1'
$env:TECTONA_DEV_TLS_KEY = Join-Path $tls 'server-key.pem'
$env:TECTONA_DEV_TLS_CERT = Join-Path $tls 'server.pem'
Push-Location $project
try {
    $node = Join-Path $env:ProgramFiles 'nodejs/node.exe'
    if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction Stop).Source }
    & $node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5443 --strictPort
    if ($LASTEXITCODE -ne 0) { throw "HTTPS server exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
    Remove-Item Env:TECTONA_DEV_HTTPS, Env:TECTONA_DEV_TLS_KEY, Env:TECTONA_DEV_TLS_CERT -ErrorAction SilentlyContinue
}
