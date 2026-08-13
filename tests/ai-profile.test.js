import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AiProfileValidationError,
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
