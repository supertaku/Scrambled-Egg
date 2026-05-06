param(
  [string]$ExecuTorchVersion = "1.0.0-xnnpack",
  [string]$AarUrl = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $repoRoot "android/app/libs"
$targetFile = Join-Path $targetDir "executorch.aar"

if ([string]::IsNullOrWhiteSpace($AarUrl)) {
  $AarUrl = "https://ossci-android.s3.amazonaws.com/executorch/release/$ExecuTorchVersion/executorch.aar"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Write-Host "Downloading ExecuTorch Android AAR"
Write-Host "Source: $AarUrl"
Write-Host "Target: $targetFile"

Invoke-WebRequest -Uri $AarUrl -OutFile $targetFile

$sizeMb = [math]::Round((Get-Item $targetFile).Length / 1MB, 1)
Write-Host "Downloaded executorch.aar ($sizeMb MB)"
