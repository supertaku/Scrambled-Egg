param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $ApkPath)) {
  throw "APK not found: $ApkPath"
}
$resolvedApkPath = (Resolve-Path $ApkPath).Path

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

$sdkRoots = @($env:ANDROID_SDK_ROOT, $env:ANDROID_HOME, (Join-Path $env:LOCALAPPDATA "Android\Sdk")) |
  Where-Object { $_ -and (Test-Path $_) } |
  Select-Object -Unique
$dexdumpPath = $null
foreach ($sdkRoot in $sdkRoots) {
  $candidate = Get-ChildItem (Join-Path $sdkRoot "build-tools") -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "dexdump.exe" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
  if ($candidate) {
    $dexdumpPath = $candidate
    break
  }
}
if (!$dexdumpPath) {
  throw "dexdump was not found under the Android SDK build-tools directories."
}

$entries = & $jarPath tf $resolvedApkPath
$modelEntries = $entries | Where-Object { $_ -like "assets/models/*" }
$nativeEntries = $entries | Where-Object { $_ -like "lib/*" -and $_ -match "pytorch|fbjni|soloader|rnllama|litertlm" }
$execuTorchNativeEntries = $nativeEntries | Where-Object { $_ -match "libexecutorch" }
$llamaNativeEntries = $nativeEntries | Where-Object { $_ -match "librnllama" }
$liteRtArm64Entries = $nativeEntries | Where-Object { $_ -eq "lib/arm64-v8a/liblitertlm_jni.so" }

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

if (!$liteRtArm64Entries) {
  throw "APK is missing the LiteRT-LM arm64 runtime library lib/arm64-v8a/liblitertlm_jni.so."
}

$packagedModelFiles = $modelEntries | Where-Object { $_ -match "\.(gguf|pte|litertlm|onnx)$" }
if ($packagedModelFiles) {
  throw "APK packages local model files under assets/models. Production builds must let users download compatible models into app-private storage."
}

$tempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("haki-apk-inspect-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDirectory | Out-Null
try {
  Push-Location $tempDirectory
  try {
    $dexEntries = $entries | Where-Object { $_ -match "^classes\d*\.dex$" }
    foreach ($dexEntry in $dexEntries) {
      & $jarPath xf $resolvedApkPath $dexEntry
    }
  } finally {
    Pop-Location
  }

  $dexDump = (Get-ChildItem $tempDirectory -Filter "classes*.dex" | ForEach-Object {
    & $dexdumpPath -d $_.FullName
  }) -join "`n"

  function Get-DexClassBlock([string]$Descriptor) {
    $classPattern = "(?ms)^Class #\d+.*?Class descriptor\s+:\s+'" + [Regex]::Escape($Descriptor) + "'.*?(?=^Class #\d+|\z)"
    $match = [Regex]::Match($dexDump, $classPattern)
    if (!$match.Success) {
      throw "APK is missing expected LiteRT-LM class $Descriptor."
    }
    return $match.Value
  }

  $engineBlock = Get-DexClassBlock "Lcom/google/ai/edge/litertlm/Engine;"
  $conversationBlock = Get-DexClassBlock "Lcom/google/ai/edge/litertlm/Conversation;"
  $callbackBlock = Get-DexClassBlock "Lcom/google/ai/edge/litertlm/MessageCallback;"

  foreach ($method in @("initialize", "createConversation")) {
    if ($engineBlock -notmatch ("name\s+:\s+'" + [Regex]::Escape($method) + "'")) {
      throw "LiteRT-LM Engine is missing expected method $method."
    }
  }
  foreach ($method in @("sendMessageAsync", "cancelProcess", "close")) {
    if ($conversationBlock -notmatch ("name\s+:\s+'" + [Regex]::Escape($method) + "'")) {
      throw "LiteRT-LM Conversation is missing expected method $method."
    }
  }
  foreach ($method in @("onMessage", "onDone", "onError")) {
    if ($callbackBlock -notmatch ("name\s+:\s+'" + [Regex]::Escape($method) + "'")) {
      throw "LiteRT-LM MessageCallback is missing expected method $method."
    }
  }
} finally {
  Remove-Item -LiteralPath $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Stable APK check passed: no packaged model weights, llama.rn and arm64 LiteRT-LM native libraries present, required LiteRT classes and methods present, no ExecuTorch packaging."
