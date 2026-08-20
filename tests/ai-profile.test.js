import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AiProfileValidationError,
  getActiveOpportunityPreferences,
  getPublicAiProfile,
  getPublicAiToolNames,
  normalizeAiProfile,
} from '../lib/ai-profile.js';

const timestamp = '2026-08-13T12:00:00.000Z';

test('normalizes self-declared tools and removes duplicates', () => {
  const profile = normalizeAiProfile({
    tools: [
      { id: 'github-copilot', usage: 'regular' },
      { id: 'github-copilot', usage: 'daily' },
    ],
    acceptsAgentRequests: true,
    visibility: 'public',
    contactPolicy: 'verified-agents',
  }, timestamp);

  assert.deepEqual(profile, {
    tools: [{ id: 'github-copilot', usage: 'daily', source: 'self-declared' }],
    acceptsAgentRequests: true,
    visibility: 'public',
    contactPolicy: 'verified-agents',
    updatedAt: timestamp,
  });
});

test('forces contact policy to nobody when requests are disabled', () => {
  const profile = normalizeAiProfile({
    tools: [],
    acceptsAgentRequests: false,
    visibility: 'private',
    contactPolicy: 'verified-agents',
  }, timestamp);

  assert.equal(profile.contactPolicy, 'nobody');
});

test('rejects unsupported tools and enum values', () => {
  assert.throws(() => normalizeAiProfile({
    tools: [{ id: 'unknown-agent', usage: 'daily' }],
    acceptsAgentRequests: false,
    visibility: 'public',
    contactPolicy: 'nobody',
  }), AiProfileValidationError);

  assert.throws(() => normalizeAiProfile({
    tools: [],
    acceptsAgentRequests: true,
    visibility: 'public',
    contactPolicy: 'nobody',
  }), /Choose a contact policy/);
});

test('projects only valid public AI profiles', () => {
  const profile = {
    tools: [{ id: 'claude-code', usage: 'experimenting', source: 'self-declared' }],
    acceptsAgentRequests: false,
    visibility: 'public',
    contactPolicy: 'nobody',
    updatedAt: timestamp,
  };

  assert.deepEqual(getPublicAiProfile(profile), profile);
  assert.equal(getPublicAiProfile({ ...profile, visibility: 'private' }), null);
  assert.equal(getPublicAiProfile({ ...profile, tools: [{ id: 'invalid', usage: 'daily' }] }), null);
});

test('projects tool names only from public AI profiles', () => {
  const profile = {
    tools: [
      { id: 'github-copilot', usage: 'daily', source: 'self-declared' },
      { id: 'claude-code', usage: 'regular', source: 'self-declared' },
    ],
    acceptsAgentRequests: false,
    visibility: 'public',
    contactPolicy: 'nobody',
    updatedAt: timestamp,
  };

  assert.deepEqual(getPublicAiToolNames(profile), ['GitHub Copilot', 'Claude Code']);
  assert.deepEqual(getPublicAiToolNames({ ...profile, visibility: 'private' }), []);
});

test('normalizes self-declared opportunity preferences', () => {
  const profile = normalizeAiProfile({
    tools: [],
    acceptsAgentRequests: true,
    visibility: 'public',
    contactPolicy: 'verified-agents',
    opportunityPreferences: {
      enabled: true,
      types: ['employment', 'contract', 'employment'],
      roles: [' Staff Engineer ', 'staff engineer'],
      locations: ['Colombo', 'Remote'],
      workModes: ['remote', 'hybrid', 'remote'],
      expiresAt: '2026-09-12T12:00:00.000Z',
    },
  }, timestamp);

  assert.deepEqual(profile.opportunityPreferences, {
    enabled: true,
    types: ['employment', 'contract'],
    roles: ['staff engineer'],
    locations: ['Colombo', 'Remote'],
    workModes: ['remote', 'hybrid'],
    expiresAt: '2026-09-12T12:00:00.000Z',
    source: 'self-declared',
  });
});

test('rejects invalid or long-lived opportunity preferences', () => {
  const base = {
    tools: [],
    acceptsAgentRequests: true,
    visibility: 'public',
    contactPolicy: 'verified-agents',
  };

  assert.throws(() => normalizeAiProfile({
    ...base,
    opportunityPreferences: {
      enabled: true,
      types: [],
      roles: [],
      locations: [],
      workModes: ['remote'],
      expiresAt: '2026-09-12T12:00:00.000Z',
    },
  }, timestamp), /opportunity type/);

  assert.throws(() => normalizeAiProfile({
    ...base,
    opportunityPreferences: {
      enabled: true,
      types: ['employment'],
      roles: [],
      locations: [],
      workModes: ['remote'],
      expiresAt: '2027-01-01T12:00:00.000Z',
    },
  }, timestamp), /within the next 90 days/);

  assert.throws(() => normalizeAiProfile({
    ...base,
    acceptsAgentRequests: false,
    contactPolicy: 'nobody',
    opportunityPreferences: {
      enabled: true,
      types: ['employment'],
      roles: [],
      locations: [],
      workModes: ['remote'],
      expiresAt: '2026-09-12T12:00:00.000Z',
    },
  }, timestamp), /public profile and verified agent requests/);
});

test('public opportunity preferences disappear after expiry', () => {
  const profile = normalizeAiProfile({
    tools: [],
    acceptsAgentRequests: true,
    visibility: 'public',
    contactPolicy: 'verified-agents',
    opportunityPreferences: {
      enabled: true,
      types: ['open-source'],
      roles: ['Maintainer'],
      locations: [],
      workModes: ['remote'],
      expiresAt: '2026-08-20T12:00:00.000Z',
    },
  }, '2026-08-13T12:00:00.000Z');

  assert.ok(getActiveOpportunityPreferences(profile, new Date('2026-08-19T12:00:00.000Z')));
  assert.equal(getActiveOpportunityPreferences(profile, new Date('2026-08-21T12:00:00.000Z')), null);
  assert.ok(getPublicAiProfile(profile, new Date('2026-08-19T12:00:00.000Z')).opportunityPreferences);
  assert.equal(getPublicAiProfile(profile, new Date('2026-08-21T12:00:00.000Z')).opportunityPreferences, undefined);
});
