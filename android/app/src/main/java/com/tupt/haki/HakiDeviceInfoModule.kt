package com.tupt.haki

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HakiDeviceInfoModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

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

      val result = Arguments.createMap()
      result.putArray("supportedAbis", supportedAbis)
      result.putDouble("totalMemoryBytes", memoryInfo.totalMem.toDouble())
      result.putInt("memoryClassMb", activityManager.memoryClass)
      result.putInt("largeMemoryClassMb", activityManager.largeMemoryClass)
      result.putBoolean("lowMemory", memoryInfo.lowMemory)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_HAKI_DEVICE_INFO", "Unable to read Android hardware profile.", error)
    }
  }
}
