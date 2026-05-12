package com.tupt.haki

import android.app.ActivityManager
import android.content.Context
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.FileNotFoundException

class HakiDeviceInfoModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "HakiDeviceInfo"

  @ReactMethod
  fun getHardwareProfile(promise: Promise) {
    try {
      val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memoryInfo = ActivityManager.MemoryInfo()
      activityManager.getMemoryInfo(memoryInfo)

      val supportedAbis = Arguments.createArray()
      Build.SUPPORTED_ABIS.forEach { abi ->
        supportedAbis.pushString(abi)
      }

      val profile = Arguments.createMap()
      profile.putArray("supportedAbis", supportedAbis)
      profile.putDouble("totalMemoryBytes", memoryInfo.totalMem.toDouble())
      profile.putDouble("availableMemoryBytes", memoryInfo.availMem.toDouble())
      profile.putDouble("thresholdBytes", memoryInfo.threshold.toDouble())
      profile.putInt("memoryClassMb", activityManager.memoryClass)
      profile.putInt("largeMemoryClassMb", activityManager.largeMemoryClass)
      profile.putBoolean("lowMemory", memoryInfo.lowMemory)

      promise.resolve(profile)
    } catch (error: Exception) {
      promise.reject("E_HAKI_DEVICE_INFO", "Failed to read Android hardware profile.", error)
    }
  }

  @ReactMethod
  fun copyBundledAssetToFile(assetPath: String, targetUri: String, promise: Promise) {
    try {
      val targetPath = Uri.parse(targetUri).path
      if (targetPath.isNullOrBlank()) {
        promise.reject("E_HAKI_BUNDLED_MODEL_TARGET", "Invalid bundled model target path.")
        return
      }

      val targetFile = File(targetPath)
      targetFile.parentFile?.mkdirs()
      val tempFile = File("${targetFile.absolutePath}.copying")
      var copiedBytes = 0L

      reactContext.assets.open(assetPath).use { input ->
        FileOutputStream(tempFile).use { output ->
          val buffer = ByteArray(1024 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            output.write(buffer, 0, read)
            copiedBytes += read.toLong()
          }
        }
      }

      if (targetFile.exists() && !targetFile.delete()) {
        tempFile.delete()
        promise.reject("E_HAKI_BUNDLED_MODEL_REPLACE", "Could not replace existing bundled model target.")
        return
      }

      if (!tempFile.renameTo(targetFile)) {
        tempFile.delete()
        promise.reject("E_HAKI_BUNDLED_MODEL_RENAME", "Could not activate copied bundled model.")
        return
      }

      val result = Arguments.createMap()
      result.putString("assetPath", assetPath)
      result.putString("uri", targetUri)
      result.putDouble("sizeBytes", copiedBytes.toDouble())
      promise.resolve(result)
    } catch (error: FileNotFoundException) {
      promise.reject("E_HAKI_BUNDLED_MODEL_MISSING", "Bundled default GGUF asset is missing: $assetPath", error)
    } catch (error: Exception) {
      promise.reject("E_HAKI_BUNDLED_MODEL_COPY", "Failed to copy bundled default GGUF asset.", error)
    }
  }
}
