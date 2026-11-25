param(
    [Parameter(Mandatory)][ValidateSet('start', 'status', 'stop', 'credential', 'verify', 'backup-workspaces', 'consolidate-workspaces')][string]$Action,
    [Parameter(Mandatory)][ValidateSet('enterprise', 'smb', 'startup')][string]$Scenario,
    [string]$Employee,
    [string]$Node = 'node'
)

$ErrorActionPreference = 'Stop'
$keyDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Tectona\WorkspaceSandbox'
$keyPath = Join-Path $keyDir 'sandbox-key.dpapi'
$keyLock = [Threading.Mutex]::new($false, 'Local\TectonaWorkspaceSandboxKey')
try {
    if (-not $keyLock.WaitOne(10000)) { throw 'Unable to lock the local sandbox key.' }
    try {
        if (-not (Test-Path -LiteralPath $keyPath)) {
            if ($Action -ne 'start') { throw 'Start the sandbox to create its local key.' }
            New-Item -ItemType Directory -Path $keyDir -Force | Out-Null
            $buffer = [byte[]]::new(32)
            $random = [Security.Cryptography.RandomNumberGenerator]::Create()
            try { $random.GetBytes($buffer) } finally { $random.Dispose() }
            $newKey = [BitConverter]::ToString($buffer).Replace('-', '').ToLowerInvariant()
            [Array]::Clear($buffer, 0, $buffer.Length)
            ConvertTo-SecureString $newKey -AsPlainText -Force | ConvertFrom-SecureString |
                Set-Content -LiteralPath $keyPath -Encoding ASCII -NoNewline
            $newKey = $null
        }
        $protected = Get-Content -LiteralPath $keyPath -Raw | ConvertTo-SecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected)
        try { $master = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $protected.Dispose() }
    } finally { $keyLock.ReleaseMutex() }
} finally { $keyLock.Dispose() }

$script = Join-Path $PSScriptRoot 'sandbox.mjs'
if ($Action -eq 'credential') {
    if (-not $Employee) { throw 'Provide an employee number or sandbox email with -Employee.' }
    $email = $master | & $Node $script email $Scenario $Employee
    if ($LASTEXITCODE -ne 0) { throw 'Unable to find the sandbox employee.' }
    $password = $master | & $Node $script credential $Scenario $Employee
    if ($LASTEXITCODE -ne 0) { throw 'Unable to derive the sandbox password.' }
    try {
        Set-Clipboard -Value $password
        Write-Output "Email: $email"
        Write-Output 'Password copied to the Windows clipboard.'
    } finally { $password = $null; $master = $null }
} else {
    $scenarioLock = [Threading.Mutex]::new($false, "Local\TectonaWorkspaceSandbox-$Scenario")
    try {
        if (-not $scenarioLock.WaitOne(0)) { throw 'Another action is running for this sandbox.' }
        try {
            $master | & $Node $script $Action $Scenario
            if ($LASTEXITCODE -ne 0) { throw "Sandbox $Action failed for $Scenario." }
        } finally { $master = $null; $scenarioLock.ReleaseMutex() }
    } finally { $scenarioLock.Dispose() }
}
