import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDeveloperForDataset } from '../lib/scoring.js';

test('scores a sparse developer against the current dataset', () => {
  const developer = { id: 'new', login: 'new', followers: 10 };
  const peers = [
    { id: 'top', login: 'top', followers: 1000, totalStars: 500 },
    { id: 'new', login: 'new', followers: 1 },
  ];

  const scored = scoreDeveloperForDataset(developer, peers);

  assert.equal(Number.isFinite(scored.score), true);
  assert.equal(Number.isFinite(scored.scorePercentile), true);
  assert.equal(scored.scoreHasSO, false);
  assert.equal(scored.id, 'new');
});