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
  nstp: ["national service training program"],
  pe: ["physical education"],
  accounting: ["finance", "payment", "cashier"],
  registrar: ["records", "student files"],
  hurt: ["injury", "injured", "first aid", "clinic", "medical"],
  injured: ["injury", "hurt", "first aid", "clinic", "medical"],
  sick: ["clinic", "medical", "health"],
  fainted: ["faint", "clinic", "medical emergency"],
  advice: ["guidance", "tips", "help"],
  grades: ["academic support", "adviser", "registrar"],
  counselor: ["guidance", "counseling"],
  counseling: ["guidance", "counselor"],
  org: ["organization", "club", "student affairs"],
  orgs: ["organizations", "clubs", "student affairs"],
  canteen: ["cafeteria", "dining", "food"]
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
