# Haki

Haki is an Expo React Native offline student assistant for school processes, office procedures, registrar concerns, clinic procedures, accounting procedures, admin procedures, university rules, and student policies.

Haki is client-only. It does not use a backend, authentication, cloud database, online search API, or online LLM API. The local documents stored on the device are the source of truth.

The bundled content in `src/data/seed-documents.json` is the only source that Haki treats as verified campus-answer data. For production pilots, replace or approve this file with official preprocessed documents and keep provisional/mock content out of student-facing answer paths.

## Offline-First Design

SQLite + FTS5 is the required baseline retrieval mode because it is deterministic, fast, offline, and available across the minimum supported devices. Optional local AI providers can improve retrieval, summarize retrieved source chunks, and answer any safe general question when the native local model is active, but they are never required for the app to work.

If an AI provider is unavailable or fails, Haki falls back to SQLite + FTS5 source search for the current session.

For native builds that report the tiny local-model requirements, Haki prefers local AI by default. Devices below the tiny model floor remain on FTS5, while higher-capability Android or iOS devices can report and use larger adaptive model tiers.

## Supported Modes

- `Offline Mode: Source Search`
  - Required fallback mode.
  - Uses SQLite + FTS5.
  - Retrieves ranked local document chunks and displays source-grounded answers with citations.
- `Offline AI Mode: Semantic Search Available`
  - Uses local embeddings when a native provider exposes them.
  - Current vector retriever is a safe placeholder ready for future embedding search.
- `Offline AI Mode: Local Safe Chat Available`
  - Uses a native local model for safe general chat when the provider exposes `answerSafeChat`.
  - School-specific questions can still retrieve saved source chunks before the model answers.
- `Offline AI Mode: Local Summary Available`
  - Uses Apple Foundation Models or llama.rn when the local runtime is available.
  - Summarizes retrieved chunks only.
  - Can answer safe general chat prompts when the native provider exposes safe chat.
- `Offline AI Mode: Hybrid Local AI`
  - Uses FTS5 + local embeddings + local summarization when all parts are available.
- `Fallback Mode: Source Search Only`
  - Used when an optional AI provider fails and Haki degrades safely.

Internal answer provenance is tracked as one of:

- `Retrieved with semantic search`
- `Retrieved with hybrid search`
- `Locally summarized with llama.rn or Apple Intelligence`
- `Answered with local safe chat`
- `General chat unavailable without local AI`

## Device Requirements

Base FTS5 mode:

- iOS 18.1+ for the current Expo native build configuration
- Android 9+

Native GGUF (llama.rn) summary mode uses conservative mobile hardware tiers (RAM, storage, architecture). Users install compatible models from the public AI Models screen into app-private storage.

llama.rn / GGUF AI mode:

- Android or iOS custom native build with the `llama.rn` Expo config plugin.
- Uses app-private GGUF files under the document `models/chat/installed/<model-id>/` directory.
- New installations start with no chat GGUF; FTS5 source search remains available until a student activates a compatible download.
- Embedding model filenames checked by default: `haki-embed.gguf`, `haki-embedding.gguf`, `haki-minilm-embed.gguf`.
- Uses the same adaptive tier policy as Android local AI: tiny 0.5B-1.5B, minimum 1B-3B, good 3B-4B, enhanced 4B-7B, flagship 7B-8B.
- The AI Models screen supports curated compatible downloads, switching, removal, paused-download recovery, public manual import for advanced offline use, and Haki progress feedback. Manual imports are preflighted for GGUF extension, size limits, device fit, and embedding runtime validation before activation.

Apple Intelligence / Foundation Models mode:

- Supported Apple Intelligence iOS/iPadOS devices only: iPhone 15 Pro models, iPhone 16 or later, iPad mini with A17 Pro, and iPad models with M1 or later.
- iOS/iPadOS 26.0+.
- Apple manages model asset readiness; Haki checks `SystemLanguageModel.default` availability.
- Requires a custom Expo development build with the `HakiAppleFoundationModels` native module.
- The native bridge performs real Foundation Models generation only on an eligible ready device; unsupported devices continue through GGUF fallback or FTS5.

Expo Go is suitable for the FTS5 MVP path, but it cannot load custom native AI modules. Use a custom Expo development build before integrating llama.rn or an Apple Foundation Models Swift bridge.

## Automatic Capability Detection

Haki checks device capability at app startup and caches the safest selected mode for the session. The detector considers platform, OS version, native provider availability, ABI/architecture, RAM, free storage, thermal state, local model asset availability, model size, quantization, embedding support, summarization support, selected execution backend, benchmark profile, and providers disabled after runtime failures.

Before probing optional AI providers, Haki opens the local database and verifies that the SQLite FTS5 index is available. If FTS5 cannot initialize, Haki reports a database initialization error and does not attempt Apple Intelligence or llama.rn.

The priority order is:

1. Hybrid Local AI
2. Local Summary Mode
3. Local Safe Chat Mode
4. Semantic Search Mode
5. FTS5-only fallback

If detection is uncertain, Haki chooses the safer FTS5 path. Administrator capability details show the active mode, platform, OS version, model tier, selected backend, benchmark metrics, provider status and unavailable reasons, and can run a short on-device behavior evaluation of the active generated-chat model.

Hybrid mode uses one provider for both embeddings and summarization. Haki does not mix Apple and llama.rn summarization or embeddings across providers.

## Install

```bash
npm install
```

## Run

```bash
npm run start
```

Other scripts:

```bash
npm run android
npm run ios
npm run typecheck
npm run test:golden
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`:

```bash
npm.cmd run typecheck
npm.cmd run test:golden
```

## Voice Input

The chat microphone uses browser `SpeechRecognition` on web and `@react-native-voice/voice` on Android/iOS.

- Web: works only in browsers that expose `SpeechRecognition` or `webkitSpeechRecognition`.
- Android/iOS: requires a custom Expo development build because the native `Voice` module is not available in Expo Go.
- Rebuild after changing the voice plugin in `app.json`.
- Android devices must have a speech recognition service installed and microphone permission granted.

## Custom Development Build

Native local AI providers are optional and are not required for the offline MVP.

When implementing real native providers:

1. Add `expo-dev-client` and the native module implementation.
2. Add the native bridge expected by the TypeScript layer:
   - `NativeModules.HakiAppleFoundationModels` (optional, Apple-only)
3. For llama.rn, keep the config plugin in `app.json`; chat GGUF files are installed into app-private managed library storage by the model coordinator.
4. Make `getCapabilities()` report the values Haki requires before enabling real local AI:

```ts
{
  summary: true,
  safeChat: true,
  embeddings: true,
  architecture: "arm64-v8a",
  memoryGB: 4,
  freeStorageGB: 3,
  modelAssetsAvailable: true,
  modelName: "your-quantized-chat-model",
  modelParameterCountB: 0.6,
  modelQuantization: "int4",
  modelTier: "tiny",
  recommendedModelTier: "tiny",
  approximateDeviceCapability: "high",
  memoryClass: "4GB",
  modelAssetPath: "file:///path/to/model.gguf",
  modelLoadTimeMs: 1200,
  lastInferenceTimeMs: 0,
  streamingSupported: true
}
```

Haki passes `preferredModelTier` into native summary and safe-chat calls based on reported device capability. Native modules should prefer the highest available matching model tier and report the active `modelTier`.

For Apple Foundation Models, the native bridge must refuse unsupported Apple Intelligence devices and unavailable sessions. It should report `modelAssetsAvailable: true` only when the Apple Foundation Models session is usable on that device.

5. Do not package GGUF files in Android assets. Public downloads must remain curated and retain known hashes and license review.

6. Rebuild the native app:

```bash
npx expo prebuild
npx expo run:ios
npx expo run:android
```

The native summarizer must follow this instruction exactly:

```text
Using only the provided source chunks, write a concise answer for a student. Do not use outside knowledge. Do not guess. If the chunks do not contain enough information to answer the question, return NO_RELIABLE_ANSWER. Include the citation IDs used.
```

If the native provider returns `NO_RELIABLE_ANSWER`, Haki shows:

```text
No reliable answer found. Try rephrasing your question or check with the relevant office.
```

The native safe-chat method receives the latest short conversation context and, for source-seeking school questions, the retrieved source chunks from the local JSON/SQLite store. It should follow this instruction:

```text
Answer any safe student question concisely and helpfully. Use recent conversation context when it clarifies the user request. If reliable source chunks are provided, prioritize them and include the citation IDs used. If source chunks are weak or missing, answer generally when safe and explain how the student can verify or get the exact school-specific answer. Do not help with violence, self-harm, stalking, harassment, sexual exploitation, illegal activity, cheating, credential theft, privacy invasion, malware, evading safety systems, or manipulation. For medical, legal, financial, or emergency situations, give general safety-oriented guidance and recommend contacting a qualified professional or trusted authority. If the request is unsafe, refuse briefly.
```

## JSON Schema

The root value must be an array:

```json
[
  {
    "document_id": "student_handbook_2026",
    "document_title": "TUP Student Handbook",
    "document_type": "handbook",
    "category": "University Rules and Policies",
    "office": "Student Affairs",
    "version": "2026",
    "last_updated": "2026-04-30",
    "chunks": [
      {
        "chunk_id": "student_handbook_2026_001",
        "section_title": "Student Conduct",
        "process_name": "Student Conduct Rules",
        "content": "Students are expected to follow university rules...",
        "answer": "Students are expected to follow university conduct rules...",
        "citation": "TUP Student Handbook, Student Conduct section",
        "page_number": 12,
        "tags": ["conduct", "rules", "discipline"]
      }
    ]
  }
]
```

Required document fields:

- `document_id`
- `document_title`
- `chunks`

Required chunk fields:

- `chunk_id`
- `content`

Rules:

- `content` is the searchable source passage.
- `answer` is preferred when present.
- `citation` is displayed exactly as provided.
- `page_number` is optional.
- `tags` improve retrieval.
- Haki does not invent missing offices, deadlines, requirements, policies, or citations.

## Import Documents

Use the admin-only Import screen to paste JSON or select a `.json` file. Haki validates the schema, previews document and chunk counts, inserts valid documents into SQLite, updates the FTS5 index through triggers, and skips duplicate `document_id` and `chunk_id` records.

## Database

Core tables:

- `documents`
- `chunks`
- `chunks_fts`
- `chunk_embeddings`
- `app_meta`

`chunk_embeddings` is vector-ready storage for future local embedding models. It is not required for FTS5 mode.

## Architecture

Key folders:

- `app/` Expo Router screens
- `src/ai/` local AI provider interfaces, capability detection, provider placeholders, and prompts
- `src/retrieval/` FTS, vector placeholder, hybrid retriever, ranking, confidence, and query normalization
- `src/services/` search, answer orchestration, mode selection, import, history, and admin services
- `src/db/` SQLite schema, migrations, seed, and document repository
- `src/components/` reusable UI components

Core interfaces:

```ts
interface Retriever {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

interface LocalAIProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  getCapabilities(): Promise<LocalAICapabilities>;
  summarizeFromSources(input: SummarizeFromSourcesInput): Promise<LocalSummaryResult>;
  answerSafeChat?(input: SafeChatInput): Promise<SafeChatResult>;
  streamSafeChat?(input: SafeChatInput, onToken: (token: string) => void): Promise<SafeChatResult>;
  embedText?(text: string): Promise<number[]>;
}
```

Implemented provider classes:

- `FallbackProvider`
- `LlamaRnProvider`
- `AppleFoundationModelsProvider`

Implemented retriever classes:

- `FTSRetriever`
- `VectorRetriever`
- `HybridRetriever`

## Quality Checks

The golden retrieval suite verifies that representative student questions still return expected chunks and confidence behavior:

```bash
npm run test:golden
```

Use TypeScript strict checking:

```bash
npm run typecheck
```

## Current Limitations

- Android/iOS GGUF chat models are optional, verified user-managed downloads; source search remains the model-free baseline.
- The Apple Foundation Models Swift bridge is optional, iOS 26+-gated, and requires physical-device release validation.
- Vector search activates when `chunk_embeddings` rows exist for the active embedding model (automatic backfill runs when a provider exposes `embedText`).
- The bundled seed data is demo content, not official policy.
- Official school offices remain the final authority.

## Roadmap

- Representative-device validation for llama.rn acceleration and Apple Foundation Models behavior
- Embedding-backed hybrid retrieval tuning
- Hybrid vector search
- Better reranking
- Document update packages
- Admin document-preprocessing tool
- Official document verification workflow
