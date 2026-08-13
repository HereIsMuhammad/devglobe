import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeActivityCursor, encodeActivityCursor } from '../lib/activity-store.js';
import { describeGitHubEvent, normalizeGitHubEvent } from '../lib/github-activity.js';

test('normalizes a GitHub event into the public activity shape', () => {
  const activity = normalizeGitHubEvent({
    id: 123,
    type: 'PushEvent',
    actor: { login: 'Octocat', avatar_url: 'https://example.test/avatar.png' },
    repo: { name: 'octo/repo' },
    created_at: '2026-08-12T12:00:00Z',
    payload: { size: 2 },
  });

  assert.equal(activity.id, '123');
  assert.equal(activity.login, 'Octocat');
  assert.equal(activity.description, 'Pushed 2 commits to octo/repo');
  assert.equal(activity.createdAt, '2026-08-12T12:00:00.000Z');
});

test('rejects events without an identity or valid timestamp', () => {
  assert.equal(normalizeGitHubEvent({ id: '1', created_at: 'invalid' }), null);
  assert.equal(normalizeGitHubEvent({ id: '1', created_at: '2026-08-12T12:00:00Z' }), null);
});

test('describes unknown GitHub event types safely', () => {
  assert.equal(describeGitHubEvent({ type: 'OtherEvent', repo: { name: 'octo/repo' } }), 'Contributed to octo/repo');
});

test('round trips stable timestamp and id cursors', () => {
  const activity = { id: '123', createdAt: '2026-08-12T12:00:00.000Z' };
  assert.deepEqual(decodeActivityCursor(encodeActivityCursor(activity)), activity);
  assert.equal(decodeActivityCursor('not-a-cursor'), null);
});