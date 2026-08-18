import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PAGE_LIMIT, parsePaginationParams } from '../lib/pagination.js';

function params(obj) {
  return new URLSearchParams(obj);
}

test('parsePaginationParams returns null when no limit is given (legacy, unpaginated request)', () => {
  assert.equal(parsePaginationParams(params({})), null);
  assert.equal(parsePaginationParams(params({ offset: '50' })), null);
});

test('parsePaginationParams returns the requested limit and offset', () => {
  assert.deepEqual(parsePaginationParams(params({ limit: '500', offset: '100' })), { limit: 500, offset: 100 });
});

test('parsePaginationParams defaults offset to 0 when omitted', () => {
  assert.deepEqual(parsePaginationParams(params({ limit: '500' })), { limit: 500, offset: 0 });
});

test('parsePaginationParams clamps limit to at least 1', () => {
  assert.equal(parsePaginationParams(params({ limit: '0' })).limit, 1);
  assert.equal(parsePaginationParams(params({ limit: '-50' })).limit, 1);
});

test('parsePaginationParams clamps limit to the configured maximum', () => {
  assert.equal(parsePaginationParams(params({ limit: '999999' })).limit, MAX_PAGE_LIMIT);
  assert.equal(parsePaginationParams(params({ limit: '5000' }), { maxLimit: 200 }).limit, 200);
});

test('parsePaginationParams ignores a non-numeric limit gracefully (clamped to 1)', () => {
  assert.equal(parsePaginationParams(params({ limit: 'not-a-number' })).limit, 1);
});

test('parsePaginationParams clamps a negative offset to 0', () => {
  assert.equal(parsePaginationParams(params({ limit: '500', offset: '-10' })).offset, 0);
});

test('parsePaginationParams ignores a non-numeric offset (defaults to 0)', () => {
  assert.equal(parsePaginationParams(params({ limit: '500', offset: 'nope' })).offset, 0);
});
