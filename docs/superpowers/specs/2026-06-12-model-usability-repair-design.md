# Model Usability Repair Design

## Goal

Make every model that the catalog declares compatible with the current phone complete download, become selectable, and remain retryable after transient native failures. Hardware, architecture, integrity, format, and LiteRT runtime checks remain strict.

## Root Cause

GGUF activation currently runs a full load-and-generation benchmark before writing `activeModelId`. That benchmark is a performance optimization, but any initialization, completion, timeout, or release error is treated as an installation failure. Earlier builds activated a validated GGUF artifact without requiring generated output.

Two later lifecycle behaviors amplify the problem: `LlamaRnProvider` caches rejected context promises, and chat services disable a provider for the whole app session after any inference exception. The models screen then clears or hides the useful failure detail.

## Design

### Runtime-specific activation

- Preserve SHA-256, file presence, metadata, quantization, template, architecture, RAM, storage, and low-memory validation.
- GGUF activation ends after those checks and persists `activeModelId`. GGUF evaluation state is normalized to `not_required`; old benchmark failures are cleared when a user retries an already-installed model.
- LiteRT-LM keeps its mandatory native response smoke test because its provider requires `evaluationStatus: passed`.
- Performance profiles remain optional. A GGUF without a profile uses the existing CPU execution fallback.

### Recoverable contexts

- Use a small keyed async-resource owner for chat and embedding contexts.
- Concurrent requests for one model share a single creation promise.
- Rejected creation promises are cleared automatically.
- Changing models or invalidating a failed context releases the previous native context before replacement.
- Completion and embedding failures invalidate their context so the next attempt starts cleanly.

### Failure policy and refresh lifecycle

- Retry transient initialization, memory, timeout, empty-output, and unknown failures without disabling the provider for the app session.
- Disable only confirmed permanent failures: missing native runtime, unsupported architecture, or corrupt artifact.
- Await provider-registry disposal during explicit capability refresh before creating a replacement registry.
- After transient retries are exhausted, use fallback for that response while leaving the provider available for a later request.

### Diagnostics

- Display the operation's normalized error in the Haki status bubble.
- Reload model state without immediately erasing a caught action error.
- Do not show obsolete GGUF benchmark failures as activation blockers.

## Verification

- Unit tests cover runtime-specific activation, rejected-context recovery, permanent/transient failure classification, ordered registry replacement, and operation messages.
- Existing local-model assertions are updated to prohibit mandatory GGUF probing.
- Run typecheck, unit tests, local-model tests, the full suite, Android compile, and APK native-library inspection when an APK is available.
- Device check: download, activate, chat twice, background/foreground, restart, switch models, and retry an already-installed model on the Poco X6 Pro.
