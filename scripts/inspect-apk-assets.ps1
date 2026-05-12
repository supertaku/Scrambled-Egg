param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath
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
$nativeEntries = $entries | Where-Object { $_ -like "lib/*" -and $_ -match "pytorch|fbjni|soloader|rnllama" }
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

if ($execuTorchNativeEntries) {
  throw "APK packages ExecuTorch native libraries (libexecutorch). Stable Haki builds use llama.rn only. Rebuild without experimental ExecuTorch artifacts."
}

if (!$llamaNativeEntries) {
  throw "APK is missing llama.rn native libraries. Rebuild the custom native app with the llama.rn plugin enabled."
}

if ($modelEntries -contains "assets/models/model.pte") {
  throw "APK packages assets/models/model.pte (legacy ExecuTorch). Remove .pte assets from release builds."
}

if (!($modelEntries -contains "assets/models/haki-default.gguf")) {
  throw "Stable APK is missing the bundled default GGUF model at assets/models/haki-default.gguf."
}

Write-Host ""
Write-Host "Stable APK check passed: bundled default GGUF present, llama.rn native libraries present, no ExecuTorch packaging."
