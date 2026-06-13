package com.tupt.haki

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.lang.reflect.Proxy
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors

class HakiLiteRtLmModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val lock = Any()
  private val inferenceExecutor = Executors.newSingleThreadExecutor()
  private var engine: AutoCloseable? = null
  private var engineModelPath: String? = null
  private var engineRevision = 0L
  private var modelLoadTimeMs: Long? = null
  private var lastInferenceTimeMs: Long? = null
  private var activeGeneration: ActiveGeneration? = null

  private data class ActiveGeneration(
    val requestId: String,
    val promise: Promise,
    val emitTokens: Boolean,
    val output: StringBuilder = StringBuilder(),
    var conversation: AutoCloseable? = null,
    var completed: Boolean = false
  )

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
    result.putBoolean("streamingSupported", true)
    result.putString("approximateDeviceCapability", "unknown")
    result.putString("memoryClass", null)
    result.putArray("unavailableReasons", Arguments.createArray())
    promise.resolve(result)
  }

  @ReactMethod
  fun validateModelConfiguration(modelPath: String, promise: Promise) {
    try {
      validateModelConfiguration(requireModelPath(modelPath))
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject(
        "E_HAKI_LITERT_CONFIGURATION",
        error.message ?: "LiteRT-LM model configuration validation failed.",
        error
      )
    }
  }

  @ReactMethod
  fun prepareModel(modelPath: String, promise: Promise) {
    val validatedPath = try {
      requireModelPath(modelPath).also(::validateModelConfiguration)
    } catch (error: Throwable) {
      promise.reject(
        "E_HAKI_LITERT_CONFIGURATION",
        error.message ?: "LiteRT-LM model configuration validation failed.",
        error
      )
      return
    }
    inferenceExecutor.execute {
      try {
        engineFor(validatedPath)
        promise.resolve(null)
      } catch (error: Throwable) {
        promise.reject(
          "E_HAKI_LITERT_PREPARE",
          error.message ?: "LiteRT-LM model preparation failed.",
          error
        )
      }
    }
  }

  @ReactMethod
  fun summarizeFromSources(input: ReadableMap, promise: Promise) {
    startGeneration(input, promise, false, "E_HAKI_LITERT_SUMMARY", "LiteRT-LM summarization failed.") {
      val instruction = stringValue(input, "instruction")
      val question = stringValue(input, "question")
      val sources = sourceBlock(arrayValue(input, "sources"))
      listOf(
        instruction,
        sources,
        "Question: $question",
        "Answer in English. Use only the supplied sources. End with `SOURCE_IDS: ...` using only source IDs from the sources."
      ).filter { it.isNotBlank() }.joinToString("\n\n")
    }
  }

  @ReactMethod
  fun answerSafeChat(input: ReadableMap, promise: Promise) {
    startGeneration(input, promise, false, "E_HAKI_LITERT_CHAT", "LiteRT-LM safe chat failed.") {
      safeChatPrompt(input)
    }
  }

  // Token deltas are emitted as TOKEN_EVENT_NAME device events keyed by
  // requestId rather than through a bridge Callback: legacy-bridge Callbacks
  // permit a single invocation, so a per-token Callback silently drops every
  // delta after the first. The promise still resolves with the full text.
  @ReactMethod
  fun streamSafeChat(input: ReadableMap, promise: Promise) {
    startGeneration(input, promise, true, "E_HAKI_LITERT_CHAT", "LiteRT-LM safe chat failed.") {
      safeChatPrompt(input)
    }
  }

  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {
    // Required by NativeEventEmitter; events flow through RCTDeviceEventEmitter.
  }

  @ReactMethod
  fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) {
    // Required by NativeEventEmitter; events flow through RCTDeviceEventEmitter.
  }

  @ReactMethod
  fun cancelGeneration(requestId: String, promise: Promise) {
    promise.resolve(cancelActiveGeneration(requestId))
  }

  @ReactMethod
  fun cancelProcess(promise: Promise) {
    promise.resolve(cancelActiveGeneration(null))
  }

  @ReactMethod
  fun release(promise: Promise) {
    cancelActiveGeneration(null)
    val detachedEngine = synchronized(lock) {
      engineRevision += 1
      val current = engine
      engine = null
      engineModelPath = null
      modelLoadTimeMs = null
      lastInferenceTimeMs = null
      current
    }
    closeQuietly(detachedEngine)
    promise.resolve(null)
  }

  private fun startGeneration(
    input: ReadableMap,
    promise: Promise,
    emitTokens: Boolean,
    errorCode: String,
    errorMessage: String,
    promptFactory: () -> String
  ) {
    val requestId = stringValue(input, "requestId")
    if (requestId.isBlank()) {
      promise.reject(errorCode, "LiteRT-LM requestId is required.")
      return
    }

    val generation = synchronized(lock) {
      if (activeGeneration != null) {
        promise.reject("E_HAKI_LITERT_BUSY", "LiteRT-LM is already generating a response.")
        null
      } else {
        ActiveGeneration(requestId, promise, emitTokens).also { activeGeneration = it }
      }
    } ?: return

    inferenceExecutor.execute {
      try {
        val modelPath = requireModelPath(input)
        val instruction = stringValue(input, "instruction")
        generateAsync(generation, modelPath, promptFactory(), instruction, errorCode, errorMessage)
      } catch (error: Throwable) {
        failGeneration(generation, errorCode, errorMessage, error)
      }
    }
  }

  private fun requireModelPath(input: ReadableMap): String {
    return requireModelPath(stringValue(input, "modelPath"))
  }

  private fun requireModelPath(modelPath: String): String {
    if (modelPath.isBlank()) {
      throw IllegalArgumentException("LiteRT-LM modelPath is required.")
    }
    val modelFile = File(modelPath)
    if (!modelFile.exists() || !modelFile.isFile) {
      throw IllegalArgumentException("LiteRT-LM model file is missing.")
    }
    if (!modelFile.name.lowercase().endsWith(".litertlm")) {
      throw IllegalArgumentException("LiteRT-LM model file must use the .litertlm extension.")
    }
    return modelFile.absolutePath
  }

  private fun engineFor(modelPath: String): AutoCloseable {
    var previous: AutoCloseable? = null
    val revision = synchronized(lock) {
      val current = engine
      if (current != null && engineModelPath == modelPath) {
        return current
      }

      previous = current
      engine = null
      engineModelPath = null
      modelLoadTimeMs = null
      engineRevision += 1
      engineRevision
    }
    closeQuietly(previous)
    setNativeMinLogSeverityError()
    val startedAt = System.currentTimeMillis()
    val next = Class
      .forName(ENGINE_CLASS)
      .getConstructor(Class.forName(ENGINE_CONFIG_CLASS))
      .newInstance(newEngineConfig(modelPath)) as AutoCloseable
    try {
      next.javaClass.getMethod("initialize").invoke(next)
    } catch (error: Throwable) {
      closeQuietly(next)
      throw error
    }
    val accepted = synchronized(lock) {
      if (engineRevision != revision) {
        false
      } else {
        engine = next
        engineModelPath = modelPath
        modelLoadTimeMs = System.currentTimeMillis() - startedAt
        true
      }
    }
    if (!accepted) {
      closeQuietly(next)
      throw CancellationException("LiteRT-LM model preparation was canceled.")
    }
    return next
  }

  private fun generateAsync(
    generation: ActiveGeneration,
    modelPath: String,
    prompt: String,
    systemInstruction: String,
    errorCode: String,
    errorMessage: String
  ) {
    val startedAt = System.currentTimeMillis()
    val normalizedInstruction = systemInstruction.ifBlank {
      "You are Haki, a local student assistant. Answer in English only."
    }
    val conversation = createConversation(engineFor(modelPath), normalizedInstruction)
    val shouldStart = synchronized(lock) {
      if (generation.completed || activeGeneration !== generation) {
        false
      } else {
        generation.conversation = conversation
        true
      }
    }
    if (!shouldStart) {
      closeQuietly(conversation)
      return
    }

    val callbackClass = Class.forName(MESSAGE_CALLBACK_CLASS)
    val callback = Proxy.newProxyInstance(
      callbackClass.classLoader,
      arrayOf(callbackClass)
    ) { _, method, args ->
      when (method.name) {
        "onMessage" -> appendGenerationOutput(generation, messageText(args?.firstOrNull()))
        "onDone" -> completeGeneration(generation, startedAt)
        "onError" -> failGeneration(
          generation,
          errorCode,
          errorMessage,
          args?.firstOrNull() as? Throwable ?: IllegalStateException(errorMessage)
        )
      }
      null
    }
    conversation.javaClass
      .getMethod("sendMessageAsync", String::class.java, callbackClass, java.util.Map::class.java)
      .invoke(conversation, prompt, callback, emptyMap<String, Any>())
  }

  private fun appendGenerationOutput(generation: ActiveGeneration, currentText: String) {
    if (currentText.isEmpty()) return
    val delta = synchronized(lock) {
      if (generation.completed || activeGeneration !== generation) return
      val previous = generation.output.toString()
      val next = if (currentText.startsWith(previous)) currentText.removePrefix(previous) else currentText
      generation.output.append(next)
      next
    }
    if (delta.isNotEmpty() && generation.emitTokens) {
      try {
        val params = Arguments.createMap()
        params.putString("requestId", generation.requestId)
        params.putString("token", delta)
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(TOKEN_EVENT_NAME, params)
      } catch (_: Throwable) {
        // A detached JS listener must not terminate native generation.
      }
    }
  }

  private fun completeGeneration(generation: ActiveGeneration, startedAt: Long) {
    val result = synchronized(lock) {
      if (generation.completed || activeGeneration !== generation) return
      generation.completed = true
      activeGeneration = null
      lastInferenceTimeMs = System.currentTimeMillis() - startedAt
      generation.output.toString().trim()
    }
    closeQuietly(generation.conversation)
    generation.promise.resolve(result)
  }

  private fun failGeneration(
    generation: ActiveGeneration,
    errorCode: String,
    errorMessage: String,
    error: Throwable
  ) {
    val shouldReject = synchronized(lock) {
      if (generation.completed || activeGeneration !== generation) {
        false
      } else {
        generation.completed = true
        activeGeneration = null
        true
      }
    }
    closeQuietly(generation.conversation)
    if (shouldReject) generation.promise.reject(errorCode, errorMessage, error)
  }

  private fun cancelActiveGeneration(requestId: String?): Boolean {
    val generation = synchronized(lock) {
      val current = activeGeneration
      if (current == null || current.completed || (requestId != null && current.requestId != requestId)) {
        null
      } else {
        current.completed = true
        activeGeneration = null
        current
      }
    } ?: return false

    try {
      generation.conversation?.javaClass?.getMethod("cancelProcess")?.invoke(generation.conversation)
    } catch (_: Throwable) {
      // Cancellation still resolves the JS request even if native cleanup fails.
    }
    closeQuietly(generation.conversation)
    val result = Arguments.createMap()
    result.putString("status", "incomplete")
    result.putString("text", generation.output.toString().trim())
    generation.promise.resolve(result)
    return true
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
    } catch (_: Throwable) {
      null
    }

    // Do not trim here: LiteRT-LM delivers tokens whose word boundary is a
    // SentencePiece leading space (" the", " process"). Trimming each snapshot
    // strips those spaces and jams words together. The full answer is trimmed
    // once when generation completes. `?:` triggers only on a null extraction,
    // so empty content returns "" instead of the message object's toString().
    return textParts ?: message.toString()
  }

  private fun createConversation(engine: AutoCloseable, systemInstruction: String): AutoCloseable {
    return engine
      .javaClass
      .getMethod("createConversation", Class.forName(CONVERSATION_CONFIG_CLASS))
      .invoke(engine, newConversationConfig(systemInstruction)) as AutoCloseable
  }

  private fun validateModelConfiguration(modelPath: String) {
    val backendClass = Class.forName(BACKEND_CLASS)
    val engineConfigClass = Class.forName(ENGINE_CONFIG_CLASS)
    val conversationConfigClass = Class.forName(CONVERSATION_CONFIG_CLASS)
    val samplerConfigClass = Class.forName(SAMPLER_CONFIG_CLASS)
    val contentsClass = Class.forName(CONTENTS_CLASS)
    val callbackClass = Class.forName(MESSAGE_CALLBACK_CLASS)
    val engineClass = Class.forName(ENGINE_CLASS)
    val conversationClass = Class.forName(CONVERSATION_CLASS)

    Class.forName(BACKEND_CPU_CLASS).getConstructor()
    engineConfigClass.getConstructor(
      String::class.java,
      backendClass,
      backendClass,
      backendClass,
      java.lang.Integer::class.java,
      java.lang.Integer::class.java,
      String::class.java
    )
    samplerConfigClass.getConstructor(
      java.lang.Integer.TYPE,
      java.lang.Double.TYPE,
      java.lang.Double.TYPE,
      java.lang.Integer.TYPE
    )
    conversationConfigClass.getConstructor(
      contentsClass,
      java.util.List::class.java,
      java.util.List::class.java,
      samplerConfigClass,
      java.lang.Boolean.TYPE
    )
    engineClass.getConstructor(engineConfigClass)
    engineClass.getMethod("initialize")
    engineClass.getMethod("createConversation", conversationConfigClass)
    conversationClass.getMethod(
      "sendMessageAsync",
      String::class.java,
      callbackClass,
      java.util.Map::class.java
    )
    conversationClass.getMethod("cancelProcess")
    if (!AutoCloseable::class.java.isAssignableFrom(engineClass) ||
      !AutoCloseable::class.java.isAssignableFrom(conversationClass)
    ) {
      throw IllegalStateException("LiteRT-LM engine lifecycle APIs are incompatible.")
    }
    newEngineConfig(modelPath)
    newConversationConfig("You are Haki. Answer in English only.")
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
    private const val TOKEN_EVENT_NAME = "HakiLiteRtLmToken"
    private const val BACKEND_CLASS = "com.google.ai.edge.litertlm.Backend"
    private const val BACKEND_CPU_CLASS = "com.google.ai.edge.litertlm.Backend\$CPU"
    private const val CONTENT_TEXT_CLASS = "com.google.ai.edge.litertlm.Content\$Text"
    private const val CONTENTS_CLASS = "com.google.ai.edge.litertlm.Contents"
    private const val CONVERSATION_CLASS = "com.google.ai.edge.litertlm.Conversation"
    private const val CONVERSATION_CONFIG_CLASS = "com.google.ai.edge.litertlm.ConversationConfig"
    private const val ENGINE_CLASS = "com.google.ai.edge.litertlm.Engine"
    private const val ENGINE_CONFIG_CLASS = "com.google.ai.edge.litertlm.EngineConfig"
    private const val LOG_SEVERITY_CLASS = "com.google.ai.edge.litertlm.LogSeverity"
    private const val MESSAGE_CALLBACK_CLASS = "com.google.ai.edge.litertlm.MessageCallback"
    private const val SAMPLER_CONFIG_CLASS = "com.google.ai.edge.litertlm.SamplerConfig"
    private val REQUIRED_CLASS_NAMES = arrayOf(
      BACKEND_CLASS,
      BACKEND_CPU_CLASS,
      CONTENT_TEXT_CLASS,
      CONTENTS_CLASS,
      CONVERSATION_CLASS,
      CONVERSATION_CONFIG_CLASS,
      ENGINE_CLASS,
      ENGINE_CONFIG_CLASS,
      LOG_SEVERITY_CLASS,
      MESSAGE_CALLBACK_CLASS,
      SAMPLER_CONFIG_CLASS
    )
  }
}
