$ErrorActionPreference = "Stop"

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$CopilotRoot = if ($env:COPILOT_HOME) {
    $env:COPILOT_HOME
} else {
    Join-Path $HOME ".copilot"
}
$ExtensionDirectory = Join-Path $CopilotRoot "extensions/local-memory"
$RuntimeDirectory = Join-Path $ScriptDirectory "extensions/local-memory"
$Timestamp = Get-Date -Format "yyyyMMddHHmmss"
$RuntimeFiles = @("extension.mjs", "memory-store.mjs")

foreach ($RuntimeFile in $RuntimeFiles) {
    $Source = Join-Path $RuntimeDirectory $RuntimeFile
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
        throw "Missing required file: $Source"
    }
}

New-Item -ItemType Directory -Force -Path $ExtensionDirectory | Out-Null

foreach ($RuntimeFile in $RuntimeFiles) {
    $Source = Join-Path $RuntimeDirectory $RuntimeFile
    $Destination = Join-Path $ExtensionDirectory $RuntimeFile
    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        Copy-Item -LiteralPath $Destination -Destination "$Destination.bak.$Timestamp"
    }
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

Write-Host "Installed Copilot CLI Local Memory to:"
Write-Host "  $ExtensionDirectory"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Start Copilot CLI with: copilot --experimental"
Write-Host "  2. Run: /extensions manage"
Write-Host "  3. Try: /remember Always run tests before committing."
