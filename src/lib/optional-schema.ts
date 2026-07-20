type DatabaseErrorLike = { code?: unknown; message?: unknown; cause?: unknown };

export function isMissingDatabaseRelation(error: unknown): boolean {
  let current: unknown = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as DatabaseErrorLike;
    if (candidate.code === "42P01") return true;
    if (typeof candidate.message === "string" && /relation .+ does not exist/i.test(candidate.message)) return true;
    current = candidate.cause;
  }
  return false;
}

export async function optionalSchemaQuery<T>(query: Promise<T>, fallback: T): Promise<{ data: T; schemaAvailable: boolean }> {
  try {
    return { data: await query, schemaAvailable: true };
  } catch (error) {
    if (!isMissingDatabaseRelation(error)) throw error;
    return { data: fallback, schemaAvailable: false };
  }
}
