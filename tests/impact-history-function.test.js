import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const impactHistory = require('../functions/impact-history/index.js');

test('Azure timer invokes the protected impact-history endpoint and logs progress', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://example.test/api/cron/impact-history');
    assert.equal(options.headers.Authorization, 'Bearer cron-secret');
    return new Response(JSON.stringify({
      day: '2026-08-16', snapshots: 500, movements: 2,
      processed: 2000, remaining: 24675, complete: false,
    }));
  });
  t.mock.method(console, 'error', () => {});
  process.env.IMPACT_HISTORY_URL = 'https://example.test/api/cron/impact-history';
  process.env.CRON_SECRET = 'cron-secret';
  const entries = [];

  await impactHistory({ log: (...args) => entries.push(args) });

  assert.equal(entries[0][0], 'DevGlobe impact history capture');
  assert.equal(entries[0][1].processed, 2000);
});

test('Azure timer rejects non-success responses', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ error: 'Impact history capture failed' }),
    { status: 500 },
  ));
  process.env.IMPACT_HISTORY_URL = 'https://example.test/api/cron/impact-history';
  process.env.CRON_SECRET = 'cron-secret';

  await assert.rejects(
    impactHistory({ log: () => {} }),
    /Impact history capture returned 500/,
  );
});