# Remaining Findings Hardening Design

## Scope

Fix the outstanding review findings without upgrading LiteRT-LM, removing the explicitly retained sample organization chart, or restructuring unrelated dirty worktree changes.

## Runtime Safety

Keep `litertlm-android:0.10.2`. Its packaged `Conversation` API exposes asynchronous message callbacks and `cancelProcess()`. The Android bridge will permit one active generation, identify it with a request ID, stream token snapshots to JavaScript, expose `cancelGeneration(requestId)`, and close the active conversation on completion, failure, cancellation, release, or model swap.

`LiteRtLmProvider` will own AbortSignal wiring, a total-generation watchdog, and periodic thermal checks. Abort, timeout, serious sustained heat, or critical heat will call native cancellation and return an incomplete result. The provider will never pass non-serializable AbortSignal objects across the React Native bridge.

## Artifact Integrity

Gemma URLs will use immutable Hugging Face revisions and their official LFS SHA-256 values:

- E2B revision `6e5c4f1e395deb959c494953478fa5cec4b8008f`, SHA-256 `181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c`.
- E4B revision `28299f30ee4d43294517a4ac93abd6163412f07f`, SHA-256 `0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0`.

Catalog tests will require every downloadable model to use an immutable revision and expected digest.

## Private Persistence

Conversation questions/answers and bookmark questions/answers/citations will be AES-256-GCM envelopes prefixed with `enc:v1:`. The AES key will be generated once and stored in Expo SecureStore. Sensitive writes will fail closed if secure key storage is unavailable.

Conversation search will retain FTS without plaintext by storing keyed token fingerprints in the existing `keywords` column. Existing plaintext rows will migrate lazily when history or bookmarks are read. Duplicate bookmark lookup will compare decrypted content during the bounded local bookmark scan, avoiding a new plaintext identity column.

## Theme And Structure

Ordinary screen colors will consume semantic theme tokens. The campus map's fixed pixel-art colors will move into a named `campusMapPalette` module because those colors describe artwork, not light/dark UI surfaces. Category accents will be centralized rather than scattered through screen files.

Focused extraction is limited to code touched by these fixes: LiteRT lifecycle helpers, private-data crypto, and screen palette modules. The sample organization chart remains unchanged by explicit user decision.

## Asset Hygiene

Temporary contact sheets, logs, and the extra chroma image will be removed. New mascot PNGs will only be converted to transparent WebP if the local image toolchain preserves alpha, dimensions, and visual quality and React Native asset resolution remains static and testable. Otherwise PNGs remain and the optimization is documented rather than forced.

## Verification

Run focused red-green tests, `npm.cmd run test:all`, Android Kotlin compilation, debug assembly when dependencies are available, asset dimension/alpha tests, and `git diff --check`. Physical E2B/E4B inference remains a device-only release gate.
