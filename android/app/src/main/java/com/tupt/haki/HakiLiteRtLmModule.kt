package com.tupt.haki

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import java.io.File

class HakiLiteRtLmModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val lock = Any()
  private var engine: AutoCloseable? = null
  private var engineModelPath: String? = null
  private var modelLoadTimeMs: Long? = null
  private var lastInferenceTimeMs: Long? = null

  override fun getName(): String = "HakiLiteRtLm"

  @ReactMethod
  fun isRuntimeAvailable(promise: Promise) {
    promise.resolve(liteRtClassesAvailable())
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(engine != null && engineModelPath != null)
  }

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    val runtimeAvailable = liteRtClassesAvailable()
    val result = Arguments.createMap()
    result.putBoolean("summary", runtimeAvailable)
    result.putBoolean("safeChat", runtimeAvailable)
    result.putBoolean("embeddings", false)
    result.putBoolean("reranking", false)
    result.putBoolean("modelAssetsAvailable", engine != null)
    result.putString("modelName", engineModelPath?.let { File(it).name })
    result.putDouble("modelParameterCountB", 0.0)
    result.putString("modelQuantization", "litert-lm")
    result.putString("modelTier", "unknown")
    result.putString("recommendedModelTier", "unknown")
    result.putString("modelAssetPath", engineModelPath)
    modelLoadTimeMs?.let { result.putDouble("modelLoadTimeMs", it.toDouble()) }
    lastInferenceTimeMs?.let { result.putDouble("lastInferenceTimeMs", it.toDouble()) }
    result.putBoolean("streamingSupported", false)
    result.putString("approximateDeviceCapability", "unknown")
    result.putString("memoryClass", null)
    result.putArray("unavailableReasons", Arguments.createArray())
    promise.resolve(result)
  }

  @ReactMethod
  fun summarizeFromSources(input: ReadableMap, promise: Promise) {
    Thread {
      try {
        val modelPath = requireModelPath(input)
        val instruction = stringValue(input, "instruction")
        val question = stringValue(input, "question")
        val sources = sourceBlock(arrayValue(input, "sources"))
        val prompt = listOf(
          instruction,
          sources,
          "Question: $question",
          "Answer in English. Use only the supplied sources. End with `SOURCE_IDS: ...` using only source IDs from the sources."
        ).filter { it.isNotBlank() }.joinToString("\n\n")
        promise.resolve(generate(modelPath, prompt, instruction))
      } catch (error: Exception) {
        promise.reject("E_HAKI_LITERT_SUMMARY", "LiteRT-LM summarization failed.", error)
      }
    }.start()
  }

  @ReactMethod
  fun answerSafeChat(input: ReadableMap, promise: Promise) {
    Thread {
      try {
        val modelPath = requireModelPath(input)
        val instruction = stringValue(input, "instruction")
        val prompt = safeChatPrompt(input)
        promise.resolve(generate(modelPath, prompt, instruction))
      } catch (error: Exception) {
        promise.reject("E_HAKI_LITERT_CHAT", "LiteRT-LM safe chat failed.", error)
      }
    }.start()
  }

  @ReactMethod
  fun release(promise: Promise) {
    synchronized(lock) {
      closeQuietly(engine)
      engine = null
      engineModelPath = null
      modelLoadTimeMs = null
      lastInferenceTimeMs = null
    }
    promise.resolve(null)
  }

  private fun requireModelPath(input: ReadableMap): String {
    val modelPath = stringValue(input, "modelPath")
    if (modelPath.isBlank()) {
      throw IllegalArgumentException("LiteRT-LM modelPath is required.")
    }
    val modelFile = File(modelPath)
    if (!modelFile.exists()) {
      throw IllegalArgumentException("LiteRT-LM model file is missing.")
    }
    if (!modelFile.name.lowercase().endsWith(".litertlm")) {
      throw IllegalArgumentException("LiteRT-LM model file must use the .litertlm extension.")
    }
    return modelFile.absolutePath
  }

  private fun engineFor(modelPath: String): AutoCloseable {
    synchronized(lock) {
      val current = engine
      if (current != null && engineModelPath == modelPath) {
        return current
      }

      closeQuietly(current)
      setNativeMinLogSeverityError()
      val startedAt = System.currentTimeMillis()
      val next = Class
        .forName(ENGINE_CLASS)
        .getConstructor(Class.forName(ENGINE_CONFIG_CLASS))
        .newInstance(newEngineConfig(modelPath)) as AutoCloseable
      next.javaClass.getMethod("initialize").invoke(next)
      engine = next
      engineModelPath = modelPath
      modelLoadTimeMs = System.currentTimeMillis() - startedAt
      return next
    }
  }

  private fun generate(modelPath: String, prompt: String, systemInstruction: String): String {
    val startedAt = System.currentTimeMillis()
    val normalizedInstruction = systemInstruction.ifBlank {
      "You are Haki, a local student assistant. Answer in English only."
    }
    val conversation = createConversation(engineFor(modelPath), normalizedInstruction)
    try {
      val response = conversation
        .javaClass
        .getMethod("sendMessage", String::class.java, java.util.Map::class.java)
        .invoke(conversation, prompt, emptyMap<String, Any>())
      lastInferenceTimeMs = System.currentTimeMillis() - startedAt
      return messageText(response)
    } finally {
      closeQuietly(conversation)
    }
  }

  private fun messageText(message: Any?): String {
    if (message == null) return ""

    val textParts = try {
      val contents = message.javaClass.getMethod("getContents").invoke(message)
      val contentItems = contents
        ?.javaClass
        ?.getMethod("getContents")
        ?.invoke(contents) as? Iterable<*>
      val textClass = Class.forName(CONTENT_TEXT_CLASS)
      contentItems
        ?.mapNotNull { content ->
          if (content == null || !textClass.isInstance(content)) {
            null
          } else {
            content.javaClass.getMethod("getText").invoke(content) as? String
          }
        }
        ?.joinToString("")
        ?.trim()
    } catch (_: Throwable) {
      null
    }

    return textParts?.takeIf { it.isNotBlank() } ?: message.toString().trim()
  }

  private fun createConversation(engine: AutoCloseable, systemInstruction: String): AutoCloseable {
    return engine
      .javaClass
      .getMethod("createConversation", Class.forName(CONVERSATION_CONFIG_CLASS))
      .invoke(engine, newConversationConfig(systemInstruction)) as AutoCloseable
  }

  private fun newEngineConfig(modelPath: String): Any {
    val backendClass = Class.forName(BACKEND_CLASS)
    val cpuBackend = Class.forName(BACKEND_CPU_CLASS).getConstructor().newInstance()
    return Class
      .forName(ENGINE_CONFIG_CLASS)
      .getConstructor(
        String::class.java,
        backendClass,
        backendClass,
        backendClass,
        java.lang.Integer::class.java,
        java.lang.Integer::class.java,
        String::class.java
      )
      .newInstance(
        modelPath,
        cpuBackend,
        null,
        null,
        null,
        null,
        reactContext.cacheDir.absolutePath
      )
  }

  private fun newConversationConfig(systemInstruction: String): Any {
    val contentsClass = Class.forName(CONTENTS_CLASS)
    val samplerConfigClass = Class.forName(SAMPLER_CONFIG_CLASS)
    val samplerConfig = samplerConfigClass
      .getConstructor(
        java.lang.Integer.TYPE,
        java.lang.Double.TYPE,
        java.lang.Double.TYPE,
        java.lang.Integer.TYPE
      )
      .newInstance(40, 0.88, 0.35, 0)

    return Class
      .forName(CONVERSATION_CONFIG_CLASS)
      .getConstructor(
        contentsClass,
        java.util.List::class.java,
        java.util.List::class.java,
        samplerConfigClass,
        java.lang.Boolean.TYPE
      )
      .newInstance(contentsOf(systemInstruction), emptyList<Any>(), emptyList<Any>(), samplerConfig, false)
  }

  private fun contentsOf(text: String): Any {
    val companion = Class.forName(CONTENTS_CLASS).getField("Companion").get(null)
    return companion.javaClass.getMethod("of", String::class.java).invoke(companion, text)
  }

  private fun setNativeMinLogSeverityError() {
    try {
      val engineClass = Class.forName(ENGINE_CLASS)
      val severityClass = Class.forName(LOG_SEVERITY_CLASS)
      val severity = severityClass.getMethod("valueOf", String::class.java).invoke(null, "ERROR")
      val companion = engineClass.getField("Companion").get(null)
      companion.javaClass.getMethod("setNativeMinLogSeverity", severityClass).invoke(companion, severity)
    } catch (_: Throwable) {
      // Logging severity is best-effort and should not block local model loading.
    }
  }

  private fun liteRtClassesAvailable(): Boolean {
    return try {
      REQUIRED_CLASS_NAMES.forEach { Class.forName(it) }
      true
    } catch (_: Throwable) {
      false
    }
  }

  private fun closeQuietly(target: AutoCloseable?) {
    try {
      target?.close()
    } catch (_: Exception) {
      // Ignore release failures during model swaps and app shutdown.
    }
  }

  private fun safeChatPrompt(input: ReadableMap): String {
    val question = stringValue(input, "question")
    val appContext = stringValue(input, "appContext")
    val taskContext = stringValue(input, "taskContext")
    val profileContext = stringValue(input, "profileContext")
    val sourceContext = sourceBlock(arrayValue(input, "sourceContext"))
    return listOf(
      appContext,
      profileContext,
      taskContext,
      sourceContext,
      "User question: $question",
      "Answer in English only. If campus facts are not supplied in sources, say you do not have enough saved source information. If the actor or pronoun reference is ambiguous, ask one short clarification question."
    ).filter { it.isNotBlank() }.joinToString("\n\n")
  }

  private fun sourceBlock(sources: ReadableArray?): String {
    if (sources == null || sources.size() == 0) return ""
    val rows = mutableListOf("Saved university sources:")
    for (index in 0 until sources.size()) {
      val source = sources.getMap(index) ?: continue
      val citationId = stringValue(source, "citationId")
      val title = stringValue(source, "documentTitle")
      val section = stringValue(source, "sectionTitle")
      val answer = stringValue(source, "answer")
      val content = stringValue(source, "content")
      val body = answer.ifBlank { content }
      rows.add("[$citationId] $title${if (section.isBlank()) "" else " - $section"}: $body")
    }
    return rows.joinToString("\n")
  }

  private fun arrayValue(map: ReadableMap, key: String): ReadableArray? {
    return if (map.hasKey(key) && !map.isNull(key)) map.getArray(key) else null
  }

  private fun stringValue(map: ReadableMap, key: String): String {
    return if (map.hasKey(key) && !map.isNull(key)) map.getString(key) ?: "" else ""
  }

  private companion object {
    private const val BACKEND_CLASS = "com.google.ai.edge.litertlm.Backend"
    private const val BACKEND_CPU_CLASS = "com.google.ai.edge.litertlm.Backend\$CPU"
    private const val CONTENT_TEXT_CLASS = "com.google.ai.edge.litertlm.Content\$Text"
    private const val CONTENTS_CLASS = "com.google.ai.edge.litertlm.Contents"
    private const val CONVERSATION_CONFIG_CLASS = "com.google.ai.edge.litertlm.ConversationConfig"
    private const val ENGINE_CLASS = "com.google.ai.edge.litertlm.Engine"
    private const val ENGINE_CONFIG_CLASS = "com.google.ai.edge.litertlm.EngineConfig"
    private const val LOG_SEVERITY_CLASS = "com.google.ai.edge.litertlm.LogSeverity"
    private const val SAMPLER_CONFIG_CLASS = "com.google.ai.edge.litertlm.SamplerConfig"
    private val REQUIRED_CLASS_NAMES = arrayOf(
      BACKEND_CLASS,
      BACKEND_CPU_CLASS,
      CONTENT_TEXT_CLASS,
      CONTENTS_CLASS,
      CONVERSATION_CONFIG_CLASS,
      ENGINE_CLASS,
      ENGINE_CONFIG_CLASS,
      LOG_SEVERITY_CLASS,
      SAMPLER_CONFIG_CLASS
    )
  }
}
