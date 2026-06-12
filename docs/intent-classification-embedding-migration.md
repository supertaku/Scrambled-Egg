# Plan: migrate intent classification onto local embeddings

## Why

Intent and scenario classification today is ~700 lines of hand-tuned regex
(`src/services/questionIntentService.ts` + `questionScenarioService.ts`) plus
pattern constants inside `answerService.ts`. The test suites keep it honest,
but every new scenario adds regex-interaction surface, and recall for
paraphrases (especially Taglish phrasing) is bounded by what the patterns
anticipated. Once a curated embedding GGUF ships (the `chunk_embeddings`
plumbing and `LlamaRnProvider.embedText` already exist), the same runtime can
classify intents by similarity instead.

## Non-negotiable constraints

- **Safety classification stays regex-first.** The deterministic safety
  patterns (self-harm, violence, etc., in English and Tagalog) must keep
  running before and independently of any embedding path. Embeddings may only
  ADD safety recalls (the existing `SEMANTIC_SAFETY_CONCEPTS` list is the
  natural place to upgrade), never replace the deterministic layer.
- **Offline and optional.** Devices without an embedding model keep the regex
  classifier unchanged. The embedding classifier is an accuracy upgrade, not a
  new requirement — same philosophy as retrieval.
- **Deterministic tie-breaks.** When embedding similarity is below threshold
  or the provider fails mid-session, fall back to the regex result for that
  query (mirror the retrieval fallback pattern).

## Phased approach

1. **Build the eval set first.** Export the scenario labels implied by
   `scripts/test-edge-cases.ts` and `scripts/chat-scenario-eval.ts` into a
   labeled question→scenario dataset; add Taglish paraphrases. This becomes
   the acceptance gate for every later phase.
2. **Prototype offline.** Embed a few exemplar phrases per scenario
   (centroids) with the candidate embedding model; classify by cosine
   similarity against centroids. Measure against the eval set vs. the regex
   baseline. No app changes in this phase.
3. **Shadow mode on device.** Run the embedding classifier alongside regex in
   `classifyStudentQuestionIntent`, log disagreements locally (admin-visible
   only), ship with regex still authoritative.
4. **Promote per scenario.** Flip scenarios to embedding-first only where
   shadow data shows it beats regex, keeping regex as the below-threshold
   fallback. Safety categories are excluded from promotion (see constraints).
5. **Retire dead regex.** Remove only patterns whose scenarios are fully
   promoted and whose eval cases pass without them.

## Performance notes

- Centroid classification is one `embedText` call per question (~tens of ms
  on the tiny embedding tier) plus dot products over <100 centroids — cheap
  relative to retrieval, but it must reuse the shared inference lease so it
  cannot race model mutations.
- Cache the centroid matrix per embedding-model hash (same invalidation key
  as `chunk_embeddings.model_name`).
