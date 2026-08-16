import { countryKey, extractCountry } from './country.js';

export const SEARCH_MODES = ['text', 'vector', 'hybrid'];
export const ALERT_FREQUENCIES = ['off', 'daily', 'weekly'];
export const MAX_SAVED_SEARCHES_PER_USER = 25;
export const MAX_SEEN_LOGINS = 2000;

export class SavedSearchValidationError extends Error {}

function cleanString(value, { maxLength = 200 } = {}) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/**
 * Normalize and validate a saved-search request body into a stored-shape
 * criteria + alert object. Throws on structurally invalid input so bad
 * requests fail loudly instead of silently saving garbage.
 */
export function normalizeSavedSearch(raw) {
  if (!raw || typeof raw !== 'object') throw new SavedSearchValidationError('Request body is required');

  const name = cleanString(raw.name, { maxLength: 80 });
  if (!name) throw new SavedSearchValidationError('name is required');

  const query = cleanString(raw.criteria?.query, { maxLength: 200 });
  const mode = SEARCH_MODES.includes(raw.criteria?.mode) ? raw.criteria.mode : 'text';

  const filters = raw.criteria?.filters || {};
  const country = cleanString(filters.country, { maxLength: 100 }) || null;
  const language = cleanString(filters.language, { maxLength: 50 }) || null;
  const minScore = Number.isFinite(filters.minScore) ? Math.min(Math.max(filters.minScore, 0), 100) : null;

  if (!query && !country && !language && minScore === null) {
    throw new SavedSearchValidationError('At least one of query, country, language, or minScore is required');
  }

  const frequency = ALERT_FREQUENCIES.includes(raw.alert?.frequency) ? raw.alert.frequency : 'off';

  return {
    name,
    criteria: { query, mode, filters: { country, language, minScore } },
    alert: { frequency, enabled: frequency !== 'off' },
  };
}

/**
 * Given the developers currently matching a saved search and the set of
 * logins already seen for that search, return only the genuinely new
 * matches (incremental + deduplicated), and the updated seen set to persist.
 */
export function diffNewMatches(currentLogins, seenLogins = []) {
  const seenSet = new Set(seenLogins);
  const newLogins = currentLogins.filter(login => !seenSet.has(login));
  newLogins.forEach(login => seenSet.add(login));

  // Cap the persisted seen set so it can't grow unbounded across years of runs.
  let updatedSeenLogins = [...seenSet];
  if (updatedSeenLogins.length > MAX_SEEN_LOGINS) {
    updatedSeenLogins = updatedSeenLogins.slice(updatedSeenLogins.length - MAX_SEEN_LOGINS);
  }

  return { newLogins, updatedSeenLogins };
}

/**
 * Defense-in-depth privacy guard: even if a caller passes an unfiltered
 * developer list, never surface private or pending profiles. Mirrors the
 * PUBLIC_FILTER predicate used by /api/search and /api/developers.
 */
export function isPubliclyVisible(developer) {
  if (!developer) return false;
  if (!developer.nomination) return true;
  return developer.nomination.status === 'approved';
}

export function filterPubliclyVisible(developers) {
  return developers.filter(isPubliclyVisible);
}

/** Apply structured filters (country/language/minScore) to a developer list. */
export function applyStructuredFilters(developers, filters = {}) {
  const { country, language, minScore } = filters;
  const wantedCountry = country ? countryKey(country) : null;
  return developers.filter(developer => (
    (!wantedCountry || countryKey(extractCountry(developer.location)) === wantedCountry)
    && (!language || developer.topLanguage?.toLowerCase() === language.toLowerCase())
    && (minScore === null || minScore === undefined || (developer.score ?? 0) >= minScore)
  ));
}

/** Apply the free-text portion of a saved search's criteria (text mode). */
export function applyTextQuery(developers, query) {
  if (!query) return developers;
  const needle = query.toLowerCase();
  return developers.filter(developer => (
    developer.login?.toLowerCase().includes(needle)
    || developer.name?.toLowerCase().includes(needle)
    || developer.location?.toLowerCase().includes(needle)
    || developer.bio?.toLowerCase().includes(needle)
    || developer.topLanguage?.toLowerCase().includes(needle)
  ));
}

/**
 * Full text-mode run pipeline: privacy -> structured filters -> text query.
 * Vector/hybrid modes additionally rank by embedding similarity upstream
 * (see lib/saved-search-run.js) before this narrows/filters the candidate set.
 */
export function runSavedSearchAgainstCandidates(candidates, criteria) {
  const visible = filterPubliclyVisible(candidates);
  const structured = applyStructuredFilters(visible, criteria.filters);
  return applyTextQuery(structured, criteria.query);
}
