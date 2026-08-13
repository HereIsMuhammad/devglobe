import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcpOptions, handleRemoteMcpRequest } from '../lib/remote-mcp.js';

const MCP_HEADERS = {
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json',
  'Mcp-Protocol-Version': '2025-06-18',
};

function mcpRequest(body, headers = {}) {
  return new Request('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { ...MCP_HEADERS, ...headers },
    body: JSON.stringify(body),
  });
}

async function readMcpResponse(response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  return response.json();
}

test('remote MCP initializes and lists DevGlobe tools without a session', async () => {
  const initialization = await readMcpResponse(await handleRemoteMcpRequest(mcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-agent', version: '1.0.0' },
    },
  })));
  assert.equal(initialization.result.serverInfo.name, 'devglobe');

  const listing = await readMcpResponse(await handleRemoteMcpRequest(mcpRequest({
    jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
  })));
  assert.deepEqual(listing.result.tools.map(tool => tool.name), [
    'search_developers',
    'get_developer_profile',
    'request_introduction',
    'get_introduction_status',
  ]);
});

test('remote MCP performs anonymous public developer discovery', async () => {
  const fetchImpl = async url => {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/search') {
      return Response.json({ results: [{ login: 'open-dev' }] });
    }
    return Response.json({
      login: 'open-dev',
      location: 'Colombo, Sri Lanka',
      topLanguage: 'JavaScript',
      aiProfile: { acceptsAgentRequests: true },
    });
  };
  const response = await readMcpResponse(await handleRemoteMcpRequest(mcpRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'search_developers',
      arguments: { query: 'React', availableForAgents: true },
    },
  }), { fetchImpl }));
  const developers = JSON.parse(response.result.content[0].text);
  assert.deepEqual(developers.map(developer => developer.login), ['open-dev']);
});

test('remote MCP forwards bearer credentials for introduction tools', async () => {
  let authorization;
  let requestBody;
  const fetchImpl = async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/agent/introductions');
    authorization = options.headers.Authorization;
    requestBody = JSON.parse(options.body);
    return Response.json({ request: { id: 'request-id', status: 'pending' } }, { status: 201 });
  };
  const response = await readMcpResponse(await handleRemoteMcpRequest(mcpRequest({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'request_introduction',
      arguments: {
        developerLogin: 'open-dev',
        reason: 'We need a maintainer for our open source React project.',
        project: 'Example UI',
      },
    },
  }, { Authorization: 'Bearer issued-agent-token' }), { fetchImpl }));
  assert.equal(response.result.isError, undefined);
  assert.equal(authorization, 'Bearer issued-agent-token');
  assert.equal(requestBody.developerLogin, 'open-dev');
});

test('remote MCP rejects untrusted browser origins and handles preflight', async () => {
  const denied = await handleRemoteMcpRequest(mcpRequest({
    jsonrpc: '2.0', id: 5, method: 'tools/list', params: {},
  }, { Origin: 'https://malicious.example' }));
  assert.equal(denied.status, 403);

  const preflight = handleMcpOptions(new Request('http://localhost:3000/mcp', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000' },
  }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3000');
});

test('stateless remote MCP rejects standalone GET and DELETE sessions', async () => {
  for (const method of ['GET', 'DELETE']) {
    const response = await handleRemoteMcpRequest(new Request('http://localhost:3000/mcp', {
      method,
      headers: { Accept: 'application/json, text/event-stream' },
    }));
    assert.equal(response.status, 405);
  }
});