import { getSiteUrl } from '../../../lib/site.js';

export function GET() {
  const siteUrl = getSiteUrl();
  return Response.json({
    linkset: [
      {
        anchor: `${siteUrl}/mcp`,
        'service-desc': [
          { href: `${siteUrl}/openapi.json`, type: 'application/openapi+json' },
        ],
        'service-doc': [
          { href: `${siteUrl}/docs/mcp-server`, type: 'text/markdown' },
        ],
      },
    ],
  }, {
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}