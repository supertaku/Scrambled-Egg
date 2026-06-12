# Intent classification embedding migration

The current intent and scenario classifiers are deterministic and heavily
tested, but regex recall is limited to anticipated wording. A future local
embedding model can improve paraphrase handling without becoming a runtime
requirement.

## Constraints

- Keep safety classification deterministic and regex-first.
- Keep the embedding path optional and offline.
- Fall back to the current classifier below a confidence threshold or after a
  provider failure.
- Preserve the English-only response policy for Tagalog and Taglish input.
- Share the existing inference lease so classification cannot race model
  activation, removal, or generation.

## Phases

1. Convert existing edge-case and chat-scenario cases into a labeled intent
   evaluation set and add representative paraphrases.
2. Benchmark centroid similarity against the regex baseline outside the app.
3. Run embeddings in on-device shadow mode and record local disagreements for
   administrators only.
4. Promote individual non-safety scenarios only where measured accuracy is
   better and latency remains acceptable.
5. Remove regex rules only after all associated evaluation cases pass through
   the promoted path and its deterministic fallback.
