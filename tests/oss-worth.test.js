import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOssWorth,
  compareOssWorth,
  OSS_CREDITS_PER_DOLLAR,
  OSS_WORTH_FORMULA_VERSION,
} from '../lib/oss-worth.js';

test('zero inputs produce zero credits with unavailable Stack Overflow', () => {
  const worth = calculateOssWorth({});

  assert.equal(worth.formulaVersion, OSS_WORTH_FORMULA_VERSION);
  assert.equal(worth.totalCredits, 0);
  assert.equal(worth.totalDollarValue, 0);
  assert.equal(worth.github.available, true);
  assert.equal(worth.stackoverflow.available, false);
});

test('GitHub uses the GitEstimate direct-value formula', () => {
  const worth = calculateOssWorth({
    totalCommits: 1_000,
    followers: 200,
    totalStars: 300,
  });

  assert.equal(worth.github.dollarValue, 610);
  assert.equal(worth.github.credits, 6_100);
  assert.equal(worth.totalDollarValue, 610);
});

test('Stack Overflow is valued separately and added to the total', () => {
  const worth = calculateOssWorth({
    totalCommits: 100,
    followers: 20,
    totalStars: 30,
    soUserId: 1,
    soAnswers: 40,
    soReputation: 500,
    soBadges: 10,
  });

  assert.equal(worth.github.dollarValue, 61);
  assert.equal(worth.stackoverflow.dollarValue, 73);
  assert.equal(worth.totalDollarValue, 134);
  assert.equal(worth.totalCredits, 134 * OSS_CREDITS_PER_DOLLAR);
});

test('a linked all-zero Stack Overflow profile is available with zero credits', () => {
  const worth = calculateOssWorth({ soUserId: 42 });

  assert.equal(worth.stackoverflow.available, true);
  assert.equal(worth.stackoverflow.credits, 0);
});

test('direct values scale linearly and invalid inputs are clamped', () => {
  const baseline = calculateOssWorth({ totalStars: 10, soUserId: 1, soAnswers: 10 });
  const doubled = calculateOssWorth({ totalStars: 20, soUserId: 1, soAnswers: 20 });
  const invalid = calculateOssWorth({ totalStars: -1, totalCommits: Infinity, soUserId: 1, soAnswers: -10, soReputation: NaN });

  assert.equal(doubled.github.credits, baseline.github.credits * 2);
  assert.equal(doubled.stackoverflow.credits, baseline.stackoverflow.credits * 2);
  assert.equal(invalid.github.credits, 0);
  assert.equal(invalid.stackoverflow.credits, 0);
});

test('worth sorting uses score and login as deterministic tie-breakers', () => {
  const developers = [
    { login: 'charlie', score: 20, ossWorth: { totalCredits: 200 } },
    { login: 'bravo', score: 40, ossWorth: { totalCredits: 100 } },
    { login: 'alpha', score: 40, ossWorth: { totalCredits: 100 } },
    { login: 'delta', score: 90, ossWorth: { totalCredits: 300 } },
  ];

  assert.deepEqual(developers.sort(compareOssWorth).map(developer => developer.login), [
    'delta',
    'charlie',
    'alpha',
    'bravo',
  ]);
});