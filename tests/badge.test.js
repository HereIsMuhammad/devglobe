import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBadgeSvg, resolveBadgeStat } from '../lib/badge.js';

function developer(overrides = {}) {
  return {
    login: 'torvalds',
    score: 91.4,
    globalRank: 4,
    globalTotal: 26000,
    country: 'USA',
    countryRank: 2,
    countryTotal: 5000,
    city: 'Portland',
    cityRank: 1,
    cityTotal: 40,
    totalStars: 182000,
    claimed: true,
    ...overrides,
  };
}

test('resolveBadgeStat returns unranked when the developer does not exist', () => {
  const result = resolveBadgeStat(null, 'globalRank');
  assert.equal(result.unranked, true);
  assert.equal(result.value, 'unranked');
});

test('resolveBadgeStat defaults to globalRank for an unknown or missing stat param', () => {
  const dev = developer();
  assert.equal(resolveBadgeStat(dev, undefined).stat, 'globalRank');
  assert.equal(resolveBadgeStat(dev, 'not-a-real-stat').stat, 'globalRank');
});

test('resolveBadgeStat formats each supported stat', () => {
  const dev = developer();
  assert.equal(resolveBadgeStat(dev, 'globalRank').value, 'Global #4');
  assert.equal(resolveBadgeStat(dev, 'countryRank').value, 'USA #2');
  assert.equal(resolveBadgeStat(dev, 'cityRank').value, 'Portland #1');
  assert.equal(resolveBadgeStat(dev, 'score').value, '91/100');
  assert.equal(resolveBadgeStat(dev, 'stars').value, '182.0K stars');
});

test('resolveBadgeStat degrades to unranked when a stat is missing on the developer', () => {
  const devWithoutCountry = developer({ countryRank: null, countryTotal: null, country: null });
  const result = resolveBadgeStat(devWithoutCountry, 'countryRank');
  assert.equal(result.unranked, true);
  assert.equal(result.value, 'unranked');
});

test('renderBadgeSvg produces valid SVG containing the label and value text', () => {
  const svg = renderBadgeSvg({ value: 'Global #4' });
  assert.match(svg, /^<svg/);
  assert.match(svg, /Devglobe rank/);
  assert.match(svg, /Global #4/);
  assert.match(svg, /<\/svg>$/);
});

test('renderBadgeSvg escapes XML-sensitive characters in the value', () => {
  const svg = renderBadgeSvg({ value: '<script>&"' });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

test('renderBadgeSvg widens automatically for longer values', () => {
  const shortSvg = renderBadgeSvg({ value: '#4' });
  const longSvg = renderBadgeSvg({ value: 'Global #123456' });
  const widthOf = svg => Number(svg.match(/width="(\d+)"/)[1]);
  assert.ok(widthOf(longSvg) > widthOf(shortSvg));
});
