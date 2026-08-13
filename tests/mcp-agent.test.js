import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentRequestValidationError,
  authenticateAgent,
  createIntroductionDocument,
  hashAgentToken,
  normalizeIntroductionDecision,
  normalizeIntroductionRequest,
  parseAgentKeys,
} from '../lib/agent-introductions.js';
import { createDevGlobeMcpClient } from '../lib/devglobe-mcp-client.js';

test('authenticates configured agents without exposing token hashes', () => {
  const keys = parseAgentKeys(JSON.stringify([{
    id: 'agent-1',
    name: 'Build Agent',
    owner: 'Example Org',
    tokenHash: hashAgentToken('secret-token'),
  }]));

  assert.deepEqual(authenticateAgent('Bearer secret-token', keys), {
    id: 'agent-1',
    name: 'Build Agent',
    owner: 'Example Org',
  });
  assert.equal(authenticateAgent('Bearer wrong-token', keys), null);
});

test('validates and creates expiring pending introduction requests', () => {
  const input = normalizeIntroductionRequest({
    developerLogin: 'octocat',
    reason: 'We need help maintaining our React component library.',
    project: 'UI Platform',
  });
  const document = createIntroductionDocument(input, {
    id: 'agent-1', name: 'Build Agent', owner: 'Example Org',
  }, new Date('2026-08-13T12:00:00.000Z'));

  assert.equal(document.status, 'pending');
  assert.equal(document.developerLogin, 'octocat');
  assert.equal(document.expiresAt, '2026-08-27T12:00:00.000Z');
  assert.equal('tokenHash' in document.requesterAgent, false);
});

test('rejects invalid introduction content', () => {
  assert.throws(() => normalizeIntroductionRequest({
    developerLogin: 'invalid login', reason: 'too short', project: 'x',
  }), AgentRequestValidationError);
});

test('accepts only terminal developer decisions with UUID request ids', () => {
  assert.deepEqual(normalizeIntroductionDecision({
    id: 'e6fa6dc6-64df-48c4-8597-c70bfe089bec',
    status: 'accepted',
  }), {
    id: 'e6fa6dc6-64df-48c4-8597-c70bfe089bec',
    status: 'accepted',
  });
  assert.throws(() => normalizeIntroductionDecision({ id: 'bad', status: 'pending' }), AgentRequestValidationError);
});

test('MCP client filters hydrated public profiles by agent availability', async () => {
  const responses = new Map([
    ['/api/search', { results: [{ login: 'open-dev' }, { login: 'closed-dev' }] }],
    ['/api/developer?id=open-dev', { login: 'open-dev', aiProfile: { acceptsAgentRequests: true } }],
    ['/api/developer?id=closed-dev', { login: 'closed-dev' }],
  ]);
  const fetchImpl = async url => {
    const parsed = new URL(url);
    const key = parsed.pathname === '/api/search' ? parsed.pathname : `${parsed.pathname}?${parsed.searchParams}`;
    return new Response(JSON.stringify(responses.get(key)), { status: 200 });
  };
  const client = createDevGlobeMcpClient({ baseUrl: 'http://localhost:3000', fetchImpl });

  const results = await client.searchDevelopers({ query: 'React', availableForAgents: true, limit: 10 });
  assert.deepEqual(results.map(result => result.login), ['open-dev']);
});

test('MCP client requires an issued token for introductions', async () => {
  const client = createDevGlobeMcpClient({ baseUrl: 'https://devglobe.dev', fetchImpl: () => {} });
  await assert.rejects(() => client.requestIntroduction({}), /DEVGLOBE_AGENT_TOKEN/);
});

test('MCP client authenticates introduction status requests', async () => {
  let receivedAuthorization;
  const client = createDevGlobeMcpClient({
    baseUrl: 'https://devglobe.dev',
    agentToken: 'issued-token',
    fetchImpl: async (url, options) => {
      receivedAuthorization = options.headers.Authorization;
      return new Response(JSON.stringify({ request: { status: 'pending' } }), { status: 200 });
    },
  });

  const result = await client.getIntroductionStatus({
    id: 'e6fa6dc6-64df-48c4-8597-c70bfe089bec',
    developerLogin: 'octocat',
  });
  assert.equal(receivedAuthorization, 'Bearer issued-token');
  assert.equal(result.request.status, 'pending');
});
