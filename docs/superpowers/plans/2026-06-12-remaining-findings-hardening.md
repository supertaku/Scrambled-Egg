# Remaining Findings Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining runtime safety, model integrity, persistence privacy, theme consistency, module-size, and asset-hygiene findings while preserving the current repaired behavior.

**Architecture:** Keep LiteRT-LM 0.10.2 and add cancellation/serialization around its confirmed native APIs. Introduce a small encrypted-persistence boundary shared by history and bookmarks, and move fixed visual palettes out of route components. Restrict refactoring to touched responsibilities.

**Tech Stack:** Expo 55, React Native 0.83, TypeScript, Vitest, Kotlin/React Native bridge, LiteRT-LM 0.10.2, Expo Crypto AES-GCM, Expo SecureStore, SQLite FTS5.

---

### Task 1: LiteRT Request Lifecycle

**Files:**
- Modify: `src/ai/nativeModules.ts`
- Modify: `src/ai/LiteRtLmProvider.ts`
- Modify: `android/app/src/main/java/com/tupt/haki/HakiLiteRtLmModule.kt`
- Create: `src/ai/liteRtGenerationGuard.ts`
- Test: `src/ai/liteRtGenerationGuard.test.ts`

- [ ] Write failing tests for abort, watchdog breach, thermal cancellation, and one-shot cancellation.
- [ ] Run `npm.cmd run test:unit -- src/ai/liteRtGenerationGuard.test.ts` and confirm the missing guard fails.
- [ ] Implement the pure TypeScript generation guard and connect it to provider request IDs.
- [ ] Replace blocking native generation with callback streaming, one active conversation, and `cancelGeneration(requestId)` using `Conversation.cancelProcess()`.
- [ ] Compile Kotlin and run focused tests.

### Task 2: Immutable Gemma Integrity

**Files:**
- Modify: `src/ai/modelDownloadConfig.ts`
- Modify: `src/ai/modelCatalog.test.ts`
- Modify: `scripts/test-local-model-manager.ts`

- [ ] Add failing assertions that E2B/E4B URLs use immutable revisions and include official SHA-256 values.
- [ ] Run focused catalog/local-model tests and confirm failure.
- [ ] Pin both artifact URLs, sizes, and hashes.
- [ ] Re-run focused tests and verify mismatch rejection remains covered.

### Task 3: Encrypted Private Data

**Files:**
- Create: `src/services/privateDataCrypto.ts`
- Create: `src/services/privateDataCrypto.test.ts`
- Modify: `src/services/historyService.ts`
- Modify: `src/services/bookmarkService.ts`
- Modify: `src/db/migrationRunner.ts`
- Modify: `src/db/schema.ts`

- [ ] Write failing pure tests for envelope recognition, lazy plaintext migration decisions, keyed token fingerprints, and malformed encrypted data.
- [ ] Implement AES-GCM/SecureStore production adapters and pure envelope/token helpers.
- [ ] Encrypt all sensitive writes and decrypt reads; fail closed when key storage is unavailable.
- [ ] Migrate existing rows lazily and rebuild conversation FTS from keyed keywords only.
- [ ] Add service tests around bounded migration and duplicate bookmark behavior.

### Task 4: Theme And Focused Extraction

**Files:**
- Create: `src/theme/campusMapPalette.ts`
- Create: `src/theme/contentCategoryPalette.ts`
- Modify: `app/campus-map.tsx`
- Modify: `app/tips.tsx`
- Modify: `app/library-topic/[chunkId].tsx`
- Modify: `app/library.tsx`

- [ ] Add static tests that route components do not define ordinary raw hex colors.
- [ ] Move intentional map artwork colors into the named map palette.
- [ ] Replace category/status UI colors with semantic light/dark token factories.
- [ ] Re-run typecheck and focused tests.

### Task 5: Asset And Workspace Hygiene

**Files:**
- Modify: `src/mascot/hd/hdAssets.ts` only if conversion succeeds
- Modify: `src/mascot/hd/hdAssets.test.ts` only if conversion succeeds
- Remove: verified temporary files under `artifacts/`
- Remove: `assets/images/mascot/hd-v2/haki-idle-chroma.png`
- Remove: unused legacy root mascot files after reference scan

- [ ] Verify all asset references and identify unused files.
- [ ] Test transparent WebP conversion on one asset and compare dimensions, alpha, and rendered appearance.
- [ ] Convert the set only if the trial is lossless enough and supported by the static require path.
- [ ] Remove verified unused/temp assets and run asset tests.

### Task 6: Full Verification And Review

**Files:**
- Modify: `docs/building-haki-from-scratch.md`
- Review: complete working-tree diff

- [ ] Update runtime cancellation, integrity, and encryption claims in the architecture document.
- [ ] Run `npm.cmd run test:all`.
- [ ] Run Android Kotlin compilation and `assembleDebug` when Gradle dependencies are available.
- [ ] Run `git diff --check`, asset-size checks, raw-color checks, and final severity review.
- [ ] Report device-only E2B/E4B smoke testing separately if no physical Android device is attached.
