export const MAX_PAGE_LIMIT = 1000;

/**
 * Parse `limit`/`offset` query params into a clamped { limit, offset } pair,
 * or null when no `limit` is given (signals "legacy, unpaginated request").
 * Used by /api/developers to stay backward compatible: existing callers that
 * don't pass `limit` keep getting the full array they always got.
 */
export function parsePaginationParams(searchParams, { maxLimit = MAX_PAGE_LIMIT } = {}) {
  const limitParam = searchParams.get('limit');
  if (!limitParam) return null;

  const parsedLimit = parseInt(limitParam, 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 0, 1), maxLimit);

  const parsedOffset = parseInt(searchParams.get('offset'), 10);
  const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

  return { limit, offset };
}
