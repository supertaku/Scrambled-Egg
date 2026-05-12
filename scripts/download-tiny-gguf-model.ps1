param(
  [string]$Url = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
  [string]$OutputPath = "android/app/src/main/assets/models/haki-tiny.gguf"
)

$ErrorActionPreference = "Stop"

$target = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_ $OutputPath }
$targetDir = Split-Path -Parent $target
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Write-Host "Downloading Tiny GGUF model"
Write-Host "Source: $Url"
Write-Host "Target: $target"

Invoke-WebRequest -Uri $Url -OutFile $target

$sizeMb = [math]::Round((Get-Item -LiteralPath $target).Length / 1MB, 2)
Write-Host "Downloaded haki-tiny.gguf ($sizeMb MB)"
