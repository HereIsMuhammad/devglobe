import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth.js';
import { buildPersonalizedFeed, decodeFeedCursor } from '../../../lib/feed.js';
import { listCandidateFeedEvents } from '../../../lib/feed-store.js';
import { getWatchlist, markAllRead, markRead } from '../../../lib/watchlist-store.js';

export async function GET(request) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '30', 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30;

  const cursorValue = searchParams.get('cursor');
  const cursor = decodeFeedCursor(cursorValue);
  if (cursorValue && !cursor) {
    return NextResponse.json({ error: 'Invalid feed cursor' }, { status: 400 });
  }

  const filters = {
    developers: searchParams.getAll('developer'),
    projects: searchParams.getAll('project'),
    languages: searchParams.getAll('language'),
    countries: searchParams.getAll('country'),
    eventTypes: searchParams.getAll('eventType'),
  };
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  try {
    const [watchlist, candidates] = await Promise.all([
      getWatchlist(session.login),
      listCandidateFeedEvents(),
    ]);

    const result = buildPersonalizedFeed(candidates, { watchlist, cursor, limit, filters, unreadOnly });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Personalized feed query failed:', error.message);
    return NextResponse.json({ error: 'Unable to load feed' }, { status: 503 });
  }
}

export async function PATCH(request) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    if (body.markAllRead) {
      const candidates = await listCandidateFeedEvents();
      const now = new Date().toISOString();
      const latest = candidates.length ? candidates.reduce((max, e) => (e.createdAt > max.createdAt ? e : max)) : null;
      const cursor = latest ? { createdAt: latest.createdAt, id: latest.id } : { createdAt: now, id: '' };
      const watchlist = await markAllRead(session.login, cursor);
      return NextResponse.json({ readState: watchlist.readState });
    }

    if (Array.isArray(body.eventIds) && body.eventIds.length) {
      const watchlist = await markRead(session.login, body.eventIds);
      return NextResponse.json({ readState: watchlist.readState });
    }

    return NextResponse.json({ error: 'eventIds or markAllRead is required' }, { status: 400 });
  } catch (error) {
    console.error('Feed read-state update failed:', error.message);
    return NextResponse.json({ error: 'Unable to update read state' }, { status: 500 });
  }
}
