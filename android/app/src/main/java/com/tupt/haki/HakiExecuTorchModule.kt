package com.tupt.haki

import android.app.ActivityManager
import android.os.Build
import android.os.StatFs
import android.os.SystemClock
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.lang.reflect.Proxy
import java.util.Locale
import java.util.concurrent.Executors

private const val PROVIDER_ID = "executorch"
private const val PROVIDER_NAME = "ExecuTorch"
private const val NO_RELIABLE_ANSWER = "NO_RELIABLE_ANSWER"
private const val MODELS_BASE_PATH = "models"
private const val LLM_MODULE_CLASS = "org.pytorch.executorch.extension.llm.LlmModule"
private const val LLM_CALLBACK_CLASS = "org.pytorch.executorch.extension.llm.LlmCallback"
private const val MODEL_NAME = "Qwen3-0.6B ExecuTorch XNNPACK"
private const val MODEL_PARAMETER_COUNT_B = 0.6
private const val MODEL_QUANTIZATION = "INT8 activations + INT4 weights"
private const val NATIVE_DISABLED_REASON =
  "ExecuTorch model loading is disabled for this release build. Build with -Phaki.enableExecuTorchNative=true only after validating the bundled model and runtime on the target device."

class HakiExecuTorchModule(
  private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  private var module: Any? = null
  private var modelLoadTimeMs: Long? = null
  private var lastInferenceTimeMs: Long? = null

  override fun getName(): String = "HakiExecuTorch"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    executor.execute {
      promise.resolve(nativeReadyForUse())
    }
  }

  @ReactMethod
  fun isModelTierDownloaded(tier: String, promise: Promise) {
    executor.execute {
      val modelFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/model.pte")
      val tokenizerFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/tokenizer.json")
      promise.resolve(modelFile.exists() && modelFile.length() > 0 && 
                      tokenizerFile.exists() && tokenizerFile.length() > 0)
    }
  }

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    executor.execute {
      try {
        val ready = nativeReadyForUse()
        val capabilities = Arguments.createMap().apply {
          putBoolean("summary", ready)
          putBoolean("safeChat", ready)
          putBoolean("embeddings", false)
          putBoolean("reranking", false)
          putString("architecture", Build.SUPPORTED_ABIS.joinToString(", "))
          putDouble("freeStorageGB", getFreeStorageGB())
          putDouble("memoryGB", getMemoryGB())
          putString("memoryClass", "${getMemoryClassMB()}MB")
          putBoolean("modelAssetsAvailable", modelAssetsAvailable())
          putString("modelName", MODEL_NAME)
          putDouble("modelParameterCountB", MODEL_PARAMETER_COUNT_B)
          putString("modelQuantization", MODEL_QUANTIZATION)
          putString("modelTier", getActiveModelTier())
          putString("recommendedModelTier", recommendedTier())
          putString("modelAssetPath", "assets/$MODELS_BASE_PATH/${getActiveModelTier()}")
          putBoolean("streamingSupported", false)
          putString("approximateDeviceCapability", approximateDeviceCapability())
          modelLoadTimeMs?.let { putDouble("modelLoadTimeMs", it.toDouble()) }
          lastInferenceTimeMs?.let { putDouble("lastInferenceTimeMs", it.toDouble()) }
          putArray("unavailableReasons", unavailableReasons())
        }
        promise.resolve(capabilities)
      } catch (error: Exception) {
        promise.reject("E_EXECUTORCH_CAPABILITIES", error.message, error)
      }
    }
  }

  @ReactMethod
  fun summarizeFromSources(input: ReadableMap, promise: Promise) {
    executor.execute {
      if (!BuildConfig.HAKI_EXECUTORCH_NATIVE_ENABLED) {
        promise.resolve(noReliableSummary())
        return@execute
      }

      try {
        val prompt = buildSummaryPrompt(input)
        val answer = generate(prompt, maxTokens = 384)
        if (answer.isBlank() || answer == NO_RELIABLE_ANSWER) {
          promise.resolve(noReliableSummary())
          return@execute
        }

        promise.resolve(Arguments.createMap().apply {
          putString("status", "ok")
          putString("text", answer)
          putArray("citationIds", citationIdsFromSources(input.getArrayOrNull("sources")))
          putString("providerId", PROVIDER_ID)
          putString("providerName", PROVIDER_NAME)
        })
      } catch (error: Exception) {
        promise.reject("E_EXECUTORCH_SUMMARY", error.message, error)
      }
    }
  }

  @ReactMethod
  fun answerSafeChat(input: ReadableMap, promise: Promise) {
    executor.execute {
      if (!BuildConfig.HAKI_EXECUTORCH_NATIVE_ENABLED) {
        promise.reject("E_EXECUTORCH_DISABLED", NATIVE_DISABLED_REASON)
        return@execute
      }

      try {
        val prompt = buildSafeChatPrompt(input)
        val answer = generate(prompt, maxTokens = 512)
        promise.resolve(Arguments.createMap().apply {
          putString("status", if (answer.isBlank()) "refused" else "ok")
          putString("text", if (answer.isBlank()) "I cannot give a reliable answer from the local model right now." else answer)
          putArray("citationIds", citationIdsFromSources(input.getArrayOrNull("sourceContext")))
          putString("providerId", PROVIDER_ID)
          putString("providerName", PROVIDER_NAME)
        })
      } catch (error: Exception) {
        promise.reject("E_EXECUTORCH_CHAT", error.message, error)
      }
    }
  }

  @ReactMethod
  fun release(promise: Promise) {
    executor.execute {
      try {
        module?.javaClass?.getMethod("resetNative")?.invoke(module)
      } catch (_: Exception) {
        // Best effort cleanup; stale native state should not block app shutdown.
      } finally {
        module = null
        promise.resolve(null)
      }
    }
  }

  private fun nativeReadyForUse(): Boolean {
    return BuildConfig.HAKI_EXECUTORCH_NATIVE_ENABLED &&
      Build.VERSION.SDK_INT >= 33 &&
      hasArm64Abi() &&
      modelAssetsAvailable() &&
      getMemoryGB() >= 4.0 &&
      getFreeStorageGB() >= 3.0 &&
      executorchClassesAvailable()
  }

  private fun unavailableReasons(): WritableArray {
    val reasons = Arguments.createArray()
    if (!BuildConfig.HAKI_EXECUTORCH_NATIVE_ENABLED) {
      reasons.pushString(NATIVE_DISABLED_REASON)
    }
    if (BuildConfig.HAKI_EXECUTORCH_NATIVE_ENABLED && !executorchClassesAvailable()) {
      reasons.pushString("ExecuTorch runtime classes are not packaged in this APK.")
    }
    if (Build.VERSION.SDK_INT < 33) {
      reasons.pushString("ExecuTorch requires Android 13+.")
    }
    if (!hasArm64Abi()) {
      reasons.pushString("ExecuTorch requires arm64-v8a; this device reports ${Build.SUPPORTED_ABIS.joinToString(", ")}.")
    }
    if (!modelAssetsAvailable()) {
      reasons.pushString("ExecuTorch model assets are not available on this device.")
    }
    if (getMemoryGB() < 4.0) {
      reasons.pushString("ExecuTorch requires at least 4GB RAM for Haki tiny local AI.")
    }
    if (getFreeStorageGB() < 3.0) {
      reasons.pushString("ExecuTorch requires at least 3GB free storage for bundled model assets.")
    }
    return reasons
  }

  private fun ensureModule(): Any {
    if (!BuildConfig.HAKI_EXECUTORCH_NATIVE_ENABLED) {
      throw IllegalStateException(NATIVE_DISABLED_REASON)
    }

    module?.let { return it }

    if (!nativeReadyForUse()) {
      throw IllegalStateException(unavailableReasonsToString())
    }

    val tier = getActiveModelTier()
    val moduleClass = Class.forName(LLM_MODULE_CLASS)
    
    // Check internal storage first (downloaded), then fallback to assets
    val internalModelFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/model.pte")
    val internalTokenizerFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/tokenizer.json")
    
    val modelFile: File
    val tokenizerFile: File
    
    if (internalModelFile.exists() && internalModelFile.length() > 0 && 
        internalTokenizerFile.exists() && internalTokenizerFile.length() > 0) {
        modelFile = internalModelFile
        tokenizerFile = internalTokenizerFile
    } else {
        modelFile = copyAssetToFiles("$MODELS_BASE_PATH/$tier/model.pte")
        tokenizerFile = copyAssetToFiles("$MODELS_BASE_PATH/$tier/tokenizer.json")
    }

    val startMs = SystemClock.elapsedRealtime()
    val created = moduleClass
      .getConstructor(String::class.java, String::class.java, Float::class.javaPrimitiveType)
      .newInstance(modelFile.absolutePath, tokenizerFile.absolutePath, 0.2f)
    val loadCode = (moduleClass.getMethod("load").invoke(created) as? Number)?.toInt() ?: 0
    modelLoadTimeMs = SystemClock.elapsedRealtime() - startMs
    if (loadCode != 0) {
      throw IllegalStateException("ExecuTorch model load failed with code $loadCode.")
    }
    module = created
    return created
  }

  private fun generate(prompt: String, maxTokens: Int): String {
    val loadedModule = ensureModule()
    val callbackInterface = Class.forName(LLM_CALLBACK_CLASS)
    val output = StringBuilder()
    val callback = Proxy.newProxyInstance(
      callbackInterface.classLoader,
      arrayOf(callbackInterface)
    ) { _, method, args ->
      when (method.name) {
        "onResult" -> {
          output.append(args?.firstOrNull() as? String ?: "")
          null
        }
        "onStats" -> null
        else -> null
      }
    }

    val startMs = SystemClock.elapsedRealtime()
    val resultCode = (loadedModule.javaClass
      .getMethod("generate", String::class.java, Int::class.javaPrimitiveType, callbackInterface)
      .invoke(loadedModule, prompt, maxTokens) as? Number)?.toInt() ?: 0
    lastInferenceTimeMs = SystemClock.elapsedRealtime() - startMs

    if (resultCode != 0) {
      throw IllegalStateException("ExecuTorch generation failed with code $resultCode.")
    }

    return sanitizeGeneratedText(output.toString())
  }

  private fun buildSummaryPrompt(input: ReadableMap): String {
    val question = input.getStringOrDefault("question", "")
    val instruction = input.getStringOrDefault("instruction", "")
    val sources = formatSources(input.getArrayOrNull("sources"))
    return """
      |System:
      |$instruction
      |
      |Use only the cited source snippets below. If they do not answer the question, reply exactly $NO_RELIABLE_ANSWER.
      |
      |Sources:
      |$sources
      |
      |User:
      |$question
      |
      |Assistant:
    """.trimMargin()
  }

  private fun buildSafeChatPrompt(input: ReadableMap): String {
    val instruction = input.getStringOrDefault("instruction", "")
    val appContext = input.getStringOrDefault("appContext", "")
    val question = input.getStringOrDefault("question", "")
    val sourceContext = formatSources(input.getArrayOrNull("sourceContext"))
    val sourceBlock = if (sourceContext.isBlank()) "" else "\nRelevant saved sources:\n$sourceContext\n"
    return """
      |System:
      |$instruction
      |
      |$appContext
      |$sourceBlock
      |User:
      |$question
      |
      |Assistant:
    """.trimMargin()
  }

  private fun formatSources(sources: ReadableArray?): String {
    if (sources == null || sources.size() == 0) {
      return ""
    }

    val chunks = mutableListOf<String>()
    for (index in 0 until minOf(sources.size(), 6)) {
      val source = sources.getMap(index) ?: continue
      val citationId = source.getStringOrDefault("citationId", source.getStringOrDefault("chunkId", "source-${index + 1}"))
      val title = source.getStringOrDefault("documentTitle", "Saved source")
      val section = source.getStringOrDefault("sectionTitle", "")
      val content = source.getStringOrDefault("content", "")
      chunks.add("[$citationId] $title${if (section.isBlank()) "" else " - $section"}\n$content")
    }
    return chunks.joinToString("\n\n")
  }

  private fun citationIdsFromSources(sources: ReadableArray?): WritableArray {
    val citationIds = Arguments.createArray()
    if (sources == null) {
      return citationIds
    }

    for (index in 0 until sources.size()) {
      val source = sources.getMap(index) ?: continue
      val citationId = source.getStringOrDefault("citationId", source.getStringOrDefault("chunkId", ""))
      if (citationId.isNotBlank()) {
        citationIds.pushString(citationId)
      }
    }
    return citationIds
  }

  private fun sanitizeGeneratedText(text: String): String {
    return text
      .replace("<|im_end|>", "")
      .substringAfterLast("Assistant:", text)
      .substringAfterLast("<|im_start|>assistant", text)
      .trim()
  }

  private fun copyAssetToFiles(assetName: String): File {
    val outputFile = File(context.filesDir, assetName)
    if (outputFile.exists() && outputFile.length() > 0) {
      return outputFile
    }

    outputFile.parentFile?.mkdirs()
    context.assets.open(assetName).use { input ->
      outputFile.outputStream().use { output ->
        input.copyTo(output)
      }
    }
    return outputFile
  }

  private fun executorchClassesAvailable(): Boolean {
    return try {
      Class.forName(LLM_MODULE_CLASS)
      Class.forName(LLM_CALLBACK_CLASS)
      true
    } catch (_: Throwable) {
      false
    }
  }

  private fun modelAssetsAvailable(): Boolean {
    val tier = getActiveModelTier()
    
    // Check internal storage
    val internalModelFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/model.pte")
    val internalTokenizerFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/tokenizer.json")
    if (internalModelFile.exists() && internalModelFile.length() > 0 && 
        internalTokenizerFile.exists() && internalTokenizerFile.length() > 0) {
        return true
    }
    
    // Check assets
    return assetExists("$MODELS_BASE_PATH/$tier/model.pte") && 
           assetExists("$MODELS_BASE_PATH/$tier/tokenizer.json")
  }

  private fun assetExists(assetName: String): Boolean {
    return try {
      context.assets.open(assetName).use { true }
    } catch (_: Exception) {
      false
    }
  }

  private fun hasArm64Abi(): Boolean {
    return Build.SUPPORTED_ABIS.any { abi -> abi.lowercase(Locale.US).contains("arm64") }
  }

  private fun getFreeStorageGB(): Double {
    val statFs = StatFs(context.filesDir.absolutePath)
    return statFs.availableBytes.toDouble() / (1024.0 * 1024.0 * 1024.0)
  }

  private fun getMemoryGB(): Double {
    val activityManager = context.getSystemService(ActivityManager::class.java)
    val info = ActivityManager.MemoryInfo()
    activityManager.getMemoryInfo(info)
    return info.totalMem.toDouble() / (1024.0 * 1024.0 * 1024.0)
  }

  private fun getMemoryClassMB(): Int {
    return context.getSystemService(ActivityManager::class.java).memoryClass
  }

  private fun approximateDeviceCapability(): String {
    val memoryGB = getMemoryGB()
    return when {
      memoryGB >= 8.0 -> "high"
      memoryGB >= 4.0 -> "standard"
      else -> "low"
    }
  }

  private fun getActiveModelTier(): String {
    val recommended = recommendedTier()
    
    // Check internal storage for recommended tier
    val internalModelFile = File(context.filesDir, "$MODELS_BASE_PATH/$recommended/model.pte")
    val internalTokenizerFile = File(context.filesDir, "$MODELS_BASE_PATH/$recommended/tokenizer.json")
    if (internalModelFile.exists() && internalModelFile.length() > 0 && 
        internalTokenizerFile.exists() && internalTokenizerFile.length() > 0) {
        return recommended
    }
    
    // Check assets for recommended tier
    if (assetExists("$MODELS_BASE_PATH/$recommended/model.pte") && 
        assetExists("$MODELS_BASE_PATH/$recommended/tokenizer.json")) {
      return recommended
    }
    
    // Fallback search through tiers from best to worst in both locations
    val tiers = listOf("flagship", "enhanced", "good", "minimum", "tiny")
    for (tier in tiers) {
      val fallbackModelFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/model.pte")
      val fallbackTokenizerFile = File(context.filesDir, "$MODELS_BASE_PATH/$tier/tokenizer.json")
      
      val internalExists = fallbackModelFile.exists() && fallbackModelFile.length() > 0 && 
                           fallbackTokenizerFile.exists() && fallbackTokenizerFile.length() > 0
      val assetExists = assetExists("$MODELS_BASE_PATH/$tier/model.pte") && 
                        assetExists("$MODELS_BASE_PATH/$tier/tokenizer.json")
                        
      if (internalExists || assetExists) {
        return tier
      }
    }
    
    return "tiny" // Default baseline
  }

  private fun recommendedTier(): String {
    val memoryGB = getMemoryGB()
    val freeStorageGB = getFreeStorageGB()
    return when {
      memoryGB >= 16.0 && freeStorageGB >= 12.0 -> "flagship"
      memoryGB >= 12.0 && freeStorageGB >= 10.0 -> "enhanced"
      memoryGB >= 8.0 && freeStorageGB >= 6.0 -> "good"
      memoryGB >= 6.0 && freeStorageGB >= 4.0 -> "minimum"
      memoryGB >= 4.0 && freeStorageGB >= 3.0 -> "tiny"
      else -> "unknown"
    }
  }

  private fun unavailableReasonsToString(): String {
    val reasons = unavailableReasons()
    val values = mutableListOf<String>()
    for (index in 0 until reasons.size()) {
      reasons.getString(index)?.let { values.add(it) }
    }
    return values.joinToString(" ")
  }

  private fun noReliableSummary(): WritableMap {
    return Arguments.createMap().apply {
      putString("status", "no_reliable_answer")
      putString("text", NO_RELIABLE_ANSWER)
      putArray("citationIds", Arguments.createArray())
      putString("providerId", PROVIDER_ID)
      putString("providerName", PROVIDER_NAME)
    }
  }
}

private fun ReadableMap.getStringOrDefault(key: String, defaultValue: String): String {
  return if (hasKey(key) && !isNull(key)) {
    getString(key) ?: defaultValue
  } else {
    defaultValue
  }
}

private fun ReadableMap.getArrayOrNull(key: String): ReadableArray? {
  return if (hasKey(key) && !isNull(key)) {
    getArray(key)
  } else {
    null
  }
}
