import { getSiteUrl } from '../../lib/site.js';

export function GET() {
  const siteUrl = getSiteUrl();
  return Response.json({
    openapi: '3.1.0',
    info: {
      title: 'DevGlobe Public API',
      version: '1.0.0',
      description: 'Public developer discovery and stateless MCP access. Private contact details are never returned.',
    },
    servers: [{ url: siteUrl }],
    paths: {
      '/api/search': {
        get: {
          operationId: 'searchDevelopers',
          summary: 'Search public developer profiles',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'top', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 10 } },
          ],
          responses: { 200: { description: 'Public developer search results' } },
        },
      },
      '/api/developer': {
        get: {
          operationId: 'getDeveloperProfile',
          summary: 'Get one public developer profile',
          parameters: [
            { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Public developer profile' }, 404: { description: 'Profile not found' } },
        },
      },
      '/mcp': {
        post: {
          operationId: 'callMcp',
          summary: 'Call the stateless DevGlobe Streamable HTTP MCP server',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { 200: { description: 'MCP JSON-RPC response' } },
        },
      },
    },
  }, {
    headers: {
      'Content-Type': 'application/openapi+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}