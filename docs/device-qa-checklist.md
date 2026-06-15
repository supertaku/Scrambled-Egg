# Haki — On-Device Model QA Checklist

Real-device validation for the IO/native paths that unit tests can't cover (download
resume, hash verification, storage preflight, thermal/OOM, native runtime gating).
Run this on at least one **low-RAM Android device (~4 GB)** plus one mid-tier device.
Record pass/fail and notes per row. Re-run before any release that touches `src/ai/`.

## Test devices

| Field | Device A | Device B |
|---|---|---|
| Model / chipset | | |
| RAM / free storage | | |
| OS version | | |
| App build (commit) | | |

## Pre-flight

- Use a small model for download tests to keep cycles short: **Qwen 2.5 0.5B (~491 MB)** or **Llama 3.2 1B (~808 MB)**.
- Verifier: SHA-256 is checked natively (`HakiDeviceInfo.sha256File`) before activation — a mismatch must **block activation**.
- Operation phases to watch (badge text on the Models screen): `queued → downloading → verifying → validating → optimizing → waiting_for_chat → activating → completed` (or `paused`/`failed`/`canceled`). Source: `modelOperationCoordinator`.

## Scenarios

| # | Scenario | Steps | Expected | Code reference | Result | Notes |
|---|---|---|---|---|---|---|
| 1 | Download interrupt → resume | Start a model download; mid-flight toggle airplane mode for ~20s, then restore network. | Operation pauses cleanly, then auto-resumes (or shows a resumable "Paused" state with a working Resume). No corrupt install. | `localModelManager` resume logic; `resumePausedModelDownload` | ☐ | |
| 2 | Download interrupt → app restart | Start a download; force-kill the app at ~50%; relaunch and open Models. | App detects the partial download and either auto-resumes (if storage still fits) or surfaces a clean "Paused" state — never a half-installed active model. | `localModelManager` restart resume path; `recoverInterruptedModelOperation` | ☐ | |
| 3 | Hash mismatch rejection | After download completes but before/at activation, replace the staged file with a wrong-content file of similar size (or point the catalog URL at a mismatched artifact in a test build). | Verification fails, the artifact is rejected and cleaned up, model does **not** activate, user sees a clear error. No partial/`.partial.` leftovers. | SHA-256 verify in `localModelManager`; `modelStoragePaths` cleanup (`safeDelete`, `.partial.`) | ☐ | |
| 4 | Storage preflight block | On a device with little free space, attempt to download a model larger than free space. | Download is blocked up-front with a clear storage message from the forecast; no partial write started. | `storageForecast` / `forecastStorageForModel`; preflight in `localModelManager` | ☐ | |
| 5 | Capability gating (RAM) | On the 4 GB device, open Models and inspect each tier. | Models the device can't run are not offered (or are disabled with a reason). Recommended section only shows runnable models. | `modelCatalog.fitsHardware` / `catalogDownloadFitsHardware`; `deviceHardwareProfile` | ☐ | |
| 6 | LiteRT bridge unavailable | On an Android build/device where the LiteRT-LM bridge is missing, view a LiteRT model card. | Download is disabled with: "Updated Android build required: LiteRT-LM bridge is not available." | `app/models.tsx` `disabledReason`; `runtimeAvailability["litert-lm"]` | ☐ | |
| 7 | First-token watchdog | Send a chat prompt on a slow/low-RAM device with a borderline-too-large model. | If first token doesn't arrive within the deadline (25s tiny/minimum, 15s others), generation is stopped and a graceful timeout message shows — not a frozen UI. | `inferenceWatchdog` first-token deadline; `LlamaRnProvider.ts` | ☐ | |
| 8 | Total-generation watchdog | Trigger a very long generation. | Hard-capped at 120s total; stops cleanly, response marked incomplete / continuation offered, no hang. | `inferenceWatchdog` total deadline (`LlamaRnProvider.ts:445,551,605`) | ☐ | |
| 9 | Thermal throttle (sustained load) | Run several long generations back-to-back until the device heats up. | Generation throttles/stops on serious/critical thermal state with a "phone getting too warm" style message; app stays responsive. | `liteRtGenerationGuard` (LiteRT); llama.rn token-interval thermal stop | ☐ | |
| 10 | OOM / oversized model | Force-activate the largest model the device "just barely" passes gating for, then chat. | Either runs, or fails gracefully to the deterministic FTS fallback (`SAFE_FALLBACK_MESSAGE`) — never a silent crash or wedged state. | native OOM → `FallbackProvider`; `modelRecoveryPolicy` | ☐ | |
| 11 | Recovery after failure | After a forced timeout/empty-output failure on an auto-activation LiteRT model, reopen the app. | Eligible reversible failures auto-recover; fatal ones (missing runtime / corrupt artifact) stay failed with a clear reason. | `modelRecoveryPolicy` (timeout/empty_output only) | ☐ | |
| 12 | Deterministic fallback always works | Disable/uninstall all chat models; ask a campus question. | FTS fallback answers from the local SQLite KB with citations — the feature never fully breaks. | `FallbackProvider` (always available); `sourceAnswerService` FTS-only path | ☐ | |
| 13 | Model switch under load | Start switching active model while a generation is in flight. | Coordinator waits for inference to idle (`waiting_for_chat`) before mutating; no race/crash. | `modelOperationCoordinator`; `recoverableAsyncResource` | ☐ | |
| 14 | iOS background mid-generation *(if iOS ships)* | On iOS, start a generation and background the app. | No Metal-related crash; on return the generation is cleanly stopped/resumable. | `LlamaRnProvider` AppState guard (Resolution 3) | ☐ | |

## Sign-off

- [ ] All rows pass on Device A (low-RAM Android)
- [ ] All rows pass on Device B
- [ ] Any failures filed as issues with device + repro
- Tester / date:
