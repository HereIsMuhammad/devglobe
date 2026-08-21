import test from 'node:test';
import assert from 'node:assert/strict';
import { withNumericScore } from '../lib/developer-score.js';

test('preserves a numeric developer score', () => {
  const developer = { login: 'scored', score: 72 };

  assert.deepEqual(withNumericScore(developer), developer);
  assert.notEqual(withNumericScore(developer), developer);
});

test('defaults absent or invalid developer scores to zero', () => {
  for (const score of [undefined, null, '72', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(withNumericScore({ login: 'unscored', score }).score, 0);
  }
});