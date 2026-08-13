import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPersonalizedFeed,
  decodeFeedCursor,
  encodeFeedCursor,
  filterEvents,
  groupEvents,
  isMuted,
  isRead,
  matchesWatchlist,
  normalizeFeedEvent,
  sortEventsNewestFirst,
  FeedValidationError,
} from '../lib/feed.js';

function event(overrides = {}) {
  return normalizeFeedEvent({
    eventType: 'rank_movement',
    subjectLogin: 'torvalds',
    language: 'C',
    country: 'USA',
    summary: 'Moved up in the rankings',
    createdAt: '2026-08-13T09:00:00Z',
    refreshCycle: '2026-08-13',
    ...overrides,
  }, { isPublicDeveloper: overrides.isPublicDeveloper !== false });
}

function watchlist(overrides = {}) {
  return {
    follows: { developers: [], projects: [], languages: [], countries: [], ...overrides.follows },
    mutes: { entities: [], eventTypes: [], ...overrides.mutes },
    readState: { readThrough: null, readIds: [], ...overrides.readState },
  };
}

test('normalizeFeedEvent rejects unknown event types and missing fields', () => {
  assert.throws(() => normalizeFeedEvent({ eventType: 'nonsense', subjectLogin: 'a', summary: 'x' }), FeedValidationError);
  assert.throws(() => normalizeFeedEvent({ eventType: 'milestone', summary: 'x' }), FeedValidationError);
  assert.throws(() => normalizeFeedEvent({ eventType: 'milestone', subjectLogin: 'a' }), FeedValidationError);
});

test('normalizeFeedEvent marks events from non-public developers as private', () => {
  const publicEvent = event({ isPublicDeveloper: true });
  const privateEvent = event({ isPublicDeveloper: false });
  assert.equal(publicEvent.visibility, 'public');
  assert.equal(privateEvent.visibility, 'private');
});

// --- Authorization / privacy -------------------------------------------------

test('personalized feed only includes events matching an explicit follow', () => {
  const e1 = event({ subjectLogin: 'torvalds' });
  const e2 = event({ subjectLogin: 'gaearon', id: 'other' });
  const wl = watchlist({ follows: { developers: ['torvalds'] } });

  const result = buildPersonalizedFeed([e1, e2], { watchlist: wl, limit: 10 });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].subjectLogin, 'torvalds');
});

test('matchesWatchlist matches on developer, project, language, or country independently', () => {
  const base = { subjectLogin: 'torvalds', project: 'linux', language: 'C', country: 'USA' };
  assert.equal(matchesWatchlist(base, watchlist({ follows: { developers: ['torvalds'] } })), true);
  assert.equal(matchesWatchlist(base, watchlist({ follows: { projects: ['linux'] } })), true);
  assert.equal(matchesWatchlist(base, watchlist({ follows: { languages: ['C'] } })), true);
  assert.equal(matchesWatchlist(base, watchlist({ follows: { countries: ['USA'] } })), true);
  assert.equal(matchesWatchlist(base, watchlist()), false);
});

test('private-visibility events never reach any feed, even for a follower', () => {
  const privateEvent = event({ isPublicDeveloper: false });
  const wl = watchlist({ follows: { developers: ['torvalds'] } });
  const result = buildPersonalizedFeed([privateEvent], { watchlist: wl, limit: 10 });
  assert.equal(result.events.length, 0);
});

test('muted developer and muted event type are excluded from the feed', () => {
  const e1 = event({ subjectLogin: 'torvalds' });
  const wlMutedDeveloper = watchlist({
    follows: { developers: ['torvalds'] },
    mutes: { entities: [{ type: 'developer', value: 'torvalds' }] },
  });
  const wlMutedType = watchlist({
    follows: { developers: ['torvalds'] },
    mutes: { eventTypes: ['rank_movement'] },
  });

  assert.equal(isMuted(e1, wlMutedDeveloper), true);
  assert.equal(isMuted(e1, wlMutedType), true);
  assert.equal(buildPersonalizedFeed([e1], { watchlist: wlMutedDeveloper, limit: 10 }).events.length, 0);
  assert.equal(buildPersonalizedFeed([e1], { watchlist: wlMutedType, limit: 10 }).events.length, 0);
});

// --- Ordering -----------------------------------------------------------------

test('events sort newest first, tie-broken by id', () => {
  const older = event({ createdAt: '2026-08-12T09:00:00Z', id: 'a', refreshCycle: '2026-08-12' });
  const newer = event({ createdAt: '2026-08-13T09:00:00Z', id: 'b', refreshCycle: '2026-08-13' });
  const sameTimeA = event({ createdAt: '2026-08-13T09:00:00Z', id: 'x', refreshCycle: '2026-08-13' });
  const sameTimeB = event({ createdAt: '2026-08-13T09:00:00Z', id: 'y', refreshCycle: '2026-08-13' });

  const sorted = sortEventsNewestFirst([older, newer]);
  assert.deepEqual(sorted.map(e => e.id), ['b', 'a']);

  const tieSorted = sortEventsNewestFirst([sameTimeA, sameTimeB]);
  assert.deepEqual(tieSorted.map(e => e.id), ['y', 'x']);
});

// --- Deduplication / grouping ---------------------------------------------

test('repeated events from the same developer, type, and refresh cycle are grouped with a count', () => {
  const e1 = event({ id: 'a', summary: 'Moved up 1 spot' });
  const e2 = event({ id: 'b', summary: 'Moved up 2 spots' });
  const e3 = event({ id: 'c', summary: 'Moved up 3 spots' });

  const grouped = groupEvents([e3, e2, e1]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].count, 3);
  assert.equal(grouped[0].summary, 'Moved up 3 spots');
  assert.deepEqual(grouped[0].groupedIds, ['c', 'b', 'a']);
});

test('different event types from the same developer are never merged', () => {
  const rank = event({ id: 'a', eventType: 'rank_movement' });
  const milestone = event({ id: 'b', eventType: 'milestone' });
  const grouped = groupEvents([rank, milestone]);
  assert.equal(grouped.length, 2);
});

test('a different refresh cycle starts a new group', () => {
  const day1 = event({ id: 'a', refreshCycle: '2026-08-12' });
  const day2 = event({ id: 'b', refreshCycle: '2026-08-13' });
  const grouped = groupEvents([day2, day1]);
  assert.equal(grouped.length, 2);
});

// --- Filtering ------------------------------------------------------------

test('filterEvents applies developer/project/language/country/eventType filters', () => {
  const e1 = event({ subjectLogin: 'torvalds', language: 'C' });
  const e2 = event({ subjectLogin: 'gaearon', language: 'JavaScript', id: 'other' });
  assert.deepEqual(filterEvents([e1, e2], { languages: ['JavaScript'] }).map(e => e.subjectLogin), ['gaearon']);
  assert.deepEqual(filterEvents([e1, e2], { developers: ['torvalds'] }).map(e => e.subjectLogin), ['torvalds']);
});

// --- Read state -------------------------------------------------------------

test('isRead honors both explicit readIds and the readThrough cursor', () => {
  const e1 = event({ id: 'a', createdAt: '2026-08-10T00:00:00Z', refreshCycle: '2026-08-10' });
  const e2 = event({ id: 'b', createdAt: '2026-08-13T00:00:00Z', refreshCycle: '2026-08-13' });

  const readState = { readThrough: { createdAt: '2026-08-11T00:00:00Z', id: 'zzz' }, readIds: ['b'] };
  assert.equal(isRead(e1, readState), true); // covered by readThrough
  assert.equal(isRead(e2, readState), true); // explicitly marked read
});

test('unreadOnly excludes read events from the page', () => {
  const e1 = event({ id: 'a', createdAt: '2026-08-13T09:00:00Z', refreshCycle: 'a' });
  const e2 = event({ id: 'b', createdAt: '2026-08-13T10:00:00Z', refreshCycle: 'b' });
  const wl = watchlist({
    follows: { developers: ['torvalds'] },
    readState: { readIds: ['a'] },
  });

  const result = buildPersonalizedFeed([e1, e2], { watchlist: wl, limit: 10, unreadOnly: true });
  assert.deepEqual(result.events.map(e => e.id), ['b']);
  assert.equal(result.unreadCount, 1);
});

// --- Pagination -------------------------------------------------------------

test('cursor pagination returns the next page in stable order with no overlap', () => {
  const events = Array.from({ length: 5 }, (_, i) => event({
    id: `e${i}`,
    createdAt: `2026-08-${10 + i}T00:00:00Z`,
    refreshCycle: `2026-08-${10 + i}`,
  }));
  const wl = watchlist({ follows: { developers: ['torvalds'] } });

  const page1 = buildPersonalizedFeed(events, { watchlist: wl, limit: 2 });
  assert.deepEqual(page1.events.map(e => e.id), ['e4', 'e3']);
  assert.ok(page1.nextCursor);

  const cursor = decodeFeedCursor(page1.nextCursor);
  const page2 = buildPersonalizedFeed(events, { watchlist: wl, limit: 2, cursor });
  assert.deepEqual(page2.events.map(e => e.id), ['e2', 'e1']);

  const cursor2 = decodeFeedCursor(page2.nextCursor);
  const page3 = buildPersonalizedFeed(events, { watchlist: wl, limit: 2, cursor: cursor2 });
  assert.deepEqual(page3.events.map(e => e.id), ['e0']);
  assert.equal(page3.nextCursor, null);
});

test('feed cursor round-trips through encode/decode and rejects garbage', () => {
  const e = event({ id: 'a' });
  assert.deepEqual(decodeFeedCursor(encodeFeedCursor(e)), { createdAt: e.createdAt, id: 'a' });
  assert.equal(decodeFeedCursor('not-a-cursor'), null);
  assert.equal(decodeFeedCursor(null), null);
});
