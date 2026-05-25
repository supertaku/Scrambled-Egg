/**
 * Application-wide constants.
 *
 * Centralised here so magic strings and numbers never appear inline.
 * Import from this file instead of duplicating string literals across services.
 */

// ─── AsyncStorage Keys ────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  /** Persists whether the app is currently in admin mode. Value: "true" | "false" */
  ADMIN_MODE: "tupt_wiki_admin_mode",
  /** Stores the last N questions the student asked, as a JSON string array. */
  RECENT_QUESTIONS: "tupt_wiki_recent_questions",
  /** Stores bounded local thumbs up/down feedback for Haki chat answers. */
  CHAT_FEEDBACK: "tupt_wiki_chat_feedback",
  /** Legacy: full profile JSON in plaintext. Migrated to SecureStore + avatar key on read. */
  STUDENT_PROFILE: "tupt_wiki_student_profile",
  /** Local avatar path/URI only (PII core fields use SecureStore when available). */
  STUDENT_PROFILE_AVATAR_URI: "tupt_wiki_student_profile_avatar_uri",
  /** Opt-in: allows saved profile values to be included in Haki prompts. */
  CHAT_USE_PROFILE_CONTEXT: "tupt_wiki_chat_use_profile_context",
  /** Opt-in: allows related remembered replies to be used as Haki prompt context. */
  CHAT_USE_RELATED_HISTORY: "tupt_wiki_chat_use_related_history",
  /** Stores a prompt interrupted while a local answer was being generated. */
  PENDING_CHAT_REQUEST: "tupt_wiki_pending_chat_request",
  /** Marks the one-time Haki profile setup flow as finished on this device. */
  ONBOARDING_COMPLETE: "tupt_wiki_onboarding_complete",
  /** Distinguishes interrupted first-run setup from a legacy saved profile. */
  ONBOARDING_STARTED: "tupt_wiki_onboarding_started",
  /** Restores the active profile setup step after an interrupted first run. */
  ONBOARDING_STEP: "tupt_wiki_onboarding_step"
} as const;

// ─── Database ─────────────────────────────────────────────────────────────────

/** SQLite database file name used by expo-sqlite. */
export const DATABASE_NAME = "tupt_wiki.db";

// ─── AI / Retrieval ───────────────────────────────────────────────────────────

/**
 * Maximum number of provider retry attempts before permanently degrading
 * to the FTS5 fallback for the current answer.
 */
export const MAX_PROVIDER_RETRIES = 2;

/**
 * Maximum number of recent questions to persist in history.
 */
export const MAX_RECENT_QUESTIONS = 8;

/**
 * Default maximum number of retrieval results to fetch from the database.
 */
export const DEFAULT_RETRIEVAL_LIMIT = 8;

// ─── Confidence Score Thresholds ─────────────────────────────────────────────
//
// These values were tuned empirically against the campus document corpus.
// Before changing them, run the golden-question evaluation suite to verify
// precision/recall doesn't regress.

/**
 * Minimum weighted score for a result to be considered HIGH confidence
 * when all corroborating signals (multi-token evidence, priority match, explicit grounding) are present.
 */
export const CONFIDENCE_HIGH_THRESHOLD_FULL = 0.72;

/**
 * Minimum weighted score for HIGH confidence when an exact phrase match
 * and explicit grounding (answer + citation) are present.
 */
export const CONFIDENCE_HIGH_THRESHOLD_PHRASE = 0.58;

/**
 * Minimum weighted score for HIGH confidence when token coverage is strong
 * and a priority field matches with explicit grounding.
 */
export const CONFIDENCE_HIGH_THRESHOLD_COVERAGE = 0.57;

/**
 * Minimum raw score for a result set to be promoted to HIGH confidence
 * when multiple supporting documents and citation metadata exist.
 */
export const CONFIDENCE_HIGH_MULTI_SUPPORT_THRESHOLD = 0.52;

/**
 * Minimum weighted score for a result to be considered MEDIUM confidence.
 */
export const CONFIDENCE_MEDIUM_THRESHOLD = 0.35;

/**
 * Lower minimum score for MEDIUM confidence when multiple supporting results
 * and explicit answer/citation metadata are present.
 */
export const CONFIDENCE_MEDIUM_LOW_THRESHOLD = 0.28;
