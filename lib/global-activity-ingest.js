import { getCosmosContainer } from './cosmos.js';
import { normalizeGitHubEvent } from './github-activity.js';
import { saveActivities } from './activity-store.js';

const LOGIN_CACHE_MS = 60 * 60 * 1000;
let loginCache = null;

async function getIndexedLogins() {
  if (loginCache?.expiresAt > Date.now()) return loginCache.logins;

  const container = getCosmosContainer();
  if (!container) return null;
  const { resources } = await container.items.query({
    query: 'SELECT VALUE LOWER(c.login) FROM c WHERE IS_DEFINED(c.login) AND (NOT IS_DEFINED(c.nomination) OR c.nomination.status = "approved")',
  }).fetchAll();
  const logins = new Set(resources);
  loginCache = { logins, expiresAt: Date.now() + LOGIN_CACHE_MS };
  return logins;
}

function githubHeaders(authenticated = true) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'DevGlobe',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (authenticated && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

export async function ingestGlobalActivities({ pages = 3 } = {}) {
  const indexedLogins = await getIndexedLogins();
  const matched = new Map();
  let fetched = 0;
  let pollInterval = 60;
  let rateLimitRemaining = null;
  let rateLimitReset = null;
  let authenticated = Boolean(process.env.GITHUB_TOKEN);

  for (let page = 1; page <= pages; page += 1) {
    const url = `https://api.github.com/events?per_page=100&page=${page}`;
    let response = await fetch(url, {
      headers: githubHeaders(authenticated),
      cache: 'no-store',
    });
    if (authenticated && (response.status === 401 || response.status === 403)) {
      authenticated = false;
      response = await fetch(url, { headers: githubHeaders(false), cache: 'no-store' });
    }
    pollInterval = Number.parseInt(response.headers.get('x-poll-interval'), 10) || pollInterval;
    rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    rateLimitReset = response.headers.get('x-ratelimit-reset');
    if (!response.ok) {
      const error = new Error(`GitHub Events API returned ${response.status}`);
      error.status = response.status;
      error.retryAfter = response.headers.get('retry-after');
      throw error;
    }

    const events = await response.json();
    fetched += events.length;
    events.forEach(event => {
      const login = event.actor?.login;
      if (!login || (indexedLogins && !indexedLogins.has(login.toLowerCase()))) return;
      const activity = normalizeGitHubEvent(event);
      if (activity) matched.set(activity.id, activity);
    });
    if (events.length < 100 || !authenticated) break;
  }

  const result = await saveActivities([...matched.values()]);
  return {
    fetched,
    matched: matched.size,
    inserted: result.inserted,
    ingestedAt: result.ingestedAt,
    pollInterval,
    rateLimitRemaining: rateLimitRemaining === null ? null : Number(rateLimitRemaining),
    rateLimitReset: rateLimitReset === null ? null : Number(rateLimitReset),
    authenticated,
  };
}