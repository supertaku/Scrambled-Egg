param(
  [string]$Url = "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
  [string]$OutputPath = "android/app/src/main/assets/models/haki-default.gguf"
)

$ErrorActionPreference = "Stop"

$target = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_ $OutputPath }
$targetDir = Split-Path -Parent $target
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Write-Host "Downloading bundled default GGUF model"
Write-Host "Source: $Url"
Write-Host "Target: $target"

Invoke-WebRequest -Uri $Url -OutFile $target

$sizeMb = [math]::Round((Get-Item -LiteralPath $target).Length / 1MB, 2)
Write-Host "Downloaded haki-default.gguf ($sizeMb MB)"
