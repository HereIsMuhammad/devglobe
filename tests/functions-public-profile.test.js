import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { publicAiProfile } = require('../functions/shared/cosmos.js');

function profile(expiresAt) {
  return {
    tools: [],
    acceptsAgentRequests: true,
    visibility: 'public',
    contactPolicy: 'verified-agents',
    updatedAt: '2026-08-20T12:00:00.000Z',
    opportunityPreferences: {
      enabled: true,
      types: ['employment'],
      roles: ['Staff engineer'],
      locations: ['Colombo'],
      workModes: ['remote'],
      expiresAt,
    },
  };
}

test('Functions public projection includes only active opportunity preferences', () => {
  const active = publicAiProfile(profile('2099-09-19T12:00:00.000Z'));
  const expired = publicAiProfile(profile('2020-08-19T12:00:00.000Z'));
  const unreachable = publicAiProfile({
    ...profile('2099-09-19T12:00:00.000Z'),
    acceptsAgentRequests: false,
    contactPolicy: 'nobody',
  });

  assert.equal(active.opportunityPreferences.source, 'self-declared');
  assert.equal(expired.opportunityPreferences, undefined);
  assert.equal(unreachable.opportunityPreferences, undefined);
});