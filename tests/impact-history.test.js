import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLanguageRanks,
  buildImpactHistory,
  canViewImpactHistory,
  createImpactSnapshot,
  createRankMovementEvent,
} from '../lib/impact-history.js';
import { captureImpactHistory } from '../lib/impact-history-capture.js';

test('creates compact dated snapshots with global, country, and language ranks', () => {
  const ranked = addLanguageRanks([
    { login: 'a', topLanguage: 'JavaScript' },
    { login: 'b', topLanguage: 'JavaScript' },
    { login: 'c', topLanguage: 'Go' },
  ]);
  const snapshot = createImpactSnapshot({
    ...ranked[1], score: 80, globalRank: 2, globalTotal: 3, country: 'US', countryRank: 1,
    totalStars: 10, followers: 4, totalCommits: 20, privateField: 'omitted',
  }, '2026-08-16T12:00:00.000Z');

  assert.equal(snapshot.id, 'b:2026-08-16');
  assert.equal(snapshot.languageRank, 2);
  assert.equal(snapshot.languageTotal, 2);
  assert.equal('privateField' in snapshot, false);
});

test('calculates 7/30/90-day changes from sparse history honestly', () => {
  const history = [
    { capturedAt: '2026-07-15T00:00:00.000Z', score: 70, totalStars: 5, followers: 2, totalCommits: 10, globalRank: 8, countryRank: 3, languageRank: 4, country: 'US', language: 'Go' },
    { capturedAt: '2026-08-01T00:00:00.000Z', score: 75, totalStars: 8, followers: 3, totalCommits: 15, globalRank: 6, countryRank: 2, languageRank: 3, country: 'US', language: 'Go' },
    { capturedAt: '2026-08-16T00:00:00.000Z', score: 80, totalStars: 12, followers: 5, totalCommits: 24, globalRank: 4, countryRank: 1, languageRank: 2, country: 'US', language: 'Go' },
  ];
  const result = buildImpactHistory(history, new Date('2026-08-16T12:00:00.000Z'));

  assert.equal(result.periods[7].available, true);
  assert.equal(result.periods[7].metrics.score, 5);
  assert.equal(result.periods[7].ranks.globalRank, 2);
  assert.equal(result.periods[30].metrics.totalStars, 7);
  assert.equal(result.periods[90].available, false);
});

test('creates one rank movement feed event and skips unchanged ranks', () => {
  const current = { login: 'octocat', day: '2026-08-16', capturedAt: '2026-08-16T00:00:00.000Z', globalRank: 3, country: 'US', language: 'Go' };
  assert.match(createRankMovementEvent(current, { globalRank: 5 }).summary, /Moved up 2 places/);
  assert.equal(createRankMovementEvent(current, { globalRank: 3 }), null);
});

test('private impact history is visible only to the claimed profile owner', () => {
  const developer = { login: 'OctoCat', claimed: true, impactHistoryVisibility: 'private' };
  assert.equal(canViewImpactHistory(developer, null), false);
  assert.equal(canViewImpactHistory(developer, 'another-user'), false);
  assert.equal(canViewImpactHistory(developer, 'octocat'), true);
  assert.equal(canViewImpactHistory({ ...developer, impactHistoryVisibility: 'public' }, null), true);
});

test('capture stores ranked snapshots and publishes privacy-aware movement events', async () => {
  const snapshots = [];
  const events = [];
  const summary = await captureImpactHistory({
    now: new Date('2026-08-16T14:00:00.000Z'),
    developers: [
      { login: 'a', topLanguage: 'Go', totalStars: 20, totalCommits: 20, followers: 5 },
      { login: 'b', topLanguage: 'Go', totalStars: 10, totalCommits: 10, followers: 2, impactHistoryVisibility: 'private' },
    ],
    getPrevious: async login => ({ login, globalRank: login === 'a' ? 2 : 1 }),
    saveSnapshot: async snapshot => snapshots.push(snapshot),
    saveEvents: async (items, options) => {
      events.push({ event: items[0], options });
      return { inserted: 1 };
    },
  });

  assert.deepEqual(summary, { developers: 2, snapshots: 2, movements: 2, day: '2026-08-16' });
  assert.equal(snapshots[0].globalRank, 1);
  assert.equal(snapshots[0].languageRank, 1);
  assert.equal(events[0].options.isPublicDeveloper, true);
  assert.equal(events[1].options.isPublicDeveloper, false);
});

test('capture bounds concurrent snapshot operations', async () => {
  let active = 0;
  let peak = 0;
  const developers = Array.from({ length: 12 }, (_, index) => ({
    login: `developer-${index}`,
    totalStars: index,
  }));

  await captureImpactHistory({
    developers,
    concurrency: 3,
    getPrevious: async () => null,
    saveSnapshot: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
    },
  });

  assert.equal(peak, 3);
});

test('capture uses the latest completed day for previous snapshots', async () => {
  let previousDayLoads = 0;
  const snapshots = [];

  await captureImpactHistory({
    now: new Date('2026-08-17T14:00:00.000Z'),
    developers: [{ login: 'a' }, { login: 'b' }],
    getPreviousDay: async day => {
      previousDayLoads += 1;
      assert.equal(day, '2026-08-17');
      return '2026-08-16';
    },
    getPreviousForDay: async login => ({ login, globalRank: login === 'a' ? 2 : 1 }),
    saveSnapshot: async snapshot => snapshots.push(snapshot),
    saveEvents: async () => ({ inserted: 1 }),
  });

  assert.equal(previousDayLoads, 1);
  assert.equal(snapshots.length, 2);
});

test('managed capture resumes from persisted progress', async () => {
  const savedProgress = [];
  const snapshots = [];
  const developers = Array.from({ length: 5 }, (_, index) => ({ login: `dev-${index}` }));

  const summary = await captureImpactHistory({
    loadDevelopers: async () => developers,
    batchSize: 2,
    getProgress: async () => ({ nextIndex: 2, previousDay: null }),
    saveProgress: async progress => savedProgress.push(progress),
    getPreviousDay: async () => null,
    getPreviousForDay: async () => null,
    saveSnapshot: async snapshot => snapshots.push(snapshot),
  });

  assert.equal(summary.snapshots, 2);
  assert.equal(summary.processed, 4);
  assert.equal(summary.remaining, 1);
  assert.equal(summary.complete, false);
  assert.equal(savedProgress[0].nextIndex, 4);
});