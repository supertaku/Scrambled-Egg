/**
 * VectorRetriever — Embeds a query and retrieves semantically similar chunks.
 *
 * Currently the actual implementation lives in VectorRetriever.placeholder.ts.
 * This file re-exports it as the canonical import point. The indirection exists so
 * a future native VectorRetriever (e.g. backed by sqlite-vec or FAISS) can be swapped
 * in without touching import sites across the codebase.
 *
 * The placeholder implementation calls `provider.embedText()` at query time and performs
 * in-memory cosine similarity against stored chunk embeddings. It is functional but not
 * optimised for large corpora (>10k chunks). For scale, use sqlite-vec or a proper ANN index.
 *
 * If you add a native implementation: replace this re-export with your class,
 * and rename VectorRetriever.placeholder.ts to VectorRetriever.js.placeholder
 * so it is excluded from the build.
 */
export { VectorRetriever } from "./VectorRetriever.placeholder";
