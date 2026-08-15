import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import nextConfig from '../next.config.js';
import { GET as getSkillIndex } from '../app/.well-known/agent-skills/index.json/route.js';
import { GET as getApiCatalog } from '../app/.well-known/api-catalog/route.js';
import { GET as getMcpCard } from '../app/.well-known/mcp/server-card.json/route.js';
import { GET as getOpenApi } from '../app/openapi.json/route.js';
import { GET as getAuth } from '../app/auth.md/route.js';
import { GET as getRobots } from '../app/robots.txt/route.js';
import { middleware } from '../middleware.js';

test('advertises agent discovery resources from the homepage', async () => {
  const [{ headers }] = await nextConfig.headers();
  const link = headers.find(({ key }) => key === 'Link').value;

  assert.match(link, /rel="api-catalog"/);
  assert.match(link, /openapi\.json.*rel="service-desc"/);
  assert.match(link, /mcp\/server-card\.json/);
  assert.match(link, /agent-skills\/index\.json/);
  assert.match(link, /auth\.md/);
});

test('serves a valid API catalog and OpenAPI description', async () => {
  const catalogResponse = getApiCatalog();
  const catalog = await catalogResponse.json();
  assert.equal(catalogResponse.headers.get('content-type'), 'application/linkset+json');
  assert.equal(catalog.linkset[0].anchor.endsWith('/mcp'), true);

  const openApiResponse = getOpenApi();
  const openApi = await openApiResponse.json();
  assert.equal(openApiResponse.headers.get('content-type'), 'application/openapi+json');
  assert.equal(openApi.openapi, '3.1.0');
  assert.deepEqual(Object.keys(openApi.paths), ['/api/search', '/api/developer', '/mcp']);
});

test('describes the MCP server tools and authentication boundary', async () => {
  const card = await getMcpCard().json();
  assert.equal(card.transport.type, 'streamable-http');
  assert.equal(card.capabilities.tools.names.length, 4);
  assert.deepEqual(card.authentication.publicTools, ['search_developers', 'get_developer_profile']);
  assert.equal(card.authentication.scheme, 'bearer');

  const auth = await getAuth().text();
  assert.match(auth, /pre-issued agent credentials/);
  assert.match(auth, /does not operate an OAuth authorization server/);
});

test('publishes an Agent Skills digest matching the served artifact', async () => {
  const skill = await fs.readFile('.agents/skills/devglobe/SKILL.md', 'utf8');
  const expected = `sha256:${createHash('sha256').update(skill).digest('hex')}`;
  const response = await getSkillIndex();
  const index = await response.json();

  assert.equal(index.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json');
  assert.equal(index.skills[0].name, 'devglobe');
  assert.equal(index.skills[0].digest, expected);
});

test('publishes Content Signals in robots.txt', async () => {
  const response = getRobots();
  const robots = await response.text();
  assert.match(robots, /Content-Signal: ai-train=no, search=yes, ai-input=yes/);
});

test('negotiates a Markdown homepage with token metadata', async () => {
  const response = middleware(new Request('https://www.devglobe.dev/', {
    headers: { Accept: 'text/markdown' },
  }));

  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(response.headers.get('vary'), 'Accept');
  assert.ok(Number(response.headers.get('x-markdown-tokens')) > 0);
  assert.match(await response.text(), /# DevGlobe/);
});