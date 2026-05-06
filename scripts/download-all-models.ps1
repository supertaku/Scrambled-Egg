$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$baseDir = Join-Path $repoRoot "android/app/src/main/assets/models"

$tiers = @{
    "tiny" = @{
        "repo" = "larryliu0820/Qwen3-0.6B-ExecuTorch-XNNPACK";
        "revision" = "main";
    };
    "minimum" = @{
        "repo" = "larryliu0820/Qwen3-1.7B-ExecuTorch-XNNPACK";
        "revision" = "main";
    };
    "flagship" = @{
        "repo" = "larryliu0820/llava-v1.5-7b-IN8-INT4";
        "revision" = "main";
    }
}

$files = @(
    "model.pte",
    "tokenizer.json",
    "vocab.json",
    "merges.txt",
    "config.json",
    "generation_config.json",
    "tokenizer_config.json"
)

foreach ($tier in $tiers.Keys) {
    $tierDir = Join-Path $baseDir $tier
    $repo = $tiers[$tier]["repo"]
    $revision = $tiers[$tier]["revision"]
    $baseUrl = "https://huggingface.co/$repo/resolve/$revision"

    Write-Host "--- Downloading Tier: $tier ($repo) ---" -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $tierDir | Out-Null

    foreach ($file in $files) {
        $targetFile = Join-Path $tierDir $file
        $url = "$baseUrl/$file"
        
        Write-Host "Downloading $file..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $targetFile -Headers @{ "User-Agent" = "haki-local-model-build" }
            $sizeMb = [math]::Round((Get-Item $targetFile).Length / 1MB, 1)
            Write-Host "Saved $file ($sizeMb MB)"
        } catch {
            Write-Host "Warning: Could not download $file for $tier. Some models might not have all files." -ForegroundColor Yellow
        }
    }
}

Write-Host "All models downloaded to $baseDir" -ForegroundColor Green
