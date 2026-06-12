# Repository consolidation - 2026-06-12

## Purpose

Consolidate intentional Haki work onto `main` while preserving excluded or
unfinished approaches as immutable recovery references. The external bundle at
`C:\tmp\tup-wiki-pre-consolidation-2026-06-12.bundle` captures all branches,
tags, and the original stash before consolidation.

## Included work

- Repaired Android LiteRT-LM bridge and packaged LiteRT-LM `0.10.2` runtime.
- Runtime-aware model lifecycle, integrity verification, activation probes,
  switching, removal, and preservation of the previous active model on failure.
- Final GGUF and LiteRT catalog with immutable artifact revisions, SHA-256
  values, minimum/recommended total RAM, and storage requirements.
- Gemma 4 E2B/E4B through LiteRT-LM; Phi-4-mini-instruct, Qwen, and Llama
  through `llama.rn`.
- Encrypted local chat persistence, retrieval/source routing, Service Desk
  filters, theme system, and repaired HD-v2 mascot behavior.
- Admin unanswered-question reporting adapted to encrypted conversation
  memory, data-derived office aliases, and composed-answer streaming fixes.
- CI, patch-package documentation, and APK inspection for both local runtimes.

## Authoritative precedence

1. Repaired LiteRT implementation and lifecycle protections.
2. Current seed data, English-only response policy, actor-role preservation,
   and chat safety behavior.
3. HD-v2 mascot implementation.
4. Selectively adapted Claude recovery features after conversion to encrypted
   persistence and current theme/retrieval APIs.

## Excluded work

- Phi ONNX and ONNX Runtime GenAI provider shells.
- Experimental Skia/Reanimated mascot implementation.
- `.codex-litertlm-inspect`, logs, contact sheets, presentation outputs, build
  products, and temporary dependency/runtime inspection files.
- Generated model weights inside the APK. Models remain user downloads in
  app-private storage.

## Recovery references

- `archive/runtime-upgrade-1675555`: pre-consolidation runtime implementation.
- `archive/skia-mascot-59bb36d`: excluded experimental mascot.
- `archive/repair-recovery-2026-06-12`: repaired recovery slices.
- `archive/claude-recovery-2026-06-12`: original unanswered-reporting recovery.
- `codex/recovery-repair-2026-06-12`: integration branch until final `main`
  fast-forward.
- `codex/recovery-claude-2026-06-12`: clean recovery worktree until final
  branch cleanup.

## Verification record

- TypeScript and all application suites pass.
- Catalog checks cover RAM tiers, immutable URLs/hashes, runtime formats, and
  the retained Qwen/Llama options.
- APK inspection verifies no bundled model weights, arm64 `liblitertlm_jni.so`,
  llama.rn libraries, and the required LiteRT Engine/Conversation callback API.
- A fresh Android build requires Java 21. The final fresh compile/assembly and
  physical-device scenarios remain release gates; an older APK may be used to
  validate the inspection script but does not satisfy the fresh-build gate.

## Cleanup rule

Delete recovery branches, the original stash, the Claude worktree, and the
remote feature branch only after the integrated commit is reachable from
`main`, archive tags are pushed, worktrees are clean, and required build gates
have succeeded. Archive tags and the external bundle remain recoverable.
