package com.tupt.haki

import android.app.ActivityManager
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

class HakiDeviceInfoModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val canceledHashOperations = ConcurrentHashMap.newKeySet<String>()
  private val backgroundDownloadPreferences =
    reactContext.getSharedPreferences("haki_background_downloads", Context.MODE_PRIVATE)

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
      val thermalState = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        when (powerManager.currentThermalStatus) {
          PowerManager.THERMAL_STATUS_NONE -> "nominal"
          PowerManager.THERMAL_STATUS_LIGHT -> "fair"
          PowerManager.THERMAL_STATUS_MODERATE -> "fair"
          PowerManager.THERMAL_STATUS_SEVERE -> "serious"
          PowerManager.THERMAL_STATUS_CRITICAL -> "critical"
          PowerManager.THERMAL_STATUS_EMERGENCY -> "critical"
          PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
          else -> "unknown"
        }
      } else {
        "unknown"
      }
      profile.putString("thermalState", thermalState)

      promise.resolve(profile)
    } catch (error: Exception) {
      promise.reject("E_HAKI_DEVICE_INFO", "Failed to read Android hardware profile.", error)
    }
  }

  @ReactMethod
  fun sha256File(targetUri: String, operationId: String, promise: Promise) {
    Thread {
      try {
        val targetPath = Uri.parse(targetUri).path
        if (targetPath.isNullOrBlank()) {
          promise.reject("E_HAKI_HASH_TARGET", "Invalid model verification target path.")
          return@Thread
        }
        val targetFile = File(targetPath)
        if (!targetFile.exists()) {
          promise.reject("E_HAKI_HASH_MISSING", "Model file is missing before verification.")
          return@Thread
        }
        val digest = MessageDigest.getInstance("SHA-256")
        targetFile.inputStream().buffered(1024 * 1024).use { input ->
          val buffer = ByteArray(1024 * 1024)
          while (true) {
            if (canceledHashOperations.remove(operationId)) {
              promise.reject("E_HAKI_HASH_CANCELED", "Model verification was canceled.")
              return@Thread
            }
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
          }
        }
        val result = digest.digest().joinToString("") { byte -> "%02x".format(byte) }
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("E_HAKI_HASH", "Failed to verify downloaded model.", error)
      } finally {
        canceledHashOperations.remove(operationId)
      }
    }.start()
  }

  @ReactMethod
  fun cancelSha256File(operationId: String) {
    canceledHashOperations.add(operationId)
  }

  @ReactMethod
  fun startBackgroundDownload(url: String, operationId: String, promise: Promise) {
    try {
      val directory = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        ?: throw IllegalStateException("External model staging directory is unavailable.")
      if (!directory.exists()) directory.mkdirs()
      val target = File(directory, "$operationId.partial.gguf")
      if (target.exists()) target.delete()

      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle("Downloading Haki chat option")
        .setDescription("Haki can finish this download while you use another app.")
        .setDestinationUri(Uri.fromFile(target))
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(false)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)

      val manager = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val downloadId = manager.enqueue(request)
      backgroundDownloadPreferences.edit().putLong(operationId, downloadId).apply()

      val result = Arguments.createMap()
      result.putDouble("downloadId", downloadId.toDouble())
      result.putString("fileUri", Uri.fromFile(target).toString())
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_HAKI_DOWNLOAD_START", "Failed to start background model download.", error)
    }
  }

  @ReactMethod
  fun getBackgroundDownloadStatus(operationId: String, promise: Promise) {
    val downloadId = backgroundDownloadPreferences.getLong(operationId, -1L)
    if (downloadId < 0) {
      promise.resolve(backgroundDownloadStatus("missing", 0L, -1L, "Download record is missing."))
      return
    }

    try {
      val manager = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      manager.query(DownloadManager.Query().setFilterById(downloadId)).use { cursor ->
        if (!cursor.moveToFirst()) {
          promise.resolve(backgroundDownloadStatus("missing", 0L, -1L, "Download could not be restored."))
          return
        }

        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        val written = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
        val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
        val mappedStatus = when (status) {
          DownloadManager.STATUS_PENDING -> "queued"
          DownloadManager.STATUS_RUNNING -> "downloading"
          DownloadManager.STATUS_PAUSED -> "queued"
          DownloadManager.STATUS_SUCCESSFUL -> "completed"
          DownloadManager.STATUS_FAILED -> "failed"
          else -> "missing"
        }
        val error = if (status == DownloadManager.STATUS_FAILED) {
          "System download failed with reason ${cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))}."
        } else {
          null
        }
        promise.resolve(backgroundDownloadStatus(mappedStatus, written, total, error))
      }
    } catch (error: Exception) {
      promise.reject("E_HAKI_DOWNLOAD_STATUS", "Failed to inspect background model download.", error)
    }
  }

  @ReactMethod
  fun cancelBackgroundDownload(operationId: String, promise: Promise) {
    try {
      val downloadId = backgroundDownloadPreferences.getLong(operationId, -1L)
      if (downloadId >= 0) {
        val manager = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        manager.remove(downloadId)
      }
      backgroundDownloadPreferences.edit().remove(operationId).apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("E_HAKI_DOWNLOAD_CANCEL", "Failed to cancel background model download.", error)
    }
  }

  @ReactMethod
  fun clearBackgroundDownloadRecord(operationId: String, promise: Promise) {
    backgroundDownloadPreferences.edit().remove(operationId).apply()
    promise.resolve(null)
  }

  private fun backgroundDownloadStatus(
    phase: String,
    bytesWritten: Long,
    totalBytes: Long,
    error: String?
  ) = Arguments.createMap().apply {
    putString("phase", phase)
    putDouble("bytesWritten", bytesWritten.toDouble())
    if (totalBytes > 0) putDouble("totalBytes", totalBytes.toDouble()) else putNull("totalBytes")
    if (error == null) putNull("error") else putString("error", error)
  }
}
