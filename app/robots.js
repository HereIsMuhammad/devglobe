const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://dev-globe-viz.vercel.app');

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/card'],
      disallow: ['/api/auth/', '/api/developer', '/api/developers', '/api/search'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}