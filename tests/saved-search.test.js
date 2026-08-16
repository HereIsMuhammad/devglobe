import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_FREQUENCIES,
  SavedSearchValidationError,
  applyStructuredFilters,
  applyTextQuery,
  diffNewMatches,
  filterPubliclyVisible,
  isPubliclyVisible,
  normalizeSavedSearch,
  runSavedSearchAgainstCandidates,
} from '../lib/saved-search.js';

function developer(overrides = {}) {
  return {
    login: 'torvalds',
    name: 'Linus Torvalds',
    location: 'Portland, OR, USA',
    topLanguage: 'C',
    score: 96,
    ...overrides,
  };
}

// --- Validation ---------------------------------------------------------

test('normalizeSavedSearch requires a name', () => {
  assert.throws(() => normalizeSavedSearch({ criteria: { query: 'rust' } }), SavedSearchValidationError);
});

test('normalizeSavedSearch requires at least one criterion', () => {
  assert.throws(() => normalizeSavedSearch({ name: 'Empty' }), SavedSearchValidationError);
});

test('normalizeSavedSearch accepts a query-only search and defaults mode to text', () => {
  const result = normalizeSavedSearch({ name: 'Rust devs', criteria: { query: 'rust' } });
  assert.equal(result.criteria.mode, 'text');
  assert.equal(result.criteria.query, 'rust');
  assert.equal(result.alert.frequency, 'off');
});

test('normalizeSavedSearch accepts structured-filters-only search with no query', () => {
  const result = normalizeSavedSearch({ name: 'Elite USA', criteria: { filters: { country: 'USA', minScore: 80 } } });
  assert.equal(result.criteria.filters.country, 'USA');
  assert.equal(result.criteria.filters.minScore, 80);
});

test('normalizeSavedSearch rejects an invalid mode by falling back to text', () => {
  const result = normalizeSavedSearch({ name: 'X', criteria: { query: 'go', mode: 'nonsense' } });
  assert.equal(result.criteria.mode, 'text');
});

test('normalizeSavedSearch clamps minScore into 0-100', () => {
  const result = normalizeSavedSearch({ name: 'X', criteria: { filters: { minScore: 500 } } });
  assert.equal(result.criteria.filters.minScore, 100);
});

test('normalizeSavedSearch sets alert.enabled based on frequency', () => {
  const daily = normalizeSavedSearch({ name: 'X', criteria: { query: 'go' }, alert: { frequency: 'daily' } });
  assert.equal(daily.alert.enabled, true);
  const off = normalizeSavedSearch({ name: 'X', criteria: { query: 'go' }, alert: { frequency: 'off' } });
  assert.equal(off.alert.enabled, false);
});

test('ALERT_FREQUENCIES includes the documented options', () => {
  assert.deepEqual(ALERT_FREQUENCIES, ['off', 'daily', 'weekly']);
});

// --- Structured + text filters ------------------------------------------

test('applyStructuredFilters matches country via extracted country, not raw substring', () => {
  const usDev = developer({ location: 'Portland, OR, USA' });
  const ukDev = developer({ login: 'gaearon', location: 'London, UK' });
  const result = applyStructuredFilters([usDev, ukDev], { country: 'USA' });
  assert.deepEqual(result.map(d => d.login), ['torvalds']);
});

test('applyStructuredFilters matches language case-insensitively', () => {
  const result = applyStructuredFilters([developer({ topLanguage: 'JavaScript' })], { language: 'javascript' });
  assert.equal(result.length, 1);
});

test('applyStructuredFilters enforces minScore', () => {
  const result = applyStructuredFilters([developer({ score: 50 }), developer({ login: 'b', score: 90 })], { minScore: 80 });
  assert.deepEqual(result.map(d => d.login), ['b']);
});

test('applyTextQuery matches login, name, location, and language', () => {
  const dev = developer();
  assert.equal(applyTextQuery([dev], 'torvalds').length, 1);
  assert.equal(applyTextQuery([dev], 'linus').length, 1);
  assert.equal(applyTextQuery([dev], 'portland').length, 1);
  assert.equal(applyTextQuery([dev], 'nonexistent').length, 0);
});

// --- Privacy --------------------------------------------------------------

test('isPubliclyVisible excludes pending/rejected self-nominations', () => {
  assert.equal(isPubliclyVisible(developer({ nomination: { status: 'pending' } })), false);
  assert.equal(isPubliclyVisible(developer({ nomination: { status: 'rejected' } })), false);
  assert.equal(isPubliclyVisible(developer({ nomination: { status: 'approved' } })), true);
  assert.equal(isPubliclyVisible(developer()), true); // legacy docs with no nomination field
});

test('filterPubliclyVisible strips private/pending profiles from a result set', () => {
  const visible = developer({ login: 'a' });
  const pending = developer({ login: 'b', nomination: { status: 'pending' } });
  assert.deepEqual(filterPubliclyVisible([visible, pending]).map(d => d.login), ['a']);
});

test('runSavedSearchAgainstCandidates never returns a private/pending profile even if it matches every filter', () => {
  const pendingMatch = developer({ login: 'sneaky', nomination: { status: 'pending' } });
  const result = runSavedSearchAgainstCandidates([pendingMatch], { query: '', filters: {} });
  assert.equal(result.length, 0);
});

test('runSavedSearchAgainstCandidates combines privacy, structured filters, and text query', () => {
  const candidates = [
    developer({ login: 'a', location: 'Portland, OR, USA', topLanguage: 'C', score: 96 }),
    developer({ login: 'b', location: 'London, UK', topLanguage: 'C', score: 96 }),
    developer({ login: 'c', location: 'Portland, OR, USA', topLanguage: 'Go', score: 96 }),
    developer({ login: 'd', location: 'Portland, OR, USA', topLanguage: 'C', score: 10 }),
  ];
  const result = runSavedSearchAgainstCandidates(candidates, {
    query: '',
    filters: { country: 'USA', language: 'C', minScore: 50 },
  });
  assert.deepEqual(result.map(d => d.login), ['a']);
});

// --- Incremental deduplicated new-match detection --------------------------

test('diffNewMatches treats every match as new on the first run', () => {
  const { newLogins, updatedSeenLogins } = diffNewMatches(['a', 'b'], []);
  assert.deepEqual(newLogins, ['a', 'b']);
  assert.deepEqual(updatedSeenLogins, ['a', 'b']);
});

test('diffNewMatches only reports logins not already seen', () => {
  const { newLogins, updatedSeenLogins } = diffNewMatches(['a', 'b', 'c'], ['a']);
  assert.deepEqual(newLogins, ['b', 'c']);
  assert.deepEqual(updatedSeenLogins, ['a', 'b', 'c']);
});

test('diffNewMatches reports nothing new when the result set is unchanged', () => {
  const { newLogins } = diffNewMatches(['a', 'b'], ['a', 'b']);
  assert.deepEqual(newLogins, []);
});

test('diffNewMatches is deduplicated: repeated runs never re-report the same login as new', () => {
  const run1 = diffNewMatches(['a', 'b'], []);
  assert.deepEqual(run1.newLogins, ['a', 'b']);

  const run2 = diffNewMatches(['a', 'b', 'c'], run1.updatedSeenLogins);
  assert.deepEqual(run2.newLogins, ['c']);

  const run3 = diffNewMatches(['a', 'b', 'c'], run2.updatedSeenLogins);
  assert.deepEqual(run3.newLogins, []);
});

test('diffNewMatches caps the persisted seen set so it cannot grow unbounded', () => {
  const manyLogins = Array.from({ length: 2500 }, (_, i) => `dev${i}`);
  const { updatedSeenLogins } = diffNewMatches(manyLogins, []);
  assert.ok(updatedSeenLogins.length <= 2000);
});
