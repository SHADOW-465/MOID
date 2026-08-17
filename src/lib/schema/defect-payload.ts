// Defect writes must satisfy DefectDef: aliases.min(1). The tree editor
// used to send aliases: [] and the API rejected the body — the add looked
// like it did nothing. The code itself is always a valid first alias.

export function aliasesForDefect(code: string, aliases?: string[] | null): string[] {
  const trimmed = (aliases ?? []).map((a) => a.trim()).filter(Boolean);
  const seen = new Set(trimmed.map((a) => a.toUpperCase()));
  const c = code.trim();
  if (c && !seen.has(c.toUpperCase())) trimmed.unshift(c);
  return trimmed;
}

/** Attach a stage to an existing defect instead of replacing its other scopes. */
export function mergeDefectForAdd(
  existing: { defectCode: string; label: string; aliases?: string[]; stages?: string[] } | undefined,
  next: { defectCode: string; label: string; aliases?: string[]; stages: string[] },
): { defectCode: string; label: string; aliases: string[]; stages: string[] } {
  const stages = [...new Set([...(existing?.stages ?? []), ...next.stages])];
  return {
    defectCode: next.defectCode,
    label: existing?.label || next.label,
    aliases: aliasesForDefect(next.defectCode, [...(existing?.aliases ?? []), ...(next.aliases ?? [])]),
    stages,
  };
}
