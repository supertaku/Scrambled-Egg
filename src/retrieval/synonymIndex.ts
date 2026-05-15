/**
 * Static synonym map for common TUP terms.
 * In the future, this can be built dynamically from indexed document synonyms.
 */
export const synonymMap: Record<string, string[]> = {
  cor: ["certificate of registration", "cert of reg"],
  shifting: ["change course", "transfer program", "change major"],
  overload: ["excess units", "additional load"],
  clearance: ["sign-off", "requirements", "accountability"],
  enrollment: ["registration", "admission"],
  id: ["identification card", "student card"],
  lose: ["lost", "missing", "replacement", "damaged"],
  lost: ["lose", "missing", "replacement", "damaged"],
  missing: ["lost", "replacement"],
  nstp: ["national service training program"],
  pe: ["physical education"],
  accounting: ["finance", "payment", "cashier"],
  registrar: ["records", "student files"],
  hurt: ["injury", "injured", "first aid", "clinic", "medical", "regular medical consultation"],
  injured: ["injury", "hurt", "first aid", "clinic", "medical"],
  sick: ["clinic", "medical", "health"],
  fainted: ["faint", "clinic", "medical emergency"],
  advice: ["guidance", "tips", "help"],
  grades: ["academic support", "adviser", "registrar"],
  counselor: ["guidance", "counseling"],
  counseling: ["guidance", "counselor"],
  org: ["organization", "club", "student affairs"],
  orgs: ["organizations", "clubs", "student affairs"],
  canteen: ["cafeteria", "dining", "food"],
  // ── TUP-specific office acronyms ──────────────────────────────────────
  // Keep these matched to the official office names indexed in the corpus.
  csso: ["student services", "student services office", "scholarship", "student welfare"],
  osa: ["student affairs", "office of student affairs"],
  osas: ["student affairs and services", "office of student affairs"],
  rgso: ["registrar", "registrar's office", "records office"],
  gmc: ["good moral", "good moral character", "good moral certificate", "certificate of good moral", "certificate of good moral character", "moral character"],
  moral: ["good moral", "good moral character", "good moral certificate", "gmc", "certificate of good moral", "certificate of good moral character"],
  ird: ["instructional resources", "instruction research"],
  its: ["information technology services", "it services"],
  // ── Campuses ──────────────────────────────────────────────────────────
  tup: ["technological university of the philippines", "tupt", "tup manila", "tup taguig"],
  tupt: ["tup taguig", "technological university of the philippines taguig"],
  // ── Common student terms ──────────────────────────────────────────────
  tuition: ["tuition fee", "tuition fees", "fee", "fees", "matricula"],
  fee: ["fees", "tuition", "tuition fee", "miscellaneous fee"],
  units: ["unit", "credit unit", "credit hours"],
  schedule: ["schedules", "class schedule", "timetable", "block schedule"]
};

/**
 * Expands a token with its synonyms if they exist.
 * Returns an array containing the original token and its synonyms.
 */
export function expandToken(token: string): string[] {
  const lower = token.toLowerCase();
  const synonyms = synonymMap[lower];
  if (synonyms) {
    return [token, ...synonyms];
  }
  return [token];
}

/**
 * Builds an OR query fragment for a token and its synonyms.
 * Example: "cor" -> '(cor OR "certificate of registration" OR "cert of reg")'
 */
export function buildExpandedTokenQuery(token: string): string {
  const variations = expandToken(token);
  if (variations.length === 1) {
    return token;
  }
  const escaped = variations.map((v) => (v.includes(" ") ? `"${v}"` : v));
  return `(${escaped.join(" OR ")})`;
}
