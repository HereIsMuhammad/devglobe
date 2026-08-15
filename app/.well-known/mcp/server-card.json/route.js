import { getSiteUrl } from '../../../../lib/site.js';

export function GET() {
  const siteUrl = getSiteUrl();
  return Response.json({
    serverInfo: { name: 'devglobe', version: '1.0.0' },
    description: 'Search public developer profiles and request consent-gated introductions.',
    transport: {
      type: 'streamable-http',
      endpoint: `${siteUrl}/mcp`,
    },
    capabilities: {
      tools: {
        listChanged: false,
        names: [
          'search_developers',
          'get_developer_profile',
          'request_introduction',
          'get_introduction_status',
        ],
      },
      resources: false,
      prompts: false,
    },
    authentication: {
      publicTools: ['search_developers', 'get_developer_profile'],
      protectedTools: ['request_introduction', 'get_introduction_status'],
      scheme: 'bearer',
      documentation: `${siteUrl}/docs/mcp-server`,
    },
  }, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}