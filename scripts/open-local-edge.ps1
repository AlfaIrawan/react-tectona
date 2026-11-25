$ErrorActionPreference = 'Stop'
$edge = @(
    "${env:ProgramFiles(x86)}/Microsoft/Edge/Application/msedge.exe",
    "$env:ProgramFiles/Microsoft/Edge/Application/msedge.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge is not installed.' }

# A separate profile keeps this development-only hostname override out of normal browsing.
$profile = Join-Path $env:LOCALAPPDATA 'Tectona/edge-local-domain'
Start-Process -FilePath $edge -ArgumentList @(
    "--user-data-dir=`"$profile`"",
    '--host-resolver-rules="MAP tectona-dev.adira.co.id 127.0.0.1"',
    '--no-first-run',
    'https://tectona-dev.adira.co.id/login'
)
