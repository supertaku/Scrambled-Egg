/**
 * HybridRetriever — Combines multiple Retriever instances using Reciprocal Rank Fusion (RRF).
 *
 * Currently the actual implementation lives in HybridRetriever.placeholder.ts.
 * This file re-exports it as the canonical import point. The indirection exists so
 * a future native HybridRetriever implementation (e.g. with on-device vector ANN search)
 * can be swapped in without touching import sites across the codebase.
 *
 * If you add a native implementation: replace this re-export with your class,
 * and rename HybridRetriever.placeholder.ts to HybridRetriever.js.placeholder
 * so it is excluded from the build.
 */
export { HybridRetriever } from "./HybridRetriever.placeholder";
