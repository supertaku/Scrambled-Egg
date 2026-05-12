import type { SQLiteDatabase } from "expo-sqlite";

import { getDatabase } from "@/db/database";

export function getAppDatabase(): Promise<SQLiteDatabase> {
  return getDatabase();
}
