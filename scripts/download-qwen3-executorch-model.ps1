param(
  [string]$ModelRepo = "larryliu0820/Qwen3-0.6B-INT8-INT4-ExecuTorch-XNNPACK",
  [string]$Revision = "main"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $repoRoot "android/app/src/main/assets/models"
$baseUrl = "https://huggingface.co/$ModelRepo/resolve/$Revision"

$files = @(
  "model.pte",
  "tokenizer.json",
  "vocab.json",
  "merges.txt",
  "config.json",
  "generation_config.json",
  "tokenizer_config.json"
)

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

foreach ($file in $files) {
  $targetFile = Join-Path $targetDir $file
  $url = "$baseUrl/$file"
  Write-Host "Downloading $file"
  Invoke-WebRequest -Uri $url -OutFile $targetFile -Headers @{ "User-Agent" = "haki-local-model-build" }
  $sizeMb = [math]::Round((Get-Item $targetFile).Length / 1MB, 1)
  Write-Host "Saved $file ($sizeMb MB)"
}

$noticePath = Join-Path $targetDir "MODEL_SOURCE.txt"
@"
Model source: https://huggingface.co/$ModelRepo
Revision: $Revision
License: Apache-2.0, as reported by the Hugging Face model card at download time.
Base model: Qwen/Qwen3-0.6B
Runtime target: ExecuTorch XNNPACK, INT8 dynamic activations + INT4 weights.

Keep this notice with the model files for internal audit and release review.
"@ | Set-Content -Path $noticePath -Encoding UTF8

Write-Host "Model files downloaded to $targetDir"
