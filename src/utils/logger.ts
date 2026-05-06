/**
 * Structured logger with namespaced channels.
 *
 * Usage:
 *   logger.ai("Mode selected", { modeId: "fts5-only" });
 *   logger.db("Migration applied", { version: 2 });
 *   logger.retrieval("FTS search returned no results", { query });
 *   logger.ui("Chat message sent");
 *
 * In production builds, only 'warn' and 'error' levels should reach the console.
 * Switch the `__DEV__` guard below to a proper env flag when you add a release config.
 */

type LogData = Record<string, unknown>;

type LogChannel = "ai" | "db" | "retrieval" | "ui" | "voice";

function formatMessage(channel: LogChannel, message: string): string {
  return `[haki:${channel}] ${message}`;
}

function log(channel: LogChannel, message: string, data?: LogData): void {
  if (!__DEV__) return;
  if (data) {
    console.log(formatMessage(channel, message), data);
  } else {
    console.log(formatMessage(channel, message));
  }
}

function warn(channel: LogChannel, message: string, data?: LogData): void {
  if (data) {
    console.warn(formatMessage(channel, message), data);
  } else {
    console.warn(formatMessage(channel, message));
  }
}

function error(channel: LogChannel, message: string, data?: LogData): void {
  if (data) {
    console.error(formatMessage(channel, message), data);
  } else {
    console.error(formatMessage(channel, message));
  }
}

/** Structured logger for the Haki app. */
export const logger = {
  /** Log messages related to AI provider selection, capability detection, and model execution. */
  ai: {
    log: (message: string, data?: LogData) => log("ai", message, data),
    warn: (message: string, data?: LogData) => warn("ai", message, data),
    error: (message: string, data?: LogData) => error("ai", message, data)
  },
  /** Log messages related to database operations, migrations, and queries. */
  db: {
    log: (message: string, data?: LogData) => log("db", message, data),
    warn: (message: string, data?: LogData) => warn("db", message, data),
    error: (message: string, data?: LogData) => error("db", message, data)
  },
  /** Log messages related to search, retrieval, ranking, and confidence scoring. */
  retrieval: {
    log: (message: string, data?: LogData) => log("retrieval", message, data),
    warn: (message: string, data?: LogData) => warn("retrieval", message, data),
    error: (message: string, data?: LogData) => error("retrieval", message, data)
  },
  /** Log messages related to UI state, navigation, and user interactions. */
  ui: {
    log: (message: string, data?: LogData) => log("ui", message, data),
    warn: (message: string, data?: LogData) => warn("ui", message, data),
    error: (message: string, data?: LogData) => error("ui", message, data)
  },
  /** Log messages related to voice input and speech recognition. */
  voice: {
    log: (message: string, data?: LogData) => log("voice", message, data),
    warn: (message: string, data?: LogData) => warn("voice", message, data),
    error: (message: string, data?: LogData) => error("voice", message, data)
  }
};
