import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DEVELOPER_FOLLOWS,
  normalizeDeveloperFollow,
  updateDeveloperFollows,
} from '../lib/watchlist-store.js';

test('normalizes developer follows and removes duplicate casing', () => {
  assert.equal(normalizeDeveloperFollow(' @OctoCat '), 'octocat');
  assert.deepEqual(updateDeveloperFollows(['OctoCat'], '@octocat', { ownerLogin: 'viewer' }), ['octocat']);
});

test('rejects invalid and self follows', () => {
  assert.throws(() => normalizeDeveloperFollow('invalid--login'), /Invalid GitHub login/);
  assert.throws(
    () => updateDeveloperFollows([], 'Viewer', { ownerLogin: 'viewer' }),
    /own profile/,
  );
});

test('removes follows and enforces the developer follow limit', () => {
  assert.deepEqual(updateDeveloperFollows(['octocat'], 'OCTOCAT', { remove: true }), []);
  const follows = Array.from({ length: MAX_DEVELOPER_FOLLOWS }, (_, index) => `dev-${index}`);
  assert.throws(() => updateDeveloperFollows(follows, 'one-more'), /follow limit/);
});