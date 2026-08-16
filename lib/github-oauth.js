export function buildGitHubAuthorizationUrl(clientId) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'read:user user:email');
  return url.toString();
}