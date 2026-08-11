import { getSiteUrl } from '../lib/site.js';

const siteUrl = getSiteUrl();

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/share/', '/api/card', '/api/card/social', '/api/preview/'],
      disallow: ['/api/auth/', '/api/developer', '/api/developers', '/api/search'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}