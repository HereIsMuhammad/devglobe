import { getSiteUrl } from '../../lib/site.js';

export function GET() {
  const siteUrl = getSiteUrl();
  const body = `User-agent: *
Allow: /
Allow: /share/
Allow: /mcp
Allow: /api/card
Allow: /api/card/social
Allow: /api/preview/
Disallow: /api/auth/
Disallow: /api/developer
Disallow: /api/developers
Disallow: /api/search
Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: ${siteUrl}/sitemap.xml
Host: ${siteUrl}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}