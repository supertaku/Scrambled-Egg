param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath,

  [switch]$AllowExecuTorchNative,

  [switch]$RequireExecuTorchAssets
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $ApkPath)) {
  throw "APK not found: $ApkPath"
}

$jar = Get-Command jar -ErrorAction SilentlyContinue
if ($jar) {
  $jarPath = $jar.Source
} elseif ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\jar.exe"))) {
  $jarPath = Join-Path $env:JAVA_HOME "bin\jar.exe"
} elseif (Test-Path "C:\Program Files\Android\Android Studio\jbr\bin\jar.exe") {
  $jarPath = "C:\Program Files\Android\Android Studio\jbr\bin\jar.exe"
} else {
  throw "jar was not found. Install a JDK or set JAVA_HOME to a JDK path."
}

$entries = & $jarPath tf $ApkPath
$modelEntries = $entries | Where-Object { $_ -like "assets/models/*" }
$nativeEntries = $entries | Where-Object { $_ -like "lib/*" -and $_ -match "executorch|pytorch|fbjni|soloader|rnllama" }
$execuTorchNativeEntries = $nativeEntries | Where-Object { $_ -match "libexecutorch" }
$llamaNativeEntries = $nativeEntries | Where-Object { $_ -match "librnllama" }

Write-Host "Model assets in APK:"
if ($modelEntries) {
  $modelEntries | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "  None found"
}

Write-Host ""
Write-Host "Relevant native libraries in APK:"
if ($nativeEntries) {
  $nativeEntries | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "  None found"
}

if ($execuTorchNativeEntries -and !$AllowExecuTorchNative) {
  throw "APK packages ExecuTorch native libraries while ExecuTorch native loading is disabled. Rebuild without -Phaki.enableExecuTorchNative=true, or rerun this script with -AllowExecuTorchNative for an intentional native test build."
}

if (!$llamaNativeEntries) {
  throw "APK is missing llama.rn native libraries. Rebuild the custom native app with the llama.rn plugin enabled."
}

if ($RequireExecuTorchAssets -or $AllowExecuTorchNative) {
  if (!($modelEntries -contains "assets/models/model.pte")) {
    throw "APK is missing assets/models/model.pte"
  }

  if (!($modelEntries -contains "assets/models/tokenizer.json")) {
    throw "APK is missing assets/models/tokenizer.json"
  }

  Write-Host ""
  Write-Host "APK contains the required ExecuTorch model asset names."
} else {
  if ($modelEntries -contains "assets/models/model.pte") {
    throw "Stable APK packages assets/models/model.pte even though ExecuTorch native loading is disabled."
  }

  Write-Host ""
  Write-Host "Stable APK excludes ExecuTorch model assets and includes llama.rn native libraries."
}
