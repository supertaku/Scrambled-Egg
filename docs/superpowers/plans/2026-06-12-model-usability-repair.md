# Model Usability Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every catalog-compatible local model downloadable, selectable, and recoverable from transient runtime failures.

**Architecture:** Separate mandatory artifact/runtime validation from optional GGUF performance profiling. Add recoverable keyed native-context ownership, classify permanent provider failures narrowly, await registry replacement cleanup, and preserve actionable UI errors.

**Tech Stack:** TypeScript, Expo/React Native, llama.rn, LiteRT-LM native bridge, Vitest, PowerShell/Gradle verification.

---

### Task 1: Runtime-specific model activation

**Files:**
- Create: `src/ai/modelActivationPolicy.ts`
- Create: `src/ai/modelActivationPolicy.test.ts`
- Modify: `src/ai/modelActivationState.ts`
- Modify: `src/ai/modelActivationState.test.ts`
- Modify: `src/ai/localModelManager.ts`
- Modify: `scripts/test-local-model-manager.ts`

- [ ] Write tests proving GGUF ignores legacy smoke-test failures and LiteRT still requires a passing smoke test.
- [ ] Run the focused tests and confirm they fail for the current behavior.
- [ ] Add `prepareManifestForActivation`, normalize GGUF evaluation to `not_required`, and call only the LiteRT probe during activation.
- [ ] Remove mandatory GGUF benchmark activation and obsolete source assertions.
- [ ] Run focused unit and local-model tests.

### Task 2: Recoverable llama contexts

**Files:**
- Create: `src/ai/recoverableAsyncResource.ts`
- Create: `src/ai/recoverableAsyncResource.test.ts`
- Modify: `src/ai/LlamaRnProvider.ts`

- [ ] Write tests proving rejected creation is cleared, concurrent creation is shared, key changes release first, and invalidation permits recreation.
- [ ] Run the focused tests and confirm the missing resource owner fails them.
- [ ] Replace chat and embedding promise fields with keyed recoverable resource owners.
- [ ] Invalidate chat contexts after completion exceptions and embedding contexts after embedding exceptions.
- [ ] Run focused tests and typecheck.

### Task 3: Provider failure and registry lifecycle

**Files:**
- Create: `src/ai/providerFailurePolicy.ts`
- Create: `src/ai/providerFailurePolicy.test.ts`
- Create: `src/ai/providerRegistryLifecycle.ts`
- Create: `src/ai/providerRegistryLifecycle.test.ts`
- Modify: `src/services/safeLocalChatService.ts`
- Modify: `src/services/sourceAnswerService.ts`
- Modify: `src/services/modeSelectionService.ts`

- [ ] Write tests that distinguish permanent runtime/artifact failures from transient inference failures and prove replacement waits for cleanup.
- [ ] Run the focused tests and confirm they fail.
- [ ] Retry transient failures with the same provider and disable only permanent failures.
- [ ] Await active registry disposal before capability refresh recreates providers.
- [ ] Run focused tests and typecheck.

### Task 4: Actionable model diagnostics

**Files:**
- Create: `src/components/models/modelOperationMessage.ts`
- Create: `src/components/models/modelOperationMessage.test.ts`
- Modify: `src/components/models/ModelOperationHaki.tsx`
- Modify: `app/models.tsx`

- [ ] Write tests proving failed and completed-with-error operations expose their actual error text.
- [ ] Run the focused test and confirm current generic messaging fails it.
- [ ] Move operation-message selection into the tested helper and preserve action errors through state reload.
- [ ] Run focused tests and typecheck.

### Task 5: Full verification

**Files:**
- Modify only files required by failures discovered during verification.

- [ ] Run `npm.cmd run test:all` and resolve regressions.
- [ ] Run `.\\gradlew.bat :app:compileDebugKotlin` from `android`.
- [ ] Build or locate a debug APK and run `npm.cmd run apk:inspect -- <apk-path>` if supported by the inspection script.
- [ ] Review `git diff`, check for unrelated changes, and perform a final requirements audit.
