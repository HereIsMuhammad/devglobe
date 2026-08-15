import { getSiteUrl } from '../../lib/site.js';

export function GET() {
  const siteUrl = getSiteUrl();
  const body = `# DevGlobe Agent Authentication

## Public access

The \`search_developers\` and \`get_developer_profile\` MCP tools are public and require no credentials.

## Protected introduction tools

The \`request_introduction\` and \`get_introduction_status\` tools require a DevGlobe-issued bearer token. DevGlobe currently uses pre-issued agent credentials and does not operate an OAuth authorization server or dynamic client registration endpoint.

Send the token only to ${siteUrl}/mcp using the \`Authorization: Bearer <token>\` header. Never place it in a repository or URL.

See ${siteUrl}/docs/mcp-server for credential issuance and consent lifecycle details.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}