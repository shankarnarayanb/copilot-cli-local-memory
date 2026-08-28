param(
    [switch]$PurgeMemories
)

$ErrorActionPreference = "Stop"

$CopilotRoot = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME ".copilot" }
$ExtensionDirectory = Join-Path $CopilotRoot "extensions/local-memory"
$MemoryDirectory = Join-Path $CopilotRoot "instructions/local-memory"

if (Test-Path -LiteralPath $ExtensionDirectory) {
    Remove-Item -LiteralPath $ExtensionDirectory -Recurse -Force
    Write-Host "Removed extension: $ExtensionDirectory"
} else {
    Write-Host "Extension is not installed: $ExtensionDirectory"
}

if ($PurgeMemories) {
    if (Test-Path -LiteralPath $MemoryDirectory) {
        Remove-Item -LiteralPath $MemoryDirectory -Recurse -Force
        Write-Host "Removed saved memories: $MemoryDirectory"
    }
} else {
    Write-Host "Saved memories were kept: $MemoryDirectory"
    Write-Host "Run again with -PurgeMemories to delete them."
}
