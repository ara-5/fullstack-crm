export type Scalar = string | number | boolean | null;
export type Changes = Record<string, { from: Scalar; to: Scalar }>;

function normalize(value: unknown): Scalar {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

export const DEFAULT_IGNORED =["id", "createdAt", "updatedAt", "aiInsights", "aiInsightsAt"];

/** Field-level diff between two versions of a record, for the audit log. */
export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignore: string[] = DEFAULT_IGNORED,
): Changes {
  const changes: Changes = {};
  for (const key of Object.keys(after)) {
    if (ignore.includes(key)) continue;
    const from = normalize(before[key]);
    const to = normalize(after[key]);
    if (from !== to) changes[key] = { from, to };
  }
  return changes;
}
