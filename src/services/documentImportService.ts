import type { ImportResult, ValidationResult } from "@/types/document";
import { parseAndValidateDocuments } from "@/utils/validation";

import { getDatabase } from "@/db/database";
import { insertDocuments } from "@/db/documentRepository";
import { getAdminMode } from "./adminService";

export function validateImportText(jsonText: string): ValidationResult {
  return parseAndValidateDocuments(jsonText);
}

export async function importDocumentsFromJson(jsonText: string): Promise<ImportResult> {
  if (!(await getAdminMode())) {
    throw new Error("Administrator mode is required before importing campus documents.");
  }

  const validation = parseAndValidateDocuments(jsonText);
  if (!validation.ok) {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue ? `${firstIssue.path}: ${firstIssue.message}` : "Invalid document JSON.");
  }

  const db = await getDatabase();
  return insertDocuments(db, validation.documents);
}
