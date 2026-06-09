# Refactor Target Architecture

This refactor is behavior-preserving. The app should keep the same routes,
model options, seeded campus answers, chat roles, and verification commands
while the code is split into clearer modules.

## Module Boundaries

- `app/` route files should become thin route adapters that render feature
  screens from `src/features/`.
- `src/features/` should own screen-specific containers, hooks, and components.
- `src/components/` should contain reusable UI shared by multiple features.
- `src/ai/local-models/` should own model storage, catalog filtering,
  download/import operations, activation probes, and operation state.
- `src/ai/providers/` should own provider-specific runtime logic.
- `src/services/chat-answer/` should own chat answer routing, role strategy,
  source resolution, and response assembly.
- `src/retrieval/` and `src/db/` should remain independent of UI and route
  code.

## Implemented Phase Boundaries

These boundaries are now in place and should be kept stable while later
refactors continue.

- `src/ai/localModelManager.ts` is a compatibility facade. New local model
  manager behavior lives under `src/ai/local-models/`.
- `src/ai/local-models/types.ts` owns local model manager contracts.
- `src/ai/local-models/paths.ts` owns local model storage path helpers.
- `src/ai/local-models/manifestStore.ts` owns manifest parsing,
  serialization, file URI handling, and manifest status builders.
- `src/ai/local-models/operationStore.ts` owns model operation state,
  listeners, and busy checks.
- `src/ai/modelCatalog.ts` owns pure catalog grouping and download-fit
  decisions.
- `src/ai/localModelTierRules.ts` owns RAM tier parsing, tier ordering, and
  quantization/runtime tier helpers used by metadata and requirements.
- `src/ai/nativeRuntimeAdapters.ts` owns shared native runtime availability,
  capability, and release checks for LiteRT-LM and ONNX GenAI providers.
- `src/services/answerPipeline.ts` owns answer-service pipeline helpers:
  selected mode context, local-safe-chat eligibility, scoped intent options,
  contextual source follow-up resolution, and task context assembly.
- `src/services/sourceRetrievalPipeline.ts` owns source retrieval composition
  across FTS, vector, and hybrid retrieval.
- `src/components/models/` owns reusable model-library UI pieces for the
  models route.
- `src/hooks/useModelManagerState.ts` owns models-screen data loading,
  operation recovery, subscriptions, error state, and action orchestration.
- `scripts/test-utils/sourceAssertions.ts` owns script-level source boundary
  assertions.

## Migration Rules

- Preserve existing public facades during migration, especially
  `src/ai/localModelManager.ts`, `src/ai/localModelMetadata.ts`,
  `src/ai/modelDownloadConfig.ts`, `src/services/answerService.ts`, and
  `src/hooks/useChatMessages.ts`.
- Move behavior first, then update imports in small batches.
- Do not remove Qwen, Llama, Gemma, Phi, seeded campus data, or Service Desk
  preview data during refactoring.
- Do not change user-visible behavior unless a failing test documents an
  existing bug and the fix is intentionally scoped.
- Keep TypeScript strictness and use typed interfaces at new module boundaries.

## Verification Gates

- Run focused tests after each phase.
- Run `npm.cmd run test:all` at every major checkpoint.
- Run Android Kotlin compilation after touching native Android code or model
  runtime wiring.
