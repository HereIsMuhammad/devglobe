import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfileCompletion } from '../lib/profile-completion.js';

test('keeps every owner step incomplete before a profile is claimed', () => {
  const result = calculateProfileCompletion({
    developer: {
      metricsUpdatedAt: '2026-08-21T00:00:00.000Z',
      topRepos: [{ name: 'devglobe' }],
      aiProfile: { tools: [{ id: 'copilot' }] },
    },
    cardGenerated: true,
  });

  assert.equal(result.completed, 0);
  assert.equal(result.percent, 0);
  assert.ok(result.steps.every(step => step.complete === false));
});

test('recalculates server-derived steps when a claim transition completes', () => {
  const developer = {
    claimed: true,
    metricsUpdatedAt: '2026-08-21T00:00:00.000Z',
    topRepos: [{ name: 'devglobe' }],
    aiProfile: {
      tools: [{ id: 'copilot', usage: 'regular' }],
      opportunityPreferences: { enabled: true },
    },
  };
  const result = calculateProfileCompletion({ developer, cardGenerated: false });

  assert.equal(result.completed, 4);
  assert.equal(result.percent, 80);
  assert.equal(result.steps.find(step => step.id === 'card').complete, false);
});

test('marks the checklist complete only after recorded card generation', () => {
  const developer = {
    claimed: true,
    metricsUpdatedAt: '2026-08-21T00:00:00.000Z',
    topRepos: [{ name: 'devglobe' }],
    aiProfile: { acceptsAgentRequests: true },
  };

  const result = calculateProfileCompletion({ developer, cardGenerated: true });

  assert.equal(result.completed, result.total);
  assert.equal(result.percent, 100);
  assert.equal(result.complete, true);
});