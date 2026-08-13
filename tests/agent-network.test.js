import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentNetworkSnapshot,
  getIntroductionLifecycle,
} from '../lib/agent-network.js';

function developer(login, country, tools = ['github-copilot']) {
  return {
    login,
    claimed: true,
    location: `City, ${country}`,
    aiProfile: {
      tools: tools.map(id => ({ id, usage: 'daily', source: 'self-declared' })),
      acceptsAgentRequests: true,
      visibility: 'public',
      contactPolicy: 'verified-agents',
      updatedAt: '2026-08-13T12:00:00.000Z',
    },
  };
}

test('projects reportable aggregate Agent Network metrics', () => {
  const snapshot = buildAgentNetworkSnapshot({
    developers: [
      developer('one', 'USA'),
      developer('two', 'Canada'),
      developer('three', 'France'),
    ],
    introductionCounts: { pending: 4, accepted: 3 },
  });

  assert.deepEqual(snapshot.metrics.openDevelopers, { value: 3, suppressed: false });
  assert.deepEqual(snapshot.metrics.countries, { value: 3, suppressed: false });
  assert.deepEqual(snapshot.tools, [{ id: 'github-copilot', name: 'GitHub Copilot', count: 3 }]);
});

test('suppresses small cohorts and excludes private or unclaimed profiles', () => {
  const privateDeveloper = developer('private', 'USA');
  privateDeveloper.aiProfile.visibility = 'private';
  const unclaimedDeveloper = developer('unclaimed', 'Canada');
  unclaimedDeveloper.claimed = false;

  const snapshot = buildAgentNetworkSnapshot({
    developers: [developer('one', 'USA'), privateDeveloper, unclaimedDeveloper],
    introductionCounts: { pending: 2, accepted: 1 },
  });

  assert.deepEqual(snapshot.metrics.openDevelopers, { value: null, suppressed: true });
  assert.deepEqual(snapshot.metrics.pendingRequests, { value: null, suppressed: true });
  assert.deepEqual(snapshot.tools, []);
});

test('derives pending, accepted, and expired lifecycle stages', () => {
  const now = new Date('2026-08-13T12:00:00.000Z');
  assert.deepEqual(getIntroductionLifecycle('pending', '2026-08-20T12:00:00.000Z', now).map(stage => stage.state), ['complete', 'current', 'upcoming']);
  assert.equal(getIntroductionLifecycle('accepted', '2026-08-20T12:00:00.000Z', now)[2].label, 'Accepted');
  assert.equal(getIntroductionLifecycle('pending', '2026-08-12T12:00:00.000Z', now)[2].label, 'Expired');
});
