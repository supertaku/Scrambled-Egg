# Haki Repair Change-Set Map

The working tree contains pre-existing user work and the Haki repair work. Do
not merge it as one undifferentiated commit. Preserve the following review and
commit boundaries when the owner prepares Git history.

## 1. Android Local AI Runtime

- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/tupt/haki/HakiDeviceInfoModule.kt`
- `android/app/src/main/java/com/tupt/haki/HakiDeviceInfoPackage.kt`
- `android/app/src/main/java/com/tupt/haki/HakiLiteRtLmModule.kt`
- `src/ai/LiteRtLmProvider.ts`
- `src/ai/nativeModules.ts`
- `src/ai/nativeRuntimeAdapters.ts`
- `src/ai/liteRtGenerationGuard.ts`
- related LiteRT tests

Review focus: native callback completion, cancellation, thermal shutdown,
runtime packaging, and bridge availability.

## 2. Model Catalog and Lifecycle

- `app/models.tsx`
- `src/components/models/`
- `src/ai/localModelManager.ts`
- `src/ai/modelOperationCoordinator.ts`
- `src/ai/modelCatalog.ts`
- `src/ai/modelDownloadConfig.ts`
- `src/ai/localModelMetadata.ts`
- `src/ai/localModelRequirements.ts`
- `src/ai/localModelPerformance.ts`
- `src/ai/modelActivationState.ts`
- `src/ai/storageForecast.ts`
- `scripts/test-local-model-manager.ts`
- related catalog, activation, coordinator, and watchdog tests

Review focus: immutable artifact identity, truthful activation state,
download recovery, mutation leases, and provider refresh.

## 3. Chat Routing and Private Persistence

- `app/chat.tsx`
- `src/components/chat/`
- `src/hooks/useChatMessages.ts`
- `src/services/answerService.ts`
- `src/services/answerSourcePolicy.ts`
- `src/services/historyService.ts`
- `src/services/bookmarkService.ts`
- `src/services/privateDataCrypto.ts`
- `src/db/schema.ts`
- `src/db/migrations.ts`
- related service and crypto tests

Review focus: actor-role preservation, source trust boundaries, encryption
migration, keyed history search, and failure visibility.

## 4. Service Desk

- `app/library.tsx`
- `app/library-topic/[chunkId].tsx`
- `src/data/libraryTopics.ts`
- `src/data/libraryTopics.test.ts`

Review focus: four-desk grouping, verified office aliases, routed-search reset,
and office-specific filtering.

## 5. Theme and Presentation

- `src/theme/`
- UI files consuming `ThemeProvider`
- `src/components/campus-map/campusMapStyles.ts`
- `src/components/chat/chatScreenStyles.ts`
- `src/theme/featurePalettes.test.ts`
- `src/__tests__/architectureBoundaries.test.ts`

Review focus: semantic tokens, dark-mode behavior, intentional illustration
palettes, and route/module ownership.

## 6. Haki Artwork

- `assets/images/mascot/hd-v2/`
- `src/mascot/`
- `src/components/mascot/`
- `src/components/onboarding/OnboardingHaki.tsx`
- `src/components/models/ModelOperationHaki.tsx`
- `docs/Haki Presentation.pptx`

Review focus: consistent identity, transparent canvas contracts, crop/scale,
and status-specific art.

## 7. Documentation and Repository Hygiene

- `AGENTS.md`
- `.easignore`
- `.gitignore`
- `docs/building-haki-from-scratch.md`
- `docs/superpowers/`
- `docs/review/`
- deletion of obsolete components, logs, and unused pixel mascot assets

Review focus: source-path accuracy, unsupported-platform claims, sample-data
labels, and confirmation that deleted files have no references.

## Integration Gate

For every slice: review its diff, run the focused test, then run
`npm.cmd run test:all`. After all slices are assembled, run Android Kotlin
compilation and `:app:assembleDebug`. Physical Gemma E2B/E4B activation is a
separate owner-run release gate.
