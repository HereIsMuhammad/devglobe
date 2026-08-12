import { NextResponse } from 'next/server';

const MAX_USERS = 5;
const EVENTS_PER_USER = 4;
const AUTHENTICATED_CACHE_MS = 60 * 1000;
const ANONYMOUS_CACHE_MS = 5 * 60 * 1000;
const activityCache = new Map();

function describeEvent(event) {
  const repo = event.repo?.name || 'a repository';

  switch (event.type) {
    case 'PushEvent': {
      const count = event.payload?.commits?.length || event.payload?.size || 0;
      return `Pushed ${count || 'new'} commit${count === 1 ? '' : 's'} to ${repo}`;
    }
    case 'PullRequestEvent':
      return `${event.payload?.action || 'Updated'} pull request in ${repo}`;
    case 'IssuesEvent':
      return `${event.payload?.action || 'Updated'} an issue in ${repo}`;
    case 'IssueCommentEvent':
      return `Commented on an issue in ${repo}`;
    case 'CreateEvent':
      return `Created ${event.payload?.ref_type || 'content'} in ${repo}`;
    case 'ForkEvent':
      return `Forked ${repo}`;
    case 'WatchEvent':
      return `Starred ${repo}`;
    case 'ReleaseEvent':
      return `${event.payload?.action || 'Published'} a release in ${repo}`;
    default:
      return `Contributed to ${repo}`;
  }
}

async function fetchUserActivity(login, eventLimit) {
  const baseHeaders = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'DevGlobe',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const headers = process.env.GITHUB_TOKEN
    ? { ...baseHeaders, Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : baseHeaders;

  const url = `https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=${eventLimit}`;
  let response = await fetch(url, { headers, cache: 'no-store' });
  let usedAnonymousFallback = false;
  if (process.env.GITHUB_TOKEN && (response.status === 401 || response.status === 403)) {
    usedAnonymousFallback = true;
    response = await fetch(url, { headers: baseHeaders, cache: 'no-store' });
  }

  if (!response.ok) return [];
  const events = await response.json();
  const activities = events.map(event => ({
    id: event.id,
    login,
    avatarUrl: event.actor?.avatar_url || null,
    type: event.type,
    description: describeEvent(event),
    repo: event.repo?.name || null,
    url: event.repo?.name ? `https://github.com/${event.repo.name}` : `https://github.com/${login}`,
    createdAt: event.created_at,
  }));

  activityCache.set(`${login}:${eventLimit}`, {
    activities,
    expiresAt: Date.now() + (process.env.GITHUB_TOKEN && !usedAnonymousFallback
      ? AUTHENTICATED_CACHE_MS
      : ANONYMOUS_CACHE_MS),
  });
  return activities;
}

async function getUserActivity(login, eventLimit) {
  const cacheKey = `${login}:${eventLimit}`;
  const cached = activityCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) return Promise.resolve(cached.activities);

  try {
    const activities = await fetchUserActivity(login, eventLimit);
    if (!activityCache.has(cacheKey)) {
      activityCache.set(cacheKey, {
        activities,
        expiresAt: Date.now() + ANONYMOUS_CACHE_MS,
      });
    }
    return activities;
  } catch {
    activityCache.set(cacheKey, {
      activities: [],
      expiresAt: Date.now() + ANONYMOUS_CACHE_MS,
    });
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const logins = [...new Set(
    searchParams.get('logins')
      ?.split(',')
      .map(login => login.trim())
      .filter(login => /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) || []
  )].slice(0, MAX_USERS);

  if (logins.length === 0) {
    return NextResponse.json({ error: 'At least one valid login is required' }, { status: 400 });
  }

  const requestedLimit = Number.parseInt(searchParams.get('limit'), 10);
  const eventLimit = logins.length === 1 && Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 20)
    : EVENTS_PER_USER;
  const activities = (await Promise.all(
    logins.map(login => getUserActivity(login, eventLimit).catch(() => []))
  ))
    .flat()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  return NextResponse.json(activities, {
    headers: { 'Cache-Control': 'no-store' },
  });
}